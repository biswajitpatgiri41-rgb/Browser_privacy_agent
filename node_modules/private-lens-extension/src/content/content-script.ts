/**
 * Content script entry point.
 * Runs in the context of web pages and handles DOM extraction, action execution.
 */

import { onMessage, onConnect, sendMessageToBackground } from "../shared/browser-api";
import { logger } from "../shared/logger";
import { DomExtractor } from "./dom-extractor";
import { ElementLocator } from "./element-locator";
import { PageObserver } from "./page-observer";
import { MESSAGE_TYPES } from "../background/message-router";
import { SanitizedContext, AgentAction, SanitizedElement, BoundingBox, PIIType } from "../types/agent";

const domExtractor = new DomExtractor();
const elementLocator = new ElementLocator();
const pageObserver = new PageObserver();

let initialized = false;
let currentTabId: number | null = null;
async function initialize(): Promise<void> {
  if (initialized) return;

  try {
    currentTabId = (window as unknown as { __PRIVACY_VISION_TAB_ID__?: number }).__PRIVACY_VISION_TAB_ID__ ?? null;

    logger.info("ContentScript", "Content script initialized", { tabId: currentTabId });

    pageObserver.start((changes) => {
      notifyPageChanged(changes);
    });

    await sendMessageToBackground({
      type: MESSAGE_TYPES.DOM_EXTRACTED,
      payload: { ready: true },
    });

    initialized = true;
  } catch (error) {
    logger.error("ContentScript", "Initialization failed", { error: (error as Error).message });
  }
}

const log = logger;
onMessage(async (message, sender, sendResponse) => {
  const routed = message as { type: string; payload: unknown };
  const requestId = crypto.randomUUID();
  const log = logger.withContext(requestId, "unknown", 0);

  log.debug("ContentScript", "Received message", { type: routed.type });

  try {
    switch (routed.type) {
      case MESSAGE_TYPES.EXTRACT_DOM:
        sendResponse({ success: true, context: await handleExtractDom(requestId) });
        break;

      case MESSAGE_TYPES.EXECUTE_ACTION:
        sendResponse({ success: true, result: await handleExecuteAction(routed.payload as AgentAction, requestId) });
        break;

      case MESSAGE_TYPES.STOP_OBSERVING:
        pageObserver.stop();
        sendResponse({ success: true });
        break;

      default:
        log.warn("ContentScript", "Unknown message type", { type: routed.type });
        sendResponse({ error: `Unknown message type: ${routed.type}` });
    }
  } catch (error) {
    log.error("ContentScript", "Message handling failed", { error: (error as Error).message });
    sendResponse({ error: (error as Error).message });
  }

  return true;
});

onConnect((port) => {
  log.debug("ContentScript", "Port connected", { name: port.name });

  port.onMessage.addListener(async (message) => {
    const routed = message as { type: string; payload: unknown };
    const requestId = crypto.randomUUID();

    try {
      switch (routed.type) {
        case MESSAGE_TYPES.EXTRACT_DOM:
          await handleExtractDom(requestId);
          port.postMessage({ success: true });
          break;

        case MESSAGE_TYPES.EXECUTE_ACTION:
          await handleExecuteAction(routed.payload as AgentAction, requestId);
          port.postMessage({ success: true });
          break;

        default:
          port.postMessage({ error: `Unknown message type: ${routed.type}` });
      }
    } catch (error) {
      port.postMessage({ error: (error as Error).message });
    }
  });

  port.onDisconnect.addListener(() => {
    log.debug("ContentScript", "Port disconnected");
  });
});
async function handleExtractDom(requestId: string): Promise<SanitizedContext> {
  const log = logger.withContext(requestId, "unknown", 0);

  try {
    log.debug("ContentScript", "Extracting DOM");

    const context = await domExtractor.extract();

    await sendMessageToBackground({
      type: MESSAGE_TYPES.DOM_EXTRACTED,
      payload: context,
      requestId,
    });

    log.info("ContentScript", "DOM extracted and sent", { elementsCount: context.elements.length });
    return context;
  } catch (error) {
    log.error("ContentScript", "DOM extraction failed", { error: (error as Error).message });
    throw error;
  }
}

async function handleExecuteAction(action: AgentAction, requestId: string): Promise<{ success: boolean; error?: string }> {
  const log = logger.withContext(requestId, "unknown", 0);

  log.info("ContentScript", "Executing action", { action: action.action, elementId: action.elementId });

  try {
    let result: { success: boolean; error?: string; newContext?: SanitizedContext };

    switch (action.action) {
      case "click":
        result = await executeClick(action, requestId);
        break;
      case "scroll":
        result = await executeScroll(action, requestId);
        break;
      case "select":
        result = await executeSelect(action, requestId);
        break;
      case "navigate":
        result = await executeNavigate(action, requestId);
        break;
      case "wait":
        result = await executeWait(action, requestId);
        break;
      case "finish":
        result = { success: true };
        break;
      default:
        throw new Error(`Unknown action type: ${(action as AgentAction).action}`);
    }

    await sendMessageToBackground({
      type: MESSAGE_TYPES.ELEMENT_ACTION_RESULT,
      payload: result,
      requestId,
    });

    log.info("ContentScript", "Action executed", { success: result.success });
    return result;
  } catch (error) {
    log.error("ContentScript", "Action execution failed", { error: (error as Error).message });
    throw error;
  }
}

async function executeClick(action: AgentAction, requestId: string): Promise<{ success: boolean; error?: string }> {
  const log = logger.withContext(requestId, "unknown", 0);

  if (!action.elementId) {
    throw new Error("Click action requires elementId");
  }

  const element = elementLocator.findElement(action.elementId);
  if (!element) {
    throw new Error(`Element not found: ${action.elementId}`);
  }

  if (!element.offsetParent || (element as HTMLElement).hidden) {
    throw new Error("Element is not visible");
  }

  if ((element as HTMLButtonElement | HTMLInputElement).disabled) {
    throw new Error("Element is disabled");
  }

  element.scrollIntoView({ behavior: "smooth", block: "center" });
  await new Promise((resolve) => setTimeout(resolve, 100));
  (element as HTMLElement).click();

  log.debug("ContentScript", "Click executed", { elementId: action.elementId });

  return { success: true };
}

async function executeScroll(action: AgentAction, requestId: string): Promise<{ success: boolean; error?: string }> {
  const direction = action.direction ?? "down";
  const amount = action.amount ?? 300;

  let scrollX = 0;
  let scrollY = 0;

  switch (direction) {
    case "up":
      scrollY = -amount;
      break;
    case "down":
      scrollY = amount;
      break;
    case "left":
      scrollX = -amount;
      break;
    case "right":
      scrollX = amount;
      break;
  }

  window.scrollBy({ left: scrollX, top: scrollY, behavior: "smooth" });
  await new Promise((resolve) => setTimeout(resolve, 300));

  return { success: true };
}

async function executeSelect(action: AgentAction, requestId: string): Promise<{ success: boolean; error?: string }> {
  if (!action.elementId) {
    throw new Error("Select action requires elementId");
  }
  if (!action.value) {
    throw new Error("Select action requires value");
  }

  const element = elementLocator.findElement(action.elementId);
  if (!element) {
    throw new Error(`Element not found: ${action.elementId}`);
  }

  if (element.tagName !== "SELECT") {
    throw new Error("Element is not a select");
  }

  const select = element as HTMLSelectElement;
  select.value = action.value;
  select.dispatchEvent(new Event("change", { bubbles: true }));

  return { success: true };
}

async function executeNavigate(action: AgentAction, requestId: string): Promise<{ success: boolean; error?: string }> {
  if (!action.url) {
    throw new Error("Navigate action requires url");
  }

  try {
    const url = new URL(action.url);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error(`Navigation to ${url.protocol} URLs not allowed`);
    }
  } catch {
    throw new Error("Invalid URL");
  }

  window.location.href = action.url;
  return { success: true };
}

async function executeWait(action: AgentAction, requestId: string): Promise<{ success: boolean; error?: string }> {
  const duration = action.durationMs ?? 1000;
  await new Promise((resolve) => setTimeout(resolve, duration));
  return { success: true };
}

function notifyPageChanged(changes: { added: number; removed: number; changed: number }): void {
  sendMessageToBackground({
    type: MESSAGE_TYPES.PAGE_CHANGED,
    payload: {
      url: window.location.href,
      title: document.title,
      changes,
    },
  }).catch(() => {});
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}

let lastUrl = window.location.href;
new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    initialized = false;
    initialize();
  }
}).observe(document, { subtree: true, childList: true });
