/**
 * Tab manager for tracking tab state and content script connections.
 */

import { logger } from "../shared/logger";
import { browserAPI, getTab } from "../shared/browser-api";

export interface TabState {
  id: number;
  url: string;
  title: string;
  active: boolean;
  contentScriptReady: boolean;
  agentSessionId?: string;
  lastDomExtraction?: number;
  elementIdCounter: number;
}

export class TabManager {
  private tabs: Map<number, TabState> = new Map();
  private activeTabId: number | null = null;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    const tabs = await this.getAllTabs();
    for (const tab of tabs) {
      if (tab.id) {
        this.tabs.set(tab.id, {
          id: tab.id,
          url: tab.url ?? "",
          title: tab.title ?? "",
          active: tab.active,
          contentScriptReady: false,
          elementIdCounter: 0,
        });
        if (tab.active) {
          this.activeTabId = tab.id;
        }
      }
    }
  }

  onTabUpdated(tabId: number, url: string, title: string): void {
    const existing = this.tabs.get(tabId);
    this.tabs.set(tabId, {
      id: tabId,
      url,
      title,
      active: existing?.active ?? false,
      contentScriptReady: false,
      agentSessionId: existing?.agentSessionId,
      elementIdCounter: existing?.elementIdCounter ?? 0,
    });
    logger.debug("TabManager", "Tab updated", { tabId, url });
  }

  setContentScriptReady(tabId: number, ready: boolean = true): void {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.contentScriptReady = ready;
      this.tabs.set(tabId, tab);
    }
  }

  isContentScriptReady(tabId: number): boolean {
    return this.tabs.get(tabId)?.contentScriptReady ?? false;
  }

  setAgentSession(tabId: number, sessionId: string): void {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.agentSessionId = sessionId;
      this.tabs.set(tabId, tab);
    }
  }

  getAgentSession(tabId: number): string | undefined {
    return this.tabs.get(tabId)?.agentSessionId;
  }

  clearAgentSession(tabId: number): void {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.agentSessionId = undefined;
      this.tabs.set(tabId, tab);
    }
  }

  setLastDomExtraction(tabId: number, timestamp: number): void {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.lastDomExtraction = timestamp;
      this.tabs.set(tabId, tab);
    }
  }

  getLastDomExtraction(tabId: number): number | undefined {
    return this.tabs.get(tabId)?.lastDomExtraction;
  }

  getNextElementId(tabId: number): string {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      return `el_${crypto.randomUUID().replace(/-/g, "").substring(0, 12)}`;
    }
    tab.elementIdCounter++;
    this.tabs.set(tabId, tab);
    return `el_${tab.elementIdCounter.toString(36).padStart(8, "0")}`;
  }

  setActiveTab(tabId: number): void {
    this.activeTabId = tabId;
    for (const [id, tab] of this.tabs) {
      tab.active = id === tabId;
      this.tabs.set(id, tab);
    }
  }

  getActiveTabId(): number | null {
    return this.activeTabId;
  }

  getTab(tabId: number): TabState | undefined {
    return this.tabs.get(tabId);
  }

  async getAllTabs(): Promise<chrome.tabs.Tab[]> {
    return new Promise((resolve) => {
      browserAPI.tabs.query({}, (tabs) => {
        resolve(tabs);
      });
    });
  }

  async getActiveTab(): Promise<TabState | null> {
    const tab = await getTab(this.activeTabId ?? -1);
    if (tab) {
      return this.tabs.get(tab.id) ?? null;
    }
    return null;
  }

  cleanupTab(tabId: number): void {
    this.tabs.delete(tabId);
    if (this.activeTabId === tabId) {
      this.activeTabId = null;
    }
    logger.debug("TabManager", "Tab cleaned up", { tabId });
  }

  getTabsWithAgent(): TabState[] {
    return Array.from(this.tabs.values()).filter((tab) => tab.agentSessionId);
  }
}
