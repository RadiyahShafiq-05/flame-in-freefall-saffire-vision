"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { HistoryItem, Calibration } from "@/types";
import DashboardCard from "@/components/DashboardCard";
export default function Reports() {
  const [reports, setReports] = useState<string[]>([]); const [h, setH] = useState<HistoryItem[]>([]);
  const [cal, setCal] = useState<Calibration | null>(null); const [err, setErr] = useState("");
  const load = () => Promise.all([api.reports(), api.history(), api.calStatus()]).then(([r, hh, c]) => { setReports(r); setH(hh); setCal(c); }).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  return (<div className="space-y-5"><h1 className="text-2xl font-semibold">Reports</h1>{err && <p className="text-amber-400 text-sm">{err}</p>}
    <button className="btn" onClick={() => api.createReport().then(load).catch(e => setErr(e.message))}>Generate report from current state</button>
    <DashboardCard title="Reports">{reports.length === 0 ? <p className="text-sm text-gray-400">None yet.</p> :
      <ul className="text-sm space-y-1">{reports.map(id => <li key={id}>{id} · <a className="text-accent underline" href={api.reportDownload(id, "html")}>HTML</a> · <a className="text-accent underline" href={api.reportDownload(id, "json")}>JSON</a></li>)}</ul>}</DashboardCard>
    <DashboardCard title="Detection history">{h.length === 0 ? <p className="text-sm text-gray-400">No detection runs yet.</p> :
      <ul className="text-sm space-y-1 text-gray-300">{h.slice().reverse().map((x, i) => <li key={i}>{x.image_id} · {x.pattern.join("×")} · {x.success ? `${x.num_corners} corners` : "not detected"}</li>)}</ul>}</DashboardCard>
    <DashboardCard title="Calibration status"><p className="text-sm">{cal?.status ?? "…"}</p>{cal?.problems?.map(p => <p key={p} className="text-xs text-amber-400">• {p}</p>)}</DashboardCard></div>);
}
