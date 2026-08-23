import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const OTP_TTL_MINUTES = 10;

async function sendEmailOtp(email: string, otp: string): Promise<void> {
  console.log(`[OTP] Email: ${email}  OTP: ${otp}`);
  const resendKey = process.env["RESEND_API_KEY"];
  if (!resendKey) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "KAP Edutech <noreply@prayaaseducation.co.in>",
        to: [email],
        subject: `${otp} — Your KAP Edutech Login OTP`,
        html: `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #E5E7EB"><h2 style="color:#111827;margin:0 0 8px;font-size:20px">Your Login OTP</h2><p style="color:#6B7280;margin:0 0 24px;font-size:14px">Use this code to sign in to KAP Edutech Parent Portal.</p><div style="background:#EEF2FF;border-radius:10px;padding:20px;text-align:center;letter-spacing:8px;font-size:32px;font-weight:800;color:#4F46E5">${otp}</div><p style="color:#9CA3AF;font-size:12px;margin:20px 0 0">Valid for 10 minutes. Do not share this code with anyone.</p></div>`,
      }),
    });
  } catch (e) {
    console.error("[OTP] Email send error:", e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json() as { email?: string };

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ message: "A valid email address is required." }, { status: 400 });
    }

    const parent = await prisma.parent.findFirst({ where: { email } });
    if (!parent) return Response.json({ message: "No account found for this email." }, { status: 404 });

    await prisma.otp.updateMany({ where: { phone: email, verified: false }, data: { verified: true } });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await prisma.otp.create({ data: { phone: email, otp, expiresAt } });

    // Respond immediately, send email in background
    sendEmailOtp(email, otp).catch(e => console.error("[OTP] bg send error:", e));

    return Response.json({ message: "OTP sent to email." });
  } catch (e) {
    console.error("[request-otp-email]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
