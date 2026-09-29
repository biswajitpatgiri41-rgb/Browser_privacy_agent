"""Deterministic action risk classification."""
from enum import Enum
from typing import Any
from app.schemas.action import AgentAction, ActionType
from app.schemas.context import SanitizedContext, SanitizedElement


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    BLOCKED = "blocked"


class RiskClassifier:
    """Classifies action risk deterministically based on action type and context."""

    # High-risk action patterns
    HIGH_RISK_PATTERNS = {
        "purchase", "buy", "checkout", "payment", "order",
        "delete", "remove", "destroy", "terminate", "cancel account",
        "transfer", "send money", "withdraw", "deposit",
        "submit", "confirm", "authorize", "approve",
        "change password", "reset password", "security settings",
        "permission", "access control", "admin", "delete user"
    }

    # Medium-risk action patterns
    MEDIUM_RISK_PATTERNS = {
        "form", "input", "textarea", "select", "dropdown",
        "login", "sign in", "sign up", "register",
        "navigate", "redirect", "link", "href",
        "search", "filter", "sort"
    }

    # Benign element roles (low risk clicks)
    BENIGN_ROLES = {
        "button", "link", "menuitem", "tab", "navigation",
        "breadcrumb", "pagination", "tooltip", "dialog"
    }

    def __init__(self):
        pass

    def classify(self, action: AgentAction, context: SanitizedContext) -> RiskLevel:
        """Classify action risk level deterministically."""
        # Blocked: forbidden action types
        if action.action == ActionType.FINISH:
            return RiskLevel.LOW

        # Check for unknown element
        if action.element_id:
            element = self._find_element(action.element_id, context)
            if element is None:
                return RiskLevel.BLOCKED
            if not element.is_interactive:
                return RiskLevel.BLOCKED

        # Navigate actions
        if action.action == ActionType.NAVIGATE:
            return self._classify_navigation(action)

        # Click actions
        if action.action == ActionType.CLICK:
            return self._classify_click(action, context)

        # Select actions
        if action.action == ActionType.SELECT:
            return RiskLevel.MEDIUM

        # Scroll/wait are generally low risk
        if action.action in (ActionType.SCROLL, ActionType.WAIT):
            return RiskLevel.LOW

        return RiskLevel.MEDIUM

    def _classify_navigation(self, action: AgentAction) -> RiskLevel:
        """Classify navigation risk."""
        if not action.url:
            return RiskLevel.BLOCKED

        url = action.url.lower()

        # Check for suspicious patterns
        for pattern in self.HIGH_RISK_PATTERNS:
            if pattern in url:
                return RiskLevel.HIGH

        # Cross-origin navigation
        # (In practice, compare with current origin)
        return RiskLevel.MEDIUM

    def _classify_click(self, action: AgentAction, context: SanitizedContext) -> RiskLevel:
        """Classify click risk based on element metadata."""
        element = self._find_element(action.element_id, context)
        if not element:
            return RiskLevel.BLOCKED

        # Check element role and label for high-risk patterns
        safe_label = (element.safe_label or "").lower()
        role = (element.role or "").lower()
        tag = (element.tag or "").lower()

        # High-risk: financial/purchase/security actions
        for pattern in self.HIGH_RISK_PATTERNS:
            if pattern in safe_label:
                return RiskLevel.HIGH

        # Medium-risk: form interactions
        for pattern in self.MEDIUM_RISK_PATTERNS:
            if pattern in safe_label:
                return RiskLevel.MEDIUM

        # Low-risk: benign navigation controls
        if role in self.BENIGN_ROLES or tag in ("a", "button"):
            return RiskLevel.LOW

        # Input elements are medium risk
        if tag in ("input", "textarea", "select"):
            return RiskLevel.MEDIUM

        return RiskLevel.LOW

    def _find_element(self, element_id: str, context: SanitizedContext) -> SanitizedElement | None:
        for element in context.elements:
            if element.element_id == element_id:
                return element
        return None

    def requires_confirmation(self, risk_level: RiskLevel) -> bool:
        """Determine if user confirmation is required."""
        return risk_level == RiskLevel.HIGH


def create_risk_classifier() -> RiskClassifier:
    return RiskClassifier()