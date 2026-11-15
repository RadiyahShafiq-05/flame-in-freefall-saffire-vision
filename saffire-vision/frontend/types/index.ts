export interface ImageInfo { image_id: string; filename: string; width: number; height: number; format: string | null;
  color_mode: string; file_size_bytes: number; kind: string; variant: string }
export interface Dataset { source: string; count: number; images: ImageInfo[]; notes: string[] }
export interface Detection { success: boolean; pattern: [number, number]; num_corners: number; message: string;
  method: string | null; image_id: string; overlay_file: string | null; corners: number[][]; image_size: [number, number] }
export interface Geometry { available: true; kind: string; spacing_px: { mean: number; std: number; min: number; max: number };
  spacing_cv: number; row_straightness_rms_px: number; note: string;
  homography_residual?: { rms_px: number; median_px: number; p95_px: number; max_px: number } }
export interface Distortion { image_id: string; detection_success: boolean; geometry: Geometry | { available: false; reason: string } }
export interface PreprocessStep { image_id: string; operation: string; saved_file: string; timestamp: string }
export interface DistortionStep { image_id: string; cols: number; rows: number; timestamp: string; geometry: Distortion["geometry"] }
export interface Calibration { status: "not_run" | "insufficient" | "valid"; problems?: string[]; views_supplied?: number; min_views?: number;
  views_used?: string[]; views_failed?: string[]; image_size?: [number, number]; units?: string; timestamp?: string;
  rms_reprojection_error_px?: number; camera_matrix?: number[][]; distortion_coefficients?: number[]; provenance?: string }
export interface Report { report_id: string; generated: string }
export interface ComparisonCopy {
  operation: string; status: string; num_corners?: number; rms_px?: number | null; changed?: boolean; improved?: boolean;
}
export interface PreprocessComparison {
  image_id?: string; pattern?: number[]; statement: string; changed: boolean; improved: boolean;
  original?: { num_corners: number; rms_px?: number | null };
  copies?: ComparisonCopy[];
}
export interface ReportDetail extends Report { dataset: Dataset; preprocessing: PreprocessStep[]; detections: HistoryItem[];
  distortion: DistortionStep[]; calibration: Calibration; processing: string; limitations: string[];
  preprocess_comparison?: PreprocessComparison | null }
export interface HistoryItem { image_id: string; success: boolean; pattern: number[]; num_corners: number; message: string }
export interface FlameFrameResult {
  experiment_name: string; source: string; filename: string;
  width: number; height: number; flame_pixels: number; image_pixels: number;
  coverage_percent: number; label: string;
  original_url: string; overlay_url: string; processed_url: string;
}
export interface ProcessLogItem {
  type: "preprocess" | "distortion" | "preprocess_comparison" | "flame_frame"; image_id: string; timestamp?: string;
  operation?: string; saved_file?: string; cols?: number; rows?: number; panel?: number | null;
  detection_success?: boolean; geometry?: Distortion["geometry"];
  statement?: string; changed?: boolean; improved?: boolean;
}

export interface AskRequest { question: string; top_k?: number; use_llm?: boolean }
export interface EvidenceItem {
  n: number; id: string; label: string; kind: string; evidence_type: string; accessions: string[];
  page: string | null; source_label: string; source_url: string | null; excerpt: string; score: number;
}
export interface RelatedInvestigation { accession: string; acronym: string | null; title: string }
export interface AskResponse {
  question: string; answered: boolean; mode: "llm" | "extractive" | "none"; model: string | null;
  answer: string | null; documented: string | null; interpretation: string | null; uncertainty: string[];
  evidence: EvidenceItem[]; related_investigations: RelatedInvestigation[]; llm_error: string | null; disclaimers: string[];
}
export interface SourceInfo { kind: string; label: string; url: string | null; passages: number; note: string | null }
export interface DocumentsResponse {
  llm_configured: boolean; model: string | null; investigations_indexed: number; passages: number;
  sources: SourceInfo[]; not_indexed: string[];
}
export interface SummarizeRequest { accession: string }
export interface SummarySection { title: string; text: string | null; source_field: string; available: boolean }
export interface SummaryResponse {
  accession: string; acronym: string | null; title: string; sections: SummarySection[]; guide_entries: EvidenceItem[];
  not_available: string[]; notes: string[]; source_url: string; method: string;
}
