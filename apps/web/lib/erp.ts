import admin from "firebase-admin";

// Read-only link to the Unacademy Nashik ERP (Firebase project
// "unacademy-nashik-erp"), which OWNS fees. The parent app never writes there
// and keeps no copy: each request reads the child's admission live.
//
//   ERP_FIREBASE_SERVICE_ACCOUNT   service-account JSON for unacademy-nashik-erp

const APP_NAME = "erp";

export function erpConfigured(): boolean {
  return !!process.env["ERP_FIREBASE_SERVICE_ACCOUNT"];
}

function erpDb(): admin.firestore.Firestore {
  const existing = admin.apps.find(a => a?.name === APP_NAME);
  const app =
    existing ??
    admin.initializeApp(
      {
        credential: admin.credential.cert(
          JSON.parse(process.env["ERP_FIREBASE_SERVICE_ACCOUNT"]!) as admin.ServiceAccount
        ),
      },
      APP_NAME
    );
  return app.firestore();
}

export type FeePayment = { amount: number; mode: string | null; date: string | null; type: string | null };

export type FeeAccount = {
  id: string;
  program: string | null;
  rollNumber: string | null;
  status: string | null;
  totalFee: number;
  paid: number;
  balance: number;
  nextDueDate: string | null; // YYYY-MM-DD
  payments: FeePayment[];
};

type Raw = Record<string, unknown>;

function toIsoDay(v: unknown): string | null {
  if (!v) return null;
  let d: Date | null = null;
  if (v instanceof admin.firestore.Timestamp) d = v.toDate();
  else if (v instanceof Date) d = v;
  else if (typeof v === "object" && v && "seconds" in v) d = new Date(Number((v as { seconds: number }).seconds) * 1000);
  else if (typeof v === "string") {
    // The ERP stores both YYYY-MM-DD and DD/MM/YYYY.
    const dmY = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmY) return `${dmY[3]}-${dmY[2]!.padStart(2, "0")}-${dmY[1]!.padStart(2, "0")}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    d = new Date(v);
  }
  if (!d || isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Only the money fields leave the ERP: no proof images, staff names, phones or notes.
function toAccount(id: string, d: Raw): FeeAccount {
  const totalFee = num(d["amount"]);
  const paid = num(d["totalPaid"]);
  const payments = Array.isArray(d["payments"]) ? (d["payments"] as Raw[]) : [];
  return {
    id,
    program: (d["program"] as string) ?? null,
    rollNumber: d["rollNumber"] != null ? String(d["rollNumber"]) : null,
    status: (d["status"] as string) ?? null,
    totalFee,
    paid,
    balance: Math.max(0, totalFee - paid),
    nextDueDate: toIsoDay(d["nextPaymentDate"]),
    payments: payments
      .map(p => ({
        amount: num(p["amount"]),
        mode: (p["mode"] as string) ?? null,
        date: toIsoDay(p["date"]),
        type: (p["type"] as string) ?? null,
      }))
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
  };
}

const HIDDEN_STATUSES = new Set(["REJECTED", "CANCELLED", "DELETED"]);

/**
 * The child's fee account(s). Matched by roll number first (the parent app's
 * enrollmentNo); if nothing matches, by the parent's phone on the admission,
 * skipping admissions that carry a sibling's roll number.
 */
export async function fetchFees(
  rollNumber: string,
  parentPhone: string,
  siblingRolls: string[] = []
): Promise<FeeAccount[]> {
  const db = erpDb();
  const col = db.collection("admissions");
  let docs = rollNumber ? (await col.where("rollNumber", "==", rollNumber).limit(5).get()).docs : [];
  if (docs.length === 0 && /^\d{10}$/.test(parentPhone)) {
    const byPhone = await Promise.all([
      col.where("phone", "==", parentPhone).limit(5).get(),
      col.where("parentPhone", "==", parentPhone).limit(5).get(),
    ]);
    const seen = new Map<string, admin.firestore.QueryDocumentSnapshot>();
    for (const s of byPhone) for (const d of s.docs) seen.set(d.id, d);
    // A parent's phone is on every child's admission, so drop any that
    // belong to a sibling, or one child would show another's fees.
    const siblings = new Set(siblingRolls.filter(Boolean));
    docs = [...seen.values()].filter(d => !siblings.has(String(d.get("rollNumber") ?? "")));
  }
  return docs
    .map(d => toAccount(d.id, d.data()))
    .filter(a => !HIDDEN_STATUSES.has(String(a.status ?? "").toUpperCase()));
}
