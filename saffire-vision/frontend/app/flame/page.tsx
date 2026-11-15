"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import type { FlameFrameResult } from "@/types";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Notice from "@/components/Notice";

const field = "block w-full rounded-md border border-edge-strong bg-base px-3 py-2 text-sm text-ink";

export default function FlamePage() {
  const [file, setFile] = useState<File | null>(null);
  const [experiment, setExperiment] = useState("");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<FlameFrameResult | null>(null);

  const run = () => {
    if (!file) { setError("Choose an image first."); return; }
    setBusy(true); setError("");
    api.flameFrame(file, experiment, source)
      .then(setResult)
      .catch(e => { setResult(null); setError(e.message); })
      .finally(() => setBusy(false));
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Flame Frames"
        subtitle="Upload one NASA flame still. The detector marks bright orange, yellow, white-hot, and blue pixels and reports their area." />
      <Notice tone="warn" title="Approximate visual detection. Not a validated fire measurement.">
        The area is in pixels only. It is not a flame length, a temperature, or a result in millimetres.
        A poster that already contains several flames is measured as that one file.
      </Notice>

      <Card title="Image">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-xs text-muted">
            <span>NASA flame image</span>
            <input type="file" accept="image/png,image/jpeg,image/tiff,image/bmp" className={`${field} file:mr-3 file:rounded file:border-0 file:bg-accent/15 file:px-2 file:py-1 file:text-accent`}
              onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
          </label>
          <label className="space-y-1 text-xs text-muted">
            <span>Experiment name</span>
            <input className={field} value={experiment} onChange={e => setExperiment(e.target.value)}
              placeholder="SoFIE-GEL" />
          </label>
          <label className="space-y-1 text-xs text-muted md:col-span-2">
            <span>Source</span>
            <input className={field} value={source} onChange={e => setSource(e.target.value)}
              placeholder="NASA, International Space Station, microgravity. Published still, 3-second interval." />
          </label>
        </div>
        <button type="button" onClick={run} disabled={busy}
          className="mt-4 rounded-md border border-accent/40 bg-accent/15 px-4 py-2 text-sm font-medium text-accent disabled:opacity-50">
          {busy ? "Detecting…" : "Detect flame region"}
        </button>
        {error && <p className="mt-3 text-sm text-warn">{error}</p>}
      </Card>

      {result && (
        <>
          <Card title="Original and detected region">
            <div className="grid gap-4 md:grid-cols-2">
              <figure>
                <img src={result.original_url} alt="Original uploaded image" className="w-full rounded border border-edge bg-black" />
                <figcaption className="mt-2 text-xs text-muted">Original</figcaption>
              </figure>
              <figure>
                <div className="relative">
                  <img src={result.original_url} alt="" className="w-full rounded border border-edge bg-black" />
                  <img src={result.overlay_url} alt="Transparent flame-region overlay" className="absolute inset-0 h-full w-full rounded" />
                </div>
                <figcaption className="mt-2 text-xs text-muted">Transparent overlay on the original</figcaption>
              </figure>
            </div>
          </Card>
          <Card title="Measurements">
            <p className="text-sm text-warn">{result.label}</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted">Detected area</dt>
                <dd className="num text-lg text-ink">{result.flame_pixels.toLocaleString()} px</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Image coverage</dt>
                <dd className="num text-lg text-ink">{result.coverage_percent}%</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Image size</dt>
                <dd className="num text-lg text-ink">{result.width}×{result.height}</dd>
              </div>
            </dl>
            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted">Experiment</dt>
                <dd className="text-ink">{result.experiment_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Source</dt>
                <dd className="text-ink">{result.source}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">File</dt>
                <dd className="font-mono text-xs text-muted">{result.filename}</dd>
              </div>
            </dl>
          </Card>
        </>
      )}
    </div>
  );
}
