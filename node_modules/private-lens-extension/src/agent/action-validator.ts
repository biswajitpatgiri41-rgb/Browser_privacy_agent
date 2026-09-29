/**
 * Action Validator - validates actions before execution.
 */

import { logger } from "../shared/logger";
import { AgentAction, SanitizedContext, ValidationResult, ActionType } from "../types/agent";
import { ElementLocator } from "../content/element-locator";
import { getElementLocator } from "../content/element-locator";

const elementLocator = getElementLocator();

export class ActionValidator {
  validate(action: AgentAction, context: SanitizedContext): ValidationResult {
    // Check if action type is valid
    const validActions: ActionType[] = ["click", "scroll", "select", "navigate", "wait", "finish"];
    if (!validActions.includes(action.action)) {
      return { valid: false, error: `Invalid action type: ${action.action}` };
    }

    // For element-based actions, verify element exists and is interactable
    if (action.elementId) {
      const element = context.elements.find((el) => el.elementId === action.elementId);
      if (!element) {
        return { valid: false, error: `Element not found in context: ${action.elementId}` };
      }

      const domElement = elementLocator.findElement(action.elementId);
      if (!domElement) {
        return { valid: false, error: `Element not found in DOM: ${action.elementId}` };
      }

      if (!element.isInteractive) {
        return { valid: false, error: `Element is not interactive: ${action.elementId}` };
      }

      if (!element.isVisible) {
        return { valid: false, error: `Element is not visible: ${action.elementId}` };
      }

      // Special validation per action type
      switch (action.action) {
        case "click":
          if (element.tag === "input" && element.inputType === "hidden") {
            return { valid: false, error: "Cannot click hidden input" };
          }
          break;
        case "select":
          if (element.tag !== "select") {
            return { valid: false, error: "Select action requires a select element" };
          }
          if (!action.value) {
            return { valid: false, error: "Select action requires a value" };
          }
          break;
      }
    } else if (["click", "select"].includes(action.action)) {
      return { valid: false, error: `${action.action} action requires elementId` };
    }

    // Validate navigate action
    if (action.action === "navigate") {
      if (!action.url) {
        return { valid: false, error: "Navigate action requires url" };
      }
      try {
        const url = new URL(action.url);
        if (!["http:", "https:"].includes(url.protocol)) {
          return { valid: false, error: `Navigation to ${url.protocol} URLs not allowed` };
        }
      } catch {
        return { valid: false, error: "Invalid URL" };
      }
    }

    // Validate wait action
    if (action.action === "wait") {
      if (action.durationMs !== undefined && (action.durationMs < 0 || action.durationMs > 30000)) {
        return { valid: false, error: "Wait duration must be between 0 and 30000ms" };
      }
    }

    return { valid: true };
  }
}
