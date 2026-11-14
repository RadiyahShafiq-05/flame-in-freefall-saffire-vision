"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ImageInfo, Calibration } from "@/types";
export default function CalibrationPage() {
  const [imgs, setImgs] = useState<ImageInfo[]>([]); const [chosen, setChosen] = useState<string[]>([]);
  const [cols, setCols] = useState(6); const [rows, setRows] = useState(4); const [sq, setSq] = useState(""); const [min, setMin] = useState(10);
  const [cal, setCal] = useState<Calibration | null>(null); const [err, setErr] = useState("");
  const load = () => api.dataset().then(d => setImgs(d.images)).catch(e => setErr(e.message));
  useEffect(() => { load(); api.calStatus().then(setCal).catch(() => {}); }, []);
  const toggle = (id: string) => setChosen(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);
  const download = () => { const b = new Blob([JSON.stringify(cal, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "calibration.json"; a.click(); };
  return (<div className="space-y-5"><h1 className="text-2xl font-semibold">Camera Calibration</h1>{err && <p className="text-amber-400 text-sm">{err}</p>}
    <p className="text-sm text-gray-400">Needs multiple independent views of the board. Color/mono copies and combined composites do not count as independent views.</p>
    <div className="flex flex-wrap gap-3 items-end text-sm">
      <label>cols <input className="input" type="number" value={cols} onChange={e => setCols(+e.target.value)} /></label>
      <label>rows <input className="input" type="number" value={rows} onChange={e => setRows(+e.target.value)} /></label>
      <label>square mm (optional) <input className="input" value={sq} onChange={e => setSq(e.target.value)} /></label>
      <label>min views <input className="input" type="number" value={min} onChange={e => setMin(+e.target.value)} /></label></div>
    <div><label className="btn cursor-pointer">Upload calibration images<input type="file" multiple hidden accept="image/*"
      onChange={async e => { try { for (const f of Array.from(e.target.files ?? [])) await api.upload(f); await load(); } catch (x: any) { setErr(x.message); } }} /></label></div>
    <ul className="text-sm space-y-1">{imgs.map(i => <li key={i.image_id}><label><input type="checkbox" checked={chosen.includes(i.image_id)} onChange={() => toggle(i.image_id)} /> {i.image_id}</label></li>)}</ul>
    <button className="btn" disabled={!chosen.length} onClick={() => api.calibrate(chosen, cols, rows, min, sq ? +sq : undefined).then(setCal).catch(e => setErr(e.message))}>Run calibration ({chosen.length} selected)</button>
    {cal && <div className="rounded-lg border border-edge bg-panel p-4 text-sm space-y-2"><div>Status: <b className={cal.status === "valid" ? "text-accent" : "text-amber-400"}>{cal.status}</b></div>
      {cal.problems?.map(p => <div key={p} className="text-amber-400">• {p}</div>)}
      {cal.status === "valid" && <><div>RMS reprojection error: {cal.rms_reprojection_error_px?.toFixed(3)} px</div>
        <pre className="text-xs overflow-auto">{JSON.stringify({ camera_matrix: cal.camera_matrix, distortion_coefficients: cal.distortion_coefficients }, null, 2)}</pre>
        <button className="btn" onClick={download}>Download parameters</button></>}</div>}</div>);
}
