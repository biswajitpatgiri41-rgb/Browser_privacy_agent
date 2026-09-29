/**
 * Background service worker for the extension.
 * Handles message routing, tab management, and coordination.
 */

import { onMessage, onConnect, sendMessage, getActiveTab, getTab } from "../shared/browser-api";
import { logger } from "../shared/logger";
import { MessageRouter } from "./message-router";
import { TabManager } from "./tab-manager";

const messageRouter = new MessageRouter();
const tabManager = new TabManager();

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  logger.info("ServiceWorker", "Extension installed", { reason: details.reason });
  if (details.reason === "install") {
    // Initialize default settings
    chrome.storage.local.set({
      "privacy-vision:enabled": true,
      "privacy-vision:maxSteps": 15,
      "privacy-vision:backendUrl": "http://localhost:8000",
    });
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  logger.info("ServiceWorker", "Extension started");
});

// Handle messages from popup/content scripts
onMessage((message, sender, sendResponse) => {
  const requestId = crypto.randomUUID();
  const log = logger.withContext(requestId, "unknown", 0);

  log.debug("ServiceWorker", "Received message", { type: (message as Record<string, unknown>).type });

  // Route message through message router
  messageRouter
    .route(message, sender, requestId)
    .then((response) => {
      sendResponse(response);
    })
    .catch((error) => {
      log.error("ServiceWorker", "Message routing failed", { error: error.message });
      sendResponse({ error: error.message });
    });

  // Return true to indicate async response
  return true;
});

// Handle long-lived connections (e.g., from content scripts)
onConnect((port) => {
  const requestId = crypto.randomUUID();
  const log = logger.withContext(requestId, "unknown", 0);

  log.debug("ServiceWorker", "Port connected", { name: port.name });

  port.onMessage.addListener((message) => {
    log.debug("ServiceWorker", "Port message received", { type: (message as Record<string, unknown>).type });

    messageRouter
      .route(message, { tab: port.sender?.tab } as chrome.runtime.MessageSender, requestId)
      .then((response) => {
        port.postMessage(response);
      })
      .catch((error) => {
        log.error("ServiceWorker", "Port message routing failed", { error: error.message });
        port.postMessage({ error: error.message });
      });
  });

  port.onDisconnect.addListener(() => {
    log.debug("ServiceWorker", "Port disconnected", { name: port.name });
    // Clean up any tab-specific state
    if (port.sender?.tab?.id) {
      tabManager.cleanupTab(port.sender.tab.id);
    }
  });
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    tabManager.onTabUpdated(tabId, tab.url, tab.title ?? "");
  }
});

// Handle tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  tabManager.cleanupTab(tabId);
});

// Handle tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await getTab(activeInfo.tabId);
  if (tab) {
    tabManager.setActiveTab(tab.id);
  }
});

logger.info("ServiceWorker", "Service worker initialized");
