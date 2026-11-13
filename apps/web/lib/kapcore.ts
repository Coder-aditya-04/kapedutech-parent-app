// The link to KAP Core (the staff platform), which OWNS homework.
// The parent app only reads it; it never writes homework or checks.
//
//   KAPCORE_URL                 e.g. https://core.kapedutech.in
//   KAPCORE_API_KEY             same value as KAP_CONNECT_API_KEY in KAP Core
//   KAPCORE_WEBHOOK_SECRET      same value as KAP_CONNECT_WEBHOOK_SECRET in KAP Core

export type HomeworkStatus = "done" | "partial" | "not_done" | "pending";

export type HomeworkItem = {
  student_roll: string;
  homework_id: string;
  kc_batch_id: string;
  subject: string;
  title: string;
  details: string | null;
  assigned_on: string;
  due_on: string;
  set_by: string;
  status: HomeworkStatus;
  checked_at: string | null;
};

export function kapcoreConfigured(): boolean {
  return !!process.env["KAPCORE_URL"] && !!process.env["KAPCORE_API_KEY"];
}

/** Homework for the given roll numbers. Throws when KAP Core cannot be reached. */
export async function fetchHomework(rolls: string[], since?: string): Promise<HomeworkItem[]> {
  const base = process.env["KAPCORE_URL"]!.replace(/\/$/, "");
  const url = new URL(`${base}/api/connect/homework`);
  url.searchParams.set("rolls", rolls.join(","));
  if (since) url.searchParams.set("since", since);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env["KAPCORE_API_KEY"]}` },
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KAP Core answered ${res.status}`);
  const body = (await res.json()) as { homework: HomeworkItem[] };
  return body.homework;
}
