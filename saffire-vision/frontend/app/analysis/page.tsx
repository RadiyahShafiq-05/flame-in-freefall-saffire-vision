"use client";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useDataset } from "@/lib/useDataset";
import { isSaffireGrid, typeLabel } from "@/lib/images";
import type { Detection, Distortion, ImageInfo } from "@/types";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Notice from "@/components/Notice";
import ImageComparison from "@/components/ImageComparison";
import CornerOverlay from "@/components/CornerOverlay";

const TABS = [
  { id: "preprocess", label: "Preprocess" },
  { id: "checkerboard", label: "Checkerboard" },
  { id: "distortion", label: "Distortion" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const OPS = [
  { id: "grayscale", label: "Grayscale", note: "Drops color; detection works on brightness only." },
  { id: "contrast", label: "Contrast", note: "CLAHE local contrast enhancement on the grayscale image." },
  { id: "denoise", label: "Noise reduction", note: "5×5 Gaussian blur to suppress sensor noise." },
  { id: "normalize", label: "Normalize", note: "Stretches grayscale values to the full 0–255 range." },
  { id: "resize", label: "Resize", note: "Scales the longest side down to 1024 px for display." },
] as const;

export default function AnalysisPage() {
  return <Suspense><Analysis /></Suspense>;
}

function Analysis() {
  const { state, dataset } = useDataset();
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const images = dataset?.images ?? [];
  const imageId = params.get("image") ?? images.find(isSaffireGrid)?.image_id ?? images[0]?.image_id ?? "";
  const image = images.find(i => i.image_id === imageId);
  const tab: Tab = TABS.some(t => t.id === params.get("tab")) ? params.get("tab") as Tab : "preprocess";
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    router.replace(`${path}?${next}`, { scroll: false });
  };

  // Pattern size is shared by the checkerboard and distortion tabs so one entry drives both.
  const [pattern, setPattern] = useState<[number, number]>([6, 4]);
  const [detection, setDetection] = useState<Detection | null>(null);
  const current = detection && detection.image_id === imageId && detection.pattern.join() === pattern.join() ? detection : null;

  if (state === "loading") return <PageHeader title="Image Analysis" subtitle="Loading images…" />;
  if (state === "offline" || state === "empty" || !image) {
    return (
      <div className="space-y-6">
        <PageHeader title="Image Analysis" />
        <EmptyState title={state === "offline" ? "Backend offline" : "No image to analyze"}
          body={state === "offline" ? "Start the backend to preprocess images and detect checkerboard corners." : "Load images into data/raw/ or upload them on the Calibration page."} />
      </div>
    );
  }

  const saffire = images.filter(isSaffireGrid);
  const others = images.filter(i => !isSaffireGrid(i));
  return (
    <div className="space-y-6">
      <PageHeader title="Image Analysis"
        subtitle="Prepare an image, find its checkerboard corners, and measure how the camera bends the grid. All numbers come from the backend." />

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="block min-w-0 flex-1 basis-80 space-y-1 text-xs text-muted">
          <span>Image</span>
          <select className="block w-full rounded-md border border-edge-strong bg-base px-3 py-2 font-mono text-sm text-ink"
            value={imageId} onChange={e => setParam("image", e.target.value)}>
            {saffire.length > 0 && <optgroup label="SAFFIRE-1 distortion grids">{saffire.map(i => <option key={i.image_id} value={i.image_id}>{i.filename}</option>)}</optgroup>}
            {others.length > 0 && <optgroup label={`Other images (${others.length})`}>{others.map(i => <option key={i.image_id} value={i.image_id}>{i.filename}</option>)}</optgroup>}
          </select>
        </label>
        <p className="num pb-2 text-xs text-muted">{image.width}×{image.height} px · {typeLabel(image)}</p>
      </div>

      <div role="tablist" aria-label="Analysis step" className="flex gap-1 border-b border-edge">
        {TABS.map((t, i) => (
          <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`}
            onClick={() => setParam("tab", t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition-colors ${tab === t.id ? "border-accent font-medium text-accent" : "border-transparent text-muted hover:text-ink"}`}>
            <span className="num mr-1.5 font-mono text-xs text-faint">{i + 1}</span>{t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "preprocess" && <Preprocess key={imageId} image={image} />}
        {tab === "checkerboard" && (
          <Checkerboard image={image} pattern={pattern} setPattern={setPattern} detection={current} onDetected={setDetection} />
        )}
        {tab === "distortion" && (
          <DistortionPanel key={imageId} image={image} pattern={pattern} setPattern={setPattern}
            detection={current} onDetected={setDetection} />
        )}
      </div>
    </div>
  );
}

function Preprocess({ image }: { image: ImageInfo }) {
  const [op, setOp] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const apply = (id: string) => {
    setOp(id); setBusy(true); setError("");
    api.preprocessUrl(image.image_id, id).then(setUrl).catch(e => { setUrl(""); setError(e.message); }).finally(() => setBusy(false));
  };
  const chosen = OPS.find(o => o.id === op);
  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ink">Operation</h2>
        <p className="text-xs text-muted">Each runs on a copy; the original file is never changed.</p>
        <div className="space-y-1.5 pt-1">
          {OPS.map(o => (
            <button key={o.id} onClick={() => apply(o.id)} aria-pressed={op === o.id} disabled={busy}
              className={`block w-full rounded-md border px-3 py-2 text-left transition-colors disabled:cursor-wait ${op === o.id ? "border-accent/50 bg-accent/10" : "border-edge hover:border-edge-strong"}`}>
              <span className={`block text-sm ${op === o.id ? "font-medium text-accent" : "text-ink"}`}>{o.label}</span>
              <span className="block text-xs text-muted">{o.note}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0">
        {error && <Notice tone="warn" title="Preprocessing failed">{error}</Notice>}
        {!op && !error && <EmptyState title="Choose an operation" body="The original and the processed copy appear side by side, or as a swipe comparison." />}
        {op && busy && <div className="aspect-[4/3] w-full animate-pulse rounded-md border border-edge bg-raised motion-reduce:animate-none" aria-label="Processing" />}
        {op && !busy && url && (
          <ImageComparison left={api.imageUrl(image.image_id)} right={url} rightLabel={`Processed: ${chosen?.label}`}
            size={[image.width, image.height]} />
        )}
      </div>
    </div>
  );
}

function PatternInput({ pattern, setPattern }: { pattern: [number, number]; setPattern: (p: [number, number]) => void }) {
  const field = (i: 0 | 1, label: string) => (
    <label className="space-y-1 text-xs text-muted">
      <span>{label}</span>
      <input type="number" min={3} max={60} value={pattern[i]} className="input num block w-20 py-1.5"
        onChange={e => { const next = [...pattern] as [number, number]; next[i] = Math.max(3, Math.min(60, +e.target.value || 3)); setPattern(next); }} />
    </label>
  );
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-ink">Inner-corner pattern</legend>
      <div className="flex items-end gap-3">
        {field(0, "Columns")}
        <span className="pb-2 text-faint">×</span>
        {field(1, "Rows")}
      </div>
      <p className="text-xs text-muted">Count corners where four squares meet, not squares. OpenCV must see the whole pattern. You choose the size; it is not verified against the real grid.</p>
    </fieldset>
  );
}

function Checkerboard({ image, pattern, setPattern, detection, onDetected }: {
  image: ImageInfo; pattern: [number, number]; setPattern: (p: [number, number]) => void;
  detection: Detection | null; onDetected: (d: Detection) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(true);
  const run = () => {
    setBusy(true); setError("");
    api.detect(image.image_id, ...pattern).then(onDetected).catch(e => setError(e.message)).finally(() => setBusy(false));
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <div className="space-y-4">
        <PatternInput pattern={pattern} setPattern={setPattern} />
        <button className="btn w-full justify-center" onClick={run} disabled={busy}>{busy ? "Detecting…" : "Detect corners"}</button>
        {detection && (
          <div className="space-y-2 rounded-md border border-edge bg-panel p-3 text-sm" aria-live="polite">
            <p className={`font-medium ${detection.success ? "text-accent" : "text-warn"}`}>
              {detection.success ? `${detection.num_corners} corners found` : `${pattern.join("×")} pattern not found`}
            </p>
            {detection.method && <p className="font-mono text-xs text-muted">{detection.method}</p>}
            <p className="text-xs text-muted">{detection.message}</p>
            {detection.success && isSaffireGrid(image) && (
              <p className="text-xs text-muted">The SAFFIRE grid runs past the frame, so this is a sub-region of the board, not its true size.</p>
            )}
          </div>
        )}
      </div>
      <div className="min-w-0 space-y-3">
        {error && <Notice tone="warn" title="Detection failed">{error}</Notice>}
        {detection?.success && (
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} className="accent-accent" />
            Show detected corners (first corner in amber)
          </label>
        )}
        <CornerOverlay src={api.imageUrl(image.image_id)} alt={`${image.filename}${detection?.success ? " with detected corners" : ""}`}
          size={detection?.image_size ?? [image.width, image.height]} corners={detection?.corners ?? []}
          pattern={detection?.pattern ?? pattern} show={show} />
      </div>
    </div>
  );
}

const METRICS = [
  { key: "mean", label: "Mean spacing", note: "Average distance between neighbouring corners." },
  { key: "std", label: "Spacing spread", note: "Standard deviation; lens distortion stretches squares unevenly across the frame." },
  { key: "cv", label: "Variation (CV)", note: "Spread divided by mean. 0 means every square is the same size on the image." },
  { key: "straight", label: "Row straightness", note: "RMS distance of corners from a straight line through their row. 0 means rows stay straight." },
] as const;

function DistortionPanel({ image, pattern, setPattern, detection, onDetected }: {
  image: ImageInfo; pattern: [number, number]; setPattern: (p: [number, number]) => void;
  detection: Detection | null; onDetected: (d: Detection) => void;
}) {
  // Results are kept with the pattern they were measured for, so editing the pattern hides them.
  const [measured, setMeasured] = useState<{ pattern: string; d: Distortion } | null>(null);
  const result = measured?.pattern === pattern.join() ? measured.d : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const measure = () => {
    setBusy(true); setError("");
    const p = pattern.join();
    // Corners for the row view come from a detection run; reuse one for the same image and pattern.
    Promise.all([api.distortion(image.image_id, ...pattern), detection ? Promise.resolve(detection) : api.detect(image.image_id, ...pattern)])
      .then(([d, det]) => { setMeasured({ pattern: p, d }); if (!detection) onDetected(det); })
      .catch(e => setError(e.message)).finally(() => setBusy(false));
  };
  const g = result?.geometry.available ? result.geometry : null;
  const value = (k: (typeof METRICS)[number]["key"]) => !g ? "" :
    k === "mean" ? `${g.spacing_px.mean.toFixed(2)} px` : k === "std" ? `${g.spacing_px.std.toFixed(2)} px`
    : k === "cv" ? g.spacing_cv.toFixed(4) : `${g.row_straightness_rms_px.toFixed(3)} px`;
  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <div className="space-y-4">
        <PatternInput pattern={pattern} setPattern={setPattern} />
        <button className="btn w-full justify-center" onClick={measure} disabled={busy}>{busy ? "Measuring…" : "Measure grid geometry"}</button>
        <p className="text-xs text-muted">These are observed pixel measurements, not lens coefficients. Coefficients need a valid calibration.</p>
      </div>
      <div className="min-w-0 space-y-4">
        {error && <Notice tone="warn" title="Measurement failed">{error}</Notice>}
        {result && !g && <Notice tone="warn" title="No geometry available">{result.geometry.available ? null : result.geometry.reason}</Notice>}
        {!result && !error && <EmptyState title="Not measured yet" body="Measure to see corner spacing and how straight each row of corners stays." />}
        {g && (
          <>
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {METRICS.map(m => (
                <div key={m.key} className="rounded-md border border-edge bg-panel p-3">
                  <dt className="text-xs text-muted">{m.label}</dt>
                  <dd className="num mt-1 font-mono text-lg text-ink">{value(m.key)}</dd>
                  <dd className="mt-1 text-xs leading-snug text-faint">{m.note}</dd>
                </div>
              ))}
            </dl>
            <SpacingRange spacing={g.spacing_px} />
            {detection?.success && (
              <Card title="Row straightness" level={3}>
                <p className="mb-3 text-xs text-muted">
                  Cyan follows the detected corners in each row; the dashed amber chord joins the row&apos;s ends. Where they part, the lens bends a straight line.
                </p>
                <CornerOverlay src={api.imageUrl(image.image_id)} alt={`${image.filename} with corner rows and straight reference chords`}
                  size={detection.image_size} corners={detection.corners} pattern={detection.pattern} mode="rows" />
              </Card>
            )}
            <p className="text-xs text-faint">Backend note: {g.note}</p>
          </>
        )}
      </div>
    </div>
  );
}

function SpacingRange({ spacing }: { spacing: { mean: number; std: number; min: number; max: number } }) {
  const { min, max, mean, std } = spacing;
  const pad = (max - min) * 0.08 || 1;
  const lo = min - pad, hi = max + pad;
  const x = (v: number) => ((v - lo) / (hi - lo)) * 100;
  return (
    <figure className="rounded-md border border-edge bg-panel p-4">
      <figcaption className="mb-3 text-xs text-muted">Corner spacing range: minimum to maximum, mean marked, ±1 standard deviation shaded</figcaption>
      <div className="relative h-8" role="img" aria-label={`Spacing from ${min.toFixed(1)} to ${max.toFixed(1)} px, mean ${mean.toFixed(1)} px`}>
        <div className="absolute top-1/2 h-px w-full bg-edge-strong" />
        <div className="absolute top-1/2 h-3 -translate-y-1/2 rounded-sm bg-accent/20" style={{ left: `${x(mean - std)}%`, width: `${x(mean + std) - x(mean - std)}%` }} />
        <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent/60" style={{ left: `${x(min)}%`, width: `${x(max) - x(min)}%` }} />
        <div className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 bg-ink" style={{ left: `${x(mean)}%` }} />
      </div>
      <div className="num mt-2 flex justify-between font-mono text-xs text-muted">
        <span>min {min.toFixed(1)} px</span><span>mean {mean.toFixed(1)} px</span><span>max {max.toFixed(1)} px</span>
      </div>
    </figure>
  );
}
