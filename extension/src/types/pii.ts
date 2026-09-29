/**
 * PII detection and redaction types.
 */

export interface PIIDetectionResult {
  regions: PIIRegion[];
  tokenMap: Record<string, number>;
  totalDetected: number;
}

export interface PIIRegion {
  regionId: string;
  type: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  originalText: string;
  token: string;
  confidence: number;
  elementId?: string;
}

export interface RedactionResult {
  redactedElements: Record<string, string>;  // elementId -> redacted HTML/text
  tokenMap: Record<string, number>;
  regionsRedacted: number;
}

export interface PrivacyGateResult {
  verified: boolean;
  piiDetected: number;
  redactionApplied: number;
  tokenMap: Record<string, number>;
  leakageRisk: "none" | "low" | "medium" | "high";
  details: string[];
}

export interface TokenReplacement {
  token: string;
  originalType: string;
  count: number;
}
