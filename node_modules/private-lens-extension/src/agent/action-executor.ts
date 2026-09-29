/**
 * Action Executor - executes actions on the page.
 */

import { logger } from "../shared/logger";
import { ElementLocator } from "../content/element-locator";
import { AgentAction, ActionResult, SanitizedContext, ActionType } from "../types/agent";
import { getElementLocator } from "../content/element-locator";

const elementLocator = getElementLocator();

export class ActionExecutor {
  async execute(action: AgentAction): Promise<ActionResult> {
    const requestId = crypto.randomUUID();
    const log = logger.withContext(requestId, "unknown", 0);

    log.info("ActionExecutor", "Executing action", { action: action.action, elementId: action.elementId });

    try {
      switch (action.action) {
        case "click":
          return await this.executeClick(action);
        case "scroll":
          return await this.executeScroll(action);
        case "select":
          return await this.executeSelect(action);
        case "navigate":
          return await this.executeNavigate(action);
        case "wait":
          return await this.executeWait(action);
        case "finish":
          return { success: true };
        default:
          throw new Error(`Unknown action type: ${(action as AgentAction).action}`);
      }
    } catch (error) {
      log.error("ActionExecutor", "Action execution failed", { error: (error as Error).message });
      return { success: false, error: (error as Error).message };
    }
  }

  private async executeClick(action: AgentAction): Promise<ActionResult> {
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

    logger.debug("ActionExecutor", "Click executed", { elementId: action.elementId });

    return { success: true };
  }

  private async executeScroll(action: AgentAction): Promise<ActionResult> {
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

  private async executeSelect(action: AgentAction): Promise<ActionResult> {
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

  private async executeNavigate(action: AgentAction): Promise<ActionResult> {
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

  private async executeWait(action: AgentAction): Promise<ActionResult> {
    const duration = action.durationMs ?? 1000;
    await new Promise((resolve) => setTimeout(resolve, duration));
    return { success: true };
  }
}
