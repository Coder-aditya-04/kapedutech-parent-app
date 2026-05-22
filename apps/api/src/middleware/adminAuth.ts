import type { Request, Response, NextFunction } from "express";

const ADMIN_SECRET = process.env["ADMIN_SECRET"];

export function requireAdminSecret(req: Request, res: Response, next: NextFunction): void {
  if (!ADMIN_SECRET) {
    // No secret configured — block all admin access
    res.status(503).json({ message: "Admin access is not configured." });
    return;
  }
  const header = req.headers["x-admin-secret"];
  if (!header || header !== ADMIN_SECRET) {
    res.status(401).json({ message: "Unauthorized." });
    return;
  }
  next();
}
