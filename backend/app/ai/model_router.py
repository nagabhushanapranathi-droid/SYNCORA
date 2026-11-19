import os
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


class TaskType:
    FAST = "fast"                    # Notifications, simple queries, greetings
    REASONING = "reasoning"          # Lesson planning, syllabus alignment, continuity
    BALANCED = "balanced"            # General assistant questions, pedagogical advice
    ANALYTICS = "analytics"          # Executive reports, workload balance analysis


class ModelRouter:
    """
    Task-aware model router for FreeLLMAPI.
    Maps high-level application tasks to appropriate FreeLLMAPI models.
    Supports environment variable overrides, dynamic model discovery matching,
    and automatic fallback to default models.
    """

    def __init__(self, provider=None):
        self._provider = provider

    def set_provider(self, provider):
        self._provider = provider

    def resolve_model(self, task_type: str = TaskType.BALANCED, requested_model: Optional[str] = None) -> str:
        """
        Determine the most suitable model name for a given task.
        Priority:
        1. Explicitly requested model by caller
        2. Task-specific environment variable override
        3. Dynamic match against available models discovered from FreeLLMAPI
        4. Global default model
        """
        if requested_model and requested_model.strip():
            return requested_model.strip()

        # Check task-specific environment variable overrides
        env_map = {
            TaskType.FAST: os.environ.get("FREELLMAPI_MODEL_FAST", "").strip(),
            TaskType.REASONING: os.environ.get("FREELLMAPI_MODEL_REASONING", "").strip(),
            TaskType.BALANCED: os.environ.get("FREELLMAPI_MODEL_BALANCED", "").strip(),
            TaskType.ANALYTICS: os.environ.get("FREELLMAPI_MODEL_ANALYTICS", "").strip(),
        }

        override = env_map.get(task_type)
        if override:
            return override

        # Dynamic match against discovered models if provider is available
        if self._provider and hasattr(self._provider, "get_available_models"):
            discovered = self._provider.get_available_models()
            matched = self._match_discovered_model(discovered, task_type)
            if matched:
                return matched

        # Global default fallback
        default_model = (
            os.environ.get("FREELLMAPI_DEFAULT_MODEL", "").strip() or
            os.environ.get("FREELLM_MODEL", "").strip() or
            "auto"
        )
        return default_model

    def _match_discovered_model(self, models: List[Dict[str, Any]], task_type: str) -> Optional[str]:
        """Match task type to candidate model from discovered models list."""
        if not models:
            return None

        model_ids = [m.get("id", "").lower() for m in models if m.get("id")]

        if task_type == TaskType.FAST:
            for mid in model_ids:
                if any(k in mid for k in ["flash", "8b", "instant", "mini", "haiku", "fast"]):
                    return mid

        elif task_type in (TaskType.REASONING, TaskType.ANALYTICS):
            for mid in model_ids:
                if any(k in mid for k in ["pro", "70b", "reasoning", "sonnet", "large", "instruct"]):
                    return mid

        elif task_type == TaskType.BALANCED:
            for mid in model_ids:
                if any(k in mid for k in ["balanced", "3.3", "2.0", "chat", "standard"]):
                    return mid

        # If no specific tag matched, return first available or None
        return model_ids[0] if model_ids else None


# Global singleton router
router = ModelRouter()
