import fs from "fs";
import path from "path";
import pdf from "pdf-parse";

const ROOT = process.cwd();
const IN_DIR = path.join(ROOT, "objectives");
const OUT_FILE = path.join(ROOT, "src", "objectives.generated.ts");

function normalizeSpaces(s) {
  return s.replace(/\s+/g, " ").trim();
}

function isDomainHeader(line) {
  return /^\d+\.0\s+/.test(line);
}
function parseDomainHeader(line) {
  const m = line.match(/^(\d+\.0)\s+(.+)$/);
  if (!m) return null;
  const num = m[1];
  const name = normalizeSpaces(m[2].replace(/\s*\|\s*/g, " "));
  return `${num} ${name}`;
}
function isObjectiveId(line) {
  return /^\d+\.[1-9]\d*$/.test(line);
}

function parseObjectivesFromText(text) {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/\r/g, "").trim())
    .filter((l) => l.length > 0);

  const objectives = {};
  let currentDomain = null;

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];

    if (isDomainHeader(ln)) {
      currentDomain = parseDomainHeader(ln);
      continue;
    }

    if (isObjectiveId(ln)) {
      const objId = ln;
      const block = [];
      let j = i + 1;

      while (j < lines.length && !isObjectiveId(lines[j]) && !isDomainHeader(lines[j])) {
        block.push(lines[j]);
        j++;
      }

      let blockText = block.join("\n");
      blockText = blockText.replace(/^\s*−\s*/gm, "• ");
      blockText = blockText.replace(/•/g, "\n• ");
      blockText = blockText.replace(/\n•\s*\n•/g, "\n• ");

      const parts = blockText
        .split("\n•")
        .map((p) => normalizeSpaces(p))
        .filter((p) => p.length > 0);

      const title = parts[0] ?? "";
      const bullets = parts.slice(1);

      objectives[objId] = {
        domain: currentDomain,
        title,
        bullets,
      };

      i = j - 1;
    }
  }

  return objectives;
}

async function readPdf(filePath) {
  const data = fs.readFileSync(filePath);
  const out = await pdf(data);
  return out.text || "";
}

async function main() {
  if (!fs.existsSync(IN_DIR)) {
    console.error(`Missing folder: ${IN_DIR}`);
    process.exit(1);
  }

  const core1Pdf = path.join(IN_DIR, "CompTIA A+ 220-1201 Exam Objectives (4.0).pdf");
  const core2Pdf = path.join(IN_DIR, "CompTIA A+ 220-1202 Exam Objectives (4.0).pdf");

  if (!fs.existsSync(core1Pdf) || !fs.existsSync(core2Pdf)) {
    console.error(`PDFs not found in ${IN_DIR}`);
    console.error(`Expected:`);
    console.error(`  ${path.basename(core1Pdf)}`);
    console.error(`  ${path.basename(core2Pdf)}`);
    process.exit(1);
  }

  const t1 = await readPdf(core1Pdf);
  const t2 = await readPdf(core2Pdf);

  const obj1 = parseObjectivesFromText(t1);
  const obj2 = parseObjectivesFromText(t2);

  const payload = {
    "220-1201": obj1,
    "220-1202": obj2,
  };

  const ts =
    `// AUTO-GENERATED. Do not edit by hand.\n` +
    `export const OBJECTIVES = ${JSON.stringify(payload, null, 2)} as const;\n`;

  fs.writeFileSync(OUT_FILE, ts, "utf8");
  console.log(`Wrote: ${OUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
