import type { Detection } from "@/types";
import { api } from "@/lib/api";
import ImageViewer from "./ImageViewer";
export default function DetectionOverlay({ d }: { d: Detection }) {
  return (<div className="space-y-2"><div className={`text-sm ${d.success ? "text-accent" : "text-amber-400"}`}>
    {d.success ? `Detected ${d.num_corners} corners (${d.method})` : "Detection failed"}</div>
    <p className="text-xs text-gray-400">{d.message}</p>
    {d.overlay_file && <ImageViewer src={api.overlayUrl(d.overlay_file)} alt="Detected corners" />}</div>);
}
