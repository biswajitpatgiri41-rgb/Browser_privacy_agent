"""Context parsing and sanitization utilities."""
from typing import Any
from app.schemas.context import SanitizedContext, SanitizedElement, PrivacyMetadata, Viewport, BoundingBox, PIIRegion, OCRRegion


class ContextParser:
    """Parses and validates incoming context from extension."""

    def __init__(self):
        pass

    def parse_context(self, raw_context: dict[str, Any]) -> SanitizedContext:
        """Parse raw context dict into SanitizedContext model."""
        return SanitizedContext.model_validate(raw_context)

    def extract_interactive_elements(self, context: SanitizedContext) -> list[SanitizedElement]:
        """Extract only interactive elements from context."""
        return [e for e in context.elements if e.is_interactive]

    def get_element_by_id(self, context: SanitizedContext, element_id: str) -> SanitizedElement | None:
        """Find element by ID."""
        for element in context.elements:
            if element.element_id == element_id:
                return element
        return None

    def get_context_summary(self, context: SanitizedContext) -> dict[str, Any]:
        """Generate a summary of context for logging/metrics."""
        interactive = self.extract_interactive_elements(context)
        return {
            "url": context.url,
            "total_elements": len(context.elements),
            "interactive_elements": len(interactive),
            "pii_detected": context.privacy.pii_detected,
            "ocr_regions": len(context.ocr_regions),
            "viewport": f"{context.viewport.width}x{context.viewport.height}"
        }

    def validate_context_integrity(self, context: SanitizedContext) -> list[str]:
        """Validate context integrity, return list of warnings."""
        warnings = []

        if not context.privacy.verified:
            warnings.append("Privacy verification failed")

        if len(context.elements) > 200:
            warnings.append(f"Element count exceeds limit: {len(context.elements)}")

        if len(context.ocr_regions) > 50:
            warnings.append(f"OCR region count exceeds limit: {len(context.ocr_regions)}")

        # Check for duplicate element IDs
        element_ids = [e.element_id for e in context.elements]
        if len(element_ids) != len(set(element_ids)):
            warnings.append("Duplicate element IDs detected")

        # Check for elements with missing required fields
        for element in context.elements:
            if not element.element_id:
                warnings.append("Element missing element_id")
            if not element.tag:
                warnings.append(f"Element {element.element_id} missing tag")

        return warnings


def create_context_parser() -> ContextParser:
    return ContextParser()