"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useDataset } from "@/lib/useDataset";
import { EXPECTED_IMAGES, SAFFIRE_I } from "@/lib/expectedDataset";
import { isSaffireGrid } from "@/lib/images";
import type { Calibration, HistoryItem, Report } from "@/types";
import Card from "@/components/Card";
import StatCard from "@/components/StatCard";
import StatusBadge, { type Status } from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import ImageCard from "@/components/ImageCard";
import FileName from "@/components/FileName";
import Notice from "@/components/Notice";

// Each source is null when it failed, so one failing endpoint never hides the others or turns
// their workflow steps into a false "Pending".
interface Activity { history: HistoryItem[] | null; calibration: Calibration | null; reports: Report[] | null; failed: string[] }

const settled = <T,>(r: PromiseSettledResult<T>) => (r.status === "fulfilled" ? r.value : null);

function useActivity(enabled: boolean) {
  const [activity, setActivity] = useState<Activity | null>(null);
  useEffect(() => {
    if (!enabled) { setActivity(null); return; }
    // The report list holds only IDs, so each report is read to get its generated time; reports that
    // cannot be read are skipped rather than failing the whole list.
    const reports = api.reports().then(async ids => (await Promise.allSettled(ids.map(api.report)))
      .flatMap(r => (r.status === "fulfilled" ? [r.value] : []))
      .sort((a, b) => b.generated.localeCompare(a.generated)));
    Promise.allSettled([api.history(), api.calStatus(), reports]).then(([h, c, r]) => setActivity({
      history: settled(h), calibration: settled(c), reports: settled(r),
      failed: [[h, "analysis history"], [c, "calibration status"], [r, "reports"]]
        .filter(([res]) => (res as PromiseSettledResult<unknown>).status === "rejected").map(([, name]) => name as string),
    }));
  }, [enabled]);
  return activity;
}

// action explains what is needed; cta is the short button label that leads there.
interface Step { name: string; href: string; status: Status; detail: string; action?: string; cta?: string }

const UNAVAILABLE = { status: "not_tracked" as Status, detail: "Could not be loaded from the backend" };
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const area = (p: number[]) => p[0] * p[1];

function workflow(gridIds: Set<string>, others: number, a: Activity | null): Step[] {
  const grids = gridIds.size;
  const history = a?.history;
  const hits = history?.filter(h => h.success) ?? [];
  const largest = hits.reduce<HistoryItem | null>((m, h) => (!m || area(h.pattern) > area(m.pattern) ? h : m), null);
  const cal = a?.calibration;
  const saffireModel = cal?.views_used?.some(id => gridIds.has(id));
  const reports = a?.reports;
  return [
    { name: "Dataset upload", href: "/dataset",
      ...(grids + others > 0
        ? { status: "completed", detail: [grids && `${plural(grids, "SAFFIRE grid")} available`, others && `${plural(others, "other image")}`].filter(Boolean).join(", plus ") }
        : { status: "pending", detail: "No images loaded", action: "Load the four grid images", cta: "Load images" }) },
    { name: "Image preprocessing", href: "/analysis", status: "not_tracked", detail: "Recorded in reports; the dashboard cannot read runs yet" },
    // The true grid size is undocumented and the grid runs past the frame, so any detected pattern is
    // a user-chosen sub-region: report it as partial, never as a completed grid detection.
    { name: "Checkerboard detection", href: "/analysis",
      ...(a && !history ? UNAVAILABLE
        : largest ? { status: "partial", detail: `Largest pattern found: ${largest.pattern.join("×")}, a sub-region; true grid size unknown` }
        : history?.length ? { status: "in_progress", detail: `${plural(history.length, "run")}, no pattern found yet`, action: "Try a smaller pattern", cta: "Open image analysis" }
        : { status: "pending", detail: "Not run yet", action: "Run checkerboard detection", cta: "Start image analysis" }) },
    { name: "Distortion analysis", href: "/analysis", status: "not_tracked", detail: "Recorded in reports; the dashboard cannot read runs yet" },
    // A valid model from test boards says nothing about the SAFFIRE camera, which has one view per camera.
    { name: "Calibration feasibility", href: "/calibration",
      ...(a && !cal ? UNAVAILABLE
        : cal?.status === "valid" && saffireModel ? { status: "completed", detail: "Valid camera model" }
        : cal?.status === "valid" ? { status: "failed", detail: "Only non-SAFFIRE test images calibrated; the SAFFIRE grids have one view per camera",
            action: `Needs ${cal.min_views ?? 10} or more SAFFIRE grid photos from different angles`, cta: "Resolve calibration" }
        : cal?.status === "insufficient" ? { status: "failed", detail: cal.problems?.[0] ?? "Not enough independent views",
            action: `Needs ${cal.min_views ?? 10} or more photos of the grid from different angles`, cta: "Resolve calibration" }
        : { status: "pending", detail: "Not run yet", action: "Check calibration feasibility", cta: "Check calibration" }) },
    { name: "Report generation", href: "/reports",
      ...(a && !reports ? UNAVAILABLE
        : reports?.length ? { status: "completed", detail: `${plural(reports.length, "report")} generated` }
        : { status: "pending", detail: "No reports yet", action: "Generate a report", cta: "Generate a report" }) },
  ] as Step[];
}

// Blocked steps come first, then the earliest pending one, then work that is only partly done.
function nextStep(steps: Step[]) {
  return steps.find(s => s.status === "failed") ?? steps.find(s => s.status === "pending")
    ?? steps.find(s => s.status === "in_progress") ?? null;
}

const fmtTime = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function Overview() {
  const { state, dataset, error: datasetError } = useDataset();
  const live = state === "live" || state === "empty";
  const activity = useActivity(live);
  const cal = activity?.calibration;
  const all = dataset?.images ?? [];
  // Uploads and test boards share data/raw with the SAFFIRE grids; only the grids count as the dataset.
  const images = all.filter(isSaffireGrid);
  const others = all.length - images.length;
  const gridIds = new Set(images.map(i => i.image_id));
  const steps = workflow(gridIds, others, activity);
  const next = live && activity ? nextStep(steps) : null;
  const count = (pick: (i: (typeof images)[number]) => boolean) => images.filter(pick).length;
  const history = activity?.history ?? [];
  const hits = history.filter(h => h.success);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Flame in Freefall</h1>
          <p className="mt-1 text-base text-muted">
            <abbr title="super intelligence" className="cursor-help no-underline">SI</abbr>-Powered Fire Safety Insights from Microgravity Combustion Data
          </p>
          <p className="mt-3 max-w-[70ch] text-sm text-muted">
            <span className="font-medium text-ink">Current module: Image Calibration and Analysis.</span>{" "}
            SAFFIRE Vision checks the camera geometry behind NASA&apos;s SAFFIRE spacecraft fire experiments. The grid
            images hold no flame data, so it draws no conclusions about fire behaviour.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {next ? <Link className="btn" href={next.href}>{next.cta ?? `Open ${next.name.toLowerCase()}`}</Link>
            : <Link className="btn" href="/dataset">Explore dataset</Link>}
          {next?.href !== "/dataset" && next && <Link className="btn-ghost" href="/dataset">Explore dataset</Link>}
          <Link className="btn-ghost" href="/reports">View reports</Link>
        </div>
      </header>

      {state === "offline" && (
        <Notice tone="warn" title="Backend offline">
          <span title={datasetError}>The SAFFIRE Vision API could not be reached.</span> Image previews and activity appear
          once it is running; start it with <code className="font-mono text-ink">python run.py</code> in <code className="font-mono text-ink">backend/</code>.
        </Notice>
      )}
      {activity?.failed.length ? (
        <Notice tone="warn" title="Some activity could not be loaded">
          The backend did not return the {activity.failed.join(", ")}. The rest of the page is unaffected; reload to try again.
        </Notice>
      ) : null}

      <Card title="Workflow" action={<span className="text-xs text-faint">{live ? "Live from the backend · select a step to open it" : "Pending until the backend responds"}</span>}>
        <ol className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {steps.map((s, i) => {
            const status = live ? s.status : "pending";
            const isNext = next?.name === s.name;
            return (
              <li key={s.name}>
                <Link href={s.href} aria-current={isNext ? "step" : undefined}
                  className={`flex h-full flex-col gap-2 rounded-md border bg-base p-3 transition-colors hover:border-accent/50 ${isNext ? "border-warn/50" : "border-edge"}`}>
                  <span className="num font-mono text-xs text-faint">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-sm font-medium text-ink">{s.name}</span>
                  <span><StatusBadge status={status} /></span>
                  <span className="text-xs leading-snug text-muted">{live ? s.detail : "Waiting for backend"}</span>
                  {live && isNext && s.action && <span className="mt-auto pt-1 text-xs font-medium text-warn">Next: {s.action}</span>}
                </Link>
              </li>
            );
          })}
        </ol>
      </Card>

      <section aria-labelledby="overview-h" className="space-y-3">
        <h2 id="overview-h" className="text-base font-semibold text-ink">Dataset overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Dataset" value="SAFFIRE-1 F1C1 distortion grids"
            hint="Camera-geometry images from NASA's SAFFIRE-I experiment"
            source={<a className="link" href={SAFFIRE_I.psiUrl} target="_blank" rel="noreferrer">{SAFFIRE_I.accession} on NASA PSI (opens in new tab)</a>} />
          <StatCard label="Image files"
            value={live ? <span className="num"><span className="text-accent">{images.length}</span> of {EXPECTED_IMAGES.length} loaded</span> : `${EXPECTED_IMAGES.length} expected`}
            hint={state === "offline" ? "Load status unknown while the backend is offline" : state === "loading" ? "Checking…"
              : others ? `Plus ${plural(others, "other image")} that are not SAFFIRE data` : undefined}
            source={live ? "From /api/dataset" : "From the expected file list"} />
          <StatCard label="Image types" value="Color and monochrome"
            hint={live
              ? <span className="num">{count(i => i.variant === "color")} color, {count(i => i.variant === "mono")} mono<br />{count(i => i.kind === "individual")} individual, {count(i => i.kind === "combined")} combined</span>
              : "Individual views and side-by-side combined views"}
            source={live ? "From /api/dataset" : "From the expected file list"} />
          <StatCard label="Current analysis"
            value={activity?.history ? <span className="num">{plural(history.length, "detection run")}</span> : "Checkerboard detection"}
            hint={activity?.history
              ? (hits.length ? `${hits.length} found a pattern; none is the full grid` : history.length ? "No pattern found yet" : "Not run yet")
              : "Run counts appear when the backend responds"}
            source={activity?.history ? "From /api/analysis/history" : undefined} />
        </div>
      </section>

      <Card title="Dataset preview" action={<Link className="link text-xs" href="/dataset">Open Dataset Explorer</Link>}>
        {state === "empty" ? (
          <EmptyState title="No images in data/raw" body="Copy the four SAFFIRE-1 grid JPEGs into data/raw/ or upload them on the Calibration page." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(live ? images : EXPECTED_IMAGES).map(im => <ImageCard key={im.image_id} image={im} loaded={live} compact />)}
          </div>
        )}
      </Card>

      <section aria-labelledby="activity-h" className="space-y-3">
        <h2 id="activity-h" className="text-base font-semibold text-ink">Recent activity</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Latest image analyses" level={3}>
            {history.length ? (
              <ol className="space-y-3">
                {history.map((h, i) => ({ h, run: i + 1 })).slice(-5).reverse().map(({ h, run }) => (
                  <li key={run} className="space-y-0.5">
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="num shrink-0 text-faint">Run {run}</span>
                      <span className={`num text-right ${h.success ? "text-accent" : "text-muted"}`}>
                        {h.pattern.join("×")} · {h.success ? `${h.num_corners} corners (sub-region)` : "not found"}
                      </span>
                    </div>
                    <FileName name={h.image_id} className="block text-xs text-muted" />
                  </li>
                ))}
              </ol>
            ) : <EmptyState title="No analyses yet" action={<Link className="btn-ghost text-xs" href="/analysis">Start image analysis</Link>} />}
          </Card>
          <Card title="Calibration" level={3}>
            {cal && cal.status !== "not_run" ? (
              <div className="space-y-2 text-sm">
                <StatusBadge status={cal.status === "valid" ? "completed" : "failed"} />
                {cal.status === "valid" && !cal.views_used?.some(id => gridIds.has(id)) && (
                  <p className="text-xs text-muted">Model of the camera behind the test images, not the SAFFIRE camera.</p>
                )}
                {cal.problems?.length ? (
                  <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
                    {cal.problems.map(p => <li key={p}>{p}</li>)}
                  </ul>
                ) : null}
                <Link className="btn-ghost text-xs" href="/calibration">Open calibration</Link>
              </div>
            ) : <EmptyState title="Calibration not run" action={<Link className="btn-ghost text-xs" href="/calibration">Check calibration</Link>} />}
          </Card>
          <Card title="Generated reports" level={3}>
            {activity?.reports?.length ? (
              <ul className="space-y-2 text-sm">
                {activity.reports.slice(0, 3).map(r => (
                  <li key={r.report_id} className="flex items-center justify-between gap-3">
                    <span className="num text-xs text-muted">{fmtTime(r.generated)}</span>
                    <span className="flex gap-3 text-xs">
                      <a className="link" href={api.reportDownload(r.report_id, "html")}>HTML</a>
                      <a className="link" href={api.reportDownload(r.report_id, "json")}>JSON</a>
                    </span>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No reports yet" action={<Link className="btn-ghost text-xs" href="/reports">View reports</Link>} />}
          </Card>
        </div>
      </section>

      <p className="text-sm text-muted">
        Why microgravity fire and camera geometry matter, and how this module fits the project:{" "}
        <Link className="link" href="/about#why">read the background</Link>.
      </p>
    </div>
  );
}
