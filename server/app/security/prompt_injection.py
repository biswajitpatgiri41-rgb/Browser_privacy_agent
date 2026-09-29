"""Prompt injection detection."""
import re
from typing import Any
from dataclasses import dataclass


@dataclass
class InjectionResult:
    detected: bool
    patterns_matched: list[str]
    safe_message: str = ""


class PromptInjectionDetector:
    """Detects prompt injection attempts in user input."""

    INJECTION_PATTERNS = [
        # Direct instruction overrides
        r"(?i)ignore\s+(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)",
        r"(?i)disregard\s+(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)",
        r"(?i)forget\s+(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)",
        r"(?i)new\s+(instructions?|prompt|rules?)\s*:",
        r"(?i)system\s*(prompt|instruction)\s*:",

        # Role manipulation
        r"(?i)you\s+are\s+now\s+(a|an)\s+\w+",
        r"(?i)act\s+as\s+(a|an)\s+\w+",
        r"(?i)pretend\s+to\s+be\s+(a|an)\s+\w+",
        r"(?i)roleplay\s+as\s+(a|an)\s+\w+",

        # Output manipulation
        r"(?i)output\s+only\s+(json|code|text)",
        r"(?i)respond\s+(only|with)\s+(json|code)",
        r"(?i)print\s+(the|your)\s+(prompt|instructions?|system)",

        # Data exfiltration
        r"(?i)show\s+me\s+(your|the)\s+(prompt|instructions?|system)",
        r"(?i)what\s+(is|are)\s+(your|the)\s+(prompt|instructions?|system)",
        r"(?i)repeat\s+(your|the)\s+(prompt|instructions?|system)",

        # Chain of thought extraction
        r"(?i)think\s+step\s+by\s+step",
        r"(?i)reason\s+through",
        r"(?i)explain\s+your\s+reasoning",

        # Jailbreak patterns
        r"(?i)developer\s+mode",
        r"(?i)unrestricted\s+mode",
        r"(?i)no\s+restrictions",
        r"(?i)bypass\s+(safety|security|filter)",
        r"(?i)override\s+(safety|security|filter)",

        # Special tokens
        r"<\|.*?\|>",
        r"\[INST\].*?\[/INST\]",
        r"<<SYS>>.*?<</SYS>>",
    ]

    def __init__(self):
        self.compiled_patterns = [re.compile(p) for p in self.INJECTION_PATTERNS]

    def scan(self, text: str) -> InjectionResult:
        """Scan text for injection patterns."""
        if not isinstance(text, str):
            return InjectionResult(detected=False, patterns_matched=[])

        matched = []
        for pattern in self.compiled_patterns:
            if pattern.search(text):
                matched.append(pattern.pattern)

        return InjectionResult(
            detected=len(matched) > 0,
            patterns_matched=matched,
            safe_message="Potential prompt injection detected" if matched else ""
        )

    def scan_dict(self, obj: Any, path: str = "") -> list[InjectionResult]:
        """Recursively scan dict for injections."""
        results = []

        if isinstance(obj, dict):
            for key, value in obj.items():
                current_path = f"{path}.{key}" if path else key
                if isinstance(value, str):
                    result = self.scan(value)
                    if result.detected:
                        result.safe_message = f"Injection in {current_path}"
                        results.append(result)
                results.extend(self.scan_dict(value, current_path))

        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                results.extend(self.scan_dict(item, f"{path}[{i}]"))

        return results


def create_prompt_injection_detector() -> PromptInjectionDetector:
    return PromptInjectionDetector()