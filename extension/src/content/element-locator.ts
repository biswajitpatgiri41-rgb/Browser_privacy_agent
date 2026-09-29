/**
 * Element Locator - finds elements by their ephemeral IDs.
 * Maintains a map from element IDs to DOM elements.
 */

import { logger } from "../shared/logger";

interface ElementEntry {
  element: HTMLElement;
  id: string;
}

export class ElementLocator {
  private elementMap: Map<string, HTMLElement> = new Map();
  private reverseMap: Map<HTMLElement, string> = new Map();

  register(element: HTMLElement, id: string): void {
    this.elementMap.set(id, element);
    this.reverseMap.set(element, id);
  }

  unregister(id: string): void {
    const element = this.elementMap.get(id);
    if (element) {
      this.elementMap.delete(id);
      this.reverseMap.delete(element);
    }
  }

  /** Alias for register for compatibility */
  registerElement(elementId: string, element: HTMLElement): void {
    this.register(element, elementId);
  }

  findElement(elementId: string): HTMLElement | null {
    return this.elementMap.get(elementId) ?? null;
  }

  findElements(elementIds: string[]): HTMLElement[] {
    return elementIds
      .map((id) => this.elementMap.get(id))
      .filter((el): el is HTMLElement => el !== undefined);
  }

  getElementId(element: HTMLElement): string | undefined {
    return this.reverseMap.get(element);
  }

  clear(): void {
    this.elementMap.clear();
    this.reverseMap.clear();
  }

  size(): number {
    return this.elementMap.size;
  }
}

// Global instance for cross-module access
let globalLocator: ElementLocator | null = null;

export function getElementLocator(): ElementLocator {
  if (!globalLocator) {
    globalLocator = new ElementLocator();
  }
  return globalLocator;
}

export function setElementLocator(locator: ElementLocator): void {
  globalLocator = locator;
}
