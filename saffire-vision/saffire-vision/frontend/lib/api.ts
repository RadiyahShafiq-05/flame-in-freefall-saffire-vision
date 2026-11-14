import type { Dataset, Detection, Calibration, HistoryItem, ImageInfo } from "@/types";
export const API = process.env.NEXT_PUBLIC_API_URL ?? ""; // empty = same-origin, proxied by Next rewrites
async function j<T>(r: Response): Promise<T> {
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(typeof e.detail === "string" ? e.detail : `HTTP ${r.status}`); }
  return r.json();
}
const post = (p: string, b: unknown) => fetch(API + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
export const api = {
  dataset: () => fetch(API + "/api/dataset").then(j<Dataset>),
  history: () => fetch(API + "/api/analysis/history").then(j<HistoryItem[]>),
  detect: (image_id: string, cols: number, rows: number) => post("/api/analysis/detect-checkerboard", { image_id, cols, rows }).then(j<Detection>),
  distortion: (image_id: string, cols: number, rows: number) => post("/api/analysis/distortion", { image_id, cols, rows }).then(j<any>),
  calibrate: (image_ids: string[], cols: number, rows: number, min_views: number, square_size_mm?: number) =>
    post("/api/calibration/run", { image_ids, cols, rows, min_views, square_size_mm }).then(j<Calibration>),
  calStatus: () => fetch(API + "/api/calibration/status").then(j<Calibration>),
  upload: (f: File) => { const fd = new FormData(); fd.append("file", f); return fetch(API + "/api/images/upload", { method: "POST", body: fd }).then(j<ImageInfo>); },
  createReport: () => fetch(API + "/api/reports", { method: "POST" }).then(j<{ report_id: string }>),
  reports: () => fetch(API + "/api/reports").then(j<string[]>),
  imageUrl: (id: string) => `${API}/api/images/${encodeURIComponent(id)}/file`,
  preprocessUrl: async (image_id: string, operation: string) => URL.createObjectURL(await (await post("/api/analysis/preprocess", { image_id, operation })).blob()),
  overlayUrl: (f: string) => `${API}/outputs/detected/${encodeURIComponent(f)}`,
  reportDownload: (id: string, fmt: "html" | "json") => `${API}/api/reports/${id}/download?format=${fmt}`,
};
