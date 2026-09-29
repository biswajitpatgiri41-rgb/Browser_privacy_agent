/**
 * TypeScript types matching the shared agent action protocol.
 * Must stay in sync with shared/schemas/agent-action.schema.json
 */

export type ActionType = "click" | "scroll" | "select" | "navigate" | "wait" | "finish";
export type ScrollDirection = "up" | "down" | "left" | "right";
export type ElementTag = "button" | "input" | "select" | "textarea" | "a" | "div" | "span" | "form" | "img" | "iframe" | "table" | "other";
export type InputType = "text" | "password" | "email" | "tel" | "search" | "url" | "number" | "date" | "checkbox" | "radio" | "submit" | "button" | "hidden" | "file" | "select" | "other";
export type PIIType = "EMAIL" | "PASSWORD" | "PERSON" | "PHONE" | "ADDRESS" | "SECRET" | "CREDIT_CARD" | "SSN" | "API_KEY" | "TOKEN" | "FACE_REGION" | "IP_ADDRESS" | "DATE_OF_BIRTH" | "OTHER";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
  devicePixelRatio: number;
}

export interface PIIRegion {
  regionId: string;  // ^pii_[a-zA-Z0-9]{8,}$
  type: PIIType;
  bbox: BoundingBox;
  token: string;  // ^\[[A-Z_]+\]$
  confidence: number;  // [0, 1]
}

export interface SanitizedElement {
  elementId: string;  // ^el_[a-zA-Z0-9]{8,}$
  tag: ElementTag;
  role: string;
  bbox: BoundingBox;
  safeLabel: string;  // max 100 chars
  inputType?: InputType;
  isInteractive: boolean;
  isVisible: boolean;
  attributes: Record<string, string>;  // max 10 properties
  piiRegions: PIIRegion[];
}

export interface OCRRegion {
  regionId: string;  // ^ocr_[a-zA-Z0-9]{8,}$
  bbox: BoundingBox;
  tokenizedText: string;  // max 500 chars
}

export interface PrivacyMetadata {
  verified: boolean;
  piiDetected: number;
  redactionApplied: number;
  tokenMap: Record<string, number>;
}

export interface SanitizedContext {
  version: "1.0.0";
  requestId: string;  // UUID
  sessionId: string;  // UUID
  url: string;
  title?: string;  // max 200 chars
  elements: SanitizedElement[];  // max 200
  viewport: Viewport;
  privacy: PrivacyMetadata;
  ocrRegions: OCRRegion[];  // max 50
}

export interface AgentAction {
  version: "1.0.0";
  action: ActionType;
  elementId?: string;  // ^el_[a-zA-Z0-9]{8,}$, required for click, select
  value?: string;  // max 500 chars, required for select
  url?: string;  // required for navigate
  direction?: ScrollDirection;  // required for scroll
  amount?: number;  // [0, 10000], required for scroll
  durationMs?: number;  // [0, 30000], required for wait
  confidence: number;  // [0, 1]
  reasoning: string;  // max 500 chars
  metadata?: Record<string, unknown>;  // max 10 properties
  reason?: string;  // for local fallback actions
}

export interface AgentRequest {
  version: "1.0.0";
  requestId: string;  // UUID
  sessionId: string;  // UUID
  task: string;  // 1-2000 chars
  context: SanitizedContext;
  step: number;  // >= 1
  allowedActions: ActionType[];
  maxSteps?: number;
}

export interface AgentResponse {
  version: "1.0.0";
  requestId: string;  // UUID
  sessionId: string;  // UUID
  action: AgentAction;
  privacy: PrivacyMetadata;
  metadata?: Record<string, unknown>;
}

export interface Metrics {
  version: "1.0.0";
  requestId: string;  // UUID
  sessionId: string;  // UUID
  step: number;  // >= 1
  latencyMs: number;
  elementsCount: number;  // [0, 200]
  piiDetected: number;
  actionTaken: ActionType | "none";
  plannerBackend: "api" | "transformers";
  plannerLatencyMs: number;
  privacyGateLatencyMs: number;
  error?: string;  // max 200 chars
}

// Task status
export type TaskStatus = "pending" | "running" | "completed" | "failed";

// Agent config
export interface AgentConfig {
  backendUrl: string;
  apiKey?: string;
  maxSteps: number;
  allowHighRisk: boolean;
}

// Risk assessment
export type RiskLevel = "low" | "medium" | "high";

export interface RiskAssessment {
  level: RiskLevel;
  reasons: string[];
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Action result
export interface ActionResult {
  success: boolean;
  error?: string;
  newContext?: SanitizedContext;
}

// Agent progress stages for live workflow visualization
export type AgentStage =
  | "task_received"
  | "observing"
  | "privacy_detection"
  | "sanitizing"
  | "privacy_verification"
  | "server_request"
  | "planning"
  | "action_validation"
  | "executing"
  | "waiting_for_page"
  | "complete"
  | "blocked"
  | "error";

export interface AgentProgressEvent {
  type: "agent_progress";
  stage: AgentStage;
  step: number;
  maxSteps: number;
  task: string;
  currentAction?: AgentAction;
  sanitizedContext?: SanitizedContext;
  privacyVerified?: boolean;
  error?: string;
  timestamp: number;
}

// Message types for extension communication
export type PopupMessageType =
  | "START_TASK"
  | "STOP_TASK"
  | "GET_STATUS"
  | "TASK_STATUS"
  | "TASK_COMPLETE"
  | "TASK_ERROR"
  | "CONFIRMATION_REQUIRED"
  | "SANITIZED_CONTEXT_UPDATE"
  | "AGENT_PROGRESS";

// Chrome message sender type for popup/background communication
export interface ChromeMessageSender {
  tab?: chrome.runtime.MessageSender["tab"];
  frameId?: number;
  id?: string;
  origin?: string;
  url?: string;
  tlsChannelId?: string;
}

// Type guards
export function isValidActionType(action: string): action is ActionType {
  return ["click", "scroll", "select", "navigate", "wait", "finish"].includes(action);
}

export function isValidPIIType(type: string): type is PIIType {
  return [
    "EMAIL", "PASSWORD", "PERSON", "PHONE", "ADDRESS", "SECRET",
    "CREDIT_CARD", "SSN", "API_KEY", "TOKEN", "FACE_REGION", "IP_ADDRESS", "DATE_OF_BIRTH", "OTHER"
  ].includes(type);
}

export function isValidElementTag(tag: string): tag is ElementTag {
  return [
    "button", "input", "select", "textarea", "a", "div", "span",
    "form", "img", "iframe", "table", "other"
  ].includes(tag);
}
