import { build } from "esbuild";
import { execFileSync } from "child_process";
import fs from "fs/promises";
import path from "path";

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
  const compatOutput = output
    .replaceAll('require("node:sqlite")', 'require("node" + ":sqlite")')
    .replaceAll(
      "(0, import_node_module.createRequire)(import_meta.url)",
      "(0, import_node_module.createRequire)(__filename)",
    );
  await fs.writeFile(file, compatOutput);
}

const trayIconSource = path.resolve("..", "..", "ios", "RemoteCTRL", "Assets.xcassets", "AppIcon.appiconset", "icon-1024.png");
const trayIconTarget = path.resolve("release", "tray.ico");
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

console.log("Build complete: dist/index.mjs, dist/tray.mjs, dist/service.mjs, dist/tray.cjs, dist/service.cjs");
