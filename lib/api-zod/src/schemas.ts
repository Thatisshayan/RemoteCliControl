import { z } from "zod";

const NonEmptyStringSchema = z.string().trim().min(1);
const AbsolutePathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine((value) => value.startsWith("/"), "Path must start with /")
  .refine((value) => !value.includes("\0"), "Path contains null bytes")
  .refine((value) => !value.includes(".."), "Invalid path");

export const PasswordAuthConnectionInputSchema = z.object({
  host: NonEmptyStringSchema.max(255),
  port: z.number().int().min(1).max(65535),
  username: NonEmptyStringSchema,
  password: NonEmptyStringSchema,
  authMode: z.literal("password").default("password"),
});
export type PasswordAuthConnectionInput = z.infer<typeof PasswordAuthConnectionInputSchema>;

export const KeyAuthConnectionInputSchema = z.object({
  host: NonEmptyStringSchema.max(255),
  port: z.number().int().min(1).max(65535),
  username: NonEmptyStringSchema,
  privateKey: NonEmptyStringSchema,
  passphrase: z.string().optional(),
  authMode: z.literal("key").default("key"),
});
export type KeyAuthConnectionInput = z.infer<typeof KeyAuthConnectionInputSchema>;

export const ConnectionInputSchema = z.union([
  PasswordAuthConnectionInputSchema,
  KeyAuthConnectionInputSchema,
]);
export type ConnectionInput = z.infer<typeof ConnectionInputSchema>;

export const NamedConnectionInputSchema = z.intersection(
  z.object({ name: NonEmptyStringSchema.max(100) }),
  ConnectionInputSchema,
);
export type NamedConnectionInput = z.infer<typeof NamedConnectionInputSchema>;

export const ConnectionProfileSecretSchema = z.object({
  id: z.string(),
  name: NonEmptyStringSchema.max(100),
  host: NonEmptyStringSchema.max(255),
  port: z.number().int().min(1).max(65535),
  username: NonEmptyStringSchema,
  authMode: z.enum(["password", "key"]),
  password: z.string().optional(),
  privateKey: z.string().optional(),
  passphrase: z.string().optional(),
});
export type ConnectionProfileSecret = z.infer<typeof ConnectionProfileSecretSchema>;

export const ConnectionProfileSafeSchema = z.object({
  id: z.string(),
  name: NonEmptyStringSchema.max(100),
  host: NonEmptyStringSchema.max(255),
  port: z.number().int().min(1).max(65535),
  username: NonEmptyStringSchema,
  authMode: z.enum(["password", "key"]),
  hasPassword: z.boolean(),
  hasPrivateKey: z.boolean(),
  hasPassphrase: z.boolean(),
});
export type ConnectionProfileSafe = z.infer<typeof ConnectionProfileSafeSchema>;

export const ConnectionProfileSchema = ConnectionProfileSafeSchema;
export type ConnectionProfile = ConnectionProfileSafe;
export const ConnectionConfigSchema = ConnectionInputSchema;
export type ConnectionConfig = ConnectionInput;

export const SessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["connecting", "connected", "disconnected", "error"]),
  createdAt: z.string(),
});
export type Session = z.infer<typeof SessionSchema>;

export const SessionRenameInputSchema = z.object({
  title: z.string().trim().min(1).max(100),
});
export type SessionRenameInput = z.infer<typeof SessionRenameInputSchema>;

export const FileItemSchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(["file", "directory", "symlink"]),
  size: z.number(),
  modifiedAt: z.string(),
  permissions: z.string(),
});
export type FileItem = z.infer<typeof FileItemSchema>;

export const FileListResponseSchema = z.object({
  path: AbsolutePathSchema,
  items: z.array(FileItemSchema),
});
export type FileListResponse = z.infer<typeof FileListResponseSchema>;

export const FilePathInputSchema = z.object({
  path: AbsolutePathSchema,
});
export type FilePathInput = z.infer<typeof FilePathInputSchema>;

export const FileRenameInputSchema = z.object({
  from: AbsolutePathSchema,
  to: AbsolutePathSchema,
});
export type FileRenameInput = z.infer<typeof FileRenameInputSchema>;

export const FileReadResponseSchema = z.object({
  content: z.string(),
});
export type FileReadResponse = z.infer<typeof FileReadResponseSchema>;

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

export const PushPreferencesSchema = z.object({
  sessionDisconnected: z.boolean(),
  serverHealthChange: z.boolean(),
});
export type PushPreferences = z.infer<typeof PushPreferencesSchema>;

export const PushPreferenceUpdateSchema = PushPreferencesSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one push preference must be provided",
);
export type PushPreferenceUpdate = z.infer<typeof PushPreferenceUpdateSchema>;

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  activeSessions: z.number().int().min(0),
  connectionConfigured: z.boolean(),
  uptimeSeconds: z.number().int().min(0),
  version: z.string(),
  authMode: z.enum(["none", "token"]),
  tunnelEnabled: z.boolean(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const TunnelStatusResponseSchema = z.object({
  active: z.boolean(),
  tunnelUrl: z.string().url().nullable(),
});
export type TunnelStatusResponse = z.infer<typeof TunnelStatusResponseSchema>;

export const VersionResponseSchema = z.object({
  version: z.string(),
  mobileMinVersion: z.string().optional(),
});
export type VersionResponse = z.infer<typeof VersionResponseSchema>;

export const SuccessResponseSchema = z.object({
  success: z.boolean(),
});
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;

export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
