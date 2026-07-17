import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("ssh2") as typeof import("ssh2");

import { getActiveConnection } from "./store.js";
import { notifySessionDisconnected } from "./pushNotifications.js";
import logger from "./logger.js";

export interface ActiveSession {
  id: string;
  title: string;
  status: "connecting" | "connected" | "disconnected" | "error";
  createdAt: Date;
  client: any;
  shell: NodeJS.ReadWriteStream | null;
  listeners: Set<(data: string) => void>;
}

const sessions = new Map<string, ActiveSession>();
let utilityClient: any = null;
let utilityBusy = false;
const utilityQueue: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = [];
let sessionCounter = 0;
const userInitiatedCloses = new Set<string>();

export function markUserInitiatedClose(id: string): void {
  userInitiatedCloses.add(id);
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function generateTitle(): string {
  sessionCounter += 1;
  return `Session ${sessionCounter}`;
}

function drainUtilityQueue(error?: any) {
  const next = utilityQueue.shift();
  if (!next) return;
  if (error) next.reject(error);
  else acquireUtilityClient().then(next.resolve, next.reject);
}

async function acquireUtilityClient(): Promise<any> {
  if (utilityClient && !utilityBusy) return utilityClient;
  if (utilityBusy) {
    return new Promise<any>((resolve, reject) => utilityQueue.push({ resolve, reject }));
  }
  const cfg = getActiveConnection();
  if (!cfg) throw new Error("No connection configured");
  utilityBusy = true;
  const client = new Client();
  utilityClient = client;
  await new Promise<void>((resolve, reject) => {
    client.once("ready", () => {
      client.once("error", () => {
        utilityClient = null;
        utilityBusy = false;
        drainUtilityQueue(new Error("Utility SSH disconnected"));
      });
      client.once("end", () => {
        utilityClient = null;
        utilityBusy = false;
        drainUtilityQueue(new Error("Utility SSH ended"));
      });
      resolve();
    });
    client.once("error", reject);
    client.connect(buildConnectOpts(cfg));
  });
  utilityBusy = false;
  drainUtilityQueue();
  return client;
}

export function resetUtilityClient() {
  if (utilityClient) {
    try { utilityClient.end(); } catch (err: any) { logger.warn({ err }, "Error ending utility client"); }
  }
  utilityClient = null;
  utilityBusy = false;
  while (utilityQueue.length) utilityQueue.pop()?.reject(new Error("Utility client reset"));
}

const READY_TIMEOUT = 15000;

function buildConnectOpts(cfg: any) {
  const opts: any = {
    host: cfg.host,
    port: cfg.port,
    username: cfg.username,
    readyTimeout: READY_TIMEOUT,
  };
  if (cfg.privateKey) {
    opts.privateKey = cfg.privateKey;
    if (cfg.passphrase) opts.passphrase = cfg.passphrase;
  } else {
    opts.password = cfg.password;
  }
  return opts;
}

export function listSessions() {
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
  }));
}

export function getSession(id: string): ActiveSession | undefined {
  return sessions.get(id);
}

export function createSession(): Promise<{ id: string; title: string; status: string; createdAt: string }> {
  const cfg = getActiveConnection();
  if (!cfg) return Promise.reject(new Error("No connection configured"));

  return new Promise((resolve, reject) => {
    const client = new Client();
    const id = generateId();
    const title = generateTitle();
    const session: ActiveSession = {
      id,
      title,
      status: "connecting",
      createdAt: new Date(),
      client,
      shell: null,
      listeners: new Set(),
    };

    sessions.set(id, session);

    client.on("ready", () => {
      logger.info({ id }, "SSH ready, opening shell");
      client.shell({ term: "xterm-256color", rows: 24, cols: 80 }, (err: any, stream: any) => {
        if (err) {
          session.status = "error";
          reject(err);
          return;
        }
        session.shell = stream;
        session.status = "connected";

        stream.on("data", (data: Buffer) => {
          const str = data.toString("utf8");
          for (const fn of session.listeners) {
            try { fn(str); } catch (err: any) { logger.warn({ err }, "Error in session listener"); }
          }
        });

        stream.on("close", () => {
          logger.info({ id }, "Shell closed");
          session.status = "disconnected";
          sessions.delete(id);
          client.end();
          if (!userInitiatedCloses.has(id)) {
            notifySessionDisconnected(title, id).catch(() => {});
          }
          userInitiatedCloses.delete(id);
        });

        resolve({
          id,
          title,
          status: session.status,
          createdAt: session.createdAt.toISOString(),
        });
      });
    });

    client.on("error", (err: any) => {
      logger.error({ id, err }, "SSH connection error");
      session.status = "error";
      sessions.delete(id);
      if (!userInitiatedCloses.has(id)) {
        notifySessionDisconnected(title, id).catch(() => {});
      }
      userInitiatedCloses.delete(id);
      reject(err);
    });

    const connectOpts: any = {
      host: cfg.host,
      port: cfg.port,
      username: cfg.username,
      readyTimeout: 15000,
    };
    if (cfg.privateKey) {
      connectOpts.privateKey = cfg.privateKey;
      if (cfg.passphrase) connectOpts.passphrase = cfg.passphrase;
    } else {
      connectOpts.password = cfg.password;
    }

    client.connect(connectOpts);
  });
}

export function closeSession(id: string): boolean {
  const session = sessions.get(id);
  if (!session) return false;
  userInitiatedCloses.add(id);
  if (session.shell) session.shell.end();
  session.client.end();
  sessions.delete(id);
  return true;
}

export function sendToSession(id: string, data: string): boolean {
  const session = sessions.get(id);
  if (!session || !session.shell) return false;
  session.shell.write(data);
  return true;
}

export function resizeSession(id: string, rows: number, cols: number): boolean {
  const session = sessions.get(id);
  if (!session || !session.shell) return false;
  (session.shell as any).setWindow(rows, cols, 0, 0);
  return true;
}

export function addOutputListener(id: string, fn: (data: string) => void): () => void {
  const session = sessions.get(id);
  if (!session) return () => {};
  session.listeners.add(fn);
  return () => { session.listeners.delete(fn); };
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export async function execCommand(command: string): Promise<ExecResult> {
  const cfg = getActiveConnection();
  if (!cfg) throw new Error("No connection configured");

  const client = await acquireUtilityClient();
  return new Promise<ExecResult>((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    client.exec(command, (err: any, stream: any) => {
      if (err) { reject(err); return; }
      // stdout and stderr are kept separate (not merged into one buffer) so
      // callers that parse machine-readable stdout (e.g. ConvertTo-Json)
      // aren't broken by unrelated PowerShell warnings/errors landing on
      // stderr and getting interleaved with it.
      stream.on("data", (data: Buffer) => stdoutChunks.push(data));
      stream.stderr.on("data", (data: Buffer) => stderrChunks.push(data));
      stream.on("close", (code: number | null) => {
        resolve({
          stdout: Buffer.concat(stdoutChunks).toString("utf8"),
          stderr: Buffer.concat(stderrChunks).toString("utf8"),
          exitCode: typeof code === "number" ? code : null,
        });
      });
    });
  });
}

export async function getSftp(): Promise<any> {
  const client = await acquireUtilityClient();
  return new Promise<any>((resolve, reject) => {
    client.sftp((err: any, sftp: any) => {
      if (err) { reject(err); return; }
      resolve(sftp);
    });
  });
}

export async function testConnection(cfg: { host: string; port: number; username: string; password?: string; privateKey?: string; passphrase?: string }): Promise<{ success: boolean; message: string; latencyMs: number }> {
  return new Promise((resolve) => {
    const client = new Client();
    const start = Date.now();

    const connectOpts: any = {
      host: cfg.host,
      port: cfg.port,
      username: cfg.username,
      readyTimeout: 10000,
    };
    if (cfg.privateKey) {
      connectOpts.privateKey = cfg.privateKey;
      if (cfg.passphrase) connectOpts.passphrase = cfg.passphrase;
    } else {
      connectOpts.password = cfg.password;
    }

    client.on("ready", () => {
      const latency = Date.now() - start;
      client.end();
      resolve({ success: true, message: "Connected successfully", latencyMs: latency });
    });

    client.on("error", (err: any) => {
      resolve({ success: false, message: err.message || "Connection failed", latencyMs: Date.now() - start });
    });

    client.connect(connectOpts);
  });
}
