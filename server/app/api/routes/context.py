"""Context validation endpoint."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import create_context_parser
from app.security import create_payload_validator, ValidationResult
from app.utils.logging import get_logger

router = APIRouter(prefix="/api/v1/context", tags=["context"])

logger = get_logger("context")


class ContextValidationRequest(BaseModel):
    context: dict


class ContextValidationResponse(BaseModel):
    valid: bool
    warnings: list[str]
    summary: dict | None = None


@router.post("/validate", response_model=ContextValidationResponse)
async def validate_context(request: ContextValidationRequest):
    """Validate a sanitized context without planning."""
    parser = create_context_parser()
    validator = create_payload_validator()

    # Validate context structure
    try:
        context = parser.parse_context(request.context)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid context: {e}")

    warnings = parser.validate_context_integrity(context)

    # Also run payload validator on context
    payload_result: ValidationResult = validator.validate_request({"context": request.context})
    if not payload_result.valid:
        warnings.extend(payload_result.violations)

    return ContextValidationResponse(
        valid=len(warnings) == 0,
        warnings=warnings,
        summary=parser.get_context_summary(context)
    )


@router.post("/parse", response_model=dict)
async def parse_context(request: ContextValidationRequest):
    """Parse and return structured context."""
    parser = create_context_parser()

    try:
        context = parser.parse_context(request.context)
        return context.model_dump()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid context: {e}")