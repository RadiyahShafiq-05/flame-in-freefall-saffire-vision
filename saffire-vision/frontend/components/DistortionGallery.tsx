"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useDataset } from "@/lib/useDataset";

type Color = "Color" | "Monochrome";
type Kind = "Individual" | "Combined";

type Entry = {
  file: string;
  color: Color;
  kind: Kind;
  desc: string;
};

const ENTRIES: Entry[] = [
  { file: "SAFFIRE-1_F1C1_DistortionGrid-30mmBlock_1280x920.jpg", color: "Color", kind: "Individual",
    desc: "Individual distortion-grid image in colour (F1C1 in the filename), showing the 30 mm block grid." },
  { file: "SAFFIRE-1_F1C1_DistortionGrid-30mmBlock_1280x920_mono.jpg", color: "Monochrome", kind: "Individual",
    desc: "Individual distortion-grid image in monochrome (F1C1 in the filename), showing the 30 mm block grid." },
  { file: "SAFFIRE-1_DistortionGrids-30mmBlock_Combined_1280x920_color.jpg", color: "Color", kind: "Combined",
    desc: "Combined distortion-grid image in colour, bringing the 30 mm block grids together in one picture." },
  { file: "SAFFIRE-1_DistortionGrids-30mmBlock_Combined_1280x920_mono.jpg", color: "Monochrome", kind: "Combined",
    desc: "Combined distortion-grid image in monochrome, bringing the 30 mm block grids together in one picture." },
];

// Clearly labelled stand-in. Not a NASA image.
function placeholder(e: Entry) {
  const lines = Array.from({ length: 21 }, (_, k) => `<line x1="${k * 64}" y1="0" x2="${k * 64}" y2="920"/>`).join("")
    + Array.from({ length: 15 }, (_, k) => `<line x1="0" y1="${k * 64}" x2="1280" y2="${k * 64}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 920"><rect width="1280" height="920" fill="#dfe5ea"/><g stroke="#b3bfc8" stroke-width="2">${lines}</g><rect x="290" y="330" width="700" height="260" fill="#fff" stroke="#8a5a00" stroke-width="4"/><text x="640" y="430" text-anchor="middle" font-family="sans-serif" font-size="44" font-weight="700" fill="#8a5a00">PLACEHOLDER</text><text x="640" y="486" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#333">Not a NASA image</text><text x="640" y="540" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#333">${e.color} - ${e.kind}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

const field = "rounded-md border border-edge bg-panel px-3 py-2 text-sm text-ink";

export default function DistortionGallery() {
  const [q, setQ] = useState("");
  const [color, setColor] = useState<"all" | Color>("all");
  const [kind, setKind] = useState<"all" | Kind>("all");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [open, setOpen] = useState<Entry | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  // The grids are served by the backend from data/raw/, the same files the Dataset Explorer shows.
  const { state, dataset } = useDataset();
  const loaded = useMemo(() => new Map((dataset?.images ?? []).map((i) => [i.filename, i])), [dataset]);

  const available = (e: Entry) => loaded.has(e.file);
  const src = (e: Entry) => { const im = loaded.get(e.file); return im ? api.imageUrl(im.image_id) : placeholder(e); };
  // Filenames say 1280x920, but the combined images are side-by-side views, so only the measured size is shown.
  const size = (e: Entry) => { const im = loaded.get(e.file); return im ? `${im.width} × ${im.height} px` : "Unknown until loaded"; };
  const missing = state === "offline" ? "Placeholder: the backend is offline" : state === "loading" ? "Checking the backend" : "Placeholder: file not found in data/raw/";
  const count = ENTRIES.filter(available).length;

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return ENTRIES
      .filter((e) => (color === "all" || e.color === color) && (kind === "all" || e.kind === kind)
        && (!s || `${e.file} ${e.color} ${e.kind} ${e.desc}`.toLowerCase().includes(s)))
      .sort((a, b) => a.file.localeCompare(b.file) * (dir === "asc" ? 1 : -1));
  }, [q, color, kind, dir]);

  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);

  return (
    <section aria-labelledby="gallery-h">
      <div className="mb-4 flex items-center gap-3">
        <h2 id="gallery-h" className="text-lg font-semibold text-ink">Image gallery</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${count === ENTRIES.length ? "bg-accent/10 text-accent" : "bg-raised text-muted"}`}>
          {count === ENTRIES.length ? "All 4 images loaded" : state === "offline" ? "Backend offline" : state === "loading" ? "Checking…" : `${count} of ${ENTRIES.length} images loaded`}
        </span>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3" role="search">
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs font-medium text-muted">Search images
          <input className={field} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filename or keyword" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">Colour
          <select className={field} value={color} onChange={(e) => setColor(e.target.value as "all" | Color)}>
            <option value="all">All</option><option value="Color">Color</option><option value="Monochrome">Monochrome</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">Image type
          <select className={field} value={kind} onChange={(e) => setKind(e.target.value as "all" | Kind)}>
            <option value="all">All</option><option value="Individual">Individual</option><option value="Combined">Combined</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">Sort by filename
          <select className={field} value={dir} onChange={(e) => setDir(e.target.value as "asc" | "desc")}>
            <option value="asc">A to Z</option><option value="desc">Z to A</option>
          </select>
        </label>
        <p className="ml-auto text-sm text-muted" aria-live="polite">Showing {list.length} of {ENTRIES.length}</p>
      </div>

      {list.length === 0 ? (
        <p className="rounded-md border border-dashed border-edge p-8 text-center text-sm text-muted">
          No images match. Clear the search or change a filter.
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {list.map((e) => (
            <li key={e.file} className="flex flex-col overflow-hidden rounded-md border border-edge bg-panel">
              <div className="relative aspect-[1280/920] border-b border-edge bg-raised">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src(e)} alt={available(e) ? `${e.color} ${e.kind.toLowerCase()} distortion grid` : "Placeholder, not a NASA image"} className="h-full w-full object-contain" />
                {!available(e) && <span className="absolute left-2 top-2 rounded bg-raised px-2 py-0.5 text-xs font-semibold text-muted">Placeholder</span>}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <p className="break-all text-xs font-semibold text-ink">{e.file}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                  <dt className="text-muted">Colour</dt><dd className="text-ink">{e.color}</dd>
                  <dt className="text-muted">Dimensions</dt><dd className="text-ink">{size(e)}</dd>
                  <dt className="text-muted">Type</dt><dd className="text-ink">{e.kind}</dd>
                </dl>
                <button type="button" onClick={() => setOpen(e)}
                  className="mt-auto rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-medium text-accent hover:bg-accent/20">
                  Open image
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <dialog ref={dialog} onClose={() => setOpen(null)} aria-labelledby="detail-h"
        className="w-[min(960px,94vw)] rounded-md border border-edge bg-panel p-0 text-ink backdrop:bg-black/70"
        onClick={(ev) => { if (ev.target === dialog.current) dialog.current?.close(); }}>
        {open && (
          <>
            <div className="flex items-center justify-between border-b border-edge px-4 py-3">
              <h3 id="detail-h" className="break-all text-sm font-semibold">{open.file}</h3>
              <button type="button" onClick={() => dialog.current?.close()} className="rounded-md border border-edge bg-raised px-3 py-1 text-sm">Close</button>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-[2fr_1fr]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src(open)} alt={available(open) ? `${open.color} ${open.kind.toLowerCase()} distortion grid` : "Placeholder, not a NASA image"} className="aspect-[1280/920] w-full border border-edge bg-raised object-contain" />
              <dl className="grid h-fit grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="text-muted">Filename</dt><dd className="break-all">{open.file}</dd>
                <dt className="text-muted">Dimensions</dt><dd>{size(open)}</dd>
                <dt className="text-muted">File format</dt><dd>JPEG (.jpg)</dd>
                <dt className="text-muted">Colour</dt><dd>{open.color}</dd>
                <dt className="text-muted">Image type</dt><dd>{open.kind}</dd>
                <dt className="text-muted">Source</dt><dd>{available(open) ? "NASA SAFFIRE-I (PSI-98), served by the backend from data/raw/" : missing}</dd>
                <dt className="text-muted">Description</dt><dd>{open.desc}</dd>
              </dl>
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
