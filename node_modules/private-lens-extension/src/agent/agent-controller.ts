/** Coordinates the agent loop from the background service worker. */

import { logger } from "../shared/logger";
import { browserAPI, sendMessage } from "../shared/browser-api";
import { AgentAction, AgentConfig, AgentRequest, AgentResponse, SanitizedContext } from "../types/agent";
import { ActionValidator } from "./action-validator";
import { RiskClassifier } from "./risk-classifier";
import { ServerClient } from "./server-client";
import { TaskState } from "./task-state";

export class AgentController {
  private readonly actionValidator = new ActionValidator();
  private readonly riskClassifier = new RiskClassifier();
  private readonly serverClient: ServerClient;
  private readonly taskState = new TaskState();
  private config: AgentConfig;
  private abortController: AbortController | null = null;
  private running = false;
  private currentStep = 0;
  private sessionId: string | null = null;

  constructor(config: AgentConfig) {
    this.config = config;
    this.serverClient = new ServerClient(config.backendUrl, config.apiKey);
  }

  async start(task: string, tabId: number, sessionId: string, maxSteps = this.config.maxSteps): Promise<void> {
    if (this.running) return;

    this.running = true;
    this.currentStep = 0;
    this.sessionId = sessionId;
    this.abortController = new AbortController();
    this.config = { ...this.config, maxSteps };
    this.taskState.initialize(task, maxSteps);
    this.notify({ type: "TASK_STATUS", payload: { status: "running", step: 0, maxSteps, task } });

    try {
      while (this.currentStep < maxSteps && !this.abortController.signal.aborted) {
        this.currentStep += 1;
        const context = await this.extractContext(tabId);
        this.notify({
          type: "AGENT_PROGRESS",
          payload: {
            type: "agent_progress",
            stage: "privacy_verification",
            step: this.currentStep,
            maxSteps,
            task,
            sanitizedContext: context,
            privacyVerified: context.privacy.verified,
            timestamp: Date.now(),
          },
        });
        const request: AgentRequest = {
          version: "1.0.0",
          requestId: crypto.randomUUID(),
          sessionId,
          task,
          context,
          step: this.currentStep,
          allowedActions: ["click", "scroll", "select", "navigate", "wait", "finish"],
        };

        let response: AgentResponse;
        try {
          response = await this.serverClient.getNextAction(request);
        } catch (error) {
          logger.error("AgentController", "Planner request failed", { error: (error as Error).message });
          response = this.getLocalAction(context, request);
        }

        const validation = this.actionValidator.validate(response.action, context);
        if (!validation.valid) {
          await this.serverClient.reportResult(request.requestId, response.action, false, validation.error);
          continue;
        }

        const risk = this.riskClassifier.classify(response.action, context);
        if (risk.level === "high" && !this.config.allowHighRisk) {
          await this.serverClient.reportResult(request.requestId, response.action, false, "High risk action requires confirmation");
          continue;
        }

        const result = await this.executeAction(tabId, response.action);
        await this.serverClient.reportResult(request.requestId, response.action, result.success, result.error);

        if (response.action.action === "finish") {
          this.taskState.complete();
          this.notify({ type: "TASK_COMPLETE", payload: { success: true } });
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      if (this.currentStep >= maxSteps && this.taskState.isRunning()) {
        this.taskState.fail("Max steps reached");
      }
    } catch (error) {
      this.taskState.fail((error as Error).message);
      this.notify({ type: "TASK_ERROR", payload: { error: (error as Error).message } });
      logger.error("AgentController", "Agent loop failed", { error: (error as Error).message });
      throw error;
    } finally {
      this.running = false;
      this.abortController = null;
    }
  }

  async stop(): Promise<void> {
    this.abortController?.abort();
    this.running = false;
  }

  getStatus() {
    return {
      isRunning: this.running,
      currentStep: this.currentStep,
      maxSteps: this.config.maxSteps,
      sessionId: this.sessionId,
      taskState: this.taskState.getState(),
    };
  }

  private async extractContext(tabId: number): Promise<SanitizedContext> {
    const response = await sendMessage<{ success: boolean; context?: SanitizedContext; error?: string }>(
      tabId,
      { type: "EXTRACT_DOM" }
    );
    if (!response?.success || !response.context) {
      throw new Error(response?.error ?? "Content script returned no sanitized context");
    }
    return response.context;
  }

  private async executeAction(tabId: number, action: AgentAction): Promise<{ success: boolean; error?: string }> {
    const response = await sendMessage<{ success: boolean; result?: { success: boolean; error?: string }; error?: string }>(
      tabId,
      { type: "EXECUTE_ACTION", payload: action }
    );
    return response?.result ?? { success: response?.success ?? false, error: response?.error };
  }

  private getLocalAction(context: SanitizedContext, request: AgentRequest): AgentResponse {
    const clickable = context.elements.find((element) => element.isInteractive && element.isVisible);
    const action: AgentAction = clickable
      ? {
          version: "1.0.0",
          action: "click",
          elementId: clickable.elementId,
          confidence: 0.3,
          reasoning: "Local fallback: first interactive element",
        }
      : {
          version: "1.0.0",
          action: "finish",
          confidence: 0.1,
          reasoning: "No actionable elements found",
        };

    return {
      version: "1.0.0",
      requestId: request.requestId,
      sessionId: request.sessionId,
      action,
      privacy: request.context.privacy,
    };
  }

  private notify(message: unknown): void {
    try {
      browserAPI.runtime.sendMessage(message).catch(() => {});
    } catch {
      // Extension views can close while a task is running.
    }
  }
}

export function defaultAgentConfig(): AgentConfig {
  return {
    backendUrl: "http://localhost:8000",
    maxSteps: 15,
    allowHighRisk: false,
  };
}
