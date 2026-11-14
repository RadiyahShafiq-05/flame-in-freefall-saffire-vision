// Builds public/data/investigations.json from NASA PSI investigation metadata.
// Usage: node scripts/build-investigations.mjs <psi-data dir>
// The dir holds one PSI-*/ folder per investigation with investigation.json and its experiment-table CSVs,
// as downloaded from https://psi.nasa.gov. Values are copied, never edited.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const src = process.argv[2];
if (!src) {
  console.error("Usage: node scripts/build-investigations.mjs <psi-data dir>");
  process.exit(1);
}

// Some PSI tables are Windows-1252, not UTF-8; latin1 keeps characters such as µ readable.
const readText = file => {
  const buf = readFileSync(file);
  const utf8 = buf.toString("utf8");
  return (utf8.includes("�") ? buf.toString("latin1") : utf8).replace(/^﻿/, "");
};

// Minimal CSV parsing: quoted fields may contain commas and newlines.
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim()));
}

const clean = s => (s ?? "").replace(/\s+/g, " ").trim();
const accessions = readdirSync(src).filter(d => /^PSI-\d+$/.test(d)).sort((a, b) => +a.slice(4) - +b.slice(4));

const investigations = accessions.map(acc => {
  const dir = join(src, acc);
  const m = JSON.parse(readFileSync(join(dir, "investigation.json"), "utf8"));
  const tables = readdirSync(dir).filter(f => f.endsWith(".csv")).sort().map(f => {
    const [header = [], ...body] = parseCsv(readText(join(dir, f)));
    return {
      name: clean(f.replace(/\.csv$/, "").replace(/^PSI-\d+_Experimental table_/, "")),
      rows: body.length,
      columns: header.map(clean).filter(Boolean),
    };
  });
  return {
    accession: m.accession,
    acronym: clean(m.investigationAcronym),
    title: clean(m.title),
    subResearchArea: clean(m.subResearchArea),
    projectType: clean(m.projectType),
    hardware: clean(m.experimentHardware),
    hardwareLink: clean(m.experimentHardwareLink),
    platform: clean(m.flightProgram),
    managingCenter: clean(m.managingNasaCenter),
    startDate: clean(m.investigationStartDate),
    endDate: clean(m.investigationEndDate),
    doi: clean(m.doi),
    license: clean(m.licenseIdentifier),
    objective: (m.objective ?? "").trim(),
    publications: (m.publications ?? []).map(p => ({ title: clean(p.title), authors: clean(p.authorList), doi: clean(p.doi) })),
    tables,
    totalFileSizeBytes: m.totalFileSize ?? 0,
    related: clean(m.related_glds).split(",").map(clean).filter(Boolean),
    modifiedDate: clean(m.modifiedDate),
  };
});

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "data", "investigations.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({
  source: "NASA Physical Sciences Informatics (PSI), investigation metadata and experiment tables",
  generated: new Date().toISOString().slice(0, 10),
  investigations,
}, null, 1) + "\n");
console.log(`Wrote ${investigations.length} investigations to ${out}`);
