"""Security audit logging."""
import json
import time
from typing import Any
from dataclasses import dataclass, field, asdict
from enum import Enum

from app.utils.logging import get_logger


class AuditEventType(str, Enum):
    REQUEST_RECEIVED = "request_received"
    REQUEST_VALIDATED = "request_validated"
    REQUEST_REJECTED = "request_rejected"
    PLANNER_CALLED = "planner_called"
    PLANNER_FAILED = "planner_failed"
    ACTION_VALIDATED = "action_validated"
    ACTION_REJECTED = "action_rejected"
    RESPONSE_SENT = "response_sent"
    ERROR = "error"


class AuditSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class AuditEvent:
    event_type: AuditEventType
    severity: AuditSeverity
    request_id: str
    session_id: str
    message: str
    metadata: dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)


class AuditLogger:
    def __init__(self):
        self.logger = get_logger("audit")

    def log(self, event: AuditEvent) -> None:
        log_data = asdict(event)
        log_data["event_type"] = event.event_type.value
        log_data["severity"] = event.severity.value
        log_data = self._sanitize(log_data)

        if event.severity in (AuditSeverity.ERROR, AuditSeverity.CRITICAL):
            self.logger.error(json.dumps(log_data))
        elif event.severity == AuditSeverity.WARNING:
            self.logger.warning(json.dumps(log_data))
        else:
            self.logger.info(json.dumps(log_data))

    def log_request_received(self, request_id: str, session_id: str, task: str, metadata: dict = None) -> None:
        self.log(AuditEvent(
            event_type=AuditEventType.REQUEST_RECEIVED,
            severity=AuditSeverity.INFO,
            request_id=request_id,
            session_id=session_id,
            message=f"Request received: {task[:100]}",
            metadata=metadata or {}
        ))

    def log_request_validated(self, request_id: str, session_id: str) -> None:
        self.log(AuditEvent(
            event_type=AuditEventType.REQUEST_VALIDATED,
            severity=AuditSeverity.INFO,
            request_id=request_id,
            session_id=session_id,
            message="Request passed validation"
        ))

    def log_request_rejected(self, request_id: str, session_id: str, violations: list[str]) -> None:
        self.log(AuditEvent(
            event_type=AuditEventType.REQUEST_REJECTED,
            severity=AuditSeverity.WARNING,
            request_id=request_id,
            session_id=session_id,
            message="Request rejected by validator",
            metadata={"violations_count": len(violations)}
        ))

    def log_planner_called(self, request_id: str, session_id: str, backend: str) -> None:
        self.log(AuditEvent(
            event_type=AuditEventType.PLANNER_CALLED,
            severity=AuditSeverity.INFO,
            request_id=request_id,
            session_id=session_id,
            message=f"Planner called: {backend}",
            metadata={"backend": backend}
        ))

    def log_planner_failed(self, request_id: str, session_id: str, backend: str, error: str) -> None:
        self.log(AuditEvent(
            event_type=AuditEventType.PLANNER_FAILED,
            severity=AuditSeverity.ERROR,
            request_id=request_id,
            session_id=session_id,
            message=f"Planner failed: {backend}",
            metadata={"backend": backend, "error": error[:200]}
        ))

    def log_action_validated(self, request_id: str, session_id: str, action_type: str, risk: str) -> None:
        self.log(AuditEvent(
            event_type=AuditEventType.ACTION_VALIDATED,
            severity=AuditSeverity.INFO,
            request_id=request_id,
            session_id=session_id,
            message=f"Action validated: {action_type}",
            metadata={"action_type": action_type, "risk": risk}
        ))

    def log_action_rejected(self, request_id: str, session_id: str, action_type: str, reason: str) -> None:
        self.log(AuditEvent(
            event_type=AuditEventType.ACTION_REJECTED,
            severity=AuditSeverity.WARNING,
            request_id=request_id,
            session_id=session_id,
            message=f"Action rejected: {action_type}",
            metadata={"action_type": action_type, "reason": reason}
        ))

    def log_response_sent(self, request_id: str, session_id: str, action_type: str) -> None:
        self.log(AuditEvent(
            event_type=AuditEventType.RESPONSE_SENT,
            severity=AuditSeverity.INFO,
            request_id=request_id,
            session_id=session_id,
            message=f"Response sent: {action_type}",
            metadata={"action_type": action_type}
        ))

    def log_error(self, request_id: str, session_id: str, error: str, context: dict = None) -> None:
        self.log(AuditEvent(
            event_type=AuditEventType.ERROR,
            severity=AuditSeverity.ERROR,
            request_id=request_id,
            session_id=session_id,
            message=f"Error: {error[:200]}",
            metadata=context or {}
        ))

    def _sanitize(self, data: dict[str, Any]) -> dict[str, Any]:
        sensitive_keys = {
            "api_key", "password", "secret", "token", "authorization",
            "access_token", "refresh_token", "cookie", "cookies",
            "private_key", "ssh_key"
        }

        def sanitize_obj(obj: Any) -> Any:
            if isinstance(obj, dict):
                return {
                    k: "[REDACTED]" if k.lower() in sensitive_keys else sanitize_obj(v)
                    for k, v in obj.items()
                }
            elif isinstance(obj, list):
                return [sanitize_obj(item) for item in obj]
            return obj

        return sanitize_obj(data)


def create_audit_logger() -> AuditLogger:
    return AuditLogger()