import { build } from "esbuild";
import { execFileSync } from "child_process";
import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";

const CLOUDFLARED_VERSION = "2026.8.2";
const CLOUDFLARED_URL = `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-windows-amd64.exe`;
const CLOUDFLARED_SHA256 = "c29eee2b121f5436a642eed69fd9767da7e7b8c510fa50aaa130337f931357b5";

async function downloadCloudflared(targetPath) {
  try {
    const existing = await fs.readFile(targetPath);
    if (createHash("sha256").update(existing).digest("hex") === CLOUDFLARED_SHA256) {
      console.log("cloudflared.exe already present and verified, skipping download.");
      return;
    }
    console.warn("cloudflared.exe present but checksum mismatch, re-downloading.");
  } catch {
    // Not present yet, fall through to download.
  }

  console.log(`Downloading cloudflared ${CLOUDFLARED_VERSION}...`);
  const response = await fetch(CLOUDFLARED_URL);
  if (!response.ok) {
    throw new Error(`Failed to download cloudflared.exe: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const actualSha256 = createHash("sha256").update(buffer).digest("hex");
  if (actualSha256 !== CLOUDFLARED_SHA256) {
    throw new Error(`cloudflared.exe checksum mismatch: expected ${CLOUDFLARED_SHA256}, got ${actualSha256}`);
  }
  await fs.writeFile(targetPath, buffer);
  console.log("cloudflared.exe downloaded and verified.");
}

const shared = {
  platform: "node",
  format: "esm",
  bundle: true,
  external: ["ssh2", "ws", "cpu-features", "bufferutil", "utf-8-validate", "systray2"],
  banner: {
    js: `
      import { createRequire as __createRequire } from "module";
      const require = __createRequire(import.meta.url);
      const __filename = import.meta.url.replace("file:///", "");
      const __dirname = import.meta.url.replace("file:///", "").replace(/\\/[^\\/]+$/, "");
    `.trim(),
  },
  minify: false,
  sourcemap: true,
};

await build({
  ...shared,
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.mjs",
});

await build({
  ...shared,
  entryPoints: ["src/tray.ts"],
  outfile: "dist/tray.mjs",
});

await build({
  ...shared,
  entryPoints: ["src/service.ts"],
  outfile: "dist/service.mjs",
});

const packaged = {
  ...shared,
  format: "cjs",
  banner: {},
};

await build({
  ...packaged,
  entryPoints: ["src/tray.ts"],
  outfile: "dist/tray.cjs",
});

await build({
  ...packaged,
  entryPoints: ["src/service.ts"],
  outfile: "dist/service.cjs",
});

for (const file of ["dist/tray.cjs", "dist/service.cjs"]) {
  const output = await fs.readFile(file, "utf8");
  // esbuild numbers its per-module `import_meta`/module-namespace aliases
  // (import_meta, import_meta2, import_meta3, ...; import_node_module,
  // import_module, import_module2, ...) independently in each bundled
  // module's scope, so a literal string match only ever caught the first
  // occurrence — every other module still crashed at runtime with
  // "argument 'filename' must be ... Received undefined" because
  // import.meta.url is empty in a cjs bundle. Match any numbered variant.
  const compatOutput = output
    .replaceAll('require("node:sqlite")', 'require("node" + ":sqlite")')
    .replace(
      /\(0, (\w+)\.createRequire\)\(import_meta\d*\.url\)/g,
      "(0, $1.createRequire)(process.execPath)",
    );
  await fs.writeFile(file, compatOutput);
}

if (process.platform === "win32") {
  const trayIconSource = path.resolve("..", "..", "ios", "RemoteCTRL", "Assets.xcassets", "AppIcon.appiconset", "icon-1024.png");
  const trayIconTarget = path.resolve("release", "tray.ico");
  await fs.mkdir(path.dirname(trayIconTarget), { recursive: true });
  const trayIconScript = `
Add-Type -AssemblyName System.Drawing
$bitmap = [System.Drawing.Bitmap]::FromFile('${trayIconSource.replaceAll("'", "''")}')
$iconHandle = $bitmap.GetHicon()
try {
  $icon = [System.Drawing.Icon]::FromHandle($iconHandle)
  $stream = [System.IO.File]::Create('${trayIconTarget.replaceAll("'", "''")}')
  try { $icon.Save($stream) } finally { $stream.Dispose() }
} finally {
  $bitmap.Dispose()
}
`.trim();

  execFileSync("powershell.exe", ["-NoLogo", "-NoProfile", "-Command", trayIconScript], { stdio: "inherit" });

  await downloadCloudflared(path.resolve("release", "cloudflared.exe"));
} else {
  console.log("Skipping Windows tray icon generation (not running on win32).");
}

console.log("Build complete: dist/index.mjs, dist/tray.mjs, dist/service.mjs, dist/tray.cjs, dist/service.cjs");
