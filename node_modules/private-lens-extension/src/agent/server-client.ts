/**
 * Server Client - communicates with backend API.
 */

import { logger } from "../shared/logger";
import { AgentRequest, AgentResponse, AgentAction, SanitizedContext } from "../types/agent";
import { privacyGate } from "../privacy/privacy-gate/privacy-gate";
import { detectPIIInElement, redactPIIInText } from "../privacy/privacy-engine";

export class ServerClient {
  private baseUrl: string;
  private apiKey: string | undefined;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  async getNextAction(request: AgentRequest): Promise<AgentResponse> {
    const url = `${this.baseUrl}/api/v1/agent/plan`;

    const verifiedContext: SanitizedContext = privacyGate.verify(request.context);
    const safeTask = redactPIIInText(
      request.task,
      detectPIIInElement(request.task, "task")
    );
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        version: request.version,
        request_id: request.requestId,
        session_id: request.sessionId,
        task: safeTask,
        context: toServerContext(verifiedContext),
        step: request.step,
        allowed_actions: request.allowedActions,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    logger.debug("ServerClient", "Received action from server", {
      action: data.action?.action,
      step: request.step,
    });

    return fromServerResponse(data);
  }

  async reportResult(requestId: string, action: AgentAction, success: boolean, error?: string): Promise<void> {
    logger.debug("ServerClient", "Action result recorded locally", {
      requestId,
      action: action.action,
      success,
      error,
    });
  }
}

function toServerContext(context: SanitizedContext): Record<string, unknown> {
  return {
    version: context.version,
    request_id: context.requestId,
    session_id: context.sessionId,
    url: context.url,
    title: context.title,
    elements: context.elements.map((element) => ({
      element_id: element.elementId,
      tag: element.tag,
      role: element.role,
      bbox: element.bbox,
      safe_label: element.safeLabel,
      input_type: element.inputType,
      is_interactive: element.isInteractive,
      is_visible: element.isVisible,
      attributes: element.attributes,
      pii_regions: element.piiRegions.map((pii) => ({
        region_id: pii.regionId,
        type: pii.type,
        bbox: pii.bbox,
        token: pii.token.replace(/_[a-z0-9-]+\]$/i, "]"),
        confidence: pii.confidence,
      })),
    })),
    viewport: {
      width: context.viewport.width,
      height: context.viewport.height,
      device_pixel_ratio: context.viewport.devicePixelRatio,
    },
    privacy: {
      verified: context.privacy.verified,
      pii_detected: context.privacy.piiDetected,
      redaction_applied: context.privacy.redactionApplied,
      token_map: context.privacy.tokenMap,
    },
    ocr_regions: context.ocrRegions.map((region) => ({
      region_id: region.regionId,
      bbox: region.bbox,
      tokenized_text: region.tokenizedText,
    })),
  };
}

function fromServerResponse(data: Record<string, any>): AgentResponse {
  const action = data.action ?? {};
  return {
    version: data.version ?? "1.0.0",
    requestId: data.request_id,
    sessionId: data.session_id,
    action: {
      version: action.version ?? "1.0.0",
      action: action.action,
      elementId: action.element_id,
      value: action.value,
      url: action.url,
      direction: action.direction,
      amount: action.amount,
      durationMs: action.duration_ms,
      confidence: action.confidence ?? 0,
      reasoning: action.reasoning ?? "",
      metadata: action.metadata,
    },
    privacy: {
      verified: data.privacy?.verified ?? false,
      piiDetected: data.privacy?.pii_detected ?? 0,
      redactionApplied: data.privacy?.redaction_applied ?? 0,
      tokenMap: data.privacy?.token_map ?? {},
    },
    metadata: data.metadata,
  };
}
