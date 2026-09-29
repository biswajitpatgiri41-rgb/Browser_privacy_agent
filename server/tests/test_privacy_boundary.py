"""Regression tests for the server-side privacy boundary."""

from copy import deepcopy

import pytest

from app.security.payload_validator import create_payload_validator


BASE_REQUEST = {
    "version": "1.0.0",
    "request_id": "11111111-1111-4111-8111-111111111111",
    "session_id": "22222222-2222-4222-8222-222222222222",
    "task": "Continue safely",
    "context": {
        "privacy": {"verified": True},
        "elements": [],
        "ocr_regions": [],
        "viewport": {"width": 1280, "height": 720, "device_pixel_ratio": 1},
    },
}


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("safe_label", "contact user@example.com"),
        ("safe_label", "call +1 555-123-4567"),
        ("safe_label", "card 4111 1111 1111 1111"),
        ("password_value", "raw-password-value"),
        ("cookie", "session-cookie-value"),
        ("authorization", "Bearer raw-token-value"),
        ("api_key", "raw-api-key-value"),
        ("secret_value", "raw-secret-value"),
    ],
)
def test_raw_sensitive_fields_are_rejected(field, value):
    request = deepcopy(BASE_REQUEST)
    request["context"]["elements"] = [{
        "element_id": "el_abcdefgh",
        "tag": "input",
        "safe_label": "field",
        field: value,
    }]

    result = create_payload_validator().validate_request(request)

    assert result.valid is False
    assert result.violations


@pytest.mark.parametrize("placeholder", ["[EMAIL]", "[PHONE]", "[PASSWORD]", "[CREDIT_CARD]"])
def test_canonical_placeholders_are_allowed(placeholder):
    request = deepcopy(BASE_REQUEST)
    request["context"]["elements"] = [{
        "element_id": "el_abcdefgh",
        "tag": "input",
        "password_value": placeholder,
    }]

    result = create_payload_validator().validate_request(request)

    assert result.valid is True
