/**
 * Page Observer - detects page changes using MutationObserver.
 * Notifies callbacks when significant DOM changes occur.
 */

import { logger } from "../shared/logger";

export type ChangeCallback = (changes: { added: number; removed: number; changed: number }) => void;

interface MutationSummary {
  added: number;
  removed: number;
  changed: number;
}

export class PageObserver {
  private observer: MutationObserver | null = null;
  private callbacks: Set<ChangeCallback> = new Set();
  private lastHtml = "";
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;
  private mutationCount = 0;
  private lastMutationTime = 0;

  constructor() {
    this.lastHtml = document.documentElement.outerHTML;
  }

  start(callback?: ChangeCallback): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastHtml = document.documentElement.outerHTML;

    this.observer = new MutationObserver((mutations) => {
      this.mutationCount += mutations.length;
      this.lastMutationTime = Date.now();

      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => {
        this.checkForSignificantChange();
      }, 150);
    });

    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href", "src", "value", "checked", "selected", "disabled", "hidden", "style", "class", "id"],
      characterData: true,
    });

    if (callback) {
      this.callbacks.add(callback);
    }

    logger.debug("PageObserver", "Started observing");
  }

  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.isRunning = false;
    this.callbacks.clear();
    logger.debug("PageObserver", "Stopped observing");
  }

  onChange(callback: ChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private checkForSignificantChange(): void {
    if (!this.isRunning) return;

    const currentHtml = document.documentElement.outerHTML;
    if (currentHtml === this.lastHtml) {
      return;
    }

    const summary = this.summarizeChanges(currentHtml);
    this.lastHtml = currentHtml;
    this.notifyCallbacks(summary);
  }

  private summarizeChanges(currentHtml: string): MutationSummary {
    // Simple heuristic: count significant differences
    const oldLength = this.lastHtml.length;
    const newLength = currentHtml.length;
    const lengthDiff = Math.abs(newLength - oldLength);

    // Estimate changes based on mutation count and length difference
    const changed = Math.min(this.mutationCount, 50);
    const added = newLength > oldLength ? Math.min(lengthDiff / 10, 20) : 0;
    const removed = oldLength > newLength ? Math.min(lengthDiff / 10, 20) : 0;

    this.mutationCount = 0;

    return { added, removed, changed };
  }

  private notifyCallbacks(summary: MutationSummary): void {
    for (const callback of this.callbacks) {
      try {
        callback(summary);
      } catch (error) {
        logger.error("PageObserver", "Callback error", { error: (error as Error).message });
      }
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }

  forceCheck(): void {
    this.checkForSignificantChange();
  }
}
