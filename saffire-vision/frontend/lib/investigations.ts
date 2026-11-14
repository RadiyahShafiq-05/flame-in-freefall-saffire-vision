"use client";
import { useEffect, useState } from "react";

export interface Publication { title: string; authors: string; doi: string }
export interface ExperimentTable { name: string; rows: number; columns: string[] }
export interface Investigation {
  accession: string; acronym: string; title: string; subResearchArea: string; projectType: string;
  hardware: string; hardwareLink: string; platform: string; managingCenter: string;
  startDate: string; endDate: string; doi: string; license: string; objective: string;
  publications: Publication[]; tables: ExperimentTable[]; totalFileSizeBytes: number; related: string[]; modifiedDate: string;
}
interface Catalog { source: string; generated: string; investigations: Investigation[] }

// Built by scripts/build-investigations.mjs from PSI metadata; served as a static file so it can be
// regenerated without a code change.
export function useInvestigations() {
  const [data, setData] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/data/investigations.json")
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch(e => setError(e.message));
  }, []);
  return { data, error };
}

export const CHALLENGE_URL = "https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/";
export const psiUrl = (accession: string) => `https://psi.nasa.gov/physci/repo/data/investigations/${accession}`;
export const doiUrl = (doi: string) => `https://doi.org/${doi}`;
export const SAFFIRE_VISION_SOURCE = "PSI-98";

// The challenge brief names these investigations for NASA's three fire-safety aims. Each note paraphrases the
// brief; investigations it does not name are "still relevant to fire safety, just not as strongly or directly".
export type Area = "flammability" | "detection" | "suppression";
export const AREA_LABEL: Record<Area, string> = { flammability: "Flammability", detection: "Detection", suppression: "Suppression" };
const BRIEF: Record<string, { area?: Area; note: string }> = {
  "PSI-26": { area: "flammability", note: "Named in the brief as a flammability study of solid materials such as fabrics and plastics." },
  "PSI-25": { area: "flammability", note: "Named in the brief as a flammability study of solid materials such as fabrics and plastics." },
  "PSI-98": { area: "flammability", note: "Named in the brief as a flammability study of solid materials such as fabrics and plastics." },
  "PSI-99": { area: "flammability", note: "Named in the brief as a flammability study of solid materials such as fabrics and plastics." },
  "PSI-100": { area: "flammability", note: "Named in the brief as a flammability study of solid materials such as fabrics and plastics." },
  "PSI-20": { area: "flammability", note: "Burned gaseous fuels, but the brief describes it as a study of materials flammability in still atmospheres." },
  "PSI-102": { area: "detection", note: "Named in the brief as the microgravity test of fire detection." },
  "PSI-101": { area: "detection", note: "Named in the brief as the microgravity test of fire detection." },
  "PSI-69": { area: "suppression", note: "Named in the brief as the suppression study: diluting the chamber atmosphere with carbon dioxide and helium." },
  "PSI-47": { note: "The brief notes it used one of the SAME smoke-detection instruments to measure dust instead." },
  "PSI-159": { note: "The brief notes these were the microgravity tests with the highest oxygen concentrations." },
};
export const briefArea = (i: Investigation) => BRIEF[i.accession]?.area;
export const briefNote = (i: Investigation) => BRIEF[i.accession]?.note;

// Hardware families as the brief groups them; anything else keeps PSI's own hardware text.
export type Family = "acme" | "mdca" | "msg" | "other" | "ground";
export const FAMILY_LABEL: Record<Family, string> = {
  acme: "ACME in the CIR", mdca: "MDCA droplets in the CIR", msg: "MSG flow duct", other: "Other flight hardware", ground: "Ground study",
};
const FAMILY: Record<string, Family> = {
  "PSI-10": "acme", "PSI-20": "acme", "PSI-21": "acme", "PSI-22": "acme", "PSI-23": "acme", "PSI-159": "acme",
  "PSI-69": "mdca", "PSI-68": "mdca", "PSI-39": "mdca",
  "PSI-26": "msg", "PSI-25": "msg", "PSI-107": "msg", "PSI-106": "msg",
};
export const isGround = (i: Investigation) => /ground/i.test(i.projectType);
export const family = (i: Investigation): Family => FAMILY[i.accession] ?? (isGround(i) ? "ground" : "other");

// Matched on column names only, so a match means the table has such a column, not that values are filled in.
export type Variable = "oxygen" | "flow" | "pressure";
export const VARIABLE_LABEL: Record<Variable, string> = { oxygen: "Oxygen", flow: "Air flow", pressure: "Pressure" };
const VARIABLE_TEST: Record<Variable, RegExp> = {
  oxygen: /oxygen|(^|[^a-z])x?o2([^a-z]|$)|^o initial/i,
  flow: /air ?flow|flow velocity|air rate|inlet velocity/i,
  pressure: /pressure|\((atm|bar)\)|mmhg|approx p /i,
};
export const columnVariable = (column: string) => (Object.keys(VARIABLE_TEST) as Variable[]).find(v => VARIABLE_TEST[v].test(column));
export const recordedVariables = (i: Investigation) =>
  (Object.keys(VARIABLE_TEST) as Variable[]).filter(v => i.tables.some(t => t.columns.some(c => VARIABLE_TEST[v].test(c))));

export const testRows = (i: Investigation) => i.tables.reduce((n, t) => n + t.rows, 0);
export const displayName = (i: Investigation) => i.acronym || i.accession;

export function formatBytes(b: number) {
  if (b >= 1e12) return `${(b / 1e12).toFixed(2)} TB`;
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${Math.round(b / 1e6)} MB`;
  return b > 0 ? "< 1 MB" : "None listed";
}

// PSI dates are MM-DD-YYYY strings and some are blank.
const year = (d: string) => /\d{4}$/.exec(d)?.[0] ?? "";
export function years(i: Investigation) {
  const [a, b] = [year(i.startDate), year(i.endDate)];
  if (!a && !b) return "";
  if (a && b) return a === b ? a : `${a}–${b}`;
  return a ? `${a}–` : `–${b}`;
}
