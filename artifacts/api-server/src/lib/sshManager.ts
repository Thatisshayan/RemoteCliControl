import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("ssh2") as typeof import("ssh2");

import { getActiveConnection } from "./store.js";
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

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function generateTitle(): string {
  return `Session ${sessions.size + 1}`;
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
            try { fn(str); } catch {}
          }
        });

        stream.on("close", () => {
          logger.info({ id }, "Shell closed");
          session.status = "disconnected";
          sessions.delete(id);
          client.end();
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

export function addOutputListener(id: string, fn: (data: string) => void): () => void {
  const session = sessions.get(id);
  if (!session) return () => {};
  session.listeners.add(fn);
  return () => { session.listeners.delete(fn); };
}

export async function execCommand(command: string): Promise<string> {
  const cfg = getActiveConnection();
  if (!cfg) throw new Error("No connection configured");

  return new Promise((resolve, reject) => {
    const client = new Client();
    const chunks: Buffer[] = [];

    client.on("ready", () => {
      client.exec(command, (err: any, stream: any) => {
        if (err) { client.end(); reject(err); return; }
        stream.on("data", (data: Buffer) => chunks.push(data));
        stream.stderr.on("data", (data: Buffer) => chunks.push(data));
        stream.on("close", () => {
          client.end();
          resolve(Buffer.concat(chunks).toString("utf8"));
        });
      });
    });

    client.on("error", reject);

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

export function getSftp(): Promise<{ sftp: any; client: any }> {
  const cfg = getActiveConnection();
  if (!cfg) return Promise.reject(new Error("No connection configured"));

  return new Promise((resolve, reject) => {
    const client = new Client();

    client.on("ready", () => {
      client.sftp((err: any, sftp: any) => {
        if (err) { client.end(); reject(err); return; }
        resolve({ sftp, client });
      });
    });

    client.on("error", reject);

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
