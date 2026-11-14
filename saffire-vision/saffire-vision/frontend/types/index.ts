export interface ImageInfo { image_id: string; filename: string; width: number; height: number; format: string | null;
  color_mode: string; file_size_bytes: number; kind: string; variant: string }
export interface Dataset { source: string; count: number; images: ImageInfo[]; notes: string[] }
export interface Detection { success: boolean; pattern: [number, number]; num_corners: number; message: string;
  method: string | null; image_id: string; overlay_file: string | null; corners: number[][]; image_size: [number, number] }
export interface Geometry { available: true; kind: string; spacing_px: { mean: number; std: number; min: number; max: number };
  spacing_cv: number; row_straightness_rms_px: number; note: string }
export interface Distortion { image_id: string; detection_success: boolean; geometry: Geometry | { available: false; reason: string } }
export interface Calibration { status: "not_run" | "insufficient" | "valid"; problems?: string[]; views_supplied?: number; min_views?: number;
  views_used?: string[]; views_failed?: string[]; image_size?: [number, number]; units?: string; timestamp?: string;
  rms_reprojection_error_px?: number; camera_matrix?: number[][]; distortion_coefficients?: number[]; provenance?: string }
export interface Report { report_id: string; generated: string }
export interface ReportDetail extends Report { dataset: Dataset; detections: HistoryItem[]; calibration: Calibration;
  processing: string; limitations: string[] }
export interface HistoryItem { image_id: string; success: boolean; pattern: number[]; num_corners: number; message: string }
