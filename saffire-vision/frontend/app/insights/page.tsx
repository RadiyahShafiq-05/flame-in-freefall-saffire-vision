"use client";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Notice from "@/components/Notice";
import {
  AREA_LABEL, CHALLENGE_URL, briefArea, displayName, useInsights, useInvestigations, type Area, type Investigation,
} from "@/lib/investigations";
import { AreaTag } from "../investigations/tags";
import InsightCard from "./InsightCard";

const AREAS = Object.keys(AREA_LABEL) as Area[];
const sum = (xs: (number | null)[]) => xs.reduce<number>((n, x) => n + (x ?? 0), 0);

function Count({ n, none = "Not recorded" }: { n: number | null; none?: string }) {
  if (n === null) return <span className="font-sans text-xs text-faint">{none}</span>;
  return <span className={n > 0 ? "text-ink" : "text-faint"}>{n}</span>;
}

function MoonBaseCoverage({ all }: { all: Investigation[] }) {
  const rows = all.flatMap(inv => inv.moonBase.map(m => ({ inv, m })))
    .sort((a, b) => (b.m.both ?? -1) - (a.m.both ?? -1) || (b.m.oxygen ?? 0) + (b.m.pressure ?? 0) - (a.m.oxygen ?? 0) - (a.m.pressure ?? 0));
  const both = all.filter(i => sum(i.moonBase.map(m => m.both)) > 0);
  const bothTests = sum(both.flatMap(i => i.moonBase.map(m => m.both)));
  const unmeasured = all.filter(i => briefArea(i) && !i.moonBase.length);
  return (
    <Card title="Has anyone tested fire at a Moon-base atmosphere?"
      action={<a className="link text-xs" href={CHALLENGE_URL} target="_blank" rel="noreferrer">Source: challenge brief</a>}>
      <p className="max-w-[75ch] text-sm text-muted">
        The brief gives a Moon base 30% oxygen or more at 10.2 psi or less: richer in oxygen and lower in pressure than Earth air (21% at 14.7 psi).
        This counts the tests in NASA&apos;s experiment tables that ran at those levels.
      </p>
      <p className="mt-4 max-w-[75ch] text-base leading-relaxed text-ink">
        {both.length === 0
          ? "No test in these tables ran at 30% oxygen or more and 10.2 psi or less together."
          : <>{both.length === 1 ? "Only one investigation" : `Only ${both.length} investigations`} ran tests at both levels together:{" "}
              {both.map((i, k) => <span key={i.accession}>{k > 0 && ", "}<Link className="link" href={`/investigations/${i.accession}`}>{displayName(i)}</Link></span>)},
              with <span className="num font-mono text-accent">{bothTests}</span> tests.</>}
      </p>

      <div className="mt-4 overflow-x-auto rounded-lg border border-edge">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-base/40 text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Investigation</th>
              <th scope="col" className="px-3 py-2 font-medium">Table</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Tests</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">30% O₂ or more</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">10.2 psi or less</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Both together</th>
            </tr>
          </thead>
          <tbody className="num font-mono">
            {rows.map(({ inv, m }) => (
              <tr key={`${inv.accession}-${m.table}`} className="border-t border-edge">
                <td className="px-3 py-2 font-sans"><Link className="link" href={`/investigations/${inv.accession}`}>{displayName(inv)}</Link></td>
                <td className="px-3 py-2 font-sans text-xs text-muted">{m.table}</td>
                <td className="px-3 py-2 text-right text-muted">{m.rows}</td>
                <td className="px-3 py-2 text-right"><Count n={m.oxygen} none={m.burnerOxygen ? "Burner stream only" : undefined} /></td>
                <td className="px-3 py-2 text-right"><Count n={m.pressure} /></td>
                <td className="px-3 py-2 text-right"><Count n={m.both} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 max-w-[75ch] text-xs text-faint">
        A test counts only when every value recorded for it meets the level. &quot;Not recorded&quot; means the table has no such column,
        so the count is unknown, not zero. &quot;Burner stream only&quot;: inverse-flame tables record oxygen in the burner&apos;s stream, not the surrounding air, so it is not counted.
      </p>
      {unmeasured.length > 0 && (
        <p className="mt-3 max-w-[75ch] text-sm text-muted">
          <span className="font-medium text-ink">Gap:</span> {unmeasured.map(displayName).join(", ")}{" "}
          {unmeasured.length === 1 ? "is" : "are"} named in the brief but {unmeasured.length === 1 ? "records" : "record"} neither ambient
          oxygen nor pressure, so {unmeasured.length === 1 ? "its tests" : "their tests"} cannot be placed against a Moon-base atmosphere.
        </p>
      )}
    </Card>
  );
}

export default function Insights() {
  const { data, error } = useInvestigations();
  const file = useInsights();

  const header = (
    <PageHeader title="Fire Safety Insights"
      subtitle="What NASA's microgravity fire experiments tell designers of spacecraft and Moon bases: which conditions were tested, and what each investigation means for preventing, detecting and suppressing fires." />
  );
  if (error) return <div className="space-y-6">{header}<Notice tone="warn" title="Could not load the investigation list">{error}</Notice></div>;
  if (!data || !file) return <div className="space-y-6">{header}<div className="h-64 animate-pulse rounded-lg border border-edge bg-panel motion-reduce:animate-none" role="status" aria-label="Loading insights" /></div>;

  const all = data.investigations;
  const groups: { key: string; title: React.ReactNode; items: Investigation[] }[] = [
    ...AREAS.map(a => ({ key: a, title: <AreaTag area={a} />, items: all.filter(i => briefArea(i) === a) })),
    { key: "other", title: <span className="text-sm font-medium text-muted">Not named in the brief</span>, items: all.filter(i => !briefArea(i)) },
  ];

  return (
    <div className="space-y-6">
      {header}
      <MoonBaseCoverage all={all} />

      {file === "missing" ? (
        <Notice title="SI insights have not been generated yet">
          Run <code className="font-mono text-ink">node scripts/generate-insights.mjs</code> in <code className="font-mono text-ink">frontend/</code> with
          a Gemini API key set in <code className="font-mono text-ink">GEMINI_API_KEY</code>. The Moon-base counts above come straight from NASA&apos;s tables and need no model.
        </Notice>
      ) : (
        <>
          <Notice title={file.reviewed ? "Written by SI, reviewed by the team" : "Written by SI, not yet reviewed by the team"}>
            {file.models.join(" and ")} ({file.provider}) wrote these on {file.generated} from PSI record text, the experiment-table ranges and the
            Moon-base counts above. Each statement lists the passages it rests on; open &quot;Sources cited&quot; to read them.
            Statements citing no passage, or using a number their passages do not contain, were removed automatically.
            PSI records describe aims and methods, not measured results.
          </Notice>
          {groups.map(g => {
            const items = g.items.filter(i => file.insights[i.accession]);
            if (!items.length) return null;
            return (
              <section key={g.key} aria-labelledby={`g-${g.key}`} className="space-y-3">
                <h2 id={`g-${g.key}`} className="flex items-center gap-2">
                  {g.title}<span className="num font-mono text-xs text-faint">{items.length}</span>
                </h2>
                <div className="grid gap-4 xl:grid-cols-2">
                  {items.map(i => <InsightCard key={i.accession} inv={i} insight={file.insights[i.accession]} linked level={3} />)}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
