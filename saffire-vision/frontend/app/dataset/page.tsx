"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Dataset } from "@/types";
import ImageCard from "@/components/ImageCard";
export default function DatasetPage() {
  const [ds, setDs] = useState<Dataset | null>(null); const [err, setErr] = useState("");
  useEffect(() => { api.dataset().then(setDs).catch(e => setErr(e.message)); }, []);
  if (err) return <p className="text-amber-400">{err}</p>;
  return (<div className="space-y-4"><h1 className="text-2xl font-semibold">Dataset Explorer</h1>
    {ds?.count === 0 && <p className="text-sm text-gray-400">No images in <code>data/raw/</code>. Copy the SAFFIRE-1 JPEGs there or upload via the API.</p>}
    <div className="grid md:grid-cols-2 gap-4">{ds?.images.map(im => <ImageCard key={im.image_id} image={im} loaded />)}</div>
    <ul className="text-xs text-gray-400 list-disc pl-5">{ds?.notes.map(n => <li key={n}>{n}</li>)}</ul></div>);
}
