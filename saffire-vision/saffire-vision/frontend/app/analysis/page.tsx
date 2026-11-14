"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ImageInfo, Detection } from "@/types";
import ImageComparison from "@/components/ImageComparison";
import DetectionOverlay from "@/components/DetectionOverlay";
import AnalysisChart from "@/components/AnalysisChart";
export default function Analysis() {
  const [imgs, setImgs] = useState<ImageInfo[]>([]); const [sel, setSel] = useState(""); const [op, setOp] = useState("contrast");
  const [proc, setProc] = useState(""); const [cols, setCols] = useState(6); const [rows, setRows] = useState(4);
  const [det, setDet] = useState<Detection | null>(null); const [geo, setGeo] = useState<any>(null); const [err, setErr] = useState("");
  useEffect(() => { api.dataset().then(d => { setImgs(d.images); setSel(d.images[0]?.image_id ?? ""); }).catch(e => setErr(e.message)); }, []);
  const run = (f: () => Promise<void>) => { setErr(""); f().catch(e => setErr(e.message)); };
  const sp = geo?.geometry?.available ? geo.geometry.spacing_px : null;
  return (<div className="space-y-5"><h1 className="text-2xl font-semibold">Image Analysis</h1>{err && <p className="text-amber-400 text-sm">{err}</p>}
    <div className="flex flex-wrap gap-3 items-end">
      <select className="input w-80" value={sel} onChange={e => setSel(e.target.value)}>{imgs.map(i => <option key={i.image_id}>{i.image_id}</option>)}</select>
      <select className="input" value={op} onChange={e => setOp(e.target.value)}>{["grayscale", "contrast", "denoise", "normalize", "resize"].map(o => <option key={o}>{o}</option>)}</select>
      <button className="btn" onClick={() => run(async () => setProc(await api.preprocessUrl(sel, op)))}>Preprocess</button></div>
    <div className="flex flex-wrap gap-3 items-end text-sm">
      <label>Inner corners (cols) <input className="input" type="number" min={3} value={cols} onChange={e => setCols(+e.target.value)} /></label>
      <label>(rows) <input className="input" type="number" min={3} value={rows} onChange={e => setRows(+e.target.value)} /></label>
      <button className="btn" onClick={() => run(async () => { setDet(await api.detect(sel, cols, rows)); setGeo(await api.distortion(sel, cols, rows)); })}>Detect checkerboard</button></div>
    <p className="text-xs text-gray-500">Pattern size is user-supplied and unverified; defaults are placeholders, not documented NASA values.</p>
    {sel && proc && <ImageComparison left={api.imageUrl(sel)} right={proc} rightLabel={`Processed: ${op}`} />}
    {det && <DetectionOverlay d={det} />}
    {sp && <div><h2 className="font-medium">Observed corner spacing (px)</h2><AnalysisChart data={Object.entries(sp).map(([name, value]) => ({ name, value: value as number }))} />
      <p className="text-xs text-gray-400">{geo.geometry.note}</p></div>}</div>);
}
