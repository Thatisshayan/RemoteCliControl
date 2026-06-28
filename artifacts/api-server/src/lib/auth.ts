import type { Request, Response, NextFunction } from "express";

const API_TOKEN = process.env.API_TOKEN;

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!API_TOKEN) {
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }
  const token = authHeader.slice(7);
  if (token !== API_TOKEN) {
    return res.status(401).json({ error: "Invalid API token" });
  }
  next();
}
