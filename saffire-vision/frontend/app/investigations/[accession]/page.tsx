"use client";
import Link from "next/link";
import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Notice from "@/components/Notice";
import {
  CHALLENGE_URL, FAMILY_LABEL, SAFFIRE_VISION_SOURCE, VARIABLE_LABEL, briefArea, briefNote, columnVariable, displayName, doiUrl, family,
  fmtRange, formatBytes, isGround, psiUrl, testRows, useInsights, useInvestigations, years,
} from "@/lib/investigations";
import { AreaTag, VariableTag } from "../tags";
import InsightCard from "../../insights/InsightCard";

const PUBS_SHOWN = 8;

function Back() {
  return (
    <Link href="/investigations" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
      All investigations
    </Link>
  );
}

export default function InvestigationDetail({ params }: { params: { accession: string } }) {
  const { data, error } = useInvestigations();
  const insights = useInsights();
  const [allPubs, setAllPubs] = useState(false);

  if (error) return <div className="space-y-6"><Back /><Notice tone="warn" title="Could not load the investigation list">{error}</Notice></div>;
  if (!data) return <div className="space-y-6"><Back /><div className="h-64 animate-pulse rounded-lg border border-edge bg-panel motion-reduce:animate-none" aria-label="Loading investigation" /></div>;

  const inv = data.investigations.find(i => i.accession === params.accession);
  if (!inv) return (
    <div className="space-y-6"><Back />
      <EmptyState title={`${params.accession} is not in the list`} body="Only the 24 combustion investigations downloaded from NASA PSI are included." /></div>
  );

  const area = briefArea(inv);
  const note = briefNote(inv);
  const pubs = allPubs ? inv.publications : inv.publications.slice(0, PUBS_SHOWN);
  const facts: [string, React.ReactNode][] = [
    ["Accession", <span key="a" className="font-mono">{inv.accession}</span>],
    ["Type", inv.projectType || "Not listed"],
    ["Research area", inv.subResearchArea || "Not listed"],
    ["Platform", inv.platform || "Not listed"],
    ["Hardware", inv.hardwareLink
      ? <a key="h" className="link" href={inv.hardwareLink} target="_blank" rel="noreferrer">{inv.hardware || "Hardware page"}</a>
      : inv.hardware || "Not listed"],
    ["Managing center", inv.managingCenter || "Not listed"],
    ["Dates", [inv.startDate, inv.endDate].filter(Boolean).join(" to ") || "Not listed"],
    ["Data in PSI", formatBytes(inv.totalFileSizeBytes)],
    ["Licence", inv.license || "Not listed"],
    ["PSI record updated", inv.modifiedDate || "Not listed"],
  ];

  return (
    <div className="space-y-6">
      <Back />
      <PageHeader title={displayName(inv)} subtitle={inv.title}
        actions={<>
          <a className="btn" href={psiUrl(inv.accession)} target="_blank" rel="noreferrer">Open on NASA PSI</a>
          {inv.doi && <a className="btn-ghost" href={doiUrl(inv.doi)} target="_blank" rel="noreferrer">DOI {inv.doi}</a>}
        </>} />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {area && <AreaTag area={area} />}
        {isGround(inv)
          ? <span className="rounded border border-edge px-1.5 py-0.5 text-muted">Ground study</span>
          : <>
              <span className="rounded border border-edge px-1.5 py-0.5 text-muted">Microgravity</span>
              <span className="rounded border border-edge px-1.5 py-0.5 text-muted">{FAMILY_LABEL[family(inv)]}</span>
            </>}
        {years(inv) && <span className="num rounded border border-edge px-1.5 py-0.5 font-mono text-muted">{years(inv)}</span>}
        {inv.accession === SAFFIRE_VISION_SOURCE && (
          <Link href="/dataset" className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 font-medium text-accent hover:bg-accent/20">
            Used by SAFFIRE Vision: open its grid images
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <Card title="Objective">
            {inv.objective
              ? <p className="max-w-[75ch] whitespace-pre-line text-sm leading-relaxed text-ink">{inv.objective}</p>
              : <p className="text-sm text-muted">PSI lists no objective for this investigation.</p>}
          </Card>

          {inv.conditions.length > 0 && (
            <Card title="Test conditions">
              <dl className="space-y-3">
                {inv.conditions.map(c => (
                  <div key={`${c.table}-${c.column}`} className="grid gap-x-4 gap-y-0.5 sm:grid-cols-[9rem_1fr]">
                    <dt className="text-sm text-muted">{VARIABLE_LABEL[c.variable]}{c.context === "oxidizer" && <span className="block text-xs text-faint">burner oxidizer stream</span>}</dt>
                    <dd className="min-w-0">
                      <span className="num font-mono text-sm text-ink">{fmtRange(c)}</span>
                      <span className="block text-xs text-muted">
                        From &quot;{c.column}&quot; in {c.table}{c.sourceUnit !== c.unit && `, converted from ${c.sourceUnit === "fraction" ? "mole fraction" : c.sourceUnit}`}; {c.rowsWithValue} of {c.rows} rows have a value.
                      </span>
                      {c.note && <span className="block text-xs text-warn">{c.note}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-faint">Lowest and highest value in each column, so a range covers every test in the table, not one run.</p>
            </Card>
          )}

          <Card title={`Experiment tables · ${inv.tables.length}`}>
            {inv.tables.length ? (
              <div className="space-y-5">
                <p className="max-w-[70ch] text-xs text-muted">
                  Each row is one test or sample. Columns highlighted in cyan record oxygen, air flow or pressure, the test conditions the challenge brief asks teams to compare.
                </p>
                {inv.tables.map(t => (
                  <div key={t.name} className="space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm font-medium text-ink">{t.name}</h3>
                      <span className="num font-mono text-xs text-muted">{t.rows.toLocaleString()} rows · {t.columns.length} columns</span>
                    </div>
                    <ul className="flex flex-wrap gap-1.5">
                      {t.columns.map((c, k) => {
                        const v = columnVariable(c);
                        return (
                          <li key={k} className={`rounded border px-1.5 py-0.5 text-xs ${v ? "border-accent/40 bg-accent/10 text-accent" : "border-edge text-muted"}`}>{c}</li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
                <p className="text-xs text-faint">The table files themselves are on NASA PSI.</p>
              </div>
            ) : <p className="text-sm text-muted">PSI has no experiment table for this investigation.</p>}
          </Card>

          <Card title={`Publications · ${inv.publications.length}`}>
            {inv.publications.length ? (
              <>
                <ol className="space-y-3">
                  {pubs.map((p, k) => (
                    <li key={k} className="text-sm">
                      {p.doi ? <a className="link" href={doiUrl(p.doi)} target="_blank" rel="noreferrer">{p.title || p.doi}</a> : <span className="text-ink">{p.title}</span>}
                      {p.authors && <span className="block text-xs text-muted">{p.authors}</span>}
                    </li>
                  ))}
                </ol>
                {inv.publications.length > PUBS_SHOWN && (
                  <button className="btn-ghost mt-4 text-xs" onClick={() => setAllPubs(v => !v)}>
                    {allPubs ? "Show fewer" : `Show all ${inv.publications.length}`}
                  </button>
                )}
              </>
            ) : <p className="text-sm text-muted">PSI lists no publications for this investigation.</p>}
          </Card>

          {insights && insights !== "missing" && insights.insights[inv.accession] && (
            <div className="space-y-3">
              <Notice title={insights.reviewed ? "Written by SI, reviewed by the team" : "Written by SI, not yet reviewed by the team"}>
                This reading restates the PSI record. It is not a measured fire result.{" "}
                <Link className="link" href="/insights">All fire-safety insights</Link>
              </Notice>
              <InsightCard inv={inv} insight={insights.insights[inv.accession]} />
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <Card title="Challenge brief" action={<a className="link text-xs" href={CHALLENGE_URL} target="_blank" rel="noreferrer">Source</a>}>
            <p className="text-sm text-muted">
              {note ?? "Not named in the brief, which calls the other PSI combustion investigations relevant to fire safety, just less directly."}
            </p>
          </Card>

          <Card title="Facts from PSI">
            <dl className="space-y-2.5 text-sm">
              {facts.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[8.5rem_1fr] gap-3">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="min-w-0 break-words text-ink">{v}</dd>
                </div>
              ))}
              <div className="grid grid-cols-[8.5rem_1fr] gap-3">
                <dt className="text-xs text-muted">Test rows</dt>
                <dd className="num font-mono text-ink">{testRows(inv).toLocaleString()}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-faint">Shown exactly as PSI lists them, including any errors in the source record.</p>
          </Card>

          {inv.related.length > 0 && (
            <Card title="Related in PSI">
              <ul className="space-y-1.5 text-sm">
                {inv.related.map(acc => {
                  const r = data.investigations.find(i => i.accession === acc);
                  return (
                    <li key={acc}>
                      {r ? <Link className="link" href={`/investigations/${acc}`}>{displayName(r)}</Link> : <span className="text-muted">{acc}</span>}
                      <span className="ml-2 font-mono text-xs text-faint">{acc}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
