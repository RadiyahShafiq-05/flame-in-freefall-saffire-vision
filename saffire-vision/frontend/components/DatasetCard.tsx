import type { ImageInfo } from "@/types";
import { api } from "@/lib/api";
import ImageViewer from "./ImageViewer";
export default function DatasetCard({ im }: { im: ImageInfo }) {
  return (<div className="rounded-lg border border-edge bg-panel p-3 space-y-2"><ImageViewer src={api.imageUrl(im.image_id)} alt={im.filename} />
    <div className="text-xs break-all">{im.filename}</div>
    <div className="text-xs text-gray-400">{im.width}×{im.height} px · {im.color_mode} · {im.format} · <span className="text-accent">{im.kind}</span></div></div>);
}
