/**
 * OCR Engine - extracts text from images using ONNX model.
 * All processing happens locally. PII detections mapped to redaction regions.
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
import { detectEntities, NEREntity } from "./ner-detector";

export interface OCRRegion {
  regionId: string;
  bbox: { x: number; y: number; width: number; height: number };
  text: string;
  confidence: number;
  tokenizedText?: string; // Text with PII replaced by tokens
  piiEntities: NEREntity[];
}

export interface OCRResult {
  regions: OCRRegion[];
  processingTimeMs: number;
  provider: "webgpu" | "wasm" | "cpu";
}

const OCR_CONFIG: ONNXModelConfig = {
  modelPath: "models/ocr.onnx",
  inputName: "input",
  outputNames: ["boxes", "scores", "text_logits"],
  inputShape: [3, 640, 640],
  scoreThreshold: 0.4,
  iouThreshold: 0.4,
  classNames: ["text"],
};

let ocrSession: ModelSession | null = null;
let isLoading = false;

export async function getOCRSession(): Promise<ModelSession> {
  if (ocrSession) return ocrSession;
  if (isLoading) {
    while (isLoading) await new Promise(r => setTimeout(r, 50));
    return ocrSession!;
  }
  
  isLoading = true;
  try {
    ocrSession = await loadModel(OCR_CONFIG);
    return ocrSession!;
  } finally {
    isLoading = false;
  }
}

/**
 * Decode text logits to string using CTC decoding (simplified).
 */
function decodeText(logits: Float32Array, vocabulary: string[]): string {
  // Simplified CTC greedy decoding
  const maxIndices = new Uint32Array(logits.length / vocabulary.length);
  for (let i = 0; i < maxIndices.length; i++) {
    const slice = logits.slice(i * vocabulary.length, (i + 1) * vocabulary.length);
    maxIndices[i] = slice.indexOf(Math.max(...slice));
  }
  
  // Remove blanks (index 0) and consecutive duplicates
  let result = "";
  let prev = -1;
  for (const idx of maxIndices) {
    if (idx !== 0 && idx !== prev) {
      result += vocabulary[idx - 1] ?? "";
    }
    prev = idx;
  }
  return result;
}

export async function runOCR(
  imageData: ImageData | HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
  viewportWidth: number,
  viewportHeight: number,
  devicePixelRatio: number
): Promise<OCRResult> {
  const startTime = performance.now();
  
  try {
    const session = await getOCRSession();
    const { config } = session;
    
    const inputTensor = preprocessImage(imageData, config.inputShape[1], config.inputShape[2]);
    const result = await runInference(session, inputTensor);
    
    const boxes = result.outputs.get("boxes");
    const scores = result.outputs.get("scores");
    const textLogits = result.outputs.get("text_logits");
    
    if (!boxes || !scores || !textLogits) {
      throw new Error("Missing model outputs");
    }
    
    // Vocabulary for text decoding (simplified - would be loaded from model metadata)
    const vocabulary = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+-=[]{}|;':\",./<>? ".split("");
    
    const regions: OCRRegion[] = [];
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
      
      if (normalizedBoxes.length === 0) continue;
      
      const box = normalizedBoxes[0];
      
      // Decode text for this region
      const regionLogits = textLogits.slice(i * vocabulary.length * 32, (i + 1) * vocabulary.length * 32);
      const text = decodeText(regionLogits, vocabulary);
      
      if (text.trim().length === 0) continue;
      
      // Run NER on extracted text to detect PII
      const nerResult = await detectEntities(text);
      const piiEntities = nerResult.entities;
      
      // Tokenize text (replace PII with tokens)
      let tokenizedText = text;
      for (const entity of piiEntities.sort((a, b) => b.start - a.start)) {
        const token = `[${entity.label}_${crypto.randomUUID().slice(0, 8)}]`;
        tokenizedText = tokenizedText.slice(0, entity.start) + token + tokenizedText.slice(entity.end);
      }
      
      regions.push({
        regionId: `ocr_${crypto.randomUUID().replace(/-/g, "").substring(0, 12)}`,
        bbox: box,
        text,
        confidence,
        tokenizedText,
        piiEntities,
      });
    }
    
    // Apply NMS to merge overlapping text regions
    const nmsBoxes = regions.map(r => ({
      x: r.bbox.x,
      y: r.bbox.y,
      width: r.bbox.width,
      height: r.bbox.height,
      confidence: r.confidence,
    }));
    
    const filtered = nonMaxSuppression(nmsBoxes, config.iouThreshold);
    
    const finalRegions = filtered.map(f => {
      const original = regions.find(r => r.confidence === f.confidence && r.bbox.x === f.x && r.bbox.y === f.y);
      return original!;
    });
    
    const processingTimeMs = performance.now() - startTime;
    
    logger.debug("OCR", "Detection complete", { 
      count: finalRegions.length,
      piiRegions: finalRegions.filter(r => r.piiEntities.length > 0).length,
      processingTimeMs,
      provider: result.provider 
    });
    
    return {
      regions: finalRegions,
      processingTimeMs,
      provider: result.provider,
    };
  } catch (error) {
    logger.error("OCR", "Detection failed", { error: (error as Error).message });
    throw error;
  }
}

export function clearOCRCache(): void {
  ocrSession = null;
}