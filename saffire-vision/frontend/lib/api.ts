import type { Dataset, Detection, Distortion, Calibration, FlameFrameResult, HistoryItem, ImageInfo, ProcessLogItem, Report, ReportDetail } from "@/types";
export const API = process.env.NEXT_PUBLIC_API_URL ?? ""; // empty = same-origin, proxied by Next rewrites
async function j<T>(r: Response): Promise<T> {
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(typeof e.detail === "string" ? e.detail : `HTTP ${r.status}`); }
  return r.json();
}
const post = (p: string, b: unknown) => fetch(API + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
export const api = {
  dataset: () => fetch(API + "/api/dataset").then(j<Dataset>),
  history: () => fetch(API + "/api/analysis/history").then(j<HistoryItem[]>),
  log: () => fetch(API + "/api/analysis/log").then(j<ProcessLogItem[]>),
  detect: (image_id: string, cols: number, rows: number) => post("/api/analysis/detect-checkerboard", { image_id, cols, rows }).then(j<Detection>),
  distortion: (image_id: string, cols: number, rows: number) => post("/api/analysis/distortion", { image_id, cols, rows }).then(j<Distortion>),
  calibrate: (image_ids: string[], cols: number, rows: number, min_views: number, square_size_mm?: number) =>
    post("/api/calibration/run", { image_ids, cols, rows, min_views, square_size_mm }).then(j<Calibration>),
  calStatus: () => fetch(API + "/api/calibration/status").then(j<Calibration>),
  upload: (f: File) => { const fd = new FormData(); fd.append("file", f); return fetch(API + "/api/images/upload", { method: "POST", body: fd }).then(j<ImageInfo>); },
  flameFrame: (file: File, experiment_name: string, source: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("experiment_name", experiment_name);
    fd.append("source", source);
    return fetch(API + "/api/analysis/flame-frame", { method: "POST", body: fd }).then(j<FlameFrameResult>);
  },
  createReport: () => fetch(API + "/api/reports", { method: "POST" }).then(j<ReportDetail>),
  reports: () => fetch(API + "/api/reports").then(j<string[]>),
  report: (id: string) => fetch(`${API}/api/reports/${encodeURIComponent(id)}`).then(j<ReportDetail>),
  imageUrl: (id: string) => `${API}/api/images/${encodeURIComponent(id)}/file`,
  preprocessUrl: async (image_id: string, operation: string) => {
    const r = await post("/api/analysis/preprocess", { image_id, operation });
    if (!r.ok) await j(r);
    return URL.createObjectURL(await r.blob());
  },
  overlayUrl: (f: string) => `${API}/outputs/detected/${encodeURIComponent(f)}`,
  reportDownload: (id: string, fmt: "html" | "json") => `${API}/api/reports/${id}/download?format=${fmt}`,
};
