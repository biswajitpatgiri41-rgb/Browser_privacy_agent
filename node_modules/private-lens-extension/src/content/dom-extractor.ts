/**
 * DOM Extractor - extracts sanitized DOM elements from the page.
 * Only extracts useful metadata, never sensitive values.
 * Now integrates with Vision Pipeline for screenshot sanitization.
 */

import { logger } from "../shared/logger";
import {
  SanitizedContext,
  SanitizedElement,
  BoundingBox,
  Viewport,
  ElementTag,
  InputType,
  PIIRegion,
  PIIType,
  OCRRegion,
  PrivacyMetadata,
} from "../types/agent";
import { ElementLocator } from "./element-locator";
import { detectPIIInElement, redactPIIInText } from "../privacy/privacy-engine";
import { captureAndSanitize, VerifiedSafeImage } from "../vision/screenshot-sanitizer";
import { runVisionPipeline, RedactionRegion, VisionEngineConfig } from "../vision/vision-engine";

const elementLocator = new ElementLocator();

export interface VisionPipelineResult {
  verifiedImage: VerifiedSafeImage | null;
  visionResult: Awaited<ReturnType<typeof runVisionPipeline>> | null;
  piiRegions: PIIRegion[];
  ocrRegions: OCRRegion[];
  tokenMap: Record<string, number>;
}

export class DomExtractor {
  private elementIdCounter = 0;
  private visionConfig: VisionEngineConfig = {
    enableUIDetection: true, enableNER: true, enableFaceDetection: true, enableOCR: true,
    safetyMarginPx: 4, mergeOverlappingRegions: true, iouMergeThreshold: 0.3,
  };

  setVisionConfig(config: Partial<VisionEngineConfig>): void { this.visionConfig = { ...this.visionConfig, ...config }; }

  async extract(): Promise<SanitizedContext> {
    const requestId = crypto.randomUUID();
    const log = logger.withContext(requestId, "unknown", 0);
    log.debug("DomExtractor", "Starting DOM extraction with vision pipeline");

    const elements = this.extractElements();
    const viewport = this.getViewport();
    const url = this.getSafeUrl();
    const title = document.title;

    let visionPipelineResult: VisionPipelineResult | null = null;
    try { visionPipelineResult = await this.runVisionPipeline(); }
    catch (error) { log.warn("DomExtractor", "Vision pipeline failed", { error: (error as Error).message }); }

    const { elements: redactedElements, piiRegions, tokenMap, ocrRegions } = 
      await this.processPII(elements, visionPipelineResult);

    const privacy: PrivacyMetadata = {
      verified: visionPipelineResult?.verifiedImage?.metadata.verificationPassed ?? false,
      piiDetected: piiRegions.length,
      redactionApplied: piiRegions.length,
      tokenMap,
    };

    const context: SanitizedContext = {
      version: "1.0.0", requestId, sessionId: this.getSessionId(), url,
      title: title.substring(0, 200), elements: redactedElements.slice(0, 200),
      viewport, privacy, ocrRegions: ocrRegions.slice(0, 50),
    };

    log.info("DomExtractor", "DOM extraction complete", {
      elementsCount: context.elements.length, piiDetected: piiRegions.length,
      ocrRegions: ocrRegions.length, visionVerified: visionPipelineResult?.verifiedImage?.metadata.verificationPassed ?? false,
    });

    return context;
  }

  private async runVisionPipeline(): Promise<VisionPipelineResult> {
    const verifiedImage = await captureAndSanitize();
    const visionResult = await runVisionPipeline(this.visionConfig);
    const piiRegions: PIIRegion[] = []; const tokenMap: Record<string, number> = {};
    for (const region of visionResult.redactionRegions) {
      if (!region.piiType) continue;
      const piiRegion: PIIRegion = { regionId: region.regionId.replace("redact_", "pii_"), type: region.piiType, bbox: region.bbox, token: region.token ?? `[${region.piiType}]`, confidence: region.confidence };
      piiRegions.push(piiRegion); tokenMap[piiRegion.token] = (tokenMap[piiRegion.token] ?? 0) + 1;
    }
    const ocrRegions: OCRRegion[] = visionResult.ocrRegions.map(ocr => ({ regionId: ocr.regionId.replace("ocr_", "ocr_"), bbox: ocr.bbox, tokenizedText: ocr.tokenizedText ?? ocr.text }));
    return { verifiedImage, visionResult, piiRegions, ocrRegions, tokenMap };
  }

  private extractElements(): SanitizedElement[] {
    const elements: SanitizedElement[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => { const el = node as HTMLElement; if (el.hidden || el.style.display === "none" || el.style.visibility === "hidden") return NodeFilter.FILTER_REJECT; if (this.isRelevantElement(el)) return NodeFilter.FILTER_ACCEPT; return NodeFilter.FILTER_SKIP; }
    });
    while (walker.nextNode()) { const element = walker.currentNode as HTMLElement; const sanitized = this.sanitizeElement(element); if (sanitized) elements.push(sanitized); }
    return elements;
  }

  private isRelevantElement(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();
    const interactiveTags = ["button", "input", "select", "textarea", "a", "form"];
    if (interactiveTags.includes(tagName)) return true;
    if (element.onclick || element.getAttribute("role") === "button" || element.getAttribute("tabindex")) return true;
    const text = element.textContent?.trim() ?? "";
    if (text.length > 0 && text.length < 500) {
      const meaningfulTags = ["label", "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "div", "li", "td", "th"];
      if (meaningfulTags.includes(tagName)) return true;
    }
    return false;
  }

  private sanitizeElement(element: HTMLElement): SanitizedElement | null {
    const rect = element.getBoundingClientRect(); if (rect.width === 0 && rect.height === 0) return null;
    const elementId = `el_${crypto.randomUUID().replace(/-/g, "").substring(0, 12)}`; elementLocator.registerElement(elementId, element);
    const bbox: BoundingBox = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    const tag = this.mapToElementTag(element.tagName.toLowerCase()); const role = element.getAttribute("role") ?? "";
    const inputType = this.getInputType(element); const isInteractive = this.isInteractiveElement(element); const isVisible = this.isElementVisible(element);
    const attributes = this.getSafeAttributes(element);
    let safeLabel = element.textContent?.trim() ?? ""; if (safeLabel.length > 100) safeLabel = safeLabel.substring(0, 97) + "...";
    const detections = detectPIIInElement(safeLabel, elementId); if (detections.length > 0) safeLabel = redactPIIInText(safeLabel, detections);
    return { elementId, tag, role, bbox, safeLabel, inputType, isInteractive, isVisible, attributes, piiRegions: [] };
  }

  private getInputType(element: HTMLElement): InputType | undefined {
    if (element.tagName === "INPUT") { const input = element as HTMLInputElement; const validTypes: InputType[] = ["text","password","email","tel","search","url","number","date","checkbox","radio","submit","button","hidden","file","other"]; return validTypes.includes(input.type as InputType) ? input.type as InputType : "other"; }
    if (element.tagName === "TEXTAREA") return "text"; if (element.tagName === "SELECT") return "select"; return undefined;
  }

  private isInteractiveElement(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase(); const interactiveTags = ["button","input","select","textarea","a","form"]; if (interactiveTags.includes(tagName)) return true; if (element.onclick) return true; if (element.getAttribute("role") === "button") return true; if (element.getAttribute("tabindex") !== null) return true; return false;
  }

  private isElementVisible(element: HTMLElement): boolean {
    if (element.hidden) return false; if (element.style.display === "none") return false; if (element.style.visibility === "hidden") return false; if (element.style.opacity === "0") return false; const rect = element.getBoundingClientRect(); if (rect.width === 0 && rect.height === 0) return false; return true;
  }

  private getSafeAttributes(element: HTMLElement): Record<string, string> {
    const attributes: Record<string, string> = {}; const allowedAttrs = ["type","aria-label","aria-labelledby","aria-describedby","role","alt","disabled","readonly","required"];
    for (const attr of allowedAttrs) { const value = element.getAttribute(attr); if (value !== null) attributes[attr] = value.substring(0, 100); }
    const keys = Object.keys(attributes).slice(0, 10); const limited: Record<string, string> = {}; for (const key of keys) limited[key] = attributes[key]; return limited;
  }

  private mapToElementTag(tagName: string): ElementTag {
    const validTags: ElementTag[] = ["button","input","select","textarea","a","div","span","form","img","iframe","table","other"]; return validTags.includes(tagName as ElementTag) ? (tagName as ElementTag) : "other";
  }

  private getViewport(): Viewport { return { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio || 1 }; }

  private getSafeUrl(): string {
    try {
      const parsed = new URL(window.location.href);
      return `${parsed.origin}${parsed.pathname}`.substring(0, 2048);
    } catch {
      return "about:blank";
    }
  }

  private getSessionId(): string { let sessionId = sessionStorage.getItem("privacy-vision:sessionId"); if (!sessionId) { sessionId = crypto.randomUUID(); sessionStorage.setItem("privacy-vision:sessionId", sessionId); } return sessionId; }

  private async processPII(elements: SanitizedElement[], visionResult: VisionPipelineResult | null): Promise<{ elements: SanitizedElement[]; piiRegions: PIIRegion[]; tokenMap: Record<string, number>; ocrRegions: OCRRegion[] }> {
    const allPiiRegions: PIIRegion[] = []; const tokenMap: Record<string, number> = {}; const ocrRegions: OCRRegion[] = [];
    if (visionResult) { allPiiRegions.push(...visionResult.piiRegions); for (const [token, count] of Object.entries(visionResult.tokenMap)) tokenMap[token] = (tokenMap[token] ?? 0) + count; ocrRegions.push(...visionResult.ocrRegions); }
    for (const element of elements) { const domElement = elementLocator.findElement(element.elementId); if (!domElement) continue; const text = domElement.textContent ?? ""; if (text.trim().length === 0) continue; const detections = detectPIIInElement(text, element.elementId); for (const detection of detections) { const piiType = this.mapPIIType(detection.type); const piiRegion: PIIRegion = { regionId: `pii_${crypto.randomUUID().replace(/-/g, "").substring(0, 12)}`, type: piiType, bbox: element.bbox, token: detection.token, confidence: detection.confidence }; element.piiRegions.push(piiRegion); allPiiRegions.push(piiRegion); tokenMap[detection.token] = (tokenMap[detection.token] ?? 0) + 1; } }
    return { elements, piiRegions: allPiiRegions, tokenMap, ocrRegions };
  }

  private mapPIIType(type: string): PIIType { const typeMap: Record<string, PIIType> = { email:"EMAIL",phone:"PHONE",ssn:"SSN",credit_card:"CREDIT_CARD",ip_address:"IP_ADDRESS",address:"ADDRESS",name:"PERSON",date_of_birth:"DATE_OF_BIRTH",custom:"OTHER" }; return typeMap[type] ?? "OTHER"; }
}