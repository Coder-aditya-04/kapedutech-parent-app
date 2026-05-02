import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { verifyFirebaseIdToken } from "../lib/firebase.js";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev_secret_change_in_prod";
const OTP_TTL_MINUTES = 10;

export async function requestOtp(req: Request, res: Response): Promise<void> {
  const { phone } = req.body as { phone?: string };

  if (!phone || !/^\d{10}$/.test(phone)) {
    res.status(400).json({ message: "A valid 10-digit phone number is required." });
    return;
  }

  const parent = await prisma.parent.findFirst({ where: { phone } });
  if (!parent) {
    res.status(404).json({ message: "No parent account found for this number." });
    return;
  }

  // Invalidate any previous unused OTPs for this phone
  await prisma.otp.updateMany({
    where: { phone, verified: false },
    data: { verified: true },
  });

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.otp.create({ data: { phone, otp, expiresAt } });

  // Send OTP via Fast2SMS (India) if API key is set, otherwise log to console
  const fast2smsKey = process.env["FAST2SMS_API_KEY"];
  if (fast2smsKey) {
    try {
      const smsRes = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: fast2smsKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          route: "otp",
          variables_values: otp,
          numbers: phone,
        }),
      });
      const smsData = await smsRes.json() as { return: boolean; message?: string[] };
      if (!smsData.return) {
        console.error(`[OTP] SMS failed:`, smsData.message);
      } else {
        console.log(`[OTP] SMS sent to ${phone}`);
      }
    } catch (e) {
      console.error(`[OTP] SMS error:`, e);
    }
  } else {
    // Development fallback — read from Render/server logs
    console.log(`[OTP] Phone: ${phone}  OTP: ${otp}  Expires: ${expiresAt.toISOString()}`);
  }

  res.status(200).json({ message: "OTP sent successfully." });
}

export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const { phone, otp } = req.body as { phone?: string; otp?: string };

  if (!phone || !otp) {
    res.status(400).json({ message: "phone and otp are required." });
    return;
  }

  const record = await prisma.otp.findFirst({
    where: { phone, otp, verified: false },
    orderBy: { expiresAt: "desc" },
  });

  if (!record) {
    res.status(401).json({ message: "Invalid OTP." });
    return;
  }

  if (record.expiresAt < new Date()) {
    res.status(401).json({ message: "OTP has expired. Please request a new one." });
    return;
  }

  await prisma.otp.update({ where: { id: record.id }, data: { verified: true } });

  const parent = await prisma.parent.findFirst({
    where: { phone },
    include: {
      students: {
        select: {
          id: true,
          name: true,
          enrollmentNo: true,
          qrCode: true,
        },
      },
    },
  });

  if (!parent) {
    res.status(404).json({ message: "Parent not found." });
    return;
  }

  const token = jwt.sign({ parentId: parent.id, phone: parent.phone }, JWT_SECRET, {
    expiresIn: "30d",
  });

  res.status(200).json({
    token,
    parent: {
      id: parent.id,
      name: parent.name,
      phone: parent.phone,
      students: parent.students,
    },
  });
}

async function sendEmailOtp(email: string, otp: string): Promise<void> {
  // Always log OTP so it's visible in Render logs as fallback
  console.log(`[OTP] Email: ${email}  OTP: ${otp}`);
  const resendKey = process.env["RESEND_API_KEY"];
  if (!resendKey) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "KAP Edutech <noreply@prayaaseducation.co.in>",
        to: [email],
        subject: `${otp} — Your KAP Edutech Login OTP`,
        html: `
          <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #E5E7EB">
            <h2 style="color:#111827;margin:0 0 8px;font-size:20px">Your Login OTP</h2>
            <p style="color:#6B7280;margin:0 0 24px;font-size:14px">Use this code to sign in to KAP Edutech Parent Portal.</p>
            <div style="background:#EEF2FF;border-radius:10px;padding:20px;text-align:center;letter-spacing:8px;font-size:32px;font-weight:800;color:#4F46E5">${otp}</div>
            <p style="color:#9CA3AF;font-size:12px;margin:20px 0 0">Valid for 10 minutes. Do not share this code with anyone.</p>
          </div>`,
      }),
    });
    const data = await res.json() as { id?: string; message?: string; name?: string };
    if (res.ok) {
      console.log(`[OTP] Email delivered via Resend, id: ${data.id}`);
    } else {
      console.error(`[OTP] Resend error:`, data.message ?? data.name);
    }
  } catch (e) {
    console.error(`[OTP] Email send error:`, e);
  }
}

export async function requestOtpByEmail(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ message: "A valid email address is required." });
    return;
  }
  const parent = await prisma.parent.findFirst({ where: { email } });
  if (!parent) {
    res.status(404).json({ message: "No account found for this email." });
    return;
  }
  await prisma.otp.updateMany({ where: { phone: email, verified: false }, data: { verified: true } });
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  await prisma.otp.create({ data: { phone: email, otp, expiresAt } });
  // Respond immediately — send email in background so app doesn't wait
  res.status(200).json({ message: "OTP sent to email." });
  sendEmailOtp(email, otp).catch(e => console.error("[OTP] background send error:", e));
}

export async function verifyOtpByEmail(req: Request, res: Response): Promise<void> {
  const { email, otp } = req.body as { email?: string; otp?: string };
  if (!email || !otp) {
    res.status(400).json({ message: "email and otp are required." });
    return;
  }
  const record = await prisma.otp.findFirst({
    where: { phone: email, otp, verified: false },
    orderBy: { expiresAt: "desc" },
  });
  if (!record) { res.status(401).json({ message: "Invalid OTP." }); return; }
  if (record.expiresAt < new Date()) { res.status(401).json({ message: "OTP expired. Request a new one." }); return; }
  await prisma.otp.update({ where: { id: record.id }, data: { verified: true } });
  const parent = await prisma.parent.findFirst({
    where: { email },
    include: { students: { select: { id: true, name: true, enrollmentNo: true, qrCode: true } } },
  });
  if (!parent) { res.status(404).json({ message: "Parent not found." }); return; }
  const token = jwt.sign({ parentId: parent.id, email: parent.email }, JWT_SECRET, { expiresIn: "30d" });
  res.status(200).json({ token, parent: { id: parent.id, name: parent.name, phone: parent.phone, email: parent.email, students: parent.students } });
}

export async function savePushToken(req: Request, res: Response): Promise<void> {
  const { parentId, pushToken } = req.body as { parentId?: string; pushToken?: string };

  if (!parentId || !pushToken) {
    res.status(400).json({ message: "parentId and pushToken are required." });
    return;
  }

  await prisma.parent.update({ where: { id: parentId }, data: { pushToken } });

  res.status(200).json({ message: "Push token saved." });
}

export async function verifyFirebasePhone(req: Request, res: Response): Promise<void> {
  const { idToken } = req.body as { idToken?: string };

  if (!idToken) {
    res.status(400).json({ message: "idToken is required." });
    return;
  }

  let phone: string;
  try {
    ({ phone } = await verifyFirebaseIdToken(idToken));
  } catch (e) {
    console.error("[Firebase] verifyIdToken failed:", e);
    res.status(401).json({ message: "Firebase token verification failed. Check Render logs." });
    return;
  }

  // Normalize phone: Firebase gives +91XXXXXXXXXX, we store 10 digits
  const normalizedPhone = phone.replace(/^\+91/, "");

  const parent = await prisma.parent.findFirst({
    where: { phone: normalizedPhone },
    include: {
      students: {
        select: { id: true, name: true, enrollmentNo: true, batch: true, qrCode: true },
      },
    },
  });

  if (!parent) {
    res.status(404).json({ message: "No parent account found for this number. Contact your institute." });
    return;
  }

  const token = jwt.sign({ parentId: parent.id, phone: parent.phone }, JWT_SECRET, { expiresIn: "30d" });

  res.status(200).json({
    token,
    parent: {
      id: parent.id,
      name: parent.name,
      phone: parent.phone,
      students: parent.students,
    },
  });
}
