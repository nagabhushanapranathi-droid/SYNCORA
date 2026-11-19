from app.ai.gemini_service import (
    get_client,
    generate_text,
    explain_recommendation,
    chat_assistant,
    explain_decision,
    generate_daily_report,
)
from app.ai.provider_manager import (
    ai_manager,
    AIProviderManager,
    get_recent_errors,
    get_usage_metrics,
    mask_secret,
)
from app.ai.providers import (
    BaseAIProvider,
    FreeLLMAPIProvider,
    FreeLLMAPIError,
    FreeLLMAPIConnectionError,
    FreeLLMAPIAuthError,
    FreeLLMAPITimeoutError,
    FreeLLMAPIRateLimitError,
    FreeLLMAPIServerError,
    FreeLLMAPIMalformedResponseError,
    mask_api_key,
)
from app.ai.model_router import router, TaskType

__all__ = [
    'get_client',
    'generate_text',
    'explain_recommendation',
    'chat_assistant',
    'explain_decision',
    'generate_daily_report',
    'ai_manager',
    'AIProviderManager',
    'get_recent_errors',
    'get_usage_metrics',
    'mask_secret',
    'BaseAIProvider',
    'FreeLLMAPIProvider',
    'FreeLLMAPIError',
    'FreeLLMAPIConnectionError',
    'FreeLLMAPIAuthError',
    'FreeLLMAPITimeoutError',
    'FreeLLMAPIRateLimitError',
    'FreeLLMAPIServerError',
    'FreeLLMAPIMalformedResponseError',
    'mask_api_key',
    'router',
    'TaskType',
]
