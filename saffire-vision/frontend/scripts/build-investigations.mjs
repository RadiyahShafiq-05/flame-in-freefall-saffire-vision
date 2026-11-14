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

// Test conditions, mapped by hand per table because each team recorded them differently. Every entry names
// its source column; values are converted to one unit per variable (oxygen %, air flow cm/s, pressure psi,
// the unit the challenge brief uses). "oxidizer" marks inverse flames, where the oxygen value is the burner's
// oxidizer stream rather than the surrounding atmosphere.
const TO_PSI = { atm: 14.6959, bar: 14.5038, mmHg: 0.0193368 };
const CONDITIONS = {
  "PSI-10": {
    "Flame Design_Normal Flame": [{ variable: "oxygen", column: "XO2 (init)", unit: "fraction" }, { variable: "pressure", column: "pinit (atm)", unit: "atm" }],
    "Flame Design_Inverse Flame": [{ variable: "oxygen", column: "XO2", unit: "fraction", context: "oxidizer" }, { variable: "pressure", column: "pinit (atm)", unit: "atm" }],
  },
  "PSI-159": {
    "CFI-G_Normal Flames": [{ variable: "oxygen", column: "XO2 before test", unit: "fraction" }, { variable: "pressure", column: "approx p (bar)", unit: "bar" }],
    "CFI-G_Inverse Flames": [{ variable: "oxygen", column: "XO2", unit: "fraction", context: "oxidizer" }, { variable: "pressure", column: "approx p (bar)", unit: "bar" }],
  },
  // Two cells read "3400%" and "2100%": spreadsheet percent formatting of 34 and 21.
  "PSI-20": { "ACME BRE": [{ variable: "oxygen", column: "Oxygen Conc (percent)", unit: "percent", percentFormatted: true }] },
  "PSI-25": { "BASS-II": [{ variable: "oxygen", column: "Calibrated initial O2 % by vol", unit: "percent" }] },
  "PSI-39": { "CFI": [{ variable: "oxygen", column: "Oxygen", unit: "fraction" }, { variable: "pressure", column: "Pressure", unit: "atm" }] },
  "PSI-68": { "Flex2": [
    { variable: "oxygen", column: "Oxygen Mole Fraction", unit: "fraction" },
    { variable: "pressure", column: "Ambient Pressure (atm)", unit: "atm" },
    { variable: "flow", column: "Flow Velocity (cm/s)", unit: "cm/s" },
  ] },
  "PSI-69": { "FLEX": [
    { variable: "oxygen", column: "O initial ambient composition; mole fraction", unit: "fraction" },
    { variable: "pressure", column: "Ambient pressure; mmHg", unit: "mmHg", keep: v => v > 0,
      note: "One test row reads 0 mmHg, which cannot sustain a flame; it is treated as missing." },
  ] },
  "PSI-98": { "SAFFIRE-1": [{ variable: "oxygen", column: "Percent O2", unit: "percent" }, { variable: "flow", column: "Air Flow (cm/s)", unit: "cm/s" }] },
  "PSI-99": { "SAFFIRE-2": [{ variable: "oxygen", column: "Percent O2 (Note 1)", unit: "percent" }, { variable: "flow", column: "Air Flow (cm/s)", unit: "cm/s" }] },
  "PSI-100": { "SAFFIRE-3": [{ variable: "flow", column: "Air Flow", unit: "cm/s" }] },
  "PSI-101": { "SAME-R": [{ variable: "flow", column: "Inlet velocity (cm/s)", unit: "cm/s" }] },
  "PSI-102": { "SAME": [{ variable: "flow", column: "Air Flow (cm/s)", unit: "cm/s" }] },
  "PSI-107": { "Spice": [{ variable: "flow", column: "Air Rate (cm/s)", unit: "cm/s", keep: v => v >= 0,
    note: "Negative readings (as low as -5.92 cm/s) are left out: a flow speed cannot be negative." }] },
};
const NORMAL_UNIT = { oxygen: "%", flow: "cm/s", pressure: "psi" };

// A cell may hold one value, a range ("21.5 - 21.7", "22.1 to 22.0") or a list ("0.17; 0.21; 0.3"); every number
// counts. Digits inside words ("LOW O2") are not values, and a minus only counts when it touches the number.
function cellValues(cell, spec) {
  return [...cell.matchAll(/(?<![A-Za-z\d.])-?\d+(?:\.\d+)?%?/g)].map(([m]) => {
    let v = parseFloat(m);
    if (spec.percentFormatted && m.endsWith("%") && v > 100) v /= 100;
    if (spec.unit === "fraction") v *= 100;
    if (TO_PSI[spec.unit]) v *= TO_PSI[spec.unit];
    return v;
  });
}

function conditions(acc, tableName, header, body) {
  return (CONDITIONS[acc]?.[tableName] ?? []).map(spec => {
    const i = header.findIndex(h => clean(h) === spec.column);
    if (i < 0) throw new Error(`${acc} ${tableName}: column "${spec.column}" not found; the PSI table changed, update CONDITIONS`);
    const keep = spec.keep ?? (() => true);
    const parsed = body.map(r => cellValues(r[i] ?? "", spec));
    const perRow = parsed.map(vs => vs.filter(keep)).filter(vs => vs.length);
    const excluded = parsed.flat().filter(v => !keep(v)).length;
    const all = perRow.flat();
    const round = v => Math.round(v * 100) / 100;
    return {
      variable: spec.variable, unit: NORMAL_UNIT[spec.variable], min: round(Math.min(...all)), max: round(Math.max(...all)),
      rowsWithValue: perRow.length, rows: body.length, table: tableName, column: spec.column, sourceUnit: spec.unit,
      ...(spec.context && { context: spec.context }),
      ...(excluded && { excluded, note: spec.note }),
    };
  });
}
const accessions = readdirSync(src).filter(d => /^PSI-\d+$/.test(d)).sort((a, b) => +a.slice(4) - +b.slice(4));

const investigations = accessions.map(acc => {
  const dir = join(src, acc);
  const m = JSON.parse(readFileSync(join(dir, "investigation.json"), "utf8"));
  const testConditions = [];
  const tables = readdirSync(dir).filter(f => f.endsWith(".csv")).sort().map(f => {
    const [header = [], ...body] = parseCsv(readText(join(dir, f)));
    const name = clean(f.replace(/\.csv$/, "").replace(/^PSI-\d+_Experimental table_/, ""));
    testConditions.push(...conditions(m.accession, name, header, body));
    return { name, rows: body.length, columns: header.map(clean).filter(Boolean) };
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
    conditions: testConditions,
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
