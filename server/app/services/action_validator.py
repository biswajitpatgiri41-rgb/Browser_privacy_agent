"""Strict action validation - planner output is untrusted."""
import json
import re
from uuid import uuid4
from typing import Any
from urllib.parse import urlparse

from app.schemas.action import AgentAction, ActionType
from app.schemas.context import SanitizedContext
from app.schemas.agent_response import AgentResponse
from app.config import get_settings


class ActionValidationError(Exception):
    """Raised when action validation fails."""
    def __init__(self, message: str, safe_error: str = None):
        super().__init__(message)
        self.safe_error = safe_error or "Action validation failed"


class ActionValidator:
    """Validates planner output through multiple stages."""

    FORBIDDEN_SCHEMES = frozenset({
        "javascript", "data", "file", "chrome", "about",
        "chrome-extension", "moz-extension", "ms-browser-extension",
        "vscode", "vscode-insiders", "file", "ftp", "ws", "wss"
    })

    MAX_SCROLL_AMOUNT = 5000
    MAX_WAIT_DURATION_MS = 30000
    MAX_NAVIGATE_URL_LENGTH = 2048

    PII_TOKEN_PATTERN = re.compile(r'^\[(EMAIL|PASSWORD|PERSON|PHONE|ADDRESS|SECRET|CREDIT_CARD|SSN|API_KEY|TOKEN|FACE_REGION|OTHER)\]$')

    def __init__(self):
        self.settings = get_settings()

    def validate(
        self,
        raw_output: str,
        context: SanitizedContext,
        allowed_actions: list[str],
        request_id: str | None = None,
        session_id: str | None = None,
    ) -> AgentResponse:
        try:
            action_dict = json.loads(raw_output)
        except json.JSONDecodeError as e:
            raise ActionValidationError(f"Invalid JSON: {e}", "Invalid action format")

        try:
            action = AgentAction.model_validate(action_dict)
        except Exception as e:
            raise ActionValidationError(f"Schema validation failed: {e}", "Invalid action parameters")

        action_name = getattr(action.action, "value", action.action)
        if action_name not in allowed_actions:
            raise ActionValidationError(
            f"Action '{action_name}' not in allowed actions: {allowed_actions}",
                "Action not permitted"
            )

        self._validate_element_existence(action, context)
        self._validate_action_specific(action, context)

        if not 0.0 <= action.confidence <= 1.0:
            raise ActionValidationError("Confidence must be in [0, 1]", "Invalid confidence value")

        return AgentResponse(
            request_id=request_id or str(uuid4()),
            session_id=session_id or str(uuid4()),
            action=action,
            privacy=context.privacy,
            requires_confirmation=self._requires_confirmation(action)
        )

    def _validate_element_existence(self, action: AgentAction, context: SanitizedContext) -> None:
        if action.element_id is None:
            return

        element_ids = {e.element_id for e in context.elements}
        if action.element_id not in element_ids:
            raise ActionValidationError(
                f"Element '{action.element_id}' not found in context",
                "Target element not found"
            )

    def _validate_action_specific(self, action: AgentAction, context: SanitizedContext) -> None:
        action_type = action.action

        if action_type == ActionType.CLICK:
            if action.element_id is None:
                raise ActionValidationError("Click requires element_id", "Missing target element")
            element = self._find_element(action.element_id, context)
            if element and not element.is_interactive:
                raise ActionValidationError(
                    f"Element '{action.element_id}' is not interactive",
                    "Cannot click non-interactive element"
                )

        elif action_type == ActionType.SELECT:
            if action.element_id is None:
                raise ActionValidationError("Select requires element_id", "Missing target element")
            if action.value is None:
                raise ActionValidationError("Select requires value", "Missing select value")
            element = self._find_element(action.element_id, context)
            if element and element.tag != "select":
                raise ActionValidationError(
                    f"Element '{action.element_id}' is not a select element",
                    "Invalid select target"
                )

        elif action_type == ActionType.SCROLL:
            if action.direction not in ("up", "down", "left", "right"):
                raise ActionValidationError(
                    f"Invalid scroll direction: {action.direction}",
                    "Invalid scroll direction"
                )
            if action.amount is not None:
                if action.amount < 0 or action.amount > self.MAX_SCROLL_AMOUNT:
                    raise ActionValidationError(
                        f"Scroll amount {action.amount} exceeds maximum {self.MAX_SCROLL_AMOUNT}",
                        "Scroll amount too large"
                    )

        elif action_type == ActionType.NAVIGATE:
            if action.url is None:
                raise ActionValidationError("Navigate requires url", "Missing URL")
            self._validate_url(action.url)

        elif action_type == ActionType.WAIT:
            if action.duration_ms is not None:
                if action.duration_ms < 0 or action.duration_ms > self.MAX_WAIT_DURATION_MS:
                    raise ActionValidationError(
                        f"Wait duration {action.duration_ms}ms exceeds maximum {self.MAX_WAIT_DURATION_MS}ms",
                        "Wait duration too long"
                    )

        elif action_type == ActionType.FINISH:
            pass

    def _validate_url(self, url: str) -> None:
        if len(url) > self.MAX_NAVIGATE_URL_LENGTH:
            raise ActionValidationError("URL too long", "URL exceeds maximum length")

        try:
            parsed = urlparse(url)
        except Exception:
            raise ActionValidationError("Invalid URL format", "Invalid URL")

        scheme = parsed.scheme.lower()
        if scheme not in ("http", "https"):
            raise ActionValidationError(
                f"Forbidden URL scheme: {scheme}",
                "Navigation to unsafe URL blocked"
            )

        if self.settings.app_env == "production":
            hostname = parsed.hostname or ""
            if hostname in ("localhost", "127.0.0.1", "0.0.0.0") or hostname.startswith("192.168.") or hostname.startswith("10.") or hostname.startswith("172.16."):
                raise ActionValidationError(
                    f"Navigation to private address blocked: {hostname}",
                    "Navigation to private address blocked"
                )

    def _find_element(self, element_id: str, context: SanitizedContext) -> Any:
        for element in context.elements:
            if element.element_id == element_id:
                return element
        return None

    def _requires_confirmation(self, action: AgentAction) -> bool:
        if action.action == ActionType.FINISH and action.confidence > 0.8:
            return False
        return False


def create_action_validator() -> ActionValidator:
    return ActionValidator()