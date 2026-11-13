import { prisma } from "@/lib/prisma";

// Each wrong guess takes this much time off the code's life. With a 10 minute
// code that allows at most 5 wrong guesses, which stops brute-forcing the
// 6-digit code without needing a schema change for an attempts counter.
const WRONG_GUESS_PENALTY_MS = 2 * 60 * 1000;

export type OtpCheck = "ok" | "invalid" | "expired";

/** Checks `otp` against the newest pending code for `identifier` (phone or email). */
export async function consumeOtp(identifier: string, otp: string): Promise<OtpCheck> {
  const record = await prisma.otp.findFirst({
    where: { phone: identifier, verified: false },
    orderBy: { expiresAt: "desc" },
  });
  if (!record) return "invalid";
  if (record.expiresAt < new Date()) return "expired";

  if (record.otp !== otp) {
    await prisma.otp.update({
      where: { id: record.id },
      data: { expiresAt: new Date(record.expiresAt.getTime() - WRONG_GUESS_PENALTY_MS) },
    });
    return "invalid";
  }

  await prisma.otp.update({ where: { id: record.id }, data: { verified: true } });
  return "ok";
}
