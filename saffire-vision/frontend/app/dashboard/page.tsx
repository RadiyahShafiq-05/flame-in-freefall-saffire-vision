"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Dataset, Calibration, HistoryItem } from "@/types";
import MetricsCard from "@/components/MetricsCard";
export default function Dashboard() {
  const [ds, setDs] = useState<Dataset | null>(null); const [cal, setCal] = useState<Calibration | null>(null);
  const [h, setH] = useState<HistoryItem[]>([]); const [err, setErr] = useState("");
  const [reports, setReports] = useState<string[]>([]);
  useEffect(() => { Promise.all([api.dataset(), api.calStatus(), api.history(), api.reports()])
    .then(([a, b, c, d]) => { setDs(a); setCal(b); setH(c); setReports(d); }).catch(e => setErr(e.message)); }, []);
  if (err) return <p className="text-amber-400">Backend unreachable: {err}. Start it with <code>python run.py</code>.</p>;
  const ok = h.filter(x => x.success).length;
  return (<div className="space-y-6"><h1 className="text-2xl font-semibold">Dashboard</h1>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricsCard label="Images loaded" value={ds?.count ?? "…"} />
      <MetricsCard label="Detection runs" value={h.length} hint={`${ok} successful`} />
      <MetricsCard label="Calibration" value={cal?.status ?? "…"} />
      <MetricsCard label="Reports" value={reports.length} /></div>
    <section><h2 className="mb-2 font-medium">Recent analysis activity</h2>
      {h.length === 0 ? <p className="text-sm text-gray-400">No analyses run yet.</p> :
        <ul className="text-sm space-y-1">{h.slice(-8).reverse().map((x, i) => <li key={i} className="text-gray-300">{x.image_id} · {x.pattern.join("×")} · {x.success ? `${x.num_corners} corners` : "not detected"}</li>)}</ul>}</section>
    <p className="text-xs text-gray-500">{ds?.source}</p></div>);
}
