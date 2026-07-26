import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const repo = path.resolve(".");
const visualDir = path.join(repo, "research/evidence-intelligence/visuals");
const previewDir = path.join(
  repo,
  "research/evidence-intelligence/lab/visual-previews"
);
await fs.mkdir(previewDir, { recursive: true });

const files = (await fs.readdir(visualDir)).filter((file) => file.endsWith(".svg"));
for (const file of files) {
  await sharp(path.join(visualDir, file), { density: 144 })
    .png()
    .toFile(path.join(previewDir, file.replace(/\.svg$/i, ".png")));
}

console.log(JSON.stringify({ rendered: files.length, files }, null, 2));
