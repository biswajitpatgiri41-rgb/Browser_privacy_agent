/**
 * ONNX Runtime Web wrapper with WebGPU support and CPU fallback.
 * All inference stays entirely inside the extension/device.
 */

import { logger } from "../shared/logger";

export type ExecutionProvider = "webgpu" | "wasm" | "cpu";

export interface ONNXModelConfig {
  modelPath: string;
  inputName: string;
  outputNames: string[];
  inputShape: number[];
  scoreThreshold: number;
  iouThreshold: number;
  classNames: string[];
}

export interface InferenceResult {
  outputs: Map<string, Float32Array>;
  processingTimeMs: number;
  provider: ExecutionProvider;
}

export interface ModelSession {
  session: unknown;
  config: ONNXModelConfig;
  provider: ExecutionProvider;
}

let ort: unknown = null;
let ortInitialized = false;

export async function initializeORT(): Promise<void> {
  if (ortInitialized) return;

  try {
    ort = await import("onnxruntime-web");
    
    const availableProviders = (ort as any).env?.getAvailableExecutionProviders?.() ?? [];
    
    let preferredProvider: ExecutionProvider = "wasm";
    if (availableProviders.includes("webgpu")) {
      preferredProvider = "webgpu";
    } else if (availableProviders.includes("wasm")) {
      preferredProvider = "wasm";
    } else {
      preferredProvider = "cpu";
    }

    (ort as any).env.wasm.wasmPaths = "models/";
    (ort as any).env.wasm.numThreads = navigator.hardwareConcurrency || 4;
    
    logger.info("ONNXRuntime", "Initialized", { 
      provider: preferredProvider,
      availableProviders 
    });

    ortInitialized = true;
  } catch (error) {
    logger.error("ONNXRuntime", "Failed to initialize", { error: (error as Error).message });
    throw new Error(`ONNX Runtime initialization failed: ${(error as Error).message}`);
  }
}

export async function loadModel(config: ONNXModelConfig): Promise<ModelSession> {
  await initializeORT();

  const ortModule = ort as any;
  const availableProviders = ortModule.env?.getAvailableExecutionProviders?.() ?? [];
  
  let provider: ExecutionProvider = "wasm";
  if (availableProviders.includes("webgpu")) {
    provider = "webgpu";
  } else if (availableProviders.includes("wasm")) {
    provider = "wasm";
  } else {
    provider = "cpu";
  }

  const sessionOptions: any = {
    executionProviders: [provider],
    graphOptimizationLevel: "all",
  };

  if (provider === "webgpu") {
    sessionOptions.webgpu = { powerPreference: "high-performance" };
  }

  try {
    const modelUrl = chrome.runtime.getURL(config.modelPath);
    const session = await ortModule.InferenceSession.create(modelUrl, sessionOptions);
    
    logger.info("ONNXRuntime", "Model loaded", { 
      model: config.modelPath, 
      provider,
      inputShape: config.inputShape 
    });

    return { session, config, provider };
  } catch (error) {
    logger.error("ONNXRuntime", "Model load failed, trying CPU fallback", { 
      model: config.modelPath, 
      error: (error as Error).message 
    });
    
    try {
      const sessionOptionsFallback = {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      };
      const modelUrl = chrome.runtime.getURL(config.modelPath);
      const session = await ortModule.InferenceSession.create(modelUrl, sessionOptionsFallback);
      
      logger.info("ONNXRuntime", "Model loaded with CPU fallback", { model: config.modelPath });
      return { session, config, provider: "wasm" };
    } catch (fallbackError) {
      logger.error("ONNXRuntime", "Model load failed completely", { 
        model: config.modelPath, 
        error: (fallbackError as Error).message 
      });
      throw new Error(`Failed to load model ${config.modelPath}: ${(fallbackError as Error).message}`);
    }
  }
}

export async function runInference(
  modelSession: ModelSession,
  inputTensor: Float32Array
): Promise<InferenceResult> {
  const startTime = performance.now();
  const ortModule = ort as any;

  try {
    const { session, config } = modelSession;
    
    const inputShape = [1, ...config.inputShape];
    const inputTensorObj = new ortModule.Tensor("float32", inputTensor, inputShape);
    
    const feeds = { [config.inputName]: inputTensorObj };
    const results = await (session as { run: (feeds: Record<string, unknown>, outputNames: string[]) => Promise<Record<string, unknown>> }).run(feeds, config.outputNames);
    
    const outputs = new Map<string, Float32Array>();
    for (const [name, tensor] of Object.entries(results)) {
      outputs.set(name, (tensor as any).data as Float32Array);
    }

    const processingTimeMs = performance.now() - startTime;
    
    logger.debug("ONNXRuntime", "Inference complete", { 
      model: config.modelPath,
      processingTimeMs,
      provider: modelSession.provider,
      outputShapes: Array.from(outputs.entries()).map(([k, v]) => ({ name: k, length: v.length }))
    });

    return { outputs, processingTimeMs, provider: modelSession.provider };
  } catch (error) {
    logger.error("ONNXRuntime", "Inference failed", { 
      model: modelSession.config.modelPath,
      error: (error as Error).message 
    });
    throw new Error(`Inference failed: ${(error as Error).message}`);
  }
}

export function preprocessImage(
  imageData: ImageData | HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
  targetWidth: number,
  targetHeight: number
): Float32Array {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  
  if (imageData instanceof ImageData) {
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = imageData.width;
    sourceCanvas.height = imageData.height;
    sourceCanvas.getContext("2d")!.putImageData(imageData, 0, 0);
    ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
  } else {
    ctx.drawImage(imageData, 0, 0, targetWidth, targetHeight);
  }
  const { data } = ctx.getImageData(0, 0, targetWidth, targetHeight);
  
  const float32Data = new Float32Array(3 * targetWidth * targetHeight);
  let idx = 0;
  for (let i = 0; i < data.length; i += 4) {
    float32Data[idx++] = data[i] / 255;
    float32Data[idx++] = data[i + 1] / 255;
    float32Data[idx++] = data[i + 2] / 255;
  }
  
  return float32Data;
}

export function normalizeBoxesToViewport(
  boxes: Float32Array,
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  devicePixelRatio: number
): Array<{ x: number; y: number; width: number; height: number }> {
  const results: Array<{ x: number; y: number; width: number; height: number }> = [];
  
  for (let i = 0; i < boxes.length; i += 4) {
    const x1 = boxes[i] * imageWidth;
    const y1 = boxes[i + 1] * imageHeight;
    const x2 = boxes[i + 2] * imageWidth;
    const y2 = boxes[i + 3] * imageHeight;
    
    const scaleX = viewportWidth / imageWidth;
    const scaleY = viewportHeight / imageHeight;
    
    results.push({
      x: Math.round(x1 * scaleX),
      y: Math.round(y1 * scaleY),
      width: Math.round((x2 - x1) * scaleX),
      height: Math.round((y2 - y1) * scaleY),
    });
  }
  
  return results;
}

export function nonMaxSuppression(
  boxes: Array<{ x: number; y: number; width: number; height: number; confidence: number }>,
  iouThreshold: number
): Array<{ x: number; y: number; width: number; height: number; confidence: number }> {
  if (boxes.length === 0) return [];
  
  const sorted = [...boxes].sort((a, b) => b.confidence - a.confidence);
  const keep: Array<{ x: number; y: number; width: number; height: number; confidence: number }> = [];
  
  while (sorted.length > 0) {
    const current = sorted.shift()!;
    keep.push(current);
    
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (calculateIoU(current, sorted[i]) > iouThreshold) {
        sorted.splice(i, 1);
      }
    }
  }
  
  return keep;
}

function calculateIoU(
  box1: { x: number; y: number; width: number; height: number },
  box2: { x: number; y: number; width: number; height: number }
): number {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);
  
  if (x2 <= x1 || y2 <= y1) return 0;
  
  const intersection = (x2 - x1) * (y2 - y1);
  const area1 = box1.width * box1.height;
  const area2 = box2.width * box2.height;
  const union = area1 + area2 - intersection;
  
  return intersection / union;
}