"use client";
import Link from "next/link";
import { useState } from "react";
import Card from "@/components/Card";
import {
  CHALLENGE_URL, CONDITION_AXIS, VARIABLE_LABEL, displayName, fmtRange, fmtValue,
  type Condition, type Investigation, type Variable,
} from "@/lib/investigations";

const VARIABLES = Object.keys(VARIABLE_LABEL) as Variable[];
const UNIT: Record<Variable, string> = { oxygen: "%", flow: "cm/s", pressure: "psi" };
const UNIT_NOTE: Record<Variable, string> = {
  oxygen: "Oxygen in % by volume (mole fractions × 100).",
  flow: "Air flow speed past the sample in cm/s.",
  pressure: "Pressure in psi (converted from atm, bar or mmHg), the unit the challenge brief uses.",
};

interface Row { inv: Investigation; c: Condition; multi: boolean }

// Label column, track and value column widths; the reference-line overlay lines up with the track using them.
const GRID = "grid grid-cols-[11rem_minmax(0,1fr)_8.5rem] items-center gap-x-4";

export default function ConditionsChart({ investigations }: { investigations: Investigation[] }) {
  const [variable, setVariable] = useState<Variable>("oxygen");
  const axis = CONDITION_AXIS[variable];
  const pct = (v: number) => `${Math.min(100, (v / axis.max) * 100)}%`;

  const rows: Row[] = investigations.flatMap(inv => {
    const cs = inv.conditions.filter(c => c.variable === variable);
    return cs.map(c => ({ inv, c, multi: cs.length > 1 }));
  });
  const byMax = (a: Row, b: Row) => b.c.max - a.c.max || b.c.min - a.c.min;
  const ambient = rows.filter(r => r.c.context !== "oxidizer").sort(byMax);
  const oxidizer = rows.filter(r => r.c.context === "oxidizer").sort(byMax);
  const ticks = Array.from({ length: axis.max / axis.step + 1 }, (_, i) => i * axis.step);

  const renderRow = ({ inv, c, multi }: Row) => {
    const point = c.min === c.max;
    const dashed = c.context === "oxidizer";
    return (
      <li key={`${inv.accession}-${c.table}-${c.column}`}>
        <Link href={`/investigations/${inv.accession}`} className={`${GRID} group rounded py-1.5 hover:bg-raised/60 focus-visible:bg-raised/60`}
          aria-label={`${displayName(inv)}${multi ? `, ${c.table}` : ""}: ${fmtRange(c)}, from ${c.rowsWithValue} of ${c.rows} test rows`}>
          <span className="min-w-0 text-sm leading-tight text-ink group-hover:text-accent">
            <span className="block truncate">{displayName(inv)}</span>
            {multi && <span className="block truncate text-xs text-faint">{c.table.replace(/^.*_/, "")}</span>}
          </span>
          <span className="relative h-3">
            <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-edge" aria-hidden="true" />
            {point ? (
              <span className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-panel ${dashed ? "border-2 border-accent bg-panel" : "bg-accent"}`}
                style={{ left: pct(c.min) }} aria-hidden="true" />
            ) : (
              <span className={`absolute top-0 h-3 rounded ${dashed ? "border-2 border-dashed border-accent bg-accent/10" : "bg-accent"}`}
                style={{ left: pct(c.min), width: `max(0.5rem, calc(${pct(c.max)} - ${pct(c.min)}))` }} aria-hidden="true" />
            )}
            <span role="tooltip"
              className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 hidden w-72 rounded-md border border-edge-strong bg-raised p-2.5 text-xs text-muted shadow-lg group-hover:block group-focus-visible:block"
              style={{ left: `min(${pct(c.min)}, calc(100% - 18rem))` }}>
              <span className="block font-medium text-ink">{displayName(inv)} · {fmtRange(c)}</span>
              <span className="block">Column &quot;{c.column}&quot; in table {c.table}</span>
              <span className="num block">{c.rowsWithValue} of {c.rows} test rows have a value</span>
              {c.note && <span className="block text-warn">{c.note}</span>}
            </span>
          </span>
          <span className="num whitespace-nowrap text-right font-mono text-xs text-muted">{fmtRange(c)}</span>
        </Link>
      </li>
    );
  };

  const overlay = (
    <div className="pointer-events-none absolute inset-y-0 left-[12rem] right-[9.5rem]" aria-hidden="true">
      {axis.refs.map(r => (
        <span key={r.at} className="absolute inset-y-0 border-l border-dashed border-muted/60" style={{ left: pct(r.at) }} />
      ))}
    </div>
  );

  return (
    <Card title="Test conditions across investigations"
      action={
        <div role="radiogroup" aria-label="Condition" className="flex rounded-md border border-edge-strong p-0.5">
          {VARIABLES.map(v => (
            <button key={v} role="radio" aria-checked={variable === v} onClick={() => setVariable(v)}
              className={`rounded px-3 py-1 text-xs transition-colors ${variable === v ? "bg-accent/15 font-medium text-accent" : "text-muted hover:text-ink"}`}>
              {VARIABLE_LABEL[v]}
            </button>
          ))}
        </div>
      }>
      <p className="max-w-[75ch] text-sm text-muted">
        Lowest to highest value recorded in each investigation&apos;s experiment table; a dot is a single value. {UNIT_NOTE[variable]}{" "}
        {axis.refs.length > 0 && <>Dashed lines mark levels from the <a className="link" href={CHALLENGE_URL} target="_blank" rel="noreferrer">challenge brief</a>.</>}
      </p>

      <div className="mt-5 space-y-1">
        {axis.refs.length > 0 && (
          <div className={GRID}>
            <span />
            <span className="relative h-8">
              {axis.refs.map((r, k) => (
                <span key={r.at} className="absolute -translate-x-1/2 whitespace-nowrap text-xs text-muted"
                  style={{ left: pct(r.at), top: k % 2 ? "1rem" : 0 }}>{r.label}</span>
              ))}
            </span>
            <span />
          </div>
        )}

        <div className="relative">
          {overlay}
          <ul>{ambient.map(renderRow)}</ul>
        </div>

        {oxidizer.length > 0 && (
          <div className="relative pt-3">
            {overlay}
            <p className="mb-1 flex items-center gap-2 text-xs text-muted">
              <span className="inline-block h-3 w-6 rounded border-2 border-dashed border-accent bg-accent/10" aria-hidden="true" />
              Inverse flames: oxygen in the burner&apos;s oxidizer stream, not the surrounding atmosphere. Not comparable with habitat levels.
            </p>
            <ul>{oxidizer.map(renderRow)}</ul>
          </div>
        )}

        <div className={GRID}>
          <span />
          <span className="relative mt-1 h-5 border-t border-edge">
            {ticks.map(t => (
              <span key={t} className="num absolute top-1 -translate-x-1/2 font-mono text-xs text-faint" style={{ left: pct(t) }}>{fmtValue(t)}</span>
            ))}
          </span>
          <span className="text-xs text-faint">{UNIT[variable]}</span>
        </div>
      </div>

      <p className="mt-4 text-xs text-faint">
        {rows.length} ranges from {new Set(rows.map(r => r.inv.accession)).size} investigations. Investigations whose tables do not record this condition are not shown.
        Column choices and unit conversions are listed on each investigation&apos;s page.
      </p>
    </Card>
  );
}
