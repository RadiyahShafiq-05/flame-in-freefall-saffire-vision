import Link from "next/link";
import Card from "@/components/Card";
import { displayName, type Claim, type Insight, type Investigation } from "@/lib/investigations";

function Cites({ ids, insight }: { ids: string[]; insight: Insight }) {
  return (
    <span className="ml-1.5 inline-flex flex-wrap gap-1 align-baseline">
      {ids.map(id => (
        <span key={id} title={insight.sources[id]?.label} className="rounded border border-edge-strong px-1 font-mono text-[11px] leading-4 text-faint">{id}</span>
      ))}
    </span>
  );
}

function ClaimText({ claim, insight }: { claim: Claim; insight: Insight }) {
  return <>{claim.text}<Cites ids={claim.sources} insight={insight} /></>;
}

// One investigation's SI-written insight. `linked` adds the investigation name as a link (for the overview page).
export default function InsightCard({ inv, insight, linked = false, level = 2 }:
  { inv: Investigation; insight: Insight; linked?: boolean; level?: 2 | 3 }) {
  const cited = Array.from(new Set([insight.summary, ...insight.fireSafety, insight.habitat, ...insight.caveats].flatMap(c => c?.sources ?? [])));
  const [Heading, Sub] = level === 2 ? (["h2", "h3"] as const) : (["h3", "h4"] as const);
  return (
    <Card level={level} title={linked ? undefined : "Fire-safety insight"}
      action={linked
        ? <Heading className="flex items-baseline gap-2">
            <Link href={`/investigations/${inv.accession}`} className={`font-semibold text-ink hover:text-accent ${level === 2 ? "text-base" : "text-sm"}`}>{displayName(inv)}</Link>
            <span className="font-mono text-xs text-faint">{inv.accession}</span>
          </Heading>
        : <span className="text-xs text-faint">Written by SI ({insight.model}), checked against cited sources</span>}>
      <div className="space-y-4 text-sm">
        {insight.summary && <p className="max-w-[75ch] leading-relaxed text-ink"><ClaimText claim={insight.summary} insight={insight} /></p>}

        {insight.fireSafety.length > 0 && (
          <div>
            <Sub className="text-xs font-medium uppercase tracking-wide text-faint">For spacecraft fire safety</Sub>
            <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-muted marker:text-edge-strong">
              {insight.fireSafety.map((c, k) => <li key={k}><ClaimText claim={c} insight={insight} /></li>)}
            </ul>
          </div>
        )}

        {insight.habitat && (
          <div className="border-t border-edge pt-3">
            <Sub className="text-xs font-medium uppercase tracking-wide text-faint">Moon-base atmosphere</Sub>
            <p className="mt-1 text-muted"><ClaimText claim={insight.habitat} insight={insight} /></p>
          </div>
        )}

        {insight.caveats.length > 0 && (
          <div>
            <Sub className="text-xs font-medium uppercase tracking-wide text-faint">Before relying on it</Sub>
            <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-muted marker:text-edge-strong">
              {insight.caveats.map((c, k) => <li key={k}><ClaimText claim={c} insight={insight} /></li>)}
            </ul>
          </div>
        )}

        <details className="group/src rounded-md border border-edge bg-base/40 px-3 py-2">
          <summary className="cursor-pointer text-xs text-muted hover:text-ink">
            Sources cited ({cited.length}){insight.dropped.length > 0 && ` · ${insight.dropped.length} unsupported claim${insight.dropped.length === 1 ? "" : "s"} removed`}
          </summary>
          <dl className="mt-2 space-y-2">
            {cited.map(id => (
              <div key={id} className="grid grid-cols-[3rem_1fr] gap-2 text-xs">
                <dt className="font-mono text-faint">{id}</dt>
                <dd className="min-w-0">
                  <span className="block text-muted">{insight.sources[id].label}</span>
                  <span className="block whitespace-pre-line text-ink/90">{insight.sources[id].text}</span>
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </Card>
  );
}
