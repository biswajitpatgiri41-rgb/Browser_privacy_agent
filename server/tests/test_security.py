"""Tests for security layer."""
import pytest
from app.security import (
    create_payload_validator,
    create_prompt_injection_detector,
    ValidationResult,
    InjectionResult
)


class TestPayloadValidator:
    """Tests for deterministic payload validation."""

    def setup_method(self):
        self.validator = create_payload_validator()

    def create_valid_request(self) -> dict:
        return {
            "version": "1.0.0",
            "request_id": "123e4567-e89b-12d3-a456-426614174000",
            "session_id": "123e4567-e89b-12d3-a456-426614174001",
            "task": "Click the button",
            "context": {
                "url": "https://example.com",
                "viewport": {"width": 1920, "height": 1080, "device_pixel_ratio": 1.0},
                "elements": [
                    {
                        "element_id": "el_abc12345",
                        "tag": "button",
                        "safe_label": "Submit",
                        "role": "button",
                        "is_interactive": True,
                        "bounding_box": {"x": 100, "y": 100, "width": 200, "height": 50}
                    }
                ],
                "privacy": {"pii_detected": False, "pii_types": [], "verified": True},
                "ocr_regions": []
            }
        }

    def test_valid_request_passes(self):
        request = self.create_valid_request()
        result = self.validator.validate_request(request)

        assert result.valid is True
        assert result.violations == []

    def test_invalid_version_fails(self):
        request = self.create_valid_request()
        request["version"] = "2.0.0"
        result = self.validator.validate_request(request)

        assert result.valid is False
        assert any("Unsupported protocol version" in v for v in result.violations)

    def test_invalid_request_id_fails(self):
        request = self.create_valid_request()
        request["request_id"] = "invalid-uuid"
        result = self.validator.validate_request(request)

        assert result.valid is False
        assert any("Invalid request_id format" in v for v in result.violations)

    def test_invalid_session_id_fails(self):
        request = self.create_valid_request()
        request["session_id"] = "invalid-uuid"
        result = self.validator.validate_request(request)

        assert result.valid is False
        assert any("Invalid session_id format" in v for v in result.violations)

    def test_long_task_fails(self):
        request = self.create_valid_request()
        request["task"] = "x" * 2500
        result = self.validator.validate_request(request)

        assert result.valid is False
        assert any("Task exceeds maximum length" in v for v in result.violations)

    def test_unverified_privacy_fails(self):
        request = self.create_valid_request()
        request["context"]["privacy"]["verified"] = False
        result = self.validator.validate_request(request)

        assert result.valid is False
        assert any("Privacy verification must be true" in v for v in result.violations)

    def test_excessive_elements_fails(self):
        request = self.create_valid_request()
        for i in range(250):
            request["context"]["elements"].append({
                "element_id": f"el_{i:08d}",
                "tag": "div",
                "is_interactive": False
            })
        result = self.validator.validate_request(request)

        assert result.valid is False
        assert any("Element count exceeds maximum" in v for v in result.violations)

    def test_invalid_element_id_format_fails(self):
        request = self.create_valid_request()
        request["context"]["elements"][0]["element_id"] = "invalid_id"
        result = self.validator.validate_request(request)

        assert result.valid is False
        assert any("invalid element_id format" in v for v in result.violations)

    def test_forbidden_fields_detected(self):
        request = self.create_valid_request()
        request["context"]["elements"][0]["password_value"] = "secret123"
        result = self.validator.validate_request(request)

        assert result.valid is False
        assert any("Forbidden field detected" in v for v in result.violations)

    def test_forbidden_fields_allow_safe_placeholders(self):
        request = self.create_valid_request()
        request["context"]["elements"][0]["password_value"] = "[PASSWORD]"
        result = self.validator.validate_request(request)

        assert result.valid is True