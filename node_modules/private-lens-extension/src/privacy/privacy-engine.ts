/**
 * Privacy Engine - PII detection and redaction.
 */

export type PIIType = 
  | "email"
  | "phone"
  | "ssn"
  | "credit_card"
  | "ip_address"
  | "address"
  | "name"
  | "date_of_birth"
  | "custom";

export interface PIIDetection {
  type: PIIType;
  token: string;
  confidence: number;
  start: number;
  end: number;
}

// Regex patterns for PII detection
const PII_PATTERNS: { type: PIIType; regex: RegExp }[] = [
  { type: "email", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
  { type: "phone", regex: /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
  { type: "ssn", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: "credit_card", regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g },
  { type: "ip_address", regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  { type: "date_of_birth", regex: /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g },
];

let tokenCounter = 0;

function generateToken(type: PIIType): string {
  tokenCounter++;
  return `[${type.toUpperCase()}_${tokenCounter.toString(36).padStart(6, "0")}]`;
}

export function detectPIIInElement(text: string, elementId: string): PIIDetection[] {
  const detections: PIIDetection[] = [];

  for (const { type, regex } of PII_PATTERNS) {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      detections.push({
        type,
        token: generateToken(type),
        confidence: 0.9,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  return detections;
}

export function redactPIIInText(text: string, detections: PIIDetection[]): string {
  let result = text;
  // Sort by start position descending to avoid index shifting
  const sorted = [...detections].sort((a, b) => b.start - a.start);

  for (const detection of sorted) {
    result = result.slice(0, detection.start) + detection.token + result.slice(detection.end);
  }

  return result;
}

export function redactPIIInElement(elementId: string, text: string): string {
  const detections = detectPIIInElement(text, elementId);
  return redactPIIInText(text, detections);
}
