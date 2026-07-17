import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import fs from "fs";
import os from "os";
import path from "path";
import { getSftp } from "../lib/sshManager.js";
import logger from "../lib/logger.js";
import { FilePathInputSchema, FileRenameInputSchema } from "../lib/contracts.js";
import { parseBody, parseQuery, sendError } from "../lib/http.js";
import { z } from "zod";
const router = Router();
// Disk-backed storage instead of memoryStorage: buffering a 100MB upload
// fully in memory can exhaust RAM on the same machine the user is
// remoting into, especially with several concurrent uploads.
const UPLOAD_TMP_DIR = path.join(os.tmpdir(), "remotectrl-uploads");
fs.mkdirSync(UPLOAD_TMP_DIR, { recursive: true });
const upload = multer({ dest: UPLOAD_TMP_DIR, limits: { fileSize: 100 * 1024 * 1024 } });

function sanitizePath(p: string): string {
  if (p.includes("..")) throw new Error("Invalid path");
  return p;
}

function validatePath(p: string): string | null {
  if (!p.startsWith("/")) return "Path must start with /";
  if (p.length > 4096) return "Path too long";
  if (p.includes("\0")) return "Path contains null bytes";
  return null;
}

router.get("/files/download", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path: filePath } = parseQuery(FilePathInputSchema, req);
    sanitizePath(filePath);
    const sftp = await getSftp();
    const stat = await new Promise<any>((resolve, reject) => {
      sftp.stat(filePath, (e: any, s: any) => e ? reject(e) : resolve(s));
    });
    res.setHeader("Content-Disposition", `attachment; filename="${filePath.split(/[/\\]/).pop() || "file"}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", stat.size);
    const stream = sftp.createReadStream(filePath);
stream.pipe(res);
    stream.on("error", (err: any) => { next(err); });
  } catch (e: any) {
    next(e);
  }
});

router.get("/files/read", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path: filePath } = parseQuery(FilePathInputSchema, req);
    sanitizePath(filePath);
    const sftp = await getSftp();
    const stat = await new Promise<any>((resolve, reject) => {
      sftp.stat(filePath, (e: any, s: any) => e ? reject(e) : resolve(s));
    });
    if (stat.size > 100 * 1024) {
      return res.status(413).json({ error: "File too large (max 100KB)" });
    }
    const content = await new Promise<Buffer>((resolve, reject) => {
      sftp.readFile(filePath, (e: any, data: Buffer) => e ? reject(e) : resolve(data));
    });
    res.json({ content: content.toString("utf8") });
  } catch (e: any) {
    next(e);
  }
});

router.get("/files", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = parseQuery(
      z.object({ path: FilePathInputSchema.shape.path.optional().default("/") }),
      req,
    );
    const dirPath = parsedQuery.path ?? "/";
    sanitizePath(dirPath);
    const sftp = await getSftp();
    const list = await new Promise<any[]>((resolve, reject) => {
      sftp.readdir(dirPath, (e: any, l: any[]) => e ? reject(e) : resolve(l));
    });
    const items = await Promise.all(
      list.map(async (item) => {
        const fullPath = dirPath.endsWith("/") ? dirPath + item.filename : dirPath + "/" + item.filename;
        let type: "file" | "directory" | "symlink" = "file";
        try {
          const attrs = await new Promise<any>((resolve, reject) => {
            sftp.stat(fullPath, (e: any, s: any) => e ? reject(e) : resolve(s));
          });
          if (attrs.isDirectory()) type = "directory";
          else if (attrs.isSymbolicLink?.()) type = "symlink";
          return {
            name: item.filename,
            path: fullPath,
            type,
            size: attrs.size,
            modifiedAt: new Date(attrs.mtime * 1000).toISOString(),
            permissions: attrs.mode?.toString(8) || "",
          };
        } catch (err: any) {
          logger.debug({ err, path: fullPath }, "Failed to stat file, using defaults");
          return { name: item.filename, path: fullPath, type: "file" as const, size: 0, modifiedAt: "", permissions: "" };
        }
      })
    );
    res.json({ path: dirPath, items });
  } catch (e: any) {
    next(e);
  }
});

router.post("/files/mkdir", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path: dirPath } = parseBody(FilePathInputSchema, req);
    sanitizePath(dirPath);
    const sftp = await getSftp();
    await new Promise<void>((resolve, reject) => {
      sftp.mkdir(dirPath, (e: any) => e ? reject(e) : resolve());
    });
    res.json({ success: true });
  } catch (e: any) {
    next(e);
  }
});

router.post("/files/upload", upload.single("file"), async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) return sendError(res, 400, "VALIDATION_ERROR", "path and file required");
  try {
    const { path: remotePath } = parseQuery(FilePathInputSchema, req);
    sanitizePath(remotePath);
    const sftp = await getSftp();
    await new Promise<void>((resolve, reject) => {
      const readStream = fs.createReadStream(req.file!.path);
      const writeStream = sftp.createWriteStream(remotePath);
      writeStream.on("close", () => resolve());
      writeStream.on("error", reject);
      readStream.on("error", reject);
      readStream.pipe(writeStream);
    });
    res.json({ success: true });
  } catch (e: any) {
    next(e);
  } finally {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
  }
});

router.delete("/files", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path: filePath } = parseQuery(FilePathInputSchema, req);
    sanitizePath(filePath);
    const sftp = await getSftp();
    await new Promise<void>((resolve, reject) => {
      sftp.unlink(filePath, (e: any) => {
        if (e) {
          sftp.rmdir(filePath, (e2: any) => e2 ? reject(e2) : resolve());
        } else {
          resolve();
        }
      });
    });
    res.json({ success: true });
  } catch (e: any) {
    next(e);
  }
});

router.patch("/files/rename", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to } = parseBody(FileRenameInputSchema, req);
    sanitizePath(from);
    sanitizePath(to);
    const fromError = validatePath(from);
    if (fromError) return sendError(res, 400, "VALIDATION_ERROR", fromError);
    const toError = validatePath(to);
    if (toError) return sendError(res, 400, "VALIDATION_ERROR", toError);
    const sftp = await getSftp();
    await new Promise<void>((resolve, reject) => {
      sftp.rename(from, to, (err: any) => err ? reject(err) : resolve());
    });
    res.json({ success: true });
  } catch (e: any) {
    next(e);
  }
});

export default router;
