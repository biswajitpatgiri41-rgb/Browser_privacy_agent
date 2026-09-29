/**
 * Browser API abstraction for cross-browser compatibility.
 * Provides a unified interface over chrome.* and browser.* APIs.
 */

type BrowserAPI = typeof chrome | typeof browser;

function getBrowserAPI(): BrowserAPI {
  // @ts-ignore - browser is available in Firefox
  return typeof browser !== "undefined" ? browser : chrome;
}

export const browserAPI = getBrowserAPI();

export interface TabInfo {
  id: number;
  url: string;
  title: string;
  active: boolean;
  windowId: number;
}

export interface MessagePort {
  postMessage(message: unknown): void;
  onMessage: {
    addListener(listener: (message: unknown, port: MessagePort) => void): void;
    removeListener(listener: (message: unknown, port: MessagePort) => void): void;
  };
  onDisconnect: {
    addListener(listener: (port: MessagePort) => void): void;
    removeListener(listener: (port: MessagePort) => void): void;
  };
  close(): void;
}

export function sendMessage<T = unknown>(
  target: { tabId?: number; frameId?: number } | number,
  message: unknown,
  options?: { frameId?: number }
): Promise<T> {
  const api = getBrowserAPI();
  const tabId = typeof target === "number" ? target : target.tabId;
  const frameId = typeof target === "number" ? undefined : target.frameId;

  return new Promise((resolve, reject) => {
    if (tabId === undefined) {
      reject(new Error("A tab ID is required"));
      return;
    }
    try {
      api.tabs.sendMessage(
        tabId,
        message,
        { frameId },
        (response: T) => {
          if (api.runtime.lastError) {
            reject(new Error(api.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

export function sendMessageToBackground(message: unknown): Promise<unknown> {
  const api = getBrowserAPI();
  return new Promise((resolve, reject) => {
    try {
      api.runtime.sendMessage(message, (response: unknown) => {
        if (api.runtime.lastError) {
          reject(new Error(api.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

export function onMessage(
  listener: (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response: unknown) => void) => boolean | void | Promise<boolean | void>
): void {
  const api = getBrowserAPI();
  (api.runtime.onMessage.addListener as unknown as (handler: typeof listener) => void)(listener);
}

export function onConnect(
  listener: (port: chrome.runtime.Port) => void
): void {
  const api = getBrowserAPI();
  api.runtime.onConnect.addListener(listener);
}

export function connect(extensionId?: string, connectInfo?: { name?: string }): MessagePort {
  const api = getBrowserAPI();
  return api.runtime.connect(extensionId, connectInfo) as unknown as MessagePort;
}

export function getActiveTab(): Promise<TabInfo | null> {
  const api = getBrowserAPI();
  return new Promise((resolve) => {
    api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        const tab = tabs[0];
        resolve({
          id: tab.id!,
          url: tab.url ?? "",
          title: tab.title ?? "",
          active: tab.active ?? true,
          windowId: tab.windowId ?? 0,
        });
      } else {
        resolve(null);
      }
    });
  });
}

export function getTab(tabId: number): Promise<TabInfo | null> {
  const api = getBrowserAPI();
  return new Promise((resolve) => {
    api.tabs.get(tabId, (tab) => {
      if (api.runtime.lastError) {
        resolve(null);
      } else {
        resolve({
          id: tab.id!,
          url: tab.url ?? "",
          title: tab.title ?? "",
          active: tab.active ?? false,
          windowId: tab.windowId ?? 0,
        });
      }
    });
  });
}

export function executeScript(tabId: number, func: (...args: unknown[]) => unknown, args: unknown[] = []): Promise<unknown[]> {
  const api = getBrowserAPI();
  return new Promise((resolve, reject) => {
    (api.scripting.executeScript as unknown as (injection: unknown, callback: (results: Array<{ result: unknown }> | undefined) => void) => void)(
      {
        target: { tabId },
        func,
        args,
      },
      (results) => {
        if (api.runtime.lastError) {
          reject(new Error(api.runtime.lastError.message));
        } else {
          resolve(results?.map((r) => r.result) ?? []);
        }
      }
    );
  });
}

export function insertCSS(tabId: number, css: string): Promise<void> {
  const api = getBrowserAPI();
  return new Promise((resolve, reject) => {
    api.scripting.insertCSS(
      {
        target: { tabId },
        css,
      },
      () => {
        if (api.runtime.lastError) {
          reject(new Error(api.runtime.lastError.message));
        } else {
          resolve();
        }
      }
    );
  });
}

export function removeCSS(tabId: number, css: string): Promise<void> {
  const api = getBrowserAPI();
  return new Promise((resolve, reject) => {
    api.scripting.removeCSS(
      {
        target: { tabId },
        css,
      },
      () => {
        if (api.runtime.lastError) {
          reject(new Error(api.runtime.lastError.message));
        } else {
          resolve();
        }
      }
    );
  });
}
export function getURL(path: string): string {
  const api = getBrowserAPI();
  return api.runtime.getURL(path);
}

export function getManifest(): chrome.runtime.Manifest {
  const api = getBrowserAPI();
  return api.runtime.getManifest();
}

export function onInstalled(listener: (details: chrome.runtime.InstalledDetails) => void): void {
  const api = getBrowserAPI();
  api.runtime.onInstalled.addListener(listener);
}

export function onStartup(listener: () => void): void {
  const api = getBrowserAPI();
  api.runtime.onStartup.addListener(listener);
}

export function setBadgeText(text: string, tabId?: number): Promise<void> {
  const api = getBrowserAPI();
  return new Promise((resolve) => {
    api.action.setBadgeText({ text, tabId }, () => resolve());
  });
}

export function setBadgeBackgroundColor(color: string, tabId?: number): Promise<void> {
  const api = getBrowserAPI();
  return new Promise((resolve) => {
    api.action.setBadgeBackgroundColor({ color, tabId }, () => resolve());
  });
}

export function openOptionsPage(): Promise<void> {
  const api = getBrowserAPI();
  return new Promise((resolve) => {
    api.runtime.openOptionsPage(() => resolve());
  });
}
export const storage = {
  local: {
    get<T>(keys: string | string[] | null): Promise<Record<string, T>> {
      const api = getBrowserAPI();
      return new Promise((resolve, reject) => {
        api.storage.local.get(keys, (items) => {
          if (api.runtime.lastError) {
            reject(new Error(api.runtime.lastError.message));
          } else {
            resolve(items as Record<string, T>);
          }
        });
      });
    },
    set(items: Record<string, unknown>): Promise<void> {
      const api = getBrowserAPI();
      return new Promise((resolve, reject) => {
        api.storage.local.set(items, () => {
          if (api.runtime.lastError) {
            reject(new Error(api.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    },
    remove(keys: string | string[]): Promise<void> {
      const api = getBrowserAPI();
      return new Promise((resolve, reject) => {
        api.storage.local.remove(keys, () => {
          if (api.runtime.lastError) {
            reject(new Error(api.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    },
    clear(): Promise<void> {
      const api = getBrowserAPI();
      return new Promise((resolve, reject) => {
        api.storage.local.clear(() => {
          if (api.runtime.lastError) {
            reject(new Error(api.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    },
  },
  session: {
    get<T>(keys: string | string[] | null): Promise<Record<string, T>> {
      const api = getBrowserAPI();
      return new Promise((resolve, reject) => {
        api.storage.session.get(keys, (items) => {
          if (api.runtime.lastError) {
            reject(new Error(api.runtime.lastError.message));
          } else {
            resolve(items as Record<string, T>);
          }
        });
      });
    },
    set(items: Record<string, unknown>): Promise<void> {
      const api = getBrowserAPI();
      return new Promise((resolve, reject) => {
        api.storage.session.set(items, () => {
          if (api.runtime.lastError) {
            reject(new Error(api.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    },
    remove(keys: string | string[]): Promise<void> {
      const api = getBrowserAPI();
      return new Promise((resolve, reject) => {
        api.storage.session.remove(keys, () => {
          if (api.runtime.lastError) {
            reject(new Error(api.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    },
  },
};
export const alarms = {
  create(name: string, alarmInfo: chrome.alarms.AlarmCreateInfo): Promise<void> {
    const api = getBrowserAPI();
    return new Promise((resolve, reject) => {
      api.alarms.create(name, alarmInfo, () => {
        if (api.runtime.lastError) {
          reject(new Error(api.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  },
  clear(name?: string): Promise<boolean> {
    const api = getBrowserAPI();
    return new Promise((resolve, reject) => {
      api.alarms.clear(name, (cleared) => {
        if (api.runtime.lastError) {
          reject(new Error(api.runtime.lastError.message));
        } else {
          resolve(cleared);
        }
      });
    });
  },
  get(name?: string): Promise<chrome.alarms.Alarm | undefined> {
    const api = getBrowserAPI();
    return new Promise((resolve, reject) => {
      api.alarms.get(name, (alarm) => {
        if (api.runtime.lastError) {
          reject(new Error(api.runtime.lastError.message));
        } else {
          resolve(alarm);
        }
      });
    });
  },
  getAll(): Promise<chrome.alarms.Alarm[]> {
    const api = getBrowserAPI();
    return new Promise((resolve, reject) => {
      api.alarms.getAll((alarms) => {
        if (api.runtime.lastError) {
          reject(new Error(api.runtime.lastError.message));
        } else {
          resolve(alarms);
        }
      });
    });
  },
  onAlarm: {
    addListener(listener: (alarm: chrome.alarms.Alarm) => void): void {
      const api = getBrowserAPI();
      api.alarms.onAlarm.addListener(listener);
    },
    removeListener(listener: (alarm: chrome.alarms.Alarm) => void): void {
      const api = getBrowserAPI();
      api.alarms.onAlarm.removeListener(listener);
    },
  },
};

export function isManifestV3(): boolean {
  const manifest = getManifest();
  return manifest.manifest_version === 3;
}

export function getExtensionId(): string {
  const api = getBrowserAPI();
  return api.runtime.id;
}

export function getVersion(): string {
  const manifest = getManifest();
  return manifest.version;
}