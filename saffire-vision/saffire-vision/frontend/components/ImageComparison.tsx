import ImageViewer from "./ImageViewer";
export default function ImageComparison({ left, right, leftLabel = "Original", rightLabel = "Processed" }:
  { left: string; right: string; leftLabel?: string; rightLabel?: string }) {
  return (<div className="grid md:grid-cols-2 gap-4"><figure><ImageViewer src={left} alt={leftLabel} /><figcaption className="text-xs text-gray-400 mt-1">{leftLabel}</figcaption></figure>
    <figure><ImageViewer src={right} alt={rightLabel} /><figcaption className="text-xs text-gray-400 mt-1">{rightLabel}</figcaption></figure></div>);
}
