// Draws backend-detected corners over the image in image-pixel coordinates, so the overlay stays
// aligned at any display size. "rows" mode adds a straight chord from each row's first to last
// corner: where corners bow away from it, the lens is bending straight lines.
export default function CornerOverlay({ src, alt, size, corners, pattern, show = true, mode = "points" }: {
  src: string; alt: string; size: [number, number]; corners: number[][]; pattern: number[]; show?: boolean; mode?: "points" | "rows";
}) {
  const [w, h] = size;
  const [cols] = pattern;
  const r = Math.max(w, h) / 260;
  const rows = Array.from({ length: corners.length / cols }, (_, i) => corners.slice(i * cols, (i + 1) * cols));
  return (
    <div className="relative w-full overflow-hidden rounded-md border border-edge bg-black" style={{ aspectRatio: `${w} / ${h}` }}>
      <img src={src} alt={alt} className="absolute inset-0 h-full w-full" />
      {show && corners.length > 0 && (
        <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 h-full w-full" role="img"
          aria-label={`${corners.length} detected corners in a ${pattern.join("×")} pattern`}>
          {mode === "rows" && rows.map((row, i) => (
            <g key={i}>
              <line x1={row[0][0]} y1={row[0][1]} x2={row[row.length - 1][0]} y2={row[row.length - 1][1]}
                stroke="#fbbf24" strokeWidth={r * 0.45} strokeDasharray={`${r * 1.6} ${r * 1.2}`} opacity={0.9} />
              <polyline points={row.map(p => p.join(",")).join(" ")} fill="none" stroke="#22d3ee" strokeWidth={r * 0.5} />
            </g>
          ))}
          {corners.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i === 0 ? r * 1.6 : r} fill={i === 0 ? "#fbbf24" : "#22d3ee"}
              stroke="#070b14" strokeWidth={r * 0.35} />
          ))}
        </svg>
      )}
    </div>
  );
}
