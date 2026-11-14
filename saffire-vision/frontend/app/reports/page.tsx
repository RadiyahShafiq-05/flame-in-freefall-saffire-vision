"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useDataset } from "@/lib/useDataset";
import { isSaffireGrid, typeLabel } from "@/lib/images";
import type { ReportDetail } from "@/types";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Notice from "@/components/Notice";
import StatusBadge from "@/components/StatusBadge";
import FileName from "@/components/FileName";

const fmtTime = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function Reports() {
  const { state } = useDataset();
  const [reports, setReports] = useState<ReportDetail[] | null>(null);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // The list endpoint returns only IDs; each report is read for its time and contents.
  const load = useCallback(() => api.reports()
    .then(ids => Promise.allSettled(ids.map(api.report)))
    .then(rs => {
      const ok = rs.flatMap(r => (r.status === "fulfilled" ? [r.value] : [])).sort((a, b) => b.generated.localeCompare(a.generated));
      setReports(ok);
      setSelected(s => s && ok.some(r => r.report_id === s) ? s : ok[0]?.report_id ?? "");
    })
    .catch(e => setError(e.message)), []);
  useEffect(() => { if (state === "live" || state === "empty") load(); }, [state, load]);

  const generate = () => {
    setBusy(true); setError("");
    api.createReport().then(r => { setSelected(r.report_id); return load(); }).catch(e => setError(e.message)).finally(() => setBusy(false));
  };

  if (state === "offline") return (
    <div className="space-y-6"><PageHeader title="Reports" />
      <EmptyState title="Backend offline" body="Start the backend to generate and download reports." /></div>
  );

  const report = reports?.find(r => r.report_id === selected);
  return (
    <div className="space-y-6">
      <PageHeader title="Reports"
        subtitle="A snapshot of the dataset, recent detections and the calibration status, saved by the backend as HTML and JSON."
        actions={<button className="btn" onClick={generate} disabled={busy}>{busy ? "Generating…" : "Generate report"}</button>} />
      {error && <Notice tone="warn" title="Request failed">{error}</Notice>}

      {reports && reports.length === 0 ? (
        <EmptyState title="No reports yet" body="Generate one to capture the current dataset, detection runs and calibration status." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <nav aria-label="Reports" className="space-y-1">
            {(reports ?? []).map(r => (
              <button key={r.report_id} onClick={() => setSelected(r.report_id)} aria-current={r.report_id === selected ? "true" : undefined}
                className={`block w-full rounded-md border px-3 py-2 text-left transition-colors ${r.report_id === selected ? "border-accent/50 bg-accent/10" : "border-edge hover:border-edge-strong"}`}>
                <span className={`num block text-sm ${r.report_id === selected ? "font-medium text-accent" : "text-ink"}`}>{fmtTime(r.generated)}</span>
                <span className="num block font-mono text-xs text-faint">{r.report_id}</span>
              </button>
            ))}
          </nav>

          {report && (
            <article aria-labelledby="report-h" className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="report-h" className="text-base font-semibold text-ink">Report from {fmtTime(report.generated)}</h2>
                <div className="flex gap-2">
                  <a className="btn-ghost text-xs" href={api.reportDownload(report.report_id, "html")}>Download HTML</a>
                  <a className="btn-ghost text-xs" href={api.reportDownload(report.report_id, "json")}>Download JSON</a>
                </div>
              </div>

              <Card title={`Dataset · ${report.dataset.count} images`} level={3}>
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted"><tr><th className="py-1 pr-3 font-medium">File</th><th className="py-1 pr-3 font-medium">Size</th><th className="py-1 font-medium">Type</th></tr></thead>
                  <tbody>{[...report.dataset.images].sort((a, b) => Number(isSaffireGrid(b)) - Number(isSaffireGrid(a))).map(i => (
                    <tr key={i.image_id} className="border-t border-edge">
                      <td className="py-1.5 pr-3"><FileName name={i.filename} className="text-xs text-ink" /></td>
                      <td className="num whitespace-nowrap py-1.5 pr-3 font-mono text-xs text-muted">{i.width}×{i.height}</td>
                      <td className="py-1.5 text-xs text-muted">{typeLabel(i)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </Card>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card title={`Preprocessing · ${report.preprocessing.length}`} level={3}>
                  {report.preprocessing.length ? (
                    <ol className="space-y-2">{report.preprocessing.map((s, i) => (
                      <li key={i} className="space-y-0.5">
                        <span className="block text-xs capitalize text-ink">{s.operation}</span>
                        <FileName name={s.image_id} className="block text-xs text-muted" />
                      </li>
                    ))}</ol>
                  ) : <p className="text-sm text-muted">No preprocessing runs at the time of this report.</p>}
                </Card>
                <Card title={`Checkerboard detections · ${report.detections.length}`} level={3}>
                  {report.detections.length ? (
                    <ol className="space-y-2">{report.detections.map((d, i) => (
                      <li key={i} className="space-y-0.5">
                        <span className={`num block text-xs ${d.success ? "text-accent" : "text-muted"}`}>
                          {d.pattern.join("×")} · {d.success ? `${d.num_corners} corners` : "not found"}
                        </span>
                        <FileName name={d.image_id} className="block text-xs text-muted" />
                      </li>
                    ))}</ol>
                  ) : <p className="text-sm text-muted">No detection runs at the time of this report.</p>}
                </Card>
                <Card title={`Grid geometry · ${report.distortion.length}`} level={3}>
                  {report.distortion.length ? (
                    <ol className="space-y-2">{report.distortion.map((s, i) => (
                      <li key={i} className="space-y-0.5">
                        <span className="num block text-xs text-ink">
                          {s.cols}×{s.rows} · {s.geometry.available
                            ? `spacing ${s.geometry.spacing_px.mean.toFixed(1)} px · row straightness ${s.geometry.row_straightness_rms_px.toFixed(2)} px${s.geometry.homography_residual ? ` · planar fit RMS ${s.geometry.homography_residual.rms_px.toFixed(2)} px` : ""}`
                            : "not measured"}
                        </span>
                        {!s.geometry.available && <span className="block text-xs text-warn">{s.geometry.reason}</span>}
                        <FileName name={s.image_id} className="block text-xs text-muted" />
                      </li>
                    ))}</ol>
                  ) : <p className="text-sm text-muted">No grid geometry runs at the time of this report.</p>}
                </Card>
                <Card title="Calibration" level={3}>
                  {report.calibration.status === "not_run" ? <p className="text-sm text-muted">Not run at the time of this report.</p> : (
                    <div className="space-y-2 text-sm">
                      <StatusBadge status={report.calibration.status === "valid" ? "completed" : "failed"} />
                      {report.calibration.rms_reprojection_error_px !== undefined && (
                        <p className="num text-muted">RMS reprojection error <span className="font-mono text-ink">{report.calibration.rms_reprojection_error_px.toFixed(3)} px</span>
                          {report.calibration.views_used && ` · ${report.calibration.views_used.length} views used`}</p>
                      )}
                      {report.calibration.problems?.length ? <ul className="list-disc space-y-1 pl-5 text-xs text-warn">{report.calibration.problems.map(p => <li key={p}>{p}</li>)}</ul> : null}
                    </div>
                  )}
                </Card>
                <Card title="Processing and limitations" level={3}>
                  <p className="text-sm text-muted">{report.processing}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">{report.limitations.map(l => <li key={l}>{l}</li>)}</ul>
                </Card>
              </div>
            </article>
          )}
        </div>
      )}
    </div>
  );
}
