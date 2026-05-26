import { Router } from "express";
import { requestOtp, verifyOtp, savePushToken, requestOtpByEmail, verifyOtpByEmail, verifyFirebasePhone } from "../controllers/auth.controller.js";
import { prisma } from "../lib/prisma.js";
import type { Request, Response } from "express";

const router = Router();

router.post("/parent/request-otp", requestOtp);
router.post("/parent/verify-otp", verifyOtp);
router.post("/parent/request-otp-email", requestOtpByEmail);
router.post("/parent/verify-otp-email", verifyOtpByEmail);
router.post("/parent/push-token", savePushToken);
router.post("/parent/firebase-verify", verifyFirebasePhone);
router.get("/parent/check-phone/:phone", async (req: Request, res: Response) => {
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
