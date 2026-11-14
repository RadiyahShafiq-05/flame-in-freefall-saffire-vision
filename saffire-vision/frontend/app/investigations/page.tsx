"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import Notice from "@/components/Notice";
import {
  AREA_LABEL, CHALLENGE_URL, FAMILY_LABEL, VARIABLE_LABEL, briefArea, displayName, family, formatBytes, isGround,
  recordedVariables, testRows, useInvestigations, years, type Area, type Family, type Investigation, type Variable,
} from "@/lib/investigations";
import { AreaTag, VariableTag } from "./tags";

const AREAS = Object.keys(AREA_LABEL) as Area[];
const FIELD = "block rounded-md border border-edge-strong bg-base px-2.5 py-1.5 text-sm text-ink";
const SORTS = {
  relevance: "Named in the brief first",
  rows: "Most test rows",
  pubs: "Most publications",
  size: "Most data",
  accession: "PSI accession",
} as const;
type Sort = keyof typeof SORTS;

// Brief-named investigations first (in the brief's prevention, detection, suppression order), then by test rows.
const areaRank = (i: Investigation) => { const a = briefArea(i); return a ? AREAS.indexOf(a) : AREAS.length; };
const accessionNo = (i: Investigation) => +i.accession.slice(4);
const COMPARE: Record<Sort, (a: Investigation, b: Investigation) => number> = {
  relevance: (a, b) => areaRank(a) - areaRank(b) || testRows(b) - testRows(a),
  rows: (a, b) => testRows(b) - testRows(a),
  pubs: (a, b) => b.publications.length - a.publications.length,
  size: (a, b) => b.totalFileSizeBytes - a.totalFileSizeBytes,
  accession: (a, b) => accessionNo(a) - accessionNo(b),
};

export default function Investigations() {
  const { data, error } = useInvestigations();
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<Area | "none" | "">("");
  const [fam, setFam] = useState<Family | "">("");
  const [vars, setVars] = useState<Variable[]>([]);
  const [sort, setSort] = useState<Sort>("relevance");

  const all = useMemo(() => data?.investigations ?? [], [data]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter(i => !q || [i.accession, i.acronym, i.title, i.objective, i.hardware].some(s => s.toLowerCase().includes(q)))
      .filter(i => !area || (area === "none" ? !briefArea(i) : briefArea(i) === area))
      .filter(i => !fam || family(i) === fam)
      .filter(i => vars.every(v => recordedVariables(i).includes(v)))
      .sort(COMPARE[sort]);
  }, [all, query, area, fam, vars, sort]);
  const filtered = query || area || fam || vars.length;
  const reset = () => { setQuery(""); setArea(""); setFam(""); setVars([]); };

  const header = (
    <PageHeader title="Combustion Investigations"
      subtitle="NASA's microgravity combustion investigations in the Physical Sciences Informatics (PSI) repository: what each studied, the hardware it used, and what its experiment tables record."
      actions={<a className="btn-ghost" href="https://psi.nasa.gov/physci/repo/search?q=combustion" target="_blank" rel="noreferrer">Open NASA PSI</a>} />
  );
  if (error) return <div className="space-y-6">{header}<Notice tone="warn" title="Could not load the investigation list">{error}</Notice></div>;
  if (!data) return <div className="space-y-6">{header}<div className="h-64 animate-pulse rounded-lg border border-edge bg-panel motion-reduce:animate-none" aria-label="Loading investigations" /></div>;

  const ground = all.filter(isGround).length;
  return (
    <div className="space-y-6">
      {header}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Investigations" value={<span className="num">{all.length}</span>}
          hint={`${all.length - ground} in microgravity, ${ground} ground studies`} />
        <StatCard label="Experiment-table test rows" value={<span className="num">{all.reduce((n, i) => n + testRows(i), 0).toLocaleString()}</span>}
          hint="One row per test or sample in PSI's tables" />
        <StatCard label="Publications listed" value={<span className="num">{all.reduce((n, i) => n + i.publications.length, 0)}</span>}
          hint={`From PSI metadata downloaded ${data.generated}`} />
      </div>

      <Card title="Fire-safety areas named in the challenge brief"
        action={<a className="link text-xs" href={CHALLENGE_URL} target="_blank" rel="noreferrer">Source: challenge brief</a>}>
        <p className="max-w-[70ch] text-sm text-muted">
          NASA&apos;s spacecraft fire-safety work aims at preventing, detecting and suppressing fires. The brief names the investigations
          below for each aim. It calls the others relevant to fire safety too, just less directly.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {AREAS.map(a => (
            <div key={a} className="rounded-md border border-edge bg-base/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <AreaTag area={a} />
                <button className="link text-xs" onClick={() => { reset(); setArea(a); }} aria-label={`Show only ${AREA_LABEL[a].toLowerCase()} investigations`}>Show only these</button>
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {all.filter(i => briefArea(i) === a).map(i => (
                  <li key={i.accession}><Link className="link text-sm" href={`/investigations/${i.accession}`}>{displayName(i)}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <section aria-labelledby="list-h" className="space-y-3">
        <h2 id="list-h" className="sr-only">All investigations</h2>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3 [&>*]:shrink-0">
          <label className="block min-w-[16rem] flex-1 space-y-1 text-xs text-muted">
            <span>Search</span>
            <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Acronym, title, objective or hardware"
              className={`${FIELD} w-full`} />
          </label>
          <label className="space-y-1 text-xs text-muted">
            <span className="block">Brief area</span>
            <select className={`${FIELD} w-48`} value={area} onChange={e => setArea(e.target.value as Area | "none" | "")}>
              <option value="">All</option>
              {AREAS.map(a => <option key={a} value={a}>{AREA_LABEL[a]}</option>)}
              <option value="none">Not named in the brief</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted">
            <span className="block">Hardware</span>
            <select className={`${FIELD} w-56`} value={fam} onChange={e => setFam(e.target.value as Family | "")}>
              <option value="">All</option>
              {(Object.keys(FAMILY_LABEL) as Family[]).map(f => <option key={f} value={f}>{FAMILY_LABEL[f]}</option>)}
            </select>
          </label>
          <fieldset className="space-y-1">
            <legend className="text-xs text-muted">Tables record</legend>
            <div className="flex gap-3 py-1.5">
              {(Object.keys(VARIABLE_LABEL) as Variable[]).map(v => (
                <label key={v} className="flex items-center gap-1.5 text-sm text-ink">
                  <input type="checkbox" className="accent-accent" checked={vars.includes(v)}
                    onChange={e => setVars(vs => e.target.checked ? [...vs, v] : vs.filter(x => x !== v))} />
                  {VARIABLE_LABEL[v]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="space-y-1 text-xs text-muted">
            <span className="block">Sort by</span>
            <select className={`${FIELD} w-56`} value={sort} onChange={e => setSort(e.target.value as Sort)}>
              {(Object.keys(SORTS) as Sort[]).map(s => <option key={s} value={s}>{SORTS[s]}</option>)}
            </select>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-muted" aria-live="polite">
          <span className="num">Showing {shown.length} of {all.length}</span>
          {filtered ? <button className="link" onClick={reset}>Clear filters</button> : null}
        </div>

        {shown.length === 0 ? (
          <EmptyState title="No investigation matches these filters" action={<button className="btn-ghost text-xs" onClick={reset}>Clear filters</button>} />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-edge">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="bg-panel text-xs text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Investigation</th>
                  <th scope="col" className="px-3 py-2 font-medium">Brief area</th>
                  <th scope="col" className="px-3 py-2 font-medium">Hardware</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Test rows</th>
                  <th scope="col" className="px-3 py-2 font-medium">Tables record</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Publications</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Data in PSI</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2 font-medium">Years (PSI)</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(i => {
                  const a = briefArea(i);
                  return (
                    <tr key={i.accession} className="border-t border-edge align-top transition-colors hover:bg-raised/60">
                      <td className="px-3 py-2.5">
                        <Link href={`/investigations/${i.accession}`} className="group block">
                          <span className="font-medium text-ink group-hover:text-accent">{displayName(i)}</span>
                          <span className="ml-2 font-mono text-xs text-faint">{i.accession}</span>
                          <span className="block max-w-md text-xs text-muted">{i.title}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">{a ? <AreaTag area={a} /> : <span className="text-xs text-faint">Not named</span>}</td>
                      <td className="px-3 py-2.5 text-xs text-muted">{FAMILY_LABEL[family(i)]}</td>
                      <td className="num px-3 py-2.5 text-right font-mono text-ink">{i.tables.length ? testRows(i).toLocaleString() : <span className="text-faint">No table</span>}</td>
                      <td className="px-3 py-2.5"><div className="flex flex-wrap gap-1">{recordedVariables(i).map(v => <VariableTag key={v} variable={v} />)}</div></td>
                      <td className="num px-3 py-2.5 text-right font-mono text-ink">{i.publications.length}</td>
                      <td className="num whitespace-nowrap px-3 py-2.5 text-right font-mono text-muted">{formatBytes(i.totalFileSizeBytes)}</td>
                      <td className="num whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted">{years(i) || <span className="text-faint">Not listed</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="max-w-[70ch] text-xs text-faint">
          &quot;Tables record&quot; matches column names in each experiment table, so it shows what was measured, not whether every row has a value.
          Years and other fields are shown exactly as PSI lists them.
        </p>
      </section>
    </div>
  );
}
