import type { ImageInfo } from "@/types";
import { api } from "@/lib/api";
import { typeLabel } from "@/lib/images";
import FileName from "./FileName";

type Img = Pick<ImageInfo, "image_id" | "filename" | "width" | "height" | "kind" | "variant">;

export default function ImageCard({ image, loaded, compact }: { image: Img; loaded: boolean; compact?: boolean }) {
  const src = api.imageUrl(image.image_id);
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-edge bg-panel">
      <div className={`relative ${compact ? "h-28" : "h-44"} bg-black`}>
        {loaded ? (
          <img src={src} alt={`Distortion grid: ${image.filename}`} loading="lazy" decoding="async" className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 border-b border-dashed border-edge bg-base text-center">
            <span className="text-xs font-medium text-muted">Expected, not loaded</span>
            <span className="text-xs text-faint">No image available offline</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <FileName name={image.filename} className="text-xs text-ink" />
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {typeLabel(image).split(" · ").map(t => <span key={t} className="rounded border border-edge px-1.5 py-0.5 text-muted">{t}</span>)}
          <span className="num font-mono text-faint">{image.width}×{image.height}</span>
        </div>
        <div className="mt-auto pt-1">
          {loaded
            ? <a className="btn-ghost text-xs" href={src} target="_blank" rel="noreferrer">View image</a>
            : <button className="btn-ghost text-xs" disabled>View image</button>}
        </div>
      </div>
    </article>
  );
}
