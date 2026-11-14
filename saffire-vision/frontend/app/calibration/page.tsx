"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useDataset } from "@/lib/useDataset";
import { isSaffireGrid, typeLabel } from "@/lib/images";
import type { Calibration, ImageInfo } from "@/types";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Notice from "@/components/Notice";
import StatusBadge from "@/components/StatusBadge";
import FileName from "@/components/FileName";

// Mirrors the backend's grouping in camera_calibration._group_key so the pre-check flags the same
// color/mono pairs the backend will reject.
const sceneKey = (name: string) => ["_mono", "_color", "-mono", "-color"].reduce((n, t) => n.replace(t, ""), name.toLowerCase());

function precheck(selected: ImageInfo[], minViews: number) {
  const scenes = new Map<string, number>();
  selected.forEach(i => scenes.set(sceneKey(i.filename), (scenes.get(sceneKey(i.filename)) ?? 0) + 1));
  const sizes = new Set(selected.map(i => `${i.width}×${i.height}`));
  return [
    { ok: selected.length >= minViews, text: `At least ${minViews} views selected`, detail: `${selected.length} selected` },
    { ok: selected.length > 0 && sizes.size === 1, text: "All views share one resolution", detail: sizes.size > 1 ? [...sizes].join(", ") : [...sizes][0] ?? "No views selected" },
    { ok: [...scenes.values()].every(n => n === 1), text: "No color/mono copies of the same scene", detail: "Copies are the same view, not independent ones" },
    { ok: !selected.some(i => i.kind === "combined"), text: "No combined side-by-side composites", detail: "Their panels must be separated first" },
  ];
}

const COEFFS = ["k1", "k2", "p1", "p2", "k3"];
const fmtTime = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function CalibrationPage() {
  const { state, dataset, refresh } = useDataset();
  // SAFFIRE grids first, then other images such as test boards and uploads.
  const images = useMemo(() => [...(dataset?.images ?? [])].sort((a, b) => Number(isSaffireGrid(b)) - Number(isSaffireGrid(a))), [dataset]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [pattern, setPattern] = useState<[number, number]>([6, 4]);
  const [square, setSquare] = useState("");
  const [minViews, setMinViews] = useState(10);
  const [cal, setCal] = useState<Calibration | null>(null);
  const [busy, setBusy] = useState(false);
  const [upload, setUpload] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { if (state === "live") api.calStatus().then(setCal).catch(e => setError(e.message)); }, [state]);

  const selected = images.filter(i => chosen.includes(i.image_id));
  const checks = precheck(selected, minViews);
  const bySize = useMemo(() => {
    const groups = new Map<string, string[]>();
    images.filter(i => i.kind !== "combined").forEach(i => {
      const k = `${i.width}×${i.height}`;
      // Only one file per scene, so a color/mono pair never fills a quick selection.
      const taken = (groups.get(k) ?? []).map(id => sceneKey(id));
      if (!taken.includes(sceneKey(i.filename))) groups.set(k, [...(groups.get(k) ?? []), i.image_id]);
    });
    return [...groups.entries()].filter(([, ids]) => ids.length > 1).sort((a, b) => b[1].length - a[1].length);
  }, [images]);

  const toggle = (id: string) => setChosen(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);
  const run = () => {
    setBusy(true); setError("");
    api.calibrate(chosen, ...pattern, minViews, square ? +square : undefined)
      .then(setCal).catch(e => setError(e.message)).finally(() => setBusy(false));
  };
  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    const list = Array.from(files);
    try {
      for (const [n, f] of list.entries()) { setUpload(`Uploading ${n + 1} of ${list.length}…`); await api.upload(f); }
      setUpload(`Uploaded ${list.length} image${list.length === 1 ? "" : "s"}.`);
      refresh();
    } catch (e) { setUpload(""); setError((e as Error).message); }
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(cal, null, 2)], { type: "application/json" }));
    a.download = "calibration.json"; a.click(); URL.revokeObjectURL(a.href);
  };

  if (state === "offline") return (
    <div className="space-y-6"><PageHeader title="Camera Calibration" />
      <EmptyState title="Backend offline" body="Start the backend to select views and run a calibration." /></div>
  );

  const usedNonSaffire = cal?.status === "valid" && cal.views_used?.every(id => !isSaffireGrid(images.find(i => i.image_id === id) ?? { kind: "unknown", variant: "" }));
  return (
    <div className="space-y-6">
      <PageHeader title="Camera Calibration"
        subtitle="Estimate a camera's lens model from several photos of one checkerboard. Results appear only when OpenCV's calibration actually succeeds." />

      {error && <Notice tone="warn" title="Request failed">{error}</Notice>}

      <Card title="Current calibration" action={cal?.timestamp && <span className="num text-xs text-faint">{fmtTime(cal.timestamp)}</span>}>
        {!cal || cal.status === "not_run" ? <p className="text-sm text-muted">No calibration has been run yet.</p> : (
          <div className="space-y-2" aria-live="polite">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <StatusBadge status={cal.status === "valid" ? "completed" : "failed"} />
              <span className="num text-muted">
                {cal.views_used ? `${cal.views_used.length} of ${cal.views_supplied} views used` : `${cal.views_supplied ?? 0} views supplied`}
                {cal.rms_reprojection_error_px !== undefined && ` · RMS reprojection error ${cal.rms_reprojection_error_px.toFixed(3)} px`}
              </span>
            </div>
            {cal.problems?.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-warn">{cal.problems.map(p => <li key={p}>{p}</li>)}</ul> : null}
          </div>
        )}
      </Card>

      {cal?.status === "valid" && cal.camera_matrix && cal.distortion_coefficients && (
        <section aria-labelledby="results-h" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="results-h" className="text-base font-semibold text-ink">Calibration results</h2>
            <button className="btn-ghost text-xs" onClick={download}>Download parameters (JSON)</button>
          </div>
          {usedNonSaffire && (
            <Notice title="These results describe the camera that took the selected images">
              None of the views used are SAFFIRE grids, so this is not a SAFFIRE camera model.
            </Notice>
          )}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Camera matrix" level={3}>
              <table className="num w-full font-mono text-sm">
                <caption className="sr-only">3×3 camera intrinsic matrix</caption>
                <tbody>{cal.camera_matrix.map((row, r) => (
                  <tr key={r}>{row.map((v, c) => <td key={c} className="px-1 py-1 text-right text-ink">{v.toFixed(2)}</td>)}</tr>
                ))}</tbody>
              </table>
              <p className="mt-3 text-xs text-muted">
                Focal length fx {cal.camera_matrix[0][0].toFixed(1)}, fy {cal.camera_matrix[1][1].toFixed(1)}; principal point
                ({cal.camera_matrix[0][2].toFixed(1)}, {cal.camera_matrix[1][2].toFixed(1)}). In pixels.
              </p>
            </Card>
            <Card title="Distortion coefficients" level={3}>
              <dl className="num grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-sm">
                {cal.distortion_coefficients.map((v, i) => (
                  <div key={i} className="contents"><dt className="text-muted">{COEFFS[i] ?? `c${i}`}</dt><dd className="text-right text-ink">{v.toFixed(5)}</dd></div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-muted">k1, k2, k3: radial (barrel or pincushion). p1, p2: tangential (lens tilt).</p>
            </Card>
            <Card title="Details" level={3}>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-muted">Image size</dt><dd className="num font-mono text-ink">{cal.image_size?.join("×")} px</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">RMS error</dt><dd className="num font-mono text-ink">{cal.rms_reprojection_error_px?.toFixed(3)} px</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">Units</dt><dd className="text-right text-ink">{cal.units}</dd></div>
              </dl>
              <p className="mt-3 text-xs text-faint">{cal.provenance}</p>
            </Card>
          </div>
          <Card title="Undistorted comparison" level={3}>
            <p className="text-sm text-muted">Needs a backend endpoint that applies this model to an image. It is requested from the backend team and not available yet.</p>
          </Card>
        </section>
      )}

      <section aria-labelledby="run-h" className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <div className="space-y-5">
          <h2 id="run-h" className="text-base font-semibold text-ink">Run a calibration</h2>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">Inner-corner pattern</legend>
            <div className="flex items-end gap-3">
              {(["Columns", "Rows"] as const).map((label, i) => (
                <label key={label} className="space-y-1 text-xs text-muted"><span>{label}</span>
                  <input type="number" min={3} max={60} value={pattern[i]} className="input num block w-20 py-1.5"
                    onChange={e => { const n = [...pattern] as [number, number]; n[i] = Math.max(3, Math.min(60, +e.target.value || 3)); setPattern(n); }} />
                </label>
              ))}
            </div>
            <p className="text-xs text-muted">The same pattern must be fully visible in every view.</p>
          </fieldset>
          <div className="flex gap-3">
            <label className="space-y-1 text-xs text-muted"><span>Square size (mm, optional)</span>
              <input inputMode="decimal" value={square} onChange={e => setSquare(e.target.value.replace(/[^0-9.]/g, ""))} className="input num block w-28 py-1.5" placeholder="Unknown" />
            </label>
            <label className="space-y-1 text-xs text-muted"><span>Minimum views</span>
              <input type="number" min={3} max={200} value={minViews} onChange={e => setMinViews(Math.max(3, +e.target.value || 3))} className="input num block w-20 py-1.5" />
            </label>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-ink">Pre-check</h3>
            <ul className="space-y-1.5 text-sm">
              {checks.map(c => (
                <li key={c.text} className="flex gap-2">
                  <svg viewBox="0 0 24 24" aria-hidden className={`mt-0.5 h-4 w-4 shrink-0 ${c.ok ? "text-ok" : "text-warn"}`} fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
                    <path d={c.ok ? "M5 12.5l4.5 4.5L19 7.5" : "M7 7l10 10M17 7L7 17"} />
                  </svg>
                  <span><span className={c.ok ? "text-ink" : "text-warn"}>{c.text}</span><span className="sr-only">{c.ok ? ": passes" : ": fails"}</span>
                    <span className="block text-xs text-muted">{c.detail}</span></span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-faint">A preview of the backend&apos;s rules; the backend makes the final decision.</p>
          </div>
          <button className="btn w-full justify-center" onClick={run} disabled={busy || chosen.length === 0}>
            {busy ? "Calibrating…" : `Run calibration on ${chosen.length} view${chosen.length === 1 ? "" : "s"}`}
          </button>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {bySize.map(([size, ids]) => (
              <button key={size} className="btn-ghost text-xs" onClick={() => setChosen(ids)}>Select {ids.length} at {size}</button>
            ))}
            <button className="btn-ghost text-xs" onClick={() => setChosen([])} disabled={!chosen.length}>Clear</button>
            <label className="btn-ghost ml-auto cursor-pointer text-xs">
              Upload images<input type="file" multiple accept="image/*" className="sr-only" onChange={e => { onUpload(e.target.files); e.target.value = ""; }} />
            </label>
          </div>
          {upload && <p className="text-xs text-muted" aria-live="polite">{upload}</p>}
          {images.length === 0 ? <EmptyState title="No images yet" body="Upload at least 10 photos of one checkerboard taken from different angles." /> : (
            <div className="overflow-x-auto rounded-lg border border-edge">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Images available as calibration views</caption>
                <thead className="border-b border-edge bg-panel text-xs text-muted">
                  <tr><th className="w-10 px-3 py-2"><span className="sr-only">Select</span></th><th className="px-3 py-2 font-medium">View</th>
                    <th className="px-3 py-2 font-medium">Size</th><th className="px-3 py-2 font-medium">Type</th><th className="whitespace-nowrap px-3 py-2 font-medium">Last run</th></tr>
                </thead>
                <tbody>
                  {images.map(i => {
                    const used = cal?.views_used?.includes(i.image_id); const failed = cal?.views_failed?.includes(i.image_id);
                    return (
                      <tr key={i.image_id} className={`border-b border-edge last:border-0 ${chosen.includes(i.image_id) ? "bg-accent/5" : ""}`}>
                        <td className="px-3 py-2"><input type="checkbox" className="accent-accent" checked={chosen.includes(i.image_id)}
                          onChange={() => toggle(i.image_id)} aria-label={`Select ${i.filename}`} /></td>
                        <td className="px-3 py-2"><div className="flex items-center gap-3">
                          <img src={api.imageUrl(i.image_id)} alt="" loading="lazy" className="h-9 w-12 shrink-0 rounded border border-edge bg-black object-cover" />
                          <FileName name={i.filename} className="text-xs text-ink" /></div></td>
                        <td className="num whitespace-nowrap px-3 py-2 font-mono text-xs text-muted">{i.width}×{i.height}</td>
                        <td className="px-3 py-2 text-xs text-muted">{typeLabel(i)}</td>
                        <td className={`px-3 py-2 text-xs ${used ? "text-ok" : failed ? "text-warn" : "text-faint"}`}>{used ? "Used" : failed ? "No pattern found" : "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
