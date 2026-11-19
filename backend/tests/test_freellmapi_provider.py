import os
import json
import pytest
from unittest.mock import patch, MagicMock
import requests

from app.ai.providers.freellmapi_provider import (
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
from app.ai.model_router import ModelRouter, TaskType
from app.ai.provider_manager import AIProviderManager


def test_freellmapi_provider_configuration():
    """Verify configuration reading, normalization, and defaults."""
    with patch.dict(os.environ, {
        "FREELLMAPI_API_KEY": "freellmapi-test-key-1234567890",
        "FREELLMAPI_BASE_URL": "http://127.0.0.1:3001/v1/",
        "FREELLMAPI_DEFAULT_MODEL": "gemini-2.5-flash",
        "FREELLMAPI_TIMEOUT": "45",
        "FREELLMAPI_MAX_RETRIES": "3",
        "SYNCORA_AI_ENABLED": "true"
    }):
        provider = FreeLLMAPIProvider()
        assert provider.is_configured() is True
        assert provider.get_api_key() == "freellmapi-test-key-1234567890"
        assert provider.get_base_url() == "http://127.0.0.1:3001/v1"
        assert provider.get_default_model() == "gemini-2.5-flash"
        assert provider.get_timeout() == 45
        assert provider.get_max_retries() == 3
        assert provider.is_ai_enabled() is True


def test_mask_api_key():
    """Verify safe masking of API credentials."""
    assert mask_api_key(None) == "Not configured"
    assert mask_api_key("") == "Not configured"
    assert mask_api_key("12345") == "***"
    assert mask_api_key("freellmapi-6475c2b2c7ec1408ea5b9eb68cd1a8aa09584c3c5daefe1e") == "free...fe1e"


def test_model_discovery_and_ttl_caching():
    """Verify /v1/models endpoint discovery and in-memory TTL caching."""
    provider = FreeLLMAPIProvider()

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "data": [
            {"id": "gemini-2.5-flash", "owned_by": "google", "context_window": 1048576},
            {"id": "gemini-2.5-pro", "owned_by": "google", "context_window": 2097152},
            {"id": "llama-3.3-70b", "owned_by": "meta", "context_window": 131072}
        ]
    }

    with patch.dict(os.environ, {"FREELLMAPI_API_KEY": "test-key"}), \
         patch("requests.get", return_value=mock_resp) as mock_get:
        # First call hits the mock endpoint
        models = provider.get_available_models(force_refresh=True)
        assert len(models) == 3
        assert models[0]["id"] == "gemini-2.5-flash"
        assert models[1]["id"] == "gemini-2.5-pro"
        assert models[2]["id"] == "llama-3.3-70b"
        assert mock_get.call_count == 1

        # Second call uses in-memory cache
        cached_models = provider.get_available_models(force_refresh=False)
        assert len(cached_models) == 3
        assert mock_get.call_count == 1  # Not called again


def test_successful_chat_completion_and_telemetry():
    """Verify successful chat completion request formatting, headers, and token metrics."""
    provider = FreeLLMAPIProvider()

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "id": "chatcmpl-123",
        "object": "chat.completion",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": "Welcome to SYNCORA class coverage."},
                "finish_reason": "stop"
            }
        ],
        "usage": {"prompt_tokens": 42, "completion_tokens": 12, "total_tokens": 54}
    }

    with patch.dict(os.environ, {"FREELLMAPI_API_KEY": "test-key"}), \
         patch("requests.post", return_value=mock_resp) as mock_post:
        result = provider.generate(
            prompt="Hello assistant",
            system_instruction="Be helpful.",
            model="gemini-2.5-flash"
        )
        assert result == "Welcome to SYNCORA class coverage."
        assert mock_post.call_count == 1

        # Verify sent headers
        args, kwargs = mock_post.call_args
        headers = kwargs.get("headers", {})
        assert headers.get("Authorization") == "Bearer test-key"
        assert headers.get("X-App-Name") == "SYNCORA"
        assert headers.get("X-Routed-Via") == "freellmapi"
        assert "X-Fallback-Attempts" in headers

        # Verify payload
        payload = kwargs.get("json", {})
        assert payload.get("model") == "gemini-2.5-flash"
        assert len(payload.get("messages")) == 2

        # Verify recorded metrics
        assert provider.metrics["successes"] == 1
        assert provider.metrics["prompt_tokens"] == 42
        assert provider.metrics["completion_tokens"] == 12


def test_structured_json_clean_and_fenced_extraction():
    """Verify structured JSON output parsing with markdown code fence extraction."""
    provider = FreeLLMAPIProvider()

    # Case 1: Pure JSON
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": '{"lesson_title": "Binary Trees", "duration": 50}'}}]
    }

    with patch.dict(os.environ, {"FREELLMAPI_API_KEY": "test-key"}), \
         patch("requests.post", return_value=mock_resp):
        res = provider.generate_structured(prompt="Generate tree lesson")
        assert res["lesson_title"] == "Binary Trees"
        assert res["duration"] == 50

    # Case 2: Markdown fenced JSON with commentary
    mock_resp.json.return_value = {
        "choices": [{
            "message": {
                "content": "Here is the result:\n```json\n{\n  \"unit\": \"Hashing\",\n  \"objectives\": [\"O1\", \"O2\"]\n}\n```\nGood luck!"
            }
        }]
    }

    with patch.dict(os.environ, {"FREELLMAPI_API_KEY": "test-key"}), \
         patch("requests.post", return_value=mock_resp):
        res2 = provider.generate_structured(prompt="Generate hashing lesson")
        assert res2["unit"] == "Hashing"
        assert len(res2["objectives"]) == 2


def test_malformed_json_raises_classified_error():
    """Verify malformed unparseable JSON raises FreeLLMAPIMalformedResponseError."""
    provider = FreeLLMAPIProvider()

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "This is plain prose without any JSON structure whatsoever."}}]
    }

    with patch.dict(os.environ, {"FREELLMAPI_API_KEY": "test-key"}), \
         patch("requests.post", return_value=mock_resp):
        with pytest.raises(FreeLLMAPIMalformedResponseError):
            provider.generate_structured(prompt="Generate plan")


def test_auth_error_not_retried():
    """Verify HTTP 401/403 raises FreeLLMAPIAuthError immediately without retrying."""
    provider = FreeLLMAPIProvider()

    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_resp.text = "Unauthorized: Invalid API key provided"

    with patch.dict(os.environ, {"FREELLMAPI_API_KEY": "bad-key", "FREELLMAPI_MAX_RETRIES": "3"}), \
         patch("requests.post", return_value=mock_resp) as mock_post:
        with pytest.raises(FreeLLMAPIAuthError) as exc_info:
            provider.generate("Test prompt")

        assert exc_info.value.status_code == 401
        assert "Invalid API key" in str(exc_info.value)
        # Auth error must fail immediately on attempt 1 without wasteful retries
        assert mock_post.call_count == 1


def test_rate_limit_429_backoff_and_retry_success():
    """Verify HTTP 429 rate limit triggers exponential backoff and succeeds on retry."""
    provider = FreeLLMAPIProvider()

    fail_resp = MagicMock()
    fail_resp.status_code = 429
    fail_resp.text = "Rate limit exceeded"
    fail_resp.headers = {"Retry-After": "0.01"}

    success_resp = MagicMock()
    success_resp.status_code = 200
    success_resp.json.return_value = {
        "choices": [{"message": {"content": "Recovered after rate limit backoff"}}]
    }

    with patch.dict(os.environ, {"FREELLMAPI_API_KEY": "test-key", "FREELLMAPI_MAX_RETRIES": "2"}), \
         patch("requests.post", side_effect=[fail_resp, success_resp]) as mock_post, \
         patch("time.sleep"):
        text = provider.generate("Test prompt")
        assert text == "Recovered after rate limit backoff"
        assert mock_post.call_count == 2
        assert provider.metrics["retries"] == 1


def test_server_error_503_retry_and_recovery():
    """Verify HTTP 503 gateway failure triggers retry and succeeds on subsequent attempt."""
    provider = FreeLLMAPIProvider()

    fail_resp = MagicMock()
    fail_resp.status_code = 503
    fail_resp.text = "Service Temporarily Unavailable"

    success_resp = MagicMock()
    success_resp.status_code = 200
    success_resp.json.return_value = {
        "choices": [{"message": {"content": "Service restored"}}]
    }

    with patch.dict(os.environ, {"FREELLMAPI_API_KEY": "test-key", "FREELLMAPI_MAX_RETRIES": "2"}), \
         patch("requests.post", side_effect=[fail_resp, success_resp]) as mock_post, \
         patch("time.sleep"):
        text = provider.generate("Test prompt")
        assert text == "Service restored"
        assert mock_post.call_count == 2


def test_connection_error_raises_classified_exception():
    """Verify host unreachable raises FreeLLMAPIConnectionError."""
    provider = FreeLLMAPIProvider()

    with patch.dict(os.environ, {"FREELLMAPI_API_KEY": "test-key", "FREELLMAPI_MAX_RETRIES": "1"}), \
         patch("requests.post", side_effect=requests.exceptions.ConnectionError("Connection refused")), \
         patch("time.sleep"):
        with pytest.raises(FreeLLMAPIConnectionError):
            provider.generate("Test prompt")


def test_timeout_error_raises_classified_exception():
    """Verify request timeout raises FreeLLMAPITimeoutError."""
    provider = FreeLLMAPIProvider()

    with patch.dict(os.environ, {"FREELLMAPI_API_KEY": "test-key", "FREELLMAPI_MAX_RETRIES": "1"}), \
         patch("requests.post", side_effect=requests.exceptions.Timeout("Read timeout")), \
         patch("time.sleep"):
        with pytest.raises(FreeLLMAPITimeoutError):
            provider.generate("Test prompt")


def test_syncora_ai_disabled_flag():
    """Verify SYNCORA_AI_ENABLED=false prevents network calls and reports availability as false."""
    with patch.dict(os.environ, {"SYNCORA_AI_ENABLED": "false", "FREELLMAPI_API_KEY": "key"}):
        provider = FreeLLMAPIProvider()
        assert provider.is_ai_enabled() is False
        avail, msg, _ = provider.check_availability()
        assert avail is False
        assert "disabled" in msg.lower()

        with pytest.raises(FreeLLMAPIError) as exc_info:
            provider.generate("Test")
        assert "disabled" in str(exc_info.value)


def test_model_router_task_resolution():
    """Verify ModelRouter maps application tasks to appropriate models."""
    router = ModelRouter()

    # 1. Explicit model request takes highest precedence
    assert router.resolve_model(TaskType.FAST, requested_model="custom-model") == "custom-model"

    # 2. Environment variable overrides take second precedence
    with patch.dict(os.environ, {
        "FREELLMAPI_MODEL_FAST": "gemini-2.5-flash",
        "FREELLMAPI_MODEL_REASONING": "gemini-2.5-pro",
        "FREELLMAPI_MODEL_ANALYTICS": "gemini-2.5-pro",
    }):
        assert router.resolve_model(TaskType.FAST) == "gemini-2.5-flash"
        assert router.resolve_model(TaskType.REASONING) == "gemini-2.5-pro"
        assert router.resolve_model(TaskType.ANALYTICS) == "gemini-2.5-pro"

    # 3. Dynamic matching against discovered models
    mock_prov = MagicMock()
    mock_prov.get_available_models.return_value = [
        {"id": "meta-llama-3.1-8b-instant"},
        {"id": "meta-llama-3.3-70b-instruct"},
        {"id": "google-gemini-2.5-flash"}
    ]
    router.set_provider(mock_prov)
    with patch.dict(os.environ, {
        "FREELLMAPI_MODEL_FAST": "",
        "FREELLMAPI_MODEL_REASONING": "",
        "FREELLMAPI_DEFAULT_MODEL": "fallback-model"
    }):
        assert router.resolve_model(TaskType.FAST) == "meta-llama-3.1-8b-instant"
        assert router.resolve_model(TaskType.REASONING) == "meta-llama-3.3-70b-instruct"


def test_ai_provider_manager_routes_through_freellmapi_primary():
    """Verify AIProviderManager defaults to FreeLLMAPI as primary gateway."""
    manager = AIProviderManager()
    assert manager.get_primary_provider_name() == "freellmapi"
    assert "freellmapi" in manager.providers

    # Mock gateway generation
    manager.gateway.is_configured = MagicMock(return_value=True)
    manager.gateway.generate = MagicMock(return_value="Output from FreeLLMAPI Gateway")

    text, prov, model = manager.generate_with_fallback("Prompt", task_type=TaskType.BALANCED)
    assert text == "Output from FreeLLMAPI Gateway"
    assert prov == "freellmapi"
    assert manager.gateway.generate.called
