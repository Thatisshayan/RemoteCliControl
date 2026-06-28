import sharp from "sharp";
import fs from "fs";
import path from "path";

const ASSETS_DIR = path.resolve("artifacts/mobile/assets");
const SOURCE_SVG = path.join(ASSETS_DIR, "icon-source.svg");

const sizes = {
  "icon.png": 1024,
  "icon-ios.png": 1024,
  "icon-android-foreground.png": 1024,
};

async function main() {
  const svgBuffer = fs.readFileSync(SOURCE_SVG);

  for (const [filename, size] of Object.entries(sizes)) {
    const outputPath = path.join(ASSETS_DIR, filename);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated ${filename} (${size}x${size})`);
  }

  // Generate adaptive icon background (solid color)
  const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
    <rect width="1024" height="1024" fill="#0d0d0d"/>
  </svg>`;
  await sharp(Buffer.from(bgSvg))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(ASSETS_DIR, "icon-android-background.png"));
  console.log("Generated icon-android-background.png (1024x1024)");

  // Generate splash screen
  const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1284" height="2778" viewBox="0 0 1284 2778">
    <rect width="1284" height="2778" fill="#0d0d0d"/>
    <g transform="translate(642, 1200)">
      <text x="0" y="0" font-family="'Courier New',monospace" font-size="200" font-weight="bold" fill="#00ff88" text-anchor="middle" dominant-baseline="central">&gt;_</text>
    </g>
  </svg>`;
  await sharp(Buffer.from(splashSvg))
    .resize(1284, 2778)
    .png()
    .toFile(path.join(ASSETS_DIR, "splash.png"));
  console.log("Generated splash.png (1284x2778)");
}

main().catch(console.error);
