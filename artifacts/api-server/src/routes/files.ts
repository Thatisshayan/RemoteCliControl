import { Router } from "express";
import multer from "multer";
import { getSftp, execCommand } from "../lib/sshManager.js";
const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get("/files/download", async (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: "path required" });
  try {
    const { sftp, client } = await getSftp();
    const stat = await new Promise<any>((resolve, reject) => {
      sftp.stat(filePath, (err: any, s: any) => err ? reject(err) : resolve(s));
    });
    const basename = filePath.split(/[/\\]/).pop() || "file";
    res.setHeader("Content-Disposition", `attachment; filename="${basename}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", stat.size);
    const stream = sftp.createReadStream(filePath);
    stream.pipe(res);
    stream.on("close", () => client.end());
    stream.on("error", (err: any) => { client.end(); res.status(500).json({ error: err.message }); });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/files/read", async (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: "path required" });
  try {
    const { sftp, client } = await getSftp();
    const stat = await new Promise<any>((resolve, reject) => {
      sftp.stat(filePath, (err: any, s: any) => err ? reject(err) : resolve(s));
    });
    if (stat.size > 100 * 1024) {
      client.end();
      return res.status(413).json({ error: "File too large (max 100KB)" });
    }
    const content = await new Promise<Buffer>((resolve, reject) => {
      sftp.readFile(filePath, (err: any, data: Buffer) => err ? reject(err) : resolve(data));
    });
    client.end();
    res.json({ content: content.toString("utf8") });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/files", async (req, res) => {
  const dirPath = (req.query.path as string) || "/";
  try {
    const { sftp, client } = await getSftp();
    const list = await new Promise<any[]>((resolve, reject) => {
      sftp.readdir(dirPath, (err: any, list: any[]) => err ? reject(err) : resolve(list));
    });
    const items = await Promise.all(
      list.map(async (item) => {
        const fullPath = dirPath.endsWith("/") ? dirPath + item.filename : dirPath + "/" + item.filename;
        let type: "file" | "directory" | "symlink" = "file";
        try {
          const attrs = await new Promise<any>((resolve, reject) => {
            sftp.stat(fullPath, (err: any, s: any) => err ? reject(err) : resolve(s));
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
    client.end();
    res.json({ path: dirPath, items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/files/mkdir", async (req, res) => {
  const { path: dirPath } = req.body;
  if (!dirPath) return res.status(400).json({ error: "path required" });
  try {
    const { sftp, client } = await getSftp();
    await new Promise<void>((resolve, reject) => {
      sftp.mkdir(dirPath, (err: any) => err ? reject(err) : resolve());
    });
    client.end();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/files/upload", upload.single("file"), async (req, res) => {
  const remotePath = req.query.path as string;
  if (!remotePath || !req.file) return res.status(400).json({ error: "path and file required" });
  try {
    const { sftp, client } = await getSftp();
    await new Promise<void>((resolve, reject) => {
      const stream = sftp.createWriteStream(remotePath);
      stream.on("close", () => resolve());
      stream.on("error", reject);
      stream.end(req.file!.buffer);
    });
    client.end();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/files", async (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: "path required" });
  try {
    const { sftp, client } = await getSftp();
    await new Promise<void>((resolve, reject) => {
      sftp.unlink(filePath, (err: any) => {
        if (err) {
          sftp.rmdir(filePath, (err2: any) => err2 ? reject(err2) : resolve());
        } else {
          resolve();
        }
      });
    });
    client.end();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
