/**
 * Message router for the background service worker.
 * Routes messages to appropriate handlers based on message type.
 */

import { logger } from "../shared/logger";
import { TabManager } from "./tab-manager";
import { browserAPI, getActiveTab, sendMessage, sendMessageToBackground } from "../shared/browser-api";
import { AgentRequest, AgentResponse, SanitizedContext, ActionType } from "../types/agent";
import { AgentController, defaultAgentConfig } from "../agent/agent-controller";

export type MessageHandler = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  requestId: string
) => Promise<unknown>;

export interface RoutedMessage {
  type: string;
  payload: unknown;
  requestId?: string;
  sessionId?: string;
}

const MESSAGE_TYPES = {
  START_TASK: "START_TASK",
  STOP_TASK: "STOP_TASK",
  GET_STATUS: "GET_STATUS",
  GET_SETTINGS: "GET_SETTINGS",
  UPDATE_SETTINGS: "UPDATE_SETTINGS",
  DOM_EXTRACTED: "DOM_EXTRACTED",
  PAGE_CHANGED: "PAGE_CHANGED",
  ELEMENT_ACTION_RESULT: "ELEMENT_ACTION_RESULT",
  EXECUTE_ACTION: "EXECUTE_ACTION",
  EXTRACT_DOM: "EXTRACT_DOM",
  STOP_OBSERVING: "STOP_OBSERVING",
  TASK_STATUS: "TASK_STATUS",
  TASK_COMPLETE: "TASK_COMPLETE",
  TASK_ERROR: "TASK_ERROR",
  CONFIRMATION_REQUIRED: "CONFIRMATION_REQUIRED",
  AGENT_REQUEST: "AGENT_REQUEST",
  AGENT_RESPONSE: "AGENT_RESPONSE",
  AGENT_PROGRESS: "AGENT_PROGRESS",
} as const;
export class MessageRouter {
  private handlers: Map<string, MessageHandler> = new Map();
  private tabManager: TabManager;
  private agentController: AgentController;

  constructor(tabManager?: TabManager) {
    this.tabManager = tabManager ?? new TabManager();
    this.agentController = new AgentController(defaultAgentConfig());
    this.registerDefaultHandlers();
  }

  setTabManager(tabManager: TabManager): void {
    this.tabManager = tabManager;
  }

  private registerDefaultHandlers(): void {
    this.registerHandler(MESSAGE_TYPES.START_TASK, this.handleStartTask.bind(this));
    this.registerHandler(MESSAGE_TYPES.STOP_TASK, this.handleStopTask.bind(this));
    this.registerHandler(MESSAGE_TYPES.GET_STATUS, this.handleGetStatus.bind(this));
    this.registerHandler(MESSAGE_TYPES.GET_SETTINGS, this.handleGetSettings.bind(this));
    this.registerHandler(MESSAGE_TYPES.UPDATE_SETTINGS, this.handleUpdateSettings.bind(this));
    this.registerHandler(MESSAGE_TYPES.DOM_EXTRACTED, this.handleDomExtracted.bind(this));
    this.registerHandler(MESSAGE_TYPES.PAGE_CHANGED, this.handlePageChanged.bind(this));
    this.registerHandler(MESSAGE_TYPES.ELEMENT_ACTION_RESULT, this.handleElementActionResult.bind(this));
    this.registerHandler(MESSAGE_TYPES.AGENT_REQUEST, this.handleAgentRequest.bind(this));
    this.registerHandler(MESSAGE_TYPES.AGENT_RESPONSE, this.handleAgentResponse.bind(this));
    this.registerHandler(MESSAGE_TYPES.AGENT_PROGRESS, this.handleAgentProgress.bind(this));
  }

  registerHandler(type: string, handler: MessageHandler): void {
    this.handlers.set(type, handler);
  }

  async route(
    message: unknown,
    sender: chrome.runtime.MessageSender,
    requestId: string
  ): Promise<unknown> {
    const routed = message as RoutedMessage;
    const type = routed.type;

    if (!type) {
      return { error: "Missing message type" };
    }

    const handler = this.handlers.get(type);
    if (!handler) {
      logger.warn("MessageRouter", `No handler for message type: ${type}`);
      return { error: `Unknown message type: ${type}` };
    }

    try {
      return await handler(routed.payload, sender, requestId);
    } catch (error) {
      logger.error("MessageRouter", `Handler error for ${type}`, { error: (error as Error).message });
      return { error: (error as Error).message };
    }
  }

  private async handleStartTask(
    payload: unknown,
    sender: chrome.runtime.MessageSender,
    requestId: string
  ): Promise<unknown> {
    const { task, sessionId, maxSteps } = payload as { task: string; sessionId: string; maxSteps?: number };
    const tab = sender.tab ?? await getActiveTab();

    if (!tab?.id) {
      throw new Error("No active tab");
    }

    logger.info("MessageRouter", "Starting task", { task: task.substring(0, 50), tabId: tab.id, sessionId });

    const run = this.agentController.start(task, tab.id, sessionId, maxSteps ?? 15);
    run.catch((error) => logger.error("MessageRouter", "Agent task failed", { error: (error as Error).message }));

    return { success: true, started: true, requestId };
  }

  private async handleStopTask(
    payload: unknown,
    sender: chrome.runtime.MessageSender,
    requestId: string
  ): Promise<unknown> {
    const { sessionId } = payload as { sessionId: string };

    logger.info("MessageRouter", "Stopping task", { sessionId });

    await this.agentController.stop();

    return { success: true };
  }

  private async handleGetStatus(
    payload: unknown,
    sender: chrome.runtime.MessageSender,
    requestId: string
  ): Promise<unknown> {
    const status = this.agentController.getStatus();
    return { success: true, status };
  }

  private async handleGetSettings(
    payload: unknown,
    sender: chrome.runtime.MessageSender,
    requestId: string
  ): Promise<unknown> {
    const settings = await browserAPI.storage.local.get([
      "privacy-vision:enabled",
      "privacy-vision:maxSteps",
      "privacy-vision:backendUrl",
    ]);
    return { success: true, settings };
  }

  private async handleUpdateSettings(
    payload: unknown,
    sender: chrome.runtime.MessageSender,
    requestId: string
  ): Promise<unknown> {
    const settings = payload as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(settings)) {
      if (key.startsWith("privacy-vision:")) {
        updates[key] = value;
      }
    }

    await browserAPI.storage.local.set(updates);
    return { success: true };
  }
private async handleDomExtracted(
    payload: unknown,
    sender: chrome.runtime.MessageSender,
    requestId: string
  ): Promise<unknown> {
    const context = payload as SanitizedContext;
    const tabId = sender.tab?.id;

    if (!tabId) {
      throw new Error("No tab ID");
    }

    if (context && Array.isArray(context.elements)) {
      logger.debug("MessageRouter", "DOM extracted", { tabId, elementsCount: context.elements.length });
    } else {
      this.tabManager.setContentScriptReady(tabId);
    }

    return { success: true };
  }

  private async handlePageChanged(
    payload: unknown,
    sender: chrome.runtime.MessageSender,
    requestId: string
  ): Promise<unknown> {
    const { url, title } = payload as { url: string; title: string };
    const tabId = sender.tab?.id;

    if (!tabId) {
      throw new Error("No tab ID");
    }

    this.tabManager.onTabUpdated(tabId, url, title);
    return { success: true };
  }

  private async handleElementActionResult(
    payload: unknown,
    sender: chrome.runtime.MessageSender,
    requestId: string
  ): Promise<unknown> {
    const result = payload as { success: boolean; error?: string; newContext?: SanitizedContext };
    const tabId = sender.tab?.id;

    if (!tabId) {
      throw new Error("No tab ID");
    }

    return { success: true };
  }

  private async handleAgentRequest(
    payload: unknown,
    sender: chrome.runtime.MessageSender,
    requestId: string
  ): Promise<unknown> {
    const request = payload as AgentRequest;
    logger.debug("MessageRouter", "Agent request received", { requestId: request.requestId });
    return { success: true, queued: true };
  }

  private async handleAgentResponse(
    payload: unknown,
    sender: chrome.runtime.MessageSender,
    requestId: string
  ): Promise<unknown> {
    const response = payload as AgentResponse;
    logger.debug("MessageRouter", "Agent response received", { requestId: response.requestId });
    return { success: true };
  }

  private async handleAgentProgress(
    payload: unknown,
    sender: chrome.runtime.MessageSender,
    requestId: string
  ): Promise<unknown> {
    // Broadcast progress event to all connected extension views (popup, etc.)
    await this.broadcastToViews(payload);
    return { success: true };
  }

  async sendToContentScript(tabId: number, message: unknown): Promise<unknown> {
    return sendMessage(tabId, message);
  }

  async broadcast(message: unknown): Promise<void> {
    const tabs = await this.tabManager.getAllTabs();
    await Promise.all(
      tabs.map((tab) => {
        if (tab.id) {
          return sendMessage(tab.id, message).catch(() => {});
        }
      })
    );

    // Also broadcast to extension views (popup, options, etc.)
    const api = browserAPI;
    try {
      api.runtime.sendMessage(message).catch(() => {});
    } catch {}
  }

  async broadcastToViews(message: unknown): Promise<void> {
    const api = browserAPI;
    try {
      api.runtime.sendMessage(message).catch(() => {});
    } catch {}
  }
}

export { MESSAGE_TYPES };
