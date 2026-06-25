import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "dist/index.mjs",
  external: ["ssh2", "ws", "cpu-features", "bufferutil", "utf-8-validate"],
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
});

console.log("Build complete: dist/index.mjs");
