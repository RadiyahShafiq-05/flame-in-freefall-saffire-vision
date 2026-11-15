// Generates public/data/insights.json: SI-written fire-safety insights for each PSI investigation, grounded in
// numbered source passages from public/data/investigations.json (run build-investigations.mjs first).
// Usage (PowerShell):  $env:GEMINI_API_KEY = "<your key>"; node scripts/generate-insights.mjs [PSI-98 ...]
// With accessions given, only those are regenerated; the others are kept. Never commit the key.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-4-hydrogen";
if (!KEY) {
  console.error('Set GEMINI_API_KEY first, e.g. $env:GEMINI_API_KEY = "<key from aistudio.google.com>"');
  process.exit(1);
}

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "data");
const { investigations } = JSON.parse(readFileSync(join(dataDir, "investigations.json"), "utf8"));
const outFile = join(dataDir, "insights.json");
// Free-tier daily limits can stop a run part-way, so a rerun may use another model; each insight records its own.
const prevFile = existsSync(outFile) ? JSON.parse(readFileSync(outFile, "utf8")) : { insights: {} };
const previous = Object.fromEntries(Object.entries(prevFile.insights).map(([acc, ins]) => [acc, { model: prevFile.model, ...ins }]));
const only = process.argv.slice(2);

const fmt = v => String(Number(v.toFixed(1)));
const range = c => (c.min === c.max ? fmt(c.min) : `${fmt(c.min)} to ${fmt(c.max)}`) + ` ${c.unit}`;
const VARIABLE = { oxygen: "Ambient oxygen", flow: "Air flow speed", pressure: "Pressure" };
const count = (n, rows, what) => (n === null ? `${what}: not recorded` : `${n} of ${rows} tests at ${what}`);

// Every passage the model may cite, keyed by a short id shown next to each claim in the app.
function sources(inv) {
  const s = {
    BRIEF: { label: "Challenge brief", text: "The challenge brief gives a Moon base atmosphere of 30% oxygen or more at 10.2 psi or less. Earth air is 21% oxygen at 14.7 psi; a spacesuit is 4.3 psi." },
  };
  if (inv.objective) s.O = { label: "PSI objective", text: inv.objective };
  if (inv.approach) s.A = { label: "PSI approach", text: inv.approach };
  if (inv.hypothesis) s.H = { label: "PSI hypothesis", text: inv.hypothesis };
  if (inv.impacts) s.I = { label: "PSI research impacts", text: inv.impacts };
  inv.conditions.forEach((c, k) => {
    const what = c.context === "oxidizer" ? "Oxygen in the burner's oxidizer stream (inverse flame, not the surrounding atmosphere)" : VARIABLE[c.variable];
    s[`C${k + 1}`] = { label: `Test conditions · ${c.table}`, text: `${what}: ${range(c)}, lowest to highest in column "${c.column}" of table ${c.table}; ${c.rowsWithValue} of ${c.rows} tests have a value.` };
  });
  inv.moonBase.forEach((m, k) => {
    s[`M${k + 1}`] = { label: `Moon-base atmosphere · ${m.table}`, text: `Table ${m.table}: ${m.burnerOxygen ? "ambient oxygen: not recorded (its oxygen values are the burner stream's)" : count(m.oxygen, m.rows, "30% oxygen or more")}; ${count(m.pressure, m.rows, "10.2 psi or less")}; ${count(m.both, m.rows, "30% oxygen or more and 10.2 psi or less together")}.` };
  });
  inv.publications.slice(0, 12).forEach((p, k) => { if (p.title) s[`P${k + 1}`] = { label: "Publication title", text: p.title }; });
  return s;
}

const SYSTEM = `You write fire-safety insights about one NASA microgravity combustion investigation for spacecraft and Moon-base designers.
Use only the numbered source passages you are given. Every item must list the ids of the passages that support it.
PSI records describe aims, methods and expected impacts, not measured results: never present an aim or hypothesis as a finding, and say "aimed to" or "was designed to" for them.
Only use numbers that appear in the passages you cite. If the passages do not show tests at the Moon-base atmosphere, say so plainly; never guess.
Plain English, short sentences, no marketing language.`;

const item = { type: "object", properties: { text: { type: "string" }, sources: { type: "array", items: { type: "string" } } }, required: ["text", "sources"] };
const SCHEMA = {
  type: "object",
  properties: {
    summary: { ...item, description: "Two sentences: what the investigation studied and how." },
    fireSafety: { type: "array", items: item, minItems: 1, maxItems: 4, description: "What this record means for preventing, detecting or suppressing spacecraft fires." },
    habitat: { ...item, description: "How its tested conditions relate to the Moon-base atmosphere in the brief." },
    caveats: { type: "array", items: item, maxItems: 2, description: "Limits a designer should know before relying on it." },
  },
  required: ["summary", "fireSafety", "habitat", "caveats"],
};

async function ask(input) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "x-goog-api-key": KEY, "Content-Type": "application/json", "Api-Revision": "2026-05-20" },
      body: JSON.stringify({ model: MODEL, system_instruction: SYSTEM, input, response_format: { type: "text", mime_type: "application/json", schema: SCHEMA } }),
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const wait = 15 * attempt;
      console.log(`  HTTP ${res.status}, retrying in ${wait}s`);
      await new Promise(r => setTimeout(r, wait * 1000));
      continue;
    }
    const body = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(body).slice(0, 500)}`);
    const text = typeof body.output_text === "string" ? body.output_text
      : body.steps?.flatMap(s => s.content ?? []).filter(b => b.type === "text").map(b => b.text).at(-1);
    if (!text) throw new Error(`No text in response: ${JSON.stringify(body).slice(0, 500)}`);
    return JSON.parse(text);
  }
}

// Drops any claim that cites no known passage, or uses a number none of its cited passages contains.
function verify(it, src, dropped) {
  const ids = (it?.sources ?? []).filter(id => src[id]);
  if (!it?.text || !ids.length) { dropped.push({ text: it?.text ?? "", reason: "cites no known source" }); return null; }
  const cited = ids.map(id => src[id].text).join(" ");
  const missing = (it.text.match(/\d+(?:\.\d+)?/g) ?? []).filter(n => !new RegExp(`(?<![\\d.])${n.replace(".", "\\.")}(?![\\d]|\\.\\d)`).test(cited));
  if (missing.length) { dropped.push({ text: it.text, reason: `number not in cited sources: ${missing.join(", ")}` }); return null; }
  return { text: it.text, sources: ids };
}

const insights = { ...previous };
for (const inv of investigations) {
  if (only.length && !only.includes(inv.accession)) continue;
  const src = sources(inv);
  const input = `Investigation ${inv.accession} (${inv.acronym || inv.title}): ${inv.title}. Platform: ${inv.platform || "not listed"}. Type: ${inv.projectType}.\n\nSource passages:\n` +
    Object.entries(src).map(([id, p]) => `[${id}] ${p.label}: ${p.text}`).join("\n\n");
  process.stdout.write(`${inv.accession} ${inv.acronym}... `);
  try {
    const out = await ask(input);
    const dropped = [];
    const list = xs => (xs ?? []).map(x => verify(x, src, dropped)).filter(Boolean);
    insights[inv.accession] = {
      model: MODEL,
      summary: verify(out.summary, src, dropped),
      fireSafety: list(out.fireSafety),
      habitat: verify(out.habitat, src, dropped),
      caveats: list(out.caveats),
      dropped,
      sources: src,
    };
    console.log(dropped.length ? `ok, ${dropped.length} claim(s) dropped` : "ok");
  } catch (e) {
    console.log(`failed: ${e.message}`);
  }
}

writeFileSync(outFile, JSON.stringify({
  models: [...new Set(Object.values(insights).map(i => i.model))],
  provider: "Google Gemini API (AI Studio)",
  generated: new Date().toISOString().slice(0, 10),
  reviewed: false,
  insights,
}, null, 1) + "\n");
console.log(`Wrote ${Object.keys(insights).length} of ${investigations.length} investigations to ${outFile}`);
