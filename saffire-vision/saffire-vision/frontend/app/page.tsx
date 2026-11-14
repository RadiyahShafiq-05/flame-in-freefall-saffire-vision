"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useDataset } from "@/lib/useDataset";
import { EXPECTED_IMAGES, SAFFIRE_I } from "@/lib/expectedDataset";
import type { Calibration, HistoryItem, Report } from "@/types";
import Card from "@/components/Card";
import StatCard from "@/components/StatCard";
import StatusBadge, { type Status } from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import ImageCard from "@/components/ImageCard";
import Notice from "@/components/Notice";

interface Activity { history: HistoryItem[]; calibration: Calibration; reports: Report[] }

function useActivity(enabled: boolean) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) { setActivity(null); return; }
    Promise.all([api.history(), api.calStatus(), api.reports()])
      // The report list holds only IDs, so each report is read to get its generated time.
      .then(async ([history, calibration, ids]) => {
        const reports = (await Promise.all(ids.map(api.report)))
          .sort((a, b) => b.generated.localeCompare(a.generated));
        setActivity({ history, calibration, reports });
      })
      .catch(e => setError(e.message));
  }, [enabled]);
  return { activity, error };
}

interface Step { name: string; status: Status; detail: string }

function workflow(imageCount: number, a: Activity | null): Step[] {
  const detected = a?.history.some(h => h.success);
  const cal = a?.calibration;
  return [
    { name: "Dataset upload", status: imageCount > 0 ? "completed" : "pending",
      detail: imageCount > 0 ? `${imageCount} image${imageCount === 1 ? "" : "s"} available` : "No images loaded" },
    { name: "Image preprocessing", status: "not_tracked", detail: "The backend does not record preprocessing runs yet" },
    { name: "Checkerboard detection", status: detected ? "completed" : a?.history.length ? "in_progress" : "pending",
      detail: detected ? "At least one pattern detected" : a?.history.length ? `${a.history.length} run${a.history.length === 1 ? "" : "s"}, none detected yet` : "Not run yet" },
    { name: "Distortion analysis", status: "not_tracked", detail: "The backend does not record distortion runs yet" },
    { name: "Calibration feasibility", status: cal?.status === "valid" ? "completed" : cal?.status === "insufficient" ? "failed" : "pending",
      detail: cal?.status === "valid" ? "Valid camera model" : cal?.status === "insufficient" ? (cal.problems?.[0] ?? "Not enough independent views") : "Not run yet" },
    { name: "Report generation", status: a?.reports.length ? "completed" : "pending",
      detail: a?.reports.length ? `${a.reports.length} report${a.reports.length === 1 ? "" : "s"} generated` : "No reports yet" },
  ];
}

const fmtTime = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function Overview() {
  const { state, dataset, error: datasetError } = useDataset();
  const live = state === "live" || state === "empty";
  const { activity, error } = useActivity(live);
  const images = dataset?.images ?? [];
  const steps = workflow(images.length, activity);
  const count = (pick: (i: (typeof images)[number]) => boolean) => images.filter(pick).length;

  return (
    <div className="space-y-8">
      {state === "offline" && (
        <Notice tone="warn" title="Backend offline">
          <span title={datasetError}>The SAFFIRE Vision API could not be reached.</span> Image previews and activity appear
          once it is running; start it with <code className="font-mono text-ink">python run.py</code> in <code className="font-mono text-ink">backend/</code>.
        </Notice>
      )}
      {error && <Notice tone="warn" title="Some activity could not be loaded">{error}</Notice>}

      {/* A. Introduction + F. Quick actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-edge bg-panel p-6 lg:col-span-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-2.5 py-1 text-xs font-medium text-accent">
            SAFFIRE Vision · Current module: Image Calibration and Analysis
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">Flame in Freefall</h1>
          <p className="mt-1 text-base text-muted">SI-Powered Fire Safety Insights from Microgravity Combustion Data</p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
            A platform for exploring NASA microgravity combustion data. The first module checks the camera geometry behind
            the SAFFIRE spacecraft fire experiments: it inspects the distortion-grid images, detects their checkerboard
            corners and tests whether a camera calibration is possible. These grid images contain no flame data, so the
            module draws no conclusions about fire behaviour.
          </p>
        </section>
        <Card title="Quick actions">
          <div className="grid gap-2">
            <Link className="btn justify-center" href="/dataset">Explore dataset</Link>
            <Link className="btn-ghost justify-center" href="/analysis">Start image analysis</Link>
            <Link className="btn-ghost justify-center" href="/calibration">Check calibration</Link>
            <Link className="btn-ghost justify-center" href="/reports">View reports</Link>
            <Link className="btn-ghost justify-center" href="/investigations">Browse combustion investigations</Link>
          </div>
        </Card>
      </div>

      {/* B. Dataset overview */}
      <section aria-labelledby="overview-h" className="space-y-3">
        <h2 id="overview-h" className="text-sm font-semibold uppercase tracking-wide text-faint">Dataset overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Dataset" value="NASA SAFFIRE-1 F1C1 Distortion Grids"
            source={<a className="link" href={SAFFIRE_I.psiUrl} target="_blank" rel="noreferrer">{SAFFIRE_I.accession} · SAFFIRE-I on NASA PSI</a>} />
          <StatCard label="Image files"
            value={live ? <><span className="text-accent">{images.length}</span> loaded of {EXPECTED_IMAGES.length} expected</> : `${EXPECTED_IMAGES.length} expected`}
            hint={state === "offline" ? "Load status unknown: backend offline" : state === "loading" ? "Checking…" : undefined}
            source={live ? "From /api/dataset" : "From the expected file list"} />
          <StatCard label="Image types" value="Color and monochrome"
            hint={live
              ? `${count(i => i.variant === "color")} color · ${count(i => i.variant === "mono")} mono · ${count(i => i.kind === "combined")} combined`
              : "Individual and side-by-side combined views"}
            source={live ? "From /api/dataset" : "From the expected file list"} />
          <StatCard label="Current analysis" value="Image preprocessing and checkerboard detection"
            hint="Distortion and calibration follow" />
        </div>
      </section>

      {/* C. Workflow */}
      <Card title="Workflow" action={<span className="text-xs text-faint">{live ? "Status from the backend" : "Shown as pending until the backend responds"}</span>}>
        <ol className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {steps.map((s, i) => (
            <li key={s.name} className="flex flex-col gap-2 rounded-md border border-edge bg-base p-3">
              <span className="font-mono text-xs text-faint">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-sm font-medium text-ink">{s.name}</span>
              <div><StatusBadge status={live ? s.status : "pending"} /></div>
              <span className="text-xs leading-snug text-muted">{live ? s.detail : "Waiting for backend"}</span>
            </li>
          ))}
        </ol>
      </Card>

      {/* D. Dataset preview */}
      <Card title="Dataset preview" action={<Link className="link text-xs" href="/dataset">Open Dataset Explorer</Link>}>
        {state === "empty" ? (
          <EmptyState title="No images in data/raw" body="Copy the four SAFFIRE-1 grid JPEGs into data/raw/ or upload them on the Calibration page." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(live ? images : EXPECTED_IMAGES).map(im => <ImageCard key={im.image_id} image={im} loaded={live} compact />)}
          </div>
        )}
      </Card>

      {/* E. Recent activity */}
      <section aria-labelledby="activity-h" className="space-y-3">
        <h2 id="activity-h" className="text-sm font-semibold uppercase tracking-wide text-faint">Recent activity</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Latest image analyses">
            {activity?.history.length ? (
              <ul className="space-y-2 text-sm">
                {activity.history.slice(-5).reverse().map((h, i) => (
                  <li key={i} className="flex items-start justify-between gap-3">
                    <span className="min-w-0 break-all font-mono text-xs text-muted">{h.image_id}</span>
                    <span className={`shrink-0 text-xs ${h.success ? "text-ok" : "text-warn"}`}>
                      {h.pattern.join("×")} · {h.success ? `${h.num_corners} corners` : "not detected"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No analyses yet" action={<Link className="btn-ghost text-xs" href="/analysis">Start image analysis</Link>} />}
          </Card>
          <Card title="Calibration">
            {activity && activity.calibration.status !== "not_run" ? (
              <div className="space-y-2 text-sm">
                <StatusBadge status={activity.calibration.status === "valid" ? "completed" : "failed"} />
                {activity.calibration.problems?.length ? (
                  <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
                    {activity.calibration.problems.map(p => <li key={p}>{p}</li>)}
                  </ul>
                ) : null}
              </div>
            ) : <EmptyState title="Calibration not run" action={<Link className="btn-ghost text-xs" href="/calibration">Check calibration</Link>} />}
          </Card>
          <Card title="Generated reports">
            {activity?.reports.length ? (
              <ul className="space-y-2 text-sm">
                {activity.reports.slice(0, 3).map(r => (
                  <li key={r.report_id} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted">{fmtTime(r.generated)}</span>
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

      {/* G. Project information */}
      <section aria-labelledby="about-h" className="space-y-3">
        <h2 id="about-h" className="text-sm font-semibold uppercase tracking-wide text-faint">Why this matters</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Microgravity combustion">
            <p className="text-sm leading-relaxed text-muted">
              Without buoyancy, flames lose their rising plume and spread differently, so fire-safety rules based on Earth
              tests can be wrong in a spacecraft. Planned Moon habitats are expected to run at 30% oxygen or more, which makes
              materials more flammable.
            </p>
          </Card>
          <Card title="Camera geometry">
            <p className="text-sm leading-relaxed text-muted">
              Flame size and spread rate are measured from experiment video. Lens distortion bends straight lines, so those
              measurements are only as reliable as the camera calibration behind them.
            </p>
          </Card>
          <Card title="Where this module fits">
            <p className="text-sm leading-relaxed text-muted">
              SAFFIRE Vision checks camera geometry first. Next: SAFFIRE-II flame frames, the experiment tables, and an
              overview of NASA&apos;s other combustion investigations.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}
