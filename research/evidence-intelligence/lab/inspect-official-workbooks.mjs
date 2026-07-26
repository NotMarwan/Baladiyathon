import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const root = path.resolve("research/evidence-intelligence/lab");
const dataDir = path.join(root, "official-data");
const inputs = [
  "traffic-density-on-roads.xlsx",
  "average-speed-on-roads.xlsx",
  "traffic-flow-data.xlsx",
];

const output = {
  generatedAt: new Date().toISOString(),
  tool: "@oai/artifact-tool",
  files: [],
};

for (const name of inputs) {
  const filePath = path.join(dataDir, name);
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(filePath));
  const overview = await workbook.inspect({
    kind: "workbook,sheet,table,region",
    maxChars: 16000,
    tableMaxRows: 30,
    tableMaxCols: 30,
    tableMaxCellChars: 240,
  });

  const sheetInspection = await workbook.inspect({
    kind: "sheet",
    include: "id,name",
    maxChars: 4000,
  });
  const sheets = sheetInspection.ndjson
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const sheetNames = [];
  const collectNames = (value) => {
    if (Array.isArray(value)) {
      value.forEach(collectNames);
      return;
    }
    if (value && typeof value === "object") {
      if (typeof value.name === "string") sheetNames.push(value.name);
      Object.values(value).forEach(collectNames);
    }
  };
  collectNames(sheets);

  const primarySheet = [...new Set(sheetNames)][0];
  let previewPath = null;
  if (primarySheet) {
    const preview = await workbook.render({
      sheetName: primarySheet,
      autoCrop: "all",
      scale: 1.5,
      format: "png",
    });
    previewPath = path.join(dataDir, `${path.parse(name).name}-preview.png`);
    await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
  }

  output.files.push({
    name,
    bytes: (await fs.stat(filePath)).size,
    overviewNdjson: overview.ndjson,
    primarySheet,
    previewPath: previewPath ? path.relative(root, previewPath).replaceAll("\\", "/") : null,
  });
}

await fs.writeFile(
  path.join(root, "official-workbook-inspection.json"),
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8"
);

console.log(JSON.stringify(output, null, 2));
