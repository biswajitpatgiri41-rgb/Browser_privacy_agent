/**
 * UI Element Detector - detects UI elements using ONNX model.
 * Provides bounding boxes for interactive elements.
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

export interface UIDetection {
  bbox: { x: number; y: number; width: number; height: number };
  className: string;
  confidence: number;
  elementType: "button" | "input" | "link" | "select" | "textarea" | "checkbox" | "radio" | "menu" | "tab" | "tooltip" | "dialog" | "other";
}

export interface UIDetectionResult {
  detections: UIDetection[];
  processingTimeMs: number;
  provider: "webgpu" | "wasm" | "cpu";
}

const UI_DETECTOR_CONFIG: ONNXModelConfig = {
  modelPath: "models/ui-detector.onnx",
  inputName: "input",
  outputNames: ["boxes", "scores", "classes"],
  inputShape: [3, 640, 640],
  scoreThreshold: 0.3,
  iouThreshold: 0.45,
  classNames: [
    "button", "input", "link", "select", "textarea", 
    "checkbox", "radio", "menu", "tab", "tooltip", "dialog", "other"
  ],
};

const CLASS_TO_ELEMENT_TYPE: Record<string, UIDetection["elementType"]> = {
  "button": "button",
  "input": "input",
  "link": "link",
  "select": "select",
  "textarea": "textarea",
  "checkbox": "checkbox",
  "radio": "radio",
  "menu": "menu",
  "tab": "tab",
  "tooltip": "tooltip",
  "dialog": "dialog",
  "other": "other",
};

let uiDetectorSession: ModelSession | null = null;
let isLoading = false;

export async function getUIDetectorSession(): Promise<ModelSession> {
  if (uiDetectorSession) return uiDetectorSession;
  if (isLoading) {
    while (isLoading) {
      await new Promise(r => setTimeout(r, 50));
    }
    return uiDetectorSession!;
  }
  
  isLoading = true;
  try {
    uiDetectorSession = await loadModel(UI_DETECTOR_CONFIG);
    return uiDetectorSession!;
  } finally {
    isLoading = false;
  }
}

export async function detectUIElements(
  imageData: ImageData | HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
  viewportWidth: number,
  viewportHeight: number,
  devicePixelRatio: number
): Promise<UIDetectionResult> {
  const startTime = performance.now();
  
  try {
    const session = await getUIDetectorSession();
    const { config } = session;
    
    const inputTensor = preprocessImage(imageData, config.inputShape[1], config.inputShape[2]);
    
    const result = await runInference(session, inputTensor);
    
    const boxes = result.outputs.get("boxes");
    const scores = result.outputs.get("scores");
    const classes = result.outputs.get("classes");
    
    if (!boxes || !scores || !classes) {
      throw new Error("Missing model outputs");
    }
    
    const detections: UIDetection[] = [];
    const numDetections = scores.length;
    
    for (let i = 0; i < numDetections; i++) {
      const confidence = scores[i];
      if (confidence < config.scoreThreshold) continue;
      
      const classIdx = Math.floor(classes[i]);
      const className = config.classNames[classIdx] ?? "other";
      const elementType = CLASS_TO_ELEMENT_TYPE[className] ?? "other";
      
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
        detections.push({
          bbox: box,
          className,
          confidence,
          elementType,
        });
      }
    }
    
    const nmsBoxes = detections.map(d => ({
      x: d.bbox.x,
      y: d.bbox.y,
      width: d.bbox.width,
      height: d.bbox.height,
      confidence: d.confidence,
    }));
    
    const filtered = nonMaxSuppression(nmsBoxes, config.iouThreshold);
    
    const finalDetections = filtered.map(f => ({
      bbox: { x: f.x, y: f.y, width: f.width, height: f.height },
      className: detections.find(d => d.confidence === f.confidence && d.bbox.x === f.x && d.bbox.y === f.y)?.className ?? "other",
      confidence: f.confidence,
      elementType: detections.find(d => d.confidence === f.confidence && d.bbox.x === f.x && d.bbox.y === f.y)?.elementType ?? "other",
    }));
    
    const processingTimeMs = performance.now() - startTime;
    
    logger.debug("UIDetector", "Detection complete", { 
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
    logger.error("UIDetector", "Detection failed", { error: (error as Error).message });
    throw error;
  }
}

export function clearUIDetectorCache(): void {
  uiDetectorSession = null;
}