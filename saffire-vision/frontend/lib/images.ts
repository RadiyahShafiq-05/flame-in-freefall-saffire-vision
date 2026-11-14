import type { ImageInfo } from "@/types";

type Img = Pick<ImageInfo, "kind" | "variant">;

// The backend classifies only SAFFIRE grid filenames; anything else (uploads, test boards) is "unknown".
export const isSaffireGrid = (i: Img) => i.kind !== "unknown";

// Measured by the backend team (docs/backend_api.md): the largest pattern that detects on the individual
// F1C1 grids. Smaller patterns can lock onto squares that are not neighbours.
export const measuredPattern = (i: Img): [number, number] | null =>
  isSaffireGrid(i) && i.kind === "individual" ? [21, 11] : null;

export function typeLabel(i: Img) {
  if (!isSaffireGrid(i)) return "Not a SAFFIRE grid";
  return `${i.variant === "mono" ? "Monochrome" : "Color"} · ${i.kind === "combined" ? "Combined" : "Individual"}`;
}
