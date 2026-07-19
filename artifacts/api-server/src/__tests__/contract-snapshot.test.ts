import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { AddressInfo } from "net";
import type { Server } from "http";
import request from "supertest";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  PasswordAuthConnectionInputSchema,
  KeyAuthConnectionInputSchema,
  ConnectionProfileSafeSchema,
  SessionSchema,
  SessionRenameInputSchema,
  FileItemSchema,
  FileListResponseSchema,
  FilePathInputSchema,
  FileRenameInputSchema,
  FileReadResponseSchema,
  RemoteProcessSchema,
  SavedCommandSchema,
  TestResultSchema,
  PushPreferencesSchema,
  HealthResponseSchema,
  TunnelStatusResponseSchema,
  VersionResponseSchema,
  SuccessResponseSchema,
} from "../lib/contracts.js";

// vi.mock calls must live at module top level (not nested in describe) so
// vitest's static hoisting applies them before ../app.js and its route
// modules are imported below.
vi.mock("../lib/store.js", () => ({
  getActiveConnection: vi.fn(() => null),
  getActiveConnectionSafe: vi.fn(() => null),
  getConnectionsSafe: vi.fn(() => []),
  addConnection: vi.fn(() => ({ id: "conn-1" })),
  removeConnection: vi.fn(() => true),
  setActiveConnection: vi.fn(),
  getConnectionById: vi.fn(() => ({ id: "conn-1" })),
  getPushDevices: vi.fn(() => []),
  registerPushDevice: vi.fn(),
  removePushDevice: vi.fn(() => true),
  getNotificationPreferences: vi.fn(() => ({ sessionDisconnected: true, serverHealthChange: true })),
  updateNotificationPreferences: vi.fn((prefs: any) => prefs),
  getCommands: vi.fn(() => []),
  addCommand: vi.fn((label: string, command: string, description = "") => ({ id: "cmd-1", label, command, description })),
  removeCommand: vi.fn(() => true),
}));

vi.mock("../lib/sshManager.js", () => ({
  listSessions: vi.fn(() => []),
  getSession: vi.fn(() => undefined),
  createSession: vi.fn(),
  closeSession: vi.fn(() => false),
  addOutputListener: vi.fn(() => () => {}),
  sendToSession: vi.fn(() => false),
  resizeSession: vi.fn(() => false),
  markUserInitiatedClose: vi.fn(),
  testConnection: vi.fn(),
  getSftp: vi.fn(),
  execCommand: vi.fn(async () => ({ stdout: "[]", stderr: "", exitCode: 0 })),
}));

// This file guards against contract drift between `lib/api-spec/openapi.yaml`
// (the docs-facing spec), the shared zod schemas that both the server and
// the mobile client actually run against, and the live route table.
//
// There is no code generator tying these together (see CONTRIBUTING.md
// "Contract Changes") — they are kept in sync by hand. This test makes
// silent drift fail loudly instead of only being caught by a human diff
// review.
//
// The YAML parsing below is a deliberately narrow, regex-based reader of
// this file's existing conventions (2-space path indent, 4-space method
// indent, 4-space schema name indent, 8-space property indent) rather than
// a general YAML parser — the repo has no YAML parsing dependency available
// and adding one for a single test file is not worth the churn. If
// `openapi.yaml`'s formatting changes materially, this parser (not just the
// tests) will need updating.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OPENAPI_PATH = path.resolve(__dirname, "../../../../lib/api-spec/openapi.yaml");
// Normalized to LF regardless of how git checked the file out (Windows
// checkouts commonly convert to CRLF via core.autocrlf) — every parser below
// searches for literal "\n"-delimited markers.
const yamlText = fs.readFileSync(OPENAPI_PATH, "utf8").replace(/\r\n/g, "\n");

interface RouteEntry {
  method: string;
  path: string;
}

function parseOpenApiRoutes(text: string): RouteEntry[] {
  const startIdx = text.indexOf("\npaths:\n");
  const endIdx = text.indexOf("\ncomponents:\n");
  if (startIdx === -1 || endIdx === -1) throw new Error("Could not locate paths/components sections in openapi.yaml");
  const block = text.slice(startIdx + "\npaths:\n".length, endIdx);

  const routes: RouteEntry[] = [];
  let currentPath: string | null = null;
  for (const line of block.split("\n")) {
    const pathMatch = line.match(/^ {2}(\/\S*):\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      continue;
    }
    const methodMatch = line.match(/^ {4}(get|post|put|patch|delete):\s*$/);
    if (methodMatch && currentPath) {
      routes.push({ method: methodMatch[1].toUpperCase(), path: currentPath });
    }
  }
  return routes;
}

function toExpressPath(openApiPath: string): string {
  return openApiPath.replace(/\{([^}]+)\}/g, ":$1");
}

function parseComponentPropertyKeys(text: string, schemaName: string): string[] {
  const startMarker = `\n    ${schemaName}:\n`;
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) throw new Error(`Component "${schemaName}" not found in openapi.yaml`);
  const rest = text.slice(startIdx + startMarker.length);
  const nextComponentMatch = rest.match(/\n {4}\S.*:\n/);
  const block = nextComponentMatch ? rest.slice(0, nextComponentMatch.index) : rest;
  const propsMatch = block.match(/\n {6}properties:\n([\s\S]*)/);
  if (!propsMatch) return [];
  const keys: string[] = [];
  for (const line of propsMatch[1].split("\n")) {
    const keyMatch = line.match(/^ {8}(\w+):/);
    if (keyMatch) keys.push(keyMatch[1]);
  }
  return keys;
}

function zodObjectKeys(schema: z.ZodTypeAny): string[] {
  // Duck-typed rather than `instanceof z.ZodObject`/`z.ZodEffects`: the zod
  // instance resolved via this test file's own "zod" import is not
  // guaranteed to be the same module instance as the one @remotectrl/api-zod
  // resolves internally under the pnpm workspace layout, which makes
  // `instanceof` unreliable here even though the schemas behave identically.
  const def = (schema as any)?._def;
  const unwrapped = def?.typeName === "ZodEffects" ? def.schema : schema;
  const shape = (unwrapped as any)?.shape;
  const resolvedShape = typeof shape === "function" ? shape() : shape;
  if (!resolvedShape || typeof resolvedShape !== "object") {
    throw new Error("zodObjectKeys() only supports ZodObject (optionally wrapped in ZodEffects)");
  }
  return Object.keys(resolvedShape);
}

const openApiRoutes = parseOpenApiRoutes(yamlText);

describe("OpenAPI <-> shared zod schema key parity", () => {
  const pairs: Array<[string, z.ZodTypeAny]> = [
    ["PasswordAuthConnectionInput", PasswordAuthConnectionInputSchema],
    ["KeyAuthConnectionInput", KeyAuthConnectionInputSchema],
    ["ConnectionProfileSafe", ConnectionProfileSafeSchema],
    ["Session", SessionSchema],
    ["SessionRenameInput", SessionRenameInputSchema],
    ["FileItem", FileItemSchema],
    ["FileListResponse", FileListResponseSchema],
    ["FilePathInput", FilePathInputSchema],
    ["FileRenameInput", FileRenameInputSchema],
    ["FileReadResponse", FileReadResponseSchema],
    ["RemoteProcess", RemoteProcessSchema],
    ["SavedCommand", SavedCommandSchema],
    ["TestResult", TestResultSchema],
    ["PushPreferences", PushPreferencesSchema],
    ["HealthResponse", HealthResponseSchema],
    ["TunnelStatusResponse", TunnelStatusResponseSchema],
    ["VersionResponse", VersionResponseSchema],
    ["SuccessResponse", SuccessResponseSchema],
  ];

  it.each(pairs)("%s has the same property set in openapi.yaml and the zod schema", (schemaName, zodSchema) => {
    const openApiKeys = parseComponentPropertyKeys(yamlText, schemaName).sort();
    const zodKeys = zodObjectKeys(zodSchema).sort();
    expect(zodKeys).toEqual(openApiKeys);
  });
});

describe("OpenAPI <-> live route table parity", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    delete process.env.API_TOKEN;
    const { default: app } = await import("../app.js");
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
  }, 30000); // cold import of app.js (express, ssh2, pino-http, etc.) can exceed the 10s default hook timeout

  afterAll(async () => {
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  // OPTIONS can't be used to probe route existence here: app.ts mounts
  // `cors()` globally, and cors intercepts every OPTIONS preflight itself
  // (replying 204 with no Allow header) before it ever reaches a router —
  // so OPTIONS always "succeeds" regardless of whether the path is real.
  //
  // Instead this sends each declared method for real. Every route in this
  // app — success, validation failure, or the top-level error handler —
  // always answers `application/json`; only Express's own unmatched-route
  // fallback answers `text/html`. That content-type is a reliable discriminator
  // without needing per-endpoint fixtures (auth, valid IDs, multipart bodies,
  // etc.) for every one of the ~25 documented endpoints — the response
  // content, status, and correctness of any individual call are irrelevant to
  // this test.
  const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

  it.each(openApiRoutes)("$method $path is registered", async ({ method, path: openApiPath }) => {
    const expressPath = toExpressPath(openApiPath);
    let pending = (request(baseUrl) as any)[method.toLowerCase()](expressPath);
    if (BODY_METHODS.has(method)) pending = pending.send({});
    const response = await pending;
    // Deliberately not asserting on status: several of these routes 404 or
    // 400 legitimately with the mocked/empty backing state (e.g. no active
    // connection configured). Only the content-type distinguishes "real
    // route, any outcome" from "Express never matched this path/method".
    //
    // Exception: /api/setup/html deliberately returns text/html, not JSON.
    if (openApiPath !== "/api/setup/html") {
      expect(response.headers["content-type"]).toMatch(/^application\/json/);
    }
  });

  // Bidirectional: every real route must also appear in openapi.yaml.
  // This catches undocumented routes that the openapi→app check above
  // cannot see (it only checks openapi→app, not app→openapi).
  const KNOWN_APP_ROUTES: RouteEntry[] = [
    { method: "GET", path: "/health" },
    { method: "GET", path: "/tunnel-url" },
    { method: "GET", path: "/version" },
    { method: "GET", path: "/api/setup" },
    { method: "POST", path: "/api/setup/init" },
    { method: "GET", path: "/api/setup/html" },
    { method: "GET", path: "/api/connection" },
    { method: "POST", path: "/api/connection" },
    { method: "POST", path: "/api/connection/test" },
    { method: "GET", path: "/api/connections" },
    { method: "POST", path: "/api/connections" },
    { method: "GET", path: "/api/connections/active" },
    { method: "DELETE", path: "/api/connections/:id" },
    { method: "POST", path: "/api/connections/:id/activate" },
    { method: "GET", path: "/api/sessions" },
    { method: "POST", path: "/api/sessions" },
    { method: "PATCH", path: "/api/sessions/:id" },
    { method: "DELETE", path: "/api/sessions/:id" },
    { method: "GET", path: "/api/files" },
    { method: "DELETE", path: "/api/files" },
    { method: "GET", path: "/api/files/read" },
    { method: "GET", path: "/api/files/download" },
    { method: "POST", path: "/api/files/upload" },
    { method: "POST", path: "/api/files/mkdir" },
    { method: "PATCH", path: "/api/files/rename" },
    { method: "GET", path: "/api/processes" },
    { method: "DELETE", path: "/api/processes/:pid" },
    { method: "GET", path: "/api/commands" },
    { method: "POST", path: "/api/commands" },
    { method: "DELETE", path: "/api/commands/:id" },
    { method: "GET", path: "/api/push/preferences" },
    { method: "PUT", path: "/api/push/preferences" },
    { method: "POST", path: "/api/push/register" },
    { method: "GET", path: "/api/push/devices" },
    { method: "DELETE", path: "/api/push/device/:id" },
  ];

  it("every known app route is documented in openapi.yaml", () => {
    const openApiPaths = new Set(openApiRoutes.map((r) => `${r.method} ${toExpressPath(r.path)}`));
    const missing = KNOWN_APP_ROUTES.filter((r) => !openApiPaths.has(`${r.method} ${r.path}`));
    expect(missing).toEqual([]);
  });
});
