import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { sendError } from "./http.js";

export function timingSafeTokenEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compare against a same-length buffer to avoid a length-based timing leak.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const API_TOKEN = process.env.API_TOKEN;
  if (!API_TOKEN) {
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(res, 401, "AUTH_REQUIRED", "Missing Authorization header");
  }
  const token = authHeader.slice(7);
  if (!timingSafeTokenEqual(token, API_TOKEN)) {
    return sendError(res, 401, "AUTH_INVALID", "Invalid API token");
  }
  next();
}
