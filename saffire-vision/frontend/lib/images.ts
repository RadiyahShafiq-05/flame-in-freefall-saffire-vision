import type { ImageInfo } from "@/types";

type Img = Pick<ImageInfo, "kind" | "variant">;

// The backend classifies only SAFFIRE grid filenames; anything else (uploads, test boards) is "unknown".
export const isSaffireGrid = (i: Img) => i.kind !== "unknown";

export function typeLabel(i: Img) {
  if (!isSaffireGrid(i)) return "Not a SAFFIRE grid";
  return `${i.variant === "mono" ? "Monochrome" : "Color"} · ${i.kind === "combined" ? "Combined" : "Individual"}`;
}
