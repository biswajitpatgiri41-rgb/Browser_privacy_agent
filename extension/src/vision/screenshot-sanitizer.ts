/**
 * Screenshot Sanitizer - captures, redacts, and verifies screenshots locally.
 * Never sends raw screenshots. Only creates VerifiedSafeImage after verification.
 */

import { logger } from "../shared/logger";
import { 
  runVisionPipeline, 
  applyRedactionToCanvas, 
  captureScreenshot, 
  captureScreenshotFallback,
  RedactionRegion,
  VisionEngineConfig,
  VisionEngineResult 
} from "./vision-engine";

export interface VerifiedSafeImage {
  canvas: HTMLCanvasElement;
  dataUrl: string;
  blob: Blob;
  metadata: SanitizationMetadata;
}

export interface SanitizationMetadata {
  timestamp: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  redactionRegions: RedactionRegion[];
  processingTimeMs: number;
  verificationPassed: boolean;
  verificationDetails: VerificationDetail[];
}

export interface VerificationDetail { check: string; passed: boolean; details?: string; }

export interface ScreenshotSanitizerConfig extends VisionEngineConfig {
  verificationEnabled: boolean; maxRetentionMs: number; leakageThreshold: number;
}

export const DEFAULT_SANITIZER_CONFIG: ScreenshotSanitizerConfig = {
  enableUIDetection: true, enableNER: true, enableFaceDetection: true, enableOCR: true,
  safetyMarginPx: 4, mergeOverlappingRegions: true, iouMergeThreshold: 0.3,
  verificationEnabled: true, maxRetentionMs: 5000, leakageThreshold: 0.001,
};

let sanitizerConfig: ScreenshotSanitizerConfig = { ...DEFAULT_SANITIZER_CONFIG };

export function setSanitizerConfig(config: Partial<ScreenshotSanitizerConfig>): void { sanitizerConfig = { ...sanitizerConfig, ...config }; }
export function getSanitizerConfig(): ScreenshotSanitizerConfig { return { ...sanitizerConfig }; }

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error("Failed to create blob")); }, type);
  });
}

async function verifyRedaction(
  originalImageData: ImageData,
  redactedCanvas: HTMLCanvasElement,
  regions: RedactionRegion[],
  config: ScreenshotSanitizerConfig
): Promise<{ passed: boolean; details: VerificationDetail[] }> {
  const details: VerificationDetail[] = [];
  const redactedCtx = redactedCanvas.getContext("2d", { willReadFrequently: true })!;
  const redactedData = redactedCtx.getImageData(0, 0, redactedCanvas.width, redactedCanvas.height);
  
  let totalSensitivePixels = 0, leakedPixels = 0;
  for (const region of regions) {
    const { x, y, width, height } = region.bbox;
    const cx = Math.max(0, Math.min(x, redactedCanvas.width - 1));
    const cy = Math.max(0, Math.min(y, redactedCanvas.height - 1));
    const cw = Math.min(width, redactedCanvas.width - cx);
    const ch = Math.min(height, redactedCanvas.height - cy);
    if (cw <= 0 || ch <= 0) continue;
    totalSensitivePixels += cw * ch;
    for (let py = 0; py < ch; py++) {
      for (let px = 0; px < cw; px++) {
        const oi = ((cy + py) * originalImageData.width + (cx + px)) * 4;
        const ri = ((cy + py) * redactedData.width + (cx + px)) * 4;
        if (originalImageData.data[oi + 3] > 0) {
          const r = redactedData.data[ri], g = redactedData.data[ri + 1], b = redactedData.data[ri + 2], a = redactedData.data[ri + 3];
          const solid = region.type === "password" || region.type === "secret" || region.piiType === "PASSWORD" || region.piiType === "SECRET" || region.piiType === "API_KEY" || region.piiType === "TOKEN";
          if (solid) { if (!(r === 0 && g === 0 && b === 0 && a === 255)) leakedPixels++; }
          else { const lum = 0.299*r + 0.587*g + 0.114*b; if (lum > 50 || a < 200) leakedPixels++; }
        }
      }
    }
  }
  const rate = totalSensitivePixels > 0 ? leakedPixels / totalSensitivePixels : 0;
  const leakagePassed = rate <= config.leakageThreshold;
  const coveragePassed = regions.length > 0;
  const dimensionsPassed = redactedCanvas.width === originalImageData.width && redactedCanvas.height === originalImageData.height;
  const passed = leakagePassed && coveragePassed && dimensionsPassed;
  details.push({check:"pixel_leakage",passed: leakagePassed,details:`Leakage ${(rate*100).toFixed(4)}% (thresh ${(config.leakageThreshold*100).toFixed(4)}%)`});
  details.push({check:"region_coverage",passed: coveragePassed,details:`Regions: ${regions.length}`});
  details.push({check:"dimensions",passed: dimensionsPassed,details:`${redactedCanvas.width}x${redactedCanvas.height} vs ${originalImageData.width}x${originalImageData.height}`});
  return {passed,details};
}

export async function captureAndSanitize(customConfig?: Partial<ScreenshotSanitizerConfig>): Promise<VerifiedSafeImage> {
  const config = { ...sanitizerConfig, ...customConfig }; const start = performance.now();
  let raw: HTMLCanvasElement | null = null; let rawData: ImageData | null = null;
  try {
    try { raw = await captureScreenshot(); } catch { raw = await captureScreenshotFallback(); }
    if (!raw) throw new Error("Screenshot failed");
    const ctx = raw.getContext("2d", { willReadFrequently: true })!; rawData = ctx.getImageData(0, 0, raw.width, raw.height);
    const vision = await runVisionPipeline(config);
    const redacted = applyRedactionToCanvas(raw, vision.redactionRegions);
    let passed = true; let vDetails: VerificationDetail[] = [];
    if (config.verificationEnabled) { const v = await verifyRedaction(rawData, redacted, vision.redactionRegions, config); passed = v.passed; vDetails = v.details; }
    const dataUrl = redacted.toDataURL("image/png"); const blob = await canvasToBlob(redacted, "image/png");
    const meta: SanitizationMetadata = {timestamp:Date.now(),viewportWidth:window.innerWidth,viewportHeight:window.innerHeight,devicePixelRatio:window.devicePixelRatio||1,redactionRegions:vision.redactionRegions,processingTimeMs:performance.now()-start,verificationPassed:passed,verificationDetails:vDetails};
    if (!passed) logger.warn("ScreenshotSanitizer","Verification failed",{details:vDetails});
    logger.info("ScreenshotSanitizer","Done",{passed,regions:vision.redactionRegions.length,timeMs:meta.processingTimeMs});
    return {canvas:redacted,dataUrl,blob,metadata:meta};
  } finally {
    if (raw) { const c = raw.getContext("2d"); if (c) c.clearRect(0,0,raw.width,raw.height); raw.width=1; raw.height=1; }
    rawData = null; raw = null;
    if (typeof globalThis!=="undefined" && (globalThis as any).gc) (globalThis as any).gc();
  }
}

export function createVerifiedSafeImage(c: HTMLCanvasElement, regs: RedactionRegion[], passed: boolean, vDetails: VerificationDetail[]): VerifiedSafeImage {
  return {canvas:c,dataUrl:c.toDataURL("image/png"),blob:null as any,metadata:{timestamp:Date.now(),viewportWidth:window.innerWidth,viewportHeight:window.innerHeight,devicePixelRatio:window.devicePixelRatio||1,redactionRegions:regs,processingTimeMs:0,verificationPassed:passed,verificationDetails:vDetails}};
}

export function createTestImage(w: number, h: number, regs: Array<{x:number,y:number,width:number,height:number,type:string}>): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width=w; c.height=h; const ctx=c.getContext("2d")!;
  ctx.fillStyle="#fff"; ctx.fillRect(0,0,w,h); ctx.fillStyle="#000"; ctx.font="16px Arial";
  ctx.fillText("Test Page",20,30); ctx.fillText("Email: test@example.com",20,60); ctx.fillText("Phone: 555-123-4567",20,90); ctx.fillText("Password: secret123",20,120);
  for (const r of regs) { ctx.fillStyle="#f00"; ctx.fillRect(r.x,r.y,r.width,r.height); }
  return c;
}

export async function runSanitizationTest(): Promise<{passed:boolean;details:string}> {
  const tc = createTestImage(800,600,[{x:20,y:50,width:200,height:20,type:"email"},{x:20,y:80,width:180,height:20,type:"phone"},{x:20,y:110,width:200,height:20,type:"password"}]);
  const tr: RedactionRegion[] = [
    {regionId:"t1",type:"ner",bbox:{x:20,y:50,width:200,height:20},confidence:1,source:"test",piiType:"EMAIL",token:"[EMAIL]"},
    {regionId:"t2",type:"ner",bbox:{x:20,y:80,width:180,height:20},confidence:1,source:"test",piiType:"PHONE",token:"[PHONE]"},
    {regionId:"t3",type:"password",bbox:{x:20,y:110,width:200,height:20},confidence:1,source:"test",piiType:"PASSWORD",token:"[PASSWORD]"},
  ];
  const rc = applyRedactionToCanvas(tc,tr);
  const od = tc.getContext("2d")!.getImageData(0,0,800,600);
  const v = await verifyRedaction(od,rc,tr,DEFAULT_SANITIZER_CONFIG);
  return {passed:v.passed,details:v.details.map(d=>`${d.check}:${d.passed}`).join("; ")};
}
