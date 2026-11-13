import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

export function parentToken(parentId: string, secret = "test-jwt-secret"): string {
  return jwt.sign({ parentId }, secret, { expiresIn: "1h" });
}

export function req(url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
  return new NextRequest(new URL(url, "http://localhost"), init);
}

export const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
