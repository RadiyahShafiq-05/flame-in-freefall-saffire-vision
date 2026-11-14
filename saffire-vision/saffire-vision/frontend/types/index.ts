export interface ImageInfo { image_id: string; filename: string; width: number; height: number; format: string | null;
  color_mode: string; file_size_bytes: number; kind: string; variant: string }
export interface Dataset { source: string; count: number; images: ImageInfo[]; notes: string[] }
export interface Detection { success: boolean; pattern: [number, number]; num_corners: number; message: string;
  method: string | null; image_id: string; overlay_file: string | null; corners: number[][] }
export interface Calibration { status: string; problems?: string[]; views_supplied?: number; min_views?: number;
  rms_reprojection_error_px?: number; camera_matrix?: number[][]; distortion_coefficients?: number[]; provenance?: string }
export interface HistoryItem { image_id: string; success: boolean; pattern: number[]; num_corners: number; message: string }
