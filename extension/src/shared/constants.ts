/**
 * Shared constants for the extension.
 */

export const PROTOCOL_VERSION = "1.0.0" as const;

export const ALLOWED_ACTIONS = [
  "click",
  "scroll",
  "select",
  "navigate",
  "wait",
  "finish"
] as const;

export const PII_TOKENS = [
  "[EMAIL]",
  "[PASSWORD]",
  "[PERSON]",
  "[PHONE]",
  "[ADDRESS]",
  "[SECRET]",
  "[CREDIT_CARD]",
  "[SSN]",
  "[API_KEY]",
  "[TOKEN]",
  "[FACE_REGION]",
  "[OTHER]"
] as const;

export const MAX_ELEMENTS = 200;
export const MAX_OCR_REGIONS = 50;
export const MAX_LABEL_LENGTH = 100;
export const MAX_TOKENIZED_TEXT_LENGTH = 500;
export const MAX_REASONING_LENGTH = 500;
export const MAX_TASK_LENGTH = 2000;

export const ELEMENT_ID_PREFIX = "el_";
export const PII_REGION_ID_PREFIX = "pii_";
export const OCR_REGION_ID_PREFIX = "ocr_";

export const DEFAULT_SCROLL_AMOUNT = 300;
export const MAX_SCROLL_AMOUNT = 10000;
export const MAX_WAIT_DURATION_MS = 30000;

export const CONFIDENCE_THRESHOLD = 0.5;
