"""Deterministic payload validation - security layer."""
import json
import re
from typing import Any
from dataclasses import dataclass

from app.config import get_settings


@dataclass
class ValidationResult:
    valid: bool
    violations: list[str]
    safe_message: str = ""


class PayloadValidationError(Exception):
    def __init__(self, violations: list[str]):
        self.violations = violations
        safe_msg = "; ".join(violations) if violations else "Payload validation failed"
        super().__init__(safe_msg)


class PayloadValidator:
    FORBIDDEN_FIELDS = frozenset({
        "password_value", "cookie", "cookies", "authorization",
        "access_token", "refresh_token", "api_key", "secret_value",
        "client_secret", "private_key", "ssh_key", "bearer_token"
    })

    PII_TOKEN_PATTERN = re.compile(r'^\[(EMAIL|PASSWORD|PERSON|PHONE|ADDRESS|SECRET|CREDIT_CARD|SSN|API_KEY|TOKEN|FACE_REGION|OTHER)\]$')
    RAW_PII_PATTERNS = (
        re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b'),
        re.compile(r'\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b'),
        re.compile(r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b'),
        re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b'),
    )

    SUPPORTED_VERSIONS = frozenset({"1.0.0"})

    MAX_CONTEXT_ELEMENTS = 200
    MAX_OCR_REGIONS = 50
    MAX_TASK_LENGTH = 2000
    MAX_REQUEST_BYTES = 1048576

    ELEMENT_ID_PATTERN = re.compile(r'^el_[a-zA-Z0-9]{8,}$')
    PII_REGION_ID_PATTERN = re.compile(r'^pii_[a-zA-Z0-9]{8,}$')
    OCR_REGION_ID_PATTERN = re.compile(r'^ocr_[a-zA-Z0-9]{8,}$')
    UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)

    def __init__(self):
        self.settings = get_settings()

    def validate_request(self, raw_data: dict[str, Any]) -> ValidationResult:
        violations = []

        if self._estimate_size(raw_data) > self.MAX_REQUEST_BYTES:
            violations.append("Request exceeds maximum size")

        version = raw_data.get("version")
        if version not in self.SUPPORTED_VERSIONS:
            violations.append(f"Unsupported protocol version: {version}")

        request_id = raw_data.get("request_id")
        session_id = raw_data.get("session_id")
        if not self._is_valid_uuid(request_id):
            violations.append("Invalid request_id format")
        if not self._is_valid_uuid(session_id):
            violations.append("Invalid session_id format")

        task = raw_data.get("task", "")
        if len(task) > self.MAX_TASK_LENGTH:
            violations.append(f"Task exceeds maximum length ({self.MAX_TASK_LENGTH})")

        context = raw_data.get("context", {})
        if context:
            context_violations = self._validate_context(context)
            violations.extend(context_violations)

        forbidden_violations = self._scan_forbidden_fields(raw_data)
        violations.extend(forbidden_violations)

        return ValidationResult(
            valid=len(violations) == 0,
            violations=violations,
            safe_message="Payload validation failed" if violations else ""
        )

    def _validate_context(self, context: dict[str, Any]) -> list[str]:
        violations = []

        privacy = context.get("privacy", {})
        if not privacy.get("verified", False):
            violations.append("Privacy verification must be true")

        elements = context.get("elements", [])
        if len(elements) > self.MAX_CONTEXT_ELEMENTS:
            violations.append(f"Element count exceeds maximum: {len(elements)} > {self.MAX_CONTEXT_ELEMENTS}")

        for i, element in enumerate(elements):
            elem_violations = self._validate_element(element, i)
            violations.extend(elem_violations)

        ocr_regions = context.get("ocr_regions", [])
        if len(ocr_regions) > self.MAX_OCR_REGIONS:
            violations.append(f"OCR region count exceeds maximum: {len(ocr_regions)}")

        for ocr in ocr_regions:
            if not self.OCR_REGION_ID_PATTERN.match(ocr.get("region_id", "")):
                violations.append(f"Invalid OCR region ID format: {ocr.get('region_id')}")

        viewport = context.get("viewport", {})
        if not all(k in viewport for k in ("width", "height", "device_pixel_ratio")):
            violations.append("Viewport missing required fields")

        return violations

    def _validate_element(self, element: dict[str, Any], index: int) -> list[str]:
        violations = []

        element_id = element.get("element_id")
        if not element_id:
            violations.append(f"Element {index}: missing element_id")
        elif not self.ELEMENT_ID_PATTERN.match(element_id):
            violations.append(f"Element {index}: invalid element_id format: {element_id}")

        tag = element.get("tag")
        if not tag:
            violations.append(f"Element {index}: missing tag")

        if "is_interactive" in element and not isinstance(element["is_interactive"], bool):
            violations.append(f"Element {index}: is_interactive must be boolean")

        bbox = element.get("bounding_box")
        if bbox:
            if not all(k in bbox for k in ("x", "y", "width", "height")):
                violations.append(f"Element {index}: bounding_box missing required fields")

        pii_regions = element.get("pii_regions", [])
        for pii in pii_regions:
            if not self.PII_REGION_ID_PATTERN.match(pii.get("region_id", "")):
                violations.append(f"Element {index}: invalid PII region ID: {pii.get('region_id')}")
            token = pii.get("token")
            if token and not self.PII_TOKEN_PATTERN.match(token):
                violations.append(f"Element {index}: invalid PII token: {token}")

        return violations

    def _scan_forbidden_fields(self, obj: Any, path: str = "") -> list[str]:
        violations = []

        if isinstance(obj, dict):
            for key, value in obj.items():
                current_path = f"{path}.{key}" if path else key

                if key.lower() in self.FORBIDDEN_FIELDS:
                    if not self._is_safe_placeholder(value):
                        violations.append(f"Forbidden field detected at {current_path}: {key}")

                violations.extend(self._scan_forbidden_fields(value, current_path))

        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                violations.extend(self._scan_forbidden_fields(item, f"{path}[{i}]"))
        elif (
            isinstance(obj, str)
            and path.rsplit(".", 1)[-1] not in {"request_id", "session_id"}
            and not self.PII_TOKEN_PATTERN.match(obj)
        ):
            if any(pattern.search(obj) for pattern in self.RAW_PII_PATTERNS):
                violations.append(f"Raw sensitive value detected at {path}")

        return violations

    def _is_safe_placeholder(self, value: Any) -> bool:
        if isinstance(value, str):
            return bool(self.PII_TOKEN_PATTERN.match(value))
        return False

    def _is_valid_uuid(self, value: Any) -> bool:
        if not isinstance(value, str):
            return False
        return bool(self.UUID_PATTERN.match(value))

    def _estimate_size(self, obj: Any) -> int:
        return len(json.dumps(obj, separators=(",", ":")))


def create_payload_validator() -> PayloadValidator:
    return PayloadValidator()