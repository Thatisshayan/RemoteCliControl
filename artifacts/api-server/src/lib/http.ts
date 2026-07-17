import type { Request, Response } from "express";
import type { ZodType } from "zod";

export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function sendError(res: Response, status: number, code: string, message: string, details?: unknown) {
  return res.status(status).json({
    error: message,
    code,
    ...(details === undefined ? {} : { details }),
  });
}

export function parseBody<T>(schema: ZodType<T>, req: Request): T {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid request body", parsed.error.flatten());
  }
  return parsed.data;
}

export function parseQuery<T>(schema: ZodType<T>, req: Request): T {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid query parameters", parsed.error.flatten());
  }
  return parsed.data;
}

export function parseParams<T>(schema: ZodType<T>, req: Request): T {
  const parsed = schema.safeParse(req.params);
  if (!parsed.success) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid route parameters", parsed.error.flatten());
  }
  return parsed.data;
}
