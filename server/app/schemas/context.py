"""Context schemas for sanitized browser context."""
from enum import Enum
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator
from .action import ActionType


class BoundingBox(BaseModel):
    """Bounding box in viewport coordinates."""
    x: float = Field(ge=0)
    y: float = Field(ge=0)
    width: float = Field(ge=0)
    height: float = Field(ge=0)


class Viewport(BaseModel):
    """Viewport information."""
    width: int = Field(ge=1)
    height: int = Field(ge=1)
    device_pixel_ratio: float = Field(ge=0.5, le=4)


class InputType(str, Enum):
    """Input element types."""
    TEXT = "text"
    PASSWORD = "password"
    EMAIL = "email"
    TEL = "tel"
    SEARCH = "search"
    URL = "url"
    NUMBER = "number"
    DATE = "date"
    CHECKBOX = "checkbox"
    RADIO = "radio"
    SUBMIT = "submit"
    BUTTON = "button"
    HIDDEN = "hidden"
    FILE = "file"
    OTHER = "other"


class ElementTag(str, Enum):
    """HTML element tags."""
    BUTTON = "button"
    INPUT = "input"
    SELECT = "select"
    TEXTAREA = "textarea"
    A = "a"
    DIV = "div"
    SPAN = "span"
    FORM = "form"
    IMG = "img"
    IFRAME = "iframe"
    TABLE = "table"
    OTHER = "other"


class PIIType(str, Enum):
    """PII type tokens."""
    EMAIL = "EMAIL"
    PASSWORD = "PASSWORD"
    PERSON = "PERSON"
    PHONE = "PHONE"
    ADDRESS = "ADDRESS"
    SECRET = "SECRET"
    CREDIT_CARD = "CREDIT_CARD"
    SSN = "SSN"
    API_KEY = "API_KEY"
    TOKEN = "TOKEN"
    FACE_REGION = "FACE_REGION"
    OTHER = "OTHER"


class PIIRegion(BaseModel):
    """PII region within an element."""
    region_id: str = Field(pattern=r"^pii_[a-zA-Z0-9]{8,}$")
    type: PIIType
    bbox: BoundingBox
    token: str = Field(pattern=r"^\[[A-Z_]+\]$")
    confidence: float = Field(ge=0.0, le=1.0)


class SanitizedElement(BaseModel):
    """Sanitized DOM element."""
    element_id: str = Field(pattern=r"^el_[a-zA-Z0-9]{8,}$")
    tag: ElementTag
    role: str
    bbox: BoundingBox
    safe_label: str = Field(max_length=100)
    input_type: Optional[InputType] = None
    is_interactive: bool = True
    is_visible: bool = True
    attributes: Dict[str, str] = Field(default_factory=dict, max_length=10)
    pii_regions: List[PIIRegion] = Field(default_factory=list)


class OCRRegion(BaseModel):
    """OCR region with tokenized text."""
    region_id: str = Field(pattern=r"^ocr_[a-zA-Z0-9]{8,}$")
    bbox: BoundingBox
    tokenized_text: str = Field(max_length=500)


class PrivacyMetadata(BaseModel):
    """Privacy verification metadata."""
    verified: bool
    pii_detected: int = Field(ge=0)
    redaction_applied: int = Field(ge=0)
    token_map: Dict[str, int] = Field(default_factory=dict)


class SanitizedContext(BaseModel):
    """Sanitized browser context sent to backend."""
    version: Literal["1.0.0"] = "1.0.0"
    request_id: str = Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    session_id: str = Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    url: str
    title: Optional[str] = Field(default=None, max_length=200)
    elements: List[SanitizedElement] = Field(default_factory=list, max_length=200)
    viewport: Viewport
    privacy: PrivacyMetadata
    ocr_regions: List[OCRRegion] = Field(default_factory=list, max_length=50)

    @field_validator("privacy")
    @classmethod
    def validate_privacy_verified(cls, v: PrivacyMetadata) -> PrivacyMetadata:
        if not v.verified:
            raise ValueError("privacy.verified must be true")
        return v

    model_config = {
        "extra": "forbid",
        "use_enum_values": True,
    }
