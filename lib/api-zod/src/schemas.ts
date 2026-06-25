import { z } from "zod";

export const ConnectionConfigSchema = z.object({
  host: z.string(),
  port: z.number().int(),
  username: z.string(),
  password: z.string(),
});
export type ConnectionConfig = z.infer<typeof ConnectionConfigSchema>;

export const ConnectionProfileSchema = ConnectionConfigSchema.extend({
  id: z.string(),
  name: z.string(),
});
export type ConnectionProfile = z.infer<typeof ConnectionProfileSchema>;

export const SessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["connecting", "connected", "disconnected", "error"]),
  createdAt: z.string(),
});
export type Session = z.infer<typeof SessionSchema>;

export const FileItemSchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(["file", "directory", "symlink"]),
  size: z.number(),
  modifiedAt: z.string(),
  permissions: z.string(),
});
export type FileItem = z.infer<typeof FileItemSchema>;

export const RemoteProcessSchema = z.object({
  pid: z.number(),
  name: z.string(),
  cpu: z.number(),
  memory: z.number(),
  status: z.enum(["running", "not responding"]),
  user: z.string(),
});
export type RemoteProcess = z.infer<typeof RemoteProcessSchema>;

export const SavedCommandSchema = z.object({
  id: z.string(),
  label: z.string(),
  command: z.string(),
  description: z.string().optional().default(""),
});
export type SavedCommand = z.infer<typeof SavedCommandSchema>;

export const TestResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  latencyMs: z.number(),
});
export type TestResult = z.infer<typeof TestResultSchema>;

export const SuccessResponseSchema = z.object({
  success: z.boolean(),
});
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;

export const ErrorResponseSchema = z.object({
  error: z.string(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
