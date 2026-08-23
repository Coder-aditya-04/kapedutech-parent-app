import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const OTP_TTL_MINUTES = 10;

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json() as { phone?: string };

    if (!phone || !/^\d{10}$/.test(phone)) {
      return Response.json({ message: "A valid 10-digit phone number is required." }, { status: 400 });
    }

    const parent = await prisma.parent.findFirst({ where: { phone } });
    if (!parent) {
      return Response.json({ message: "No parent account found for this number." }, { status: 404 });
    }

    await prisma.otp.updateMany({ where: { phone, verified: false }, data: { verified: true } });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await prisma.otp.create({ data: { phone, otp, expiresAt } });

    const fast2smsKey = process.env["FAST2SMS_API_KEY"];
    if (fast2smsKey) {
      try {
        await fetch("https://www.fast2sms.com/dev/bulkV2", {
          method: "POST",
          headers: { authorization: fast2smsKey, "Content-Type": "application/json" },
          body: JSON.stringify({ route: "otp", variables_values: otp, numbers: phone }),
        });
      } catch (e) {
        console.error("[OTP] SMS error:", e);
      }
    } else {
      console.log(`[OTP] Phone: ${phone}  OTP: ${otp}`);
    }

    return Response.json({ message: "OTP sent successfully." });
  } catch (e) {
    console.error("[request-otp]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
