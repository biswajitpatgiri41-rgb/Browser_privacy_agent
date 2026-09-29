import asyncio

from app.config import Settings
from app.llm import create_planner_backend


def test_default_planner_backend_is_transformers():
    settings = Settings()
    assert settings.planner_backend == "transformers"


def test_temporary_backend_health_and_plan():
    backend = create_planner_backend("temporary")
    assert backend.get_backend_name() == "temporary"

    async def run_check():
        assert await backend.health_check() is True
        plan = await backend.plan({
            "task": "Click the login button",
            "sanitized_context": {
                "elements": [
                    {"element_id": "el_12345678", "tag": "button", "safe_label": "Login", "is_interactive": True}
                ],
                "privacy": {"verified": True},
            },
            "allowed_actions": ["click", "scroll", "select", "navigate", "wait", "finish"],
            "privacy_metadata": {"verified": True},
            "step": 1,
        })
        assert plan.action["action"] == "click"
        assert plan.action["element_id"] == "el_12345678"
        assert plan.confidence >= 0.0

    asyncio.run(run_check())
