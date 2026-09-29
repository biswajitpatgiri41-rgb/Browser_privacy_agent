/**
 * Face Detector - detects faces in screenshots for privacy protection.
 * Face detections are treated as sensitive regions requiring redaction.
 */

import { logger } from "../shared/logger";
import { 
  loadModel, 
  runInference, 
  preprocessImage, 
  normalizeBoxesToViewport,
  nonMaxSuppression,
  ModelSession,
  ONNXModelConfig
} from "./onnx-runtime";

export interface FaceDetection {
  bbox: { x: number; y: number; width: number; height: number };
  confidence: number;
  landmarks?: Array<{ x: number; y: number }>; // Optional facial landmarks
}

export interface FaceDetectionResult {
  detections: FaceDetection[];
  processingTimeMs: number;
  provider: "webgpu" | "wasm" | "cpu";
}

const FACE_DETECTOR_CONFIG: ONNXModelConfig = {
  modelPath: "models/face-detector.onnx",
  inputName: "input",
  outputNames: ["boxes", "scores", "landmarks"],
  inputShape: [3, 640, 640],
  scoreThreshold: 0.5,
  iouThreshold: 0.4,
  classNames: ["face"],
};

let faceDetectorSession: ModelSession | null = null;
let isLoading = false;

export async function getFaceDetectorSession(): Promise<ModelSession> {
  if (faceDetectorSession) return faceDetectorSession;
  if (isLoading) {
    while (isLoading) await new Promise(r => setTimeout(r, 50));
    return faceDetectorSession!;
  }
  
  isLoading = true;
  try {
    faceDetectorSession = await loadModel(FACE_DETECTOR_CONFIG);
    return faceDetectorSession!;
  } finally {
    isLoading = false;
  }
}

export async function detectFaces(
  imageData: ImageData | HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
  viewportWidth: number,
  viewportHeight: number,
  devicePixelRatio: number
): Promise<FaceDetectionResult> {
  const startTime = performance.now();
  
  try {
    const session = await getFaceDetectorSession();
    const { config } = session;
    
    const inputTensor = preprocessImage(imageData, config.inputShape[1], config.inputShape[2]);
    const result = await runInference(session, inputTensor);
    
    const boxes = result.outputs.get("boxes");
    const scores = result.outputs.get("scores");
    const landmarks = result.outputs.get("landmarks");
    
    if (!boxes || !scores) {
      throw new Error("Missing model outputs");
    }
    
    const detections: FaceDetection[] = [];
    const numDetections = scores.length;
    
    for (let i = 0; i < numDetections; i++) {
      const confidence = scores[i];
      if (confidence < config.scoreThreshold) continue;
      
      const boxData = new Float32Array(4);
      boxData[0] = boxes[i * 4];
      boxData[1] = boxes[i * 4 + 1];
      boxData[2] = boxes[i * 4 + 2];
      boxData[3] = boxes[i * 4 + 3];
      
      const normalizedBoxes = normalizeBoxesToViewport(
        boxData,
        config.inputShape[2],
        config.inputShape[1],
        viewportWidth,
        viewportHeight,
        devicePixelRatio
      );
      
      if (normalizedBoxes.length > 0) {
        const box = normalizedBoxes[0];
        let faceLandmarks: Array<{ x: number; y: number }> | undefined;
        
        if (landmarks && landmarks.length >= (i + 1) * 10) {
          // 5 landmarks * 2 coords = 10 values
          faceLandmarks = [];
          for (let j = 0; j < 5; j++) {
            const lx = landmarks[i * 10 + j * 2] * config.inputShape[2];
            const ly = landmarks[i * 10 + j * 2 + 1] * config.inputShape[1];
            const scaleX = viewportWidth / config.inputShape[2];
            const scaleY = viewportHeight / config.inputShape[1];
            faceLandmarks.push({ x: Math.round(lx * scaleX), y: Math.round(ly * scaleY) });
          }
        }
        
        detections.push({
          bbox: box,
          confidence,
          landmarks: faceLandmarks,
        });
      }
    }
    
    // Apply NMS
    const nmsBoxes = detections.map(d => ({
      x: d.bbox.x,
      y: d.bbox.y,
      width: d.bbox.width,
      height: d.bbox.height,
      confidence: d.confidence,
    }));
    
    const filtered = nonMaxSuppression(nmsBoxes, config.iouThreshold);
    
    const finalDetections = filtered.map(f => {
      const original = detections.find(d => d.confidence === f.confidence && d.bbox.x === f.x && d.bbox.y === f.y);
      return {
        bbox: { x: f.x, y: f.y, width: f.width, height: f.height },
        confidence: f.confidence,
        landmarks: original?.landmarks,
      };
    });
    
    const processingTimeMs = performance.now() - startTime;
    
    logger.debug("FaceDetector", "Detection complete", { 
      count: finalDetections.length,
      processingTimeMs,
      provider: result.provider 
    });
    
    return {
      detections: finalDetections,
      processingTimeMs,
      provider: result.provider,
    };
  } catch (error) {
    logger.error("FaceDetector", "Detection failed", { error: (error as Error).message });
    throw error;
  }
}

export function clearFaceDetectorCache(): void {
  faceDetectorSession = null;
}