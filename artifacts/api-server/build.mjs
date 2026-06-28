import { build } from "esbuild";

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

console.log("Build complete: dist/index.mjs, dist/tray.mjs");
