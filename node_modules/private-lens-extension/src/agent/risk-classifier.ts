/**
 * Risk Classifier - classifies actions by risk level.
 */

import { AgentAction, SanitizedContext, RiskAssessment, RiskLevel } from "../types/agent";

export class RiskClassifier {
  classify(action: AgentAction, context: SanitizedContext): RiskAssessment {
    let level: RiskLevel = "low";
    const reasons: string[] = [];

    switch (action.action) {
      case "navigate":
        level = "medium";
        reasons.push("Navigation changes page context");
        break;
      case "click":
        if (action.elementId) {
          const element = context.elements.find((el) => el.elementId === action.elementId);
          if (element) {
            if (element.tag === "a" && element.attributes.href) {
              level = "medium";
              reasons.push("Clicking link may navigate");
            }
            if (element.attributes.onclick) {
              level = "medium";
              reasons.push("Element has click handler");
            }
            if (element.tag === "button" && element.attributes.type === "submit") {
              level = "medium";
              reasons.push("Form submission");
            }
          }
        }
        break;
      case "select":
        level = "low";
        break;
      case "wait":
        level = "low";
        break;
      case "finish":
        level = "low";
        break;
      case "scroll":
        level = "low";
        break;
    }

    // Check for sensitive contexts
    if (this.isSensitiveContext(context)) {
      if (level === "low") level = "medium";
      reasons.push("Action in sensitive context (forms, payments, auth)");
    }

    // Check for file downloads
    if (action.action === "click" && action.elementId) {
      const element = context.elements.find((el) => el.elementId === action.elementId);
      if (element && element.tag === "a" && element.attributes.href) {
        const href = element.attributes.href.toLowerCase();
        if (href.includes(".pdf") || href.includes(".exe") || href.includes(".zip")) {
          level = "medium";
          reasons.push("Link may trigger file download");
        }
      }
    }

    return { level, reasons };
  }

  private isSensitiveContext(context: SanitizedContext): boolean {
    const sensitivePatterns = [
      /login/i,
      /password/i,
      /payment/i,
      /checkout/i,
      /credit.?card/i,
      /billing/i,
      /auth/i,
      /sign.?in/i,
      /register/i,
    ];

    const url = context.url.toLowerCase();
    const title = (context.title ?? "").toLowerCase();

    for (const pattern of sensitivePatterns) {
      if (pattern.test(url) || pattern.test(title)) {
        return true;
      }
    }

    // Check for password fields in context
    const hasPasswordField = context.elements.some(
      (el) => el.inputType === "password"
    );
    if (hasPasswordField) return true;

    return false;
  }
}
