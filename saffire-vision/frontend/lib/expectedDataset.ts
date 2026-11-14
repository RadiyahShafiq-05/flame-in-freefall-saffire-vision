import type { ImageInfo } from "@/types";

// The four SAFFIRE-1 F1C1 grid files the team expects, from docs/dataset.md. Shown only while the
// backend is unreachable, and always labelled as "expected, not loaded". The combined images are
// 2565x920 even though their filenames say 1280x920.
export const EXPECTED_IMAGES: Pick<ImageInfo, "image_id" | "filename" | "width" | "height" | "kind" | "variant">[] = [
  { filename: "SAFFIRE-1_F1C1_DistortionGrid-30mmBlock_1280x920.jpg", width: 1280, height: 920, kind: "individual", variant: "color" },
  { filename: "SAFFIRE-1_F1C1_DistortionGrid-30mmBlock_1280x920_mono.jpg", width: 1280, height: 920, kind: "individual", variant: "mono" },
  { filename: "SAFFIRE-1_DistortionGrids-30mmBlock_Combined_1280x920_color.jpg", width: 2565, height: 920, kind: "combined", variant: "color" },
  { filename: "SAFFIRE-1_DistortionGrids-30mmBlock_Combined_1280x920_mono.jpg", width: 2565, height: 920, kind: "combined", variant: "mono" },
].map(i => ({ ...i, image_id: i.filename }));

export const SAFFIRE_I = {
  accession: "PSI-98",
  title: "Spacecraft Fire Safety Experiment-I (SAFFIRE-I)",
  doi: "10.60555/0t15-1z43",
  psiUrl: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-98",
};
