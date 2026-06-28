import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { getSftp, execCommand } from "../lib/sshManager.js";
const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

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
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: "path required" });
  try {
    sanitizePath(filePath);
    const err = validatePath(filePath);
    if (err) return res.status(400).json({ error: err });
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
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: "path required" });
  try {
    sanitizePath(filePath);
    const err = validatePath(filePath);
    if (err) return res.status(400).json({ error: err });
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
  const dirPath = (req.query.path as string) || "/";
  try {
    sanitizePath(dirPath);
    const err = validatePath(dirPath);
    if (err) return res.status(400).json({ error: err });
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
        } catch {
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
  const { path: dirPath } = req.body;
  if (!dirPath) return res.status(400).json({ error: "path required" });
  try {
    sanitizePath(dirPath);
    const err = validatePath(dirPath);
    if (err) return res.status(400).json({ error: err });
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
  const remotePath = req.query.path as string;
  if (!remotePath || !req.file) return res.status(400).json({ error: "path and file required" });
  try {
    sanitizePath(remotePath);
    const err = validatePath(remotePath);
    if (err) return res.status(400).json({ error: err });
    const sftp = await getSftp();
    await new Promise<void>((resolve, reject) => {
      const stream = sftp.createWriteStream(remotePath);
      stream.on("close", () => resolve());
      stream.on("error", reject);
      stream.end(req.file!.buffer);
    });
    res.json({ success: true });
  } catch (e: any) {
    next(e);
  }
});

router.delete("/files", async (req: Request, res: Response, next: NextFunction) => {
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: "path required" });
  try {
    sanitizePath(filePath);
    const err = validatePath(filePath);
    if (err) return res.status(400).json({ error: err });
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
  const { from, to } = req.body;
  if (!from || !to) return res.status(400).json({ error: "from and to required" });
  try {
    sanitizePath(from);
    sanitizePath(to);
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
