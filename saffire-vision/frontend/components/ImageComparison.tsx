"use client";
import { useState } from "react";

export default function ImageComparison({ left, right, leftLabel = "Original", rightLabel = "Processed", size }:
  { left: string; right: string; leftLabel?: string; rightLabel?: string; size: [number, number] }) {
  const [mode, setMode] = useState<"side" | "swipe">("side");
  const [pos, setPos] = useState(50);
  const frame = { aspectRatio: `${size[0]} / ${size[1]}` };
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Comparison layout" className="inline-flex rounded-md border border-edge-strong p-0.5 text-xs">
        {(["side", "swipe"] as const).map(m => (
          <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
            className={`rounded px-2.5 py-1 ${mode === m ? "bg-accent/15 text-accent" : "text-muted hover:text-ink"}`}>
            {m === "side" ? "Side by side" : "Swipe"}
          </button>
        ))}
      </div>
      {mode === "side" ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[[left, leftLabel], [right, rightLabel]].map(([src, label]) => (
            <figure key={label} className="space-y-1.5">
              <div className="relative overflow-hidden rounded-md border border-edge bg-black" style={frame}>
                <img src={src} alt={label} className="absolute inset-0 h-full w-full" />
              </div>
              <figcaption className="text-xs text-muted">{label}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <figure className="space-y-2">
          <div className="relative overflow-hidden rounded-md border border-edge bg-black" style={frame}>
            <img src={left} alt={leftLabel} className="absolute inset-0 h-full w-full" />
            <img src={right} alt={rightLabel} className="absolute inset-0 h-full w-full" style={{ clipPath: `inset(0 0 0 ${pos}%)` }} />
            <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-accent" style={{ left: `${pos}%` }} aria-hidden />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span>{leftLabel}</span>
            <input type="range" min={0} max={100} value={pos} onChange={e => setPos(+e.target.value)}
              aria-label={`Swipe between ${leftLabel} and ${rightLabel}`} className="flex-1 accent-accent" />
            <span>{rightLabel}</span>
          </div>
        </figure>
      )}
    </div>
  );
}
