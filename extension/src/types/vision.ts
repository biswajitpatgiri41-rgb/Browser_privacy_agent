/**
 * Vision/OCR related types.
 */

export interface VisionDetection {
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  className: string;
  confidence: number;
  text?: string;
}

export interface VisionResult {
  detections: VisionDetection[];
  imageWidth: number;
  imageHeight: number;
  processingTimeMs: number;
}

export interface OCRResult {
  regions: OCRRegion[];
  processingTimeMs: number;
}

export interface OCRRegion {
  regionId: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  text: string;
  confidence: number;
  tokenizedText?: string;
}

export interface ModelConfig {
  modelPath: string;
  inputShape: [number, number, number];
  scoreThreshold: number;
  iouThreshold: number;
  classNames: string[];
}
