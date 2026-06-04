import { Router } from "express";
import { requestOtp, verifyOtp, savePushToken, requestOtpByEmail, verifyOtpByEmail, verifyFirebasePhone } from "../controllers/auth.controller.js";
import { prisma } from "../lib/prisma.js";
import type { Request, Response, NextFunction } from "express";

const router = Router();

// ── In-memory rate limiter ────────────────────────────────────────────────────
// Tracks { key -> { count, resetAt } }. No external package needed.
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function rateLimit(windowMs: number, max: number, keyFn: (req: Request) => string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyFn(req);
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (entry.count >= max) {
      const waitSec = Math.ceil((entry.resetAt - now) / 1000);
      res.status(429).json({ message: `Too many attempts. Please wait ${waitSec} seconds before trying again.` });
      return;
    }

    entry.count++;
    next();
  };
}

// Clean up expired entries every 10 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitStore.entries()) {
    if (now > val.resetAt) rateLimitStore.delete(key);
  }
}, 10 * 60 * 1000);

// ── Rate limit configs ────────────────────────────────────────────────────────
// check-phone: 10 checks per phone per 10 minutes (generous, just blocks abuse)
const checkPhoneLimit = rateLimit(10 * 60 * 1000, 10, (req) => `cp:${req.params["phone"]}`);

// firebase-verify: 5 verify attempts per phone per hour
const firebaseVerifyLimit = rateLimit(60 * 60 * 1000, 5, (req) => {
  const body = req.body as { idToken?: string };
  return `fv:${body.idToken?.slice(-20) ?? req.ip}`;
});

// request-otp-email: 3 email OTPs per email per 30 minutes
const emailOtpRequestLimit = rateLimit(30 * 60 * 1000, 3, (req) => {
  const body = req.body as { email?: string };
  return `eotp:${body.email ?? req.ip}`;
});

// verify-otp-email: 5 verify attempts per email per hour
const emailVerifyLimit = rateLimit(60 * 60 * 1000, 5, (req) => {
  const body = req.body as { email?: string };
  return `ev:${body.email ?? req.ip}`;
});

// request-otp (SMS legacy): 3 OTPs per phone per hour
const smsOtpRequestLimit = rateLimit(60 * 60 * 1000, 3, (req) => {
  const body = req.body as { phone?: string };
  return `sotp:${body.phone ?? req.ip}`;
});

// ── Routes ────────────────────────────────────────────────────────────────────
router.post("/parent/request-otp", smsOtpRequestLimit, requestOtp);
router.post("/parent/verify-otp", verifyOtp);
router.post("/parent/request-otp-email", emailOtpRequestLimit, requestOtpByEmail);
router.post("/parent/verify-otp-email", emailVerifyLimit, verifyOtpByEmail);
router.post("/parent/push-token", savePushToken);
router.post("/parent/firebase-verify", firebaseVerifyLimit, verifyFirebasePhone);

router.get("/parent/check-phone/:phone", checkPhoneLimit, async (req: Request, res: Response) => {
  const { phone } = req.params as { phone: string };
  if (!/^\d{10}$/.test(phone)) { res.status(400).json({ registered: false }); return; }
  const parent = await prisma.parent.findFirst({ where: { phone }, select: { id: true } });
  res.status(200).json({ registered: !!parent });
});

router.get("/parent/students/:parentId", async (req: Request, res: Response) => {
  const parentId = req.params["parentId"] as string;
  const students = await prisma.student.findMany({ where: { parentId } });
  res.json(students);
});

export default router;
