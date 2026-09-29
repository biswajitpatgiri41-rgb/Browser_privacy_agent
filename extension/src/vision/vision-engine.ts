/**
 * Vision Engine - orchestrates all local vision models.
 * Runs UI detection, NER, face detection, and OCR entirely on-device.
 * Normalizes bounding boxes to viewport coordinates.
 * Merges overlapping redaction regions with configurable safety margin.
 */

import { logger } from "../shared/logger";
import { detectUIElements, UIDetection } from "./ui-detector";
import { detectEntities, NEREntity } from "./ner-detector";
import { detectFaces, FaceDetection } from "./face-detector";
import { runOCR, OCRRegion } from "./ocr-engine";
import { BoundingBox, PIIType } from "../types/agent";

export interface VisionEngineConfig {
  enableUIDetection: boolean;
  enableNER: boolean;
  enableFaceDetection: boolean;
  enableOCR: boolean;
  safetyMarginPx: number;
  mergeOverlappingRegions: boolean;
  iouMergeThreshold: number;
}

export const DEFAULT_VISION_CONFIG: VisionEngineConfig = {
  enableUIDetection: true, enableNER: true, enableFaceDetection: true, enableOCR: true,
  safetyMarginPx: 4, mergeOverlappingRegions: true, iouMergeThreshold: 0.3,
};

export interface RedactionRegion {
  regionId: string; type: "ui" | "ner" | "face" | "ocr" | "password" | "secret";
  bbox: BoundingBox; confidence: number; source: string;
  piiType?: PIIType; originalText?: string; token?: string;
}

export interface VisionEngineResult {
  uiDetections: UIDetection[]; nerEntities: NEREntity[]; faceDetections: FaceDetection[];
  ocrRegions: OCRRegion[]; redactionRegions: RedactionRegion[];
  processingTimeMs: { total: number; ui: number; ner: number; face: number; ocr: number; merge: number };
  provider: "webgpu" | "wasm" | "cpu";
}

let visionConfig: VisionEngineConfig = { ...DEFAULT_VISION_CONFIG };

export function setVisionConfig(config: Partial<VisionEngineConfig>): void { visionConfig = { ...visionConfig, ...config }; }
export function getVisionConfig(): VisionEngineConfig { return { ...visionConfig }; }

export async function captureScreenshot(): Promise<HTMLCanvasElement> {
  return captureScreenshotFallback();
}

export async function captureScreenshotFallback(): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const svg = new XMLSerializer().serializeToString(document.documentElement);
  const img = new Image(); const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  await new Promise<void>((resolve, reject) => {
    img.onload = () => { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url); resolve(); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load SVG")); };
    img.src = url;
  });
  return canvas;
}

function expandBBox(bbox: BoundingBox, margin: number, vw: number, vh: number): BoundingBox {
  return { x: Math.max(0, bbox.x - margin), y: Math.max(0, bbox.y - margin),
    width: Math.min(vw - Math.max(0, bbox.x - margin), bbox.width + 2 * margin),
    height: Math.min(vh - Math.max(0, bbox.y - margin), bbox.height + 2 * margin) };
}

function calculateIoU(box1: BoundingBox, box2: BoundingBox): number {
  const x1 = Math.max(box1.x, box2.x), y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width), y2 = Math.min(box1.y + box1.height, box2.y + box2.height);
  if (x2 <= x1 || y2 <= y1) return 0;
  const inter = (x2 - x1) * (y2 - y1), a1 = box1.width * box1.height, a2 = box2.width * box2.height;
  return inter / (a1 + a2 - inter);
}

function mergeRedactionRegions(regions: RedactionRegion[], thresh: number): RedactionRegion[] {
  if (regions.length <= 1) return regions;
  const merged: RedactionRegion[] = []; const used = new Set<number>();
  for (let i = 0; i < regions.length; i++) { if (used.has(i)) continue;
    let cur = { ...regions[i] }; used.add(i);
    for (let j = i + 1; j < regions.length; j++) { if (used.has(j)) continue;
      if (calculateIoU(cur.bbox, regions[j].bbox) > thresh) {
        const x1 = Math.min(cur.bbox.x, regions[j].bbox.x), y1 = Math.min(cur.bbox.y, regions[j].bbox.y);
        const x2 = Math.max(cur.bbox.x + cur.bbox.width, regions[j].bbox.x + regions[j].bbox.width);
        const y2 = Math.max(cur.bbox.y + cur.bbox.height, regions[j].bbox.y + regions[j].bbox.height);
        cur.bbox = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
        cur.confidence = Math.max(cur.confidence, regions[j].confidence);
        cur.source += `,${regions[j].source}`; used.add(j);
      }
    } merged.push(cur);
  } return merged;
}

function mapPIIType(t: string): PIIType {
  const m: Record<string, PIIType> = { EMAIL:"EMAIL",PHONE:"PHONE",SSN:"SSN",CREDIT_CARD:"CREDIT_CARD",IP_ADDRESS:"IP_ADDRESS",DATE_OF_BIRTH:"DATE_OF_BIRTH",PERSON:"PERSON",ADDRESS:"ADDRESS",API_KEY:"API_KEY",TOKEN:"TOKEN",PASSWORD:"PASSWORD",SECRET:"SECRET",FACE_REGION:"FACE_REGION",OTHER:"OTHER" };
  return m[t] ?? "OTHER";
}

function genToken(t: PIIType): string { return `[${t}_${crypto.randomUUID().slice(0,8)}]`; }

export async function runVisionPipeline(customConfig?: Partial<VisionEngineConfig>): Promise<VisionEngineResult> {
  const config = { ...visionConfig, ...customConfig }; const totalStart = performance.now();
  const vw = window.innerWidth, vh = window.innerHeight, dpr = window.devicePixelRatio || 1;
  let shot: HTMLCanvasElement; try { shot = await captureScreenshot(); } catch { shot = await captureScreenshotFallback(); }
  const imgData = shot.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, vw, vh);
  const [uiRes, faceRes, ocrRes] = await Promise.allSettled([
    config.enableUIDetection ? detectUIElements(imgData, vw, vh, dpr) : Promise.resolve({ detections: [], processingTimeMs: 0, provider: "wasm" as const }),
    config.enableFaceDetection ? detectFaces(imgData, vw, vh, dpr) : Promise.resolve({ detections: [], processingTimeMs: 0, provider: "wasm" as const }),
    config.enableOCR ? runOCR(imgData, vw, vh, dpr) : Promise.resolve({ regions: [], processingTimeMs: 0, provider: "wasm" as const }),
  ]);
  const uiR = uiRes.status==="fulfilled"?uiRes.value:{detections:[],processingTimeMs:0,provider:"wasm" as const};
  const faceR = faceRes.status==="fulfilled"?faceRes.value:{detections:[],processingTimeMs:0,provider:"wasm" as const};
  const ocrR = ocrRes.status==="fulfilled"?ocrRes.value:{regions:[],processingTimeMs:0,provider:"wasm" as const};
  let nerR: Awaited<ReturnType<typeof detectEntities>> = { entities:[], processingTimeMs:0, provider:"wasm" };
  if (config.enableNER) nerR = await detectEntities(document.body.innerText);
  const regs: RedactionRegion[] = [];
  for (const d of uiR.detections) { const b = expandBBox({x:d.bbox.x,y:d.bbox.y,width:d.bbox.width,height:d.bbox.height},config.safetyMarginPx,vw,vh);
    regs.push({regionId:`redact_ui_${crypto.randomUUID().replace(/-/g,"").substring(0,12)}`,type:"ui",bbox:b,confidence:d.confidence,source:"ui-detector",token:`[UI_${d.elementType.toUpperCase()}]`});}
  for (const d of faceR.detections) { const b = expandBBox({x:d.bbox.x,y:d.bbox.y,width:d.bbox.width,height:d.bbox.height},config.safetyMarginPx+4,vw,vh);
    regs.push({regionId:`redact_face_${crypto.randomUUID().replace(/-/g,"").substring(0,12)}`,type:"face",bbox:b,confidence:d.confidence,source:"face-detector",piiType:"FACE_REGION",token:genToken("FACE_REGION")});}
  for (const r of ocrR.regions) { const b = expandBBox(r.bbox,config.safetyMarginPx,vw,vh);
    if (r.piiEntities.length>0) { for (const e of r.piiEntities) { regs.push({regionId:`redact_ocr_${crypto.randomUUID().replace(/-/g,"").substring(0,12)}`,type:"ocr",bbox:b,confidence:r.confidence*e.confidence,source:"ocr",piiType:mapPIIType(e.label),originalText:e.text,token:genToken(mapPIIType(e.label))}); } }
    else { regs.push({regionId:`redact_ocr_${crypto.randomUUID().replace(/-/g,"").substring(0,12)}`,type:"ocr",bbox:b,confidence:r.confidence,source:"ocr",originalText:r.text,token:r.tokenizedText}); }}
  for (const e of nerR.entities) { regs.push({regionId:`redact_ner_${crypto.randomUUID().replace(/-/g,"").substring(0,12)}`,type:"ner",bbox:{x:0,y:0,width:100,height:20},confidence:e.confidence,source:"ner",piiType:mapPIIType(e.label),originalText:e.text,token:genToken(mapPIIType(e.label))});}
  const pwdFields = document.querySelectorAll('input[type="password"],input[autocomplete*="password"],input[autocomplete*="secret"],input[autocomplete*="token"]');
  for (const f of pwdFields) { const r = f.getBoundingClientRect(); const b = expandBBox({x:r.x,y:r.y,width:r.width,height:r.height},config.safetyMarginPx,vw,vh);
    regs.push({regionId:`redact_pwd_${crypto.randomUUID().replace(/-/g,"").substring(0,12)}`,type:"password",bbox:b,confidence:1,source:"dom",piiType:"PASSWORD",token:"[PASSWORD]"});}
  const ms = performance.now(); let final = regs; if (config.mergeOverlappingRegions) final = mergeRedactionRegions(regs,config.iouMergeThreshold); const mt = performance.now()-ms;
  const tt = performance.now()-totalStart;
  logger.info("VisionEngine","Pipeline complete",{uiCount:uiR.detections.length,faceCount:faceR.detections.length,ocrCount:ocrR.regions.length,nerCount:nerR.entities.length,redactionCount:final.length,totalTimeMs:tt,provider:uiR.provider});
  return {uiDetections:uiR.detections,nerEntities:nerR.entities,faceDetections:faceR.detections,ocrRegions:ocrR.regions,redactionRegions:final,processingTimeMs:{total:tt,ui:uiR.processingTimeMs,ner:nerR.processingTimeMs,face:faceR.processingTimeMs,ocr:ocrR.processingTimeMs,merge:mt},provider:uiR.provider};
}

export function applyRedactionToCanvas(c: HTMLCanvasElement, regs: RedactionRegion[]): HTMLCanvasElement {
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  for (const r of regs) { const {x,y,width,height}=r.bbox;
    if (r.type==="password"||r.type==="secret"||r.piiType==="PASSWORD"||r.piiType==="SECRET"||r.piiType==="API_KEY"||r.piiType==="TOKEN") { ctx.fillStyle="#000"; ctx.fillRect(x,y,width,height); }
    else if (r.type==="face"||r.piiType==="FACE_REGION") { ctx.fillStyle="#333"; ctx.fillRect(x,y,width,height); ctx.strokeStyle="#555"; ctx.lineWidth=1; for(let i=0;i<width+height;i+=8){ctx.beginPath();ctx.moveTo(x+i,y);ctx.lineTo(x,y+i);ctx.stroke();}}
    else { ctx.fillStyle="rgba(0,0,0,0.7)"; ctx.fillRect(x,y,width,height); if(r.token){ctx.fillStyle="#fff";ctx.font="12px monospace";ctx.fillText(r.token,x+2,y+14);} }
  } return c;
}
export function clearVisionCache(): void {}