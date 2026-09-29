/**
 * Privacy gate - final verification before sending to backend.
 * Fail-closed: if verification fails, data is not sent.
 */

import { SanitizedContext, PrivacyMetadata, PIIRegion } from "../../types/agent";
import { PIIDetectionResult, RedactionResult } from "../../types/pii";
import { logger } from "../../shared/logger";

export interface PrivacyGateConfig {
  maxElements: number;
  maxOcrRegions: number;
  maxLabelLength: number;
  requireVerified: boolean;
  allowedPiiTokens: string[];
}

export const DEFAULT_PRIVACY_GATE_CONFIG: PrivacyGateConfig = {
  maxElements: 200,
  maxOcrRegions: 50,
  maxLabelLength: 100,
  requireVerified: true,
  allowedPiiTokens: [
    "[EMAIL]", "[PASSWORD]", "[PERSON]", "[PHONE]", "[ADDRESS]",
    "[SECRET]", "[CREDIT_CARD]", "[SSN]", "[API_KEY]", "[TOKEN]",
    "[FACE_REGION]", "[OTHER]"
  ],
};

export class PrivacyGate {
  private config: PrivacyGateConfig;

  constructor(config: Partial<PrivacyGateConfig> = {}) {
    this.config = { ...DEFAULT_PRIVACY_GATE_CONFIG, ...config };
  }

  /**
   * Verify that a sanitized context is safe to send to the backend.
   * Returns the context with privacy metadata if verified, throws otherwise.
   */
  verify(context: SanitizedContext): SanitizedContext {
    const errors: string[] = [];

    // Check privacy.verified flag
    if (this.config.requireVerified && !context.privacy.verified) {
      errors.push("privacy.verified is false");
    }

    // Check element count
    if (context.elements.length > this.config.maxElements) {
      errors.push(`element count ${context.elements.length} exceeds max ${this.config.maxElements}`);
    }

    // Check OCR region count
    if (context.ocrRegions.length > this.config.maxOcrRegions) {
      errors.push(`OCR region count ${context.ocrRegions.length} exceeds max ${this.config.maxOcrRegions}`);
    }

    // Validate each element
    for (const element of context.elements) {
      if (element.safeLabel.length > this.config.maxLabelLength) {
        errors.push(`element ${element.elementId} label exceeds max length`);
      }

      // Validate PII tokens
      for (const pii of element.piiRegions) {
        const tokenType = pii.token.match(/^\[([A-Z_]+)/)?.[1];
        if (!tokenType || !this.config.allowedPiiTokens.some((token) => token.startsWith(`[${tokenType}`))) {
          errors.push(`element ${element.elementId} has disallowed PII token: ${pii.token}`);
        }
        if (pii.confidence < 0 || pii.confidence > 1) {
          errors.push(`element ${element.elementId} PII confidence out of range`);
        }
      }

      // Validate element ID format
      if (!/^el_[a-zA-Z0-9]{8,}$/.test(element.elementId)) {
        errors.push(`invalid element ID format: ${element.elementId}`);
      }
    }

    // Validate OCR regions
    for (const ocr of context.ocrRegions) {
      if (ocr.tokenizedText.length > this.config.maxLabelLength) {
        errors.push(`OCR region ${ocr.regionId} text exceeds max length`);
      }
      if (!/^ocr_[a-zA-Z0-9]{8,}$/.test(ocr.regionId)) {
        errors.push(`invalid OCR region ID format: ${ocr.regionId}`);
      }
    }

    // Validate request/session ID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    if (!uuidRegex.test(context.requestId)) {
      errors.push("invalid requestId format");
    }
    if (!uuidRegex.test(context.sessionId)) {
      errors.push("invalid sessionId format");
    }

    if (errors.length > 0) {
      const errorMsg = `Privacy gate verification failed: ${errors.join("; ")}`;
      logger.error("PrivacyGate", errorMsg, { errors });
      throw new Error(errorMsg);
    }

    logger.info("PrivacyGate", "Privacy verification passed", {
      requestId: context.requestId,
      elementsCount: context.elements.length,
      piiDetected: context.privacy.piiDetected,
    });

    return context;
  }

  /**
   * Create privacy metadata from detection and redaction results.
   */
  createPrivacyMetadata(
    detection: PIIDetectionResult,
    redaction: RedactionResult
  ): PrivacyMetadata {
    return {
      verified: true,
      piiDetected: detection.totalDetected,
      redactionApplied: redaction.regionsRedacted,
      tokenMap: { ...detection.tokenMap, ...redaction.tokenMap },
    };
  }
}

export const privacyGate = new PrivacyGate();
