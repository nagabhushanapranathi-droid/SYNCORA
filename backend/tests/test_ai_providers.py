import pytest
import os
import json
from unittest.mock import patch, MagicMock
from app.ai.provider_manager import (
    AIProviderManager,
    GeminiProvider,
    FreeLLMAPIProvider,
    OpenAICompatibleProvider,
    mask_secret,
    get_recent_errors,
    get_usage_metrics,
    _USAGE_METRICS,
)


def test_provider_registration_and_status():
    manager = AIProviderManager()
    assert 'gemini' in manager.providers
    assert 'freellmapi' in manager.providers
    assert 'openai' in manager.providers

    statuses = manager.get_all_provider_status()
    assert len(statuses) == 3
    names = [s['name'] for s in statuses]
    assert 'gemini' in names
    assert 'freellmapi' in names
    assert 'openai' in names


def test_mask_secret():
    assert mask_secret("") == "Not configured"
    assert mask_secret(None) == "Not configured"
    assert mask_secret("short") == "***"
    assert mask_secret("AIzaSyD-1234567890abcdef") == "AIza...cdef"


def test_provider_unconfigured_availability():
    with patch.dict(os.environ, {'GOOGLE_API_KEY': '', 'GEMINI_API_KEY': ''}):
        prov = GeminiProvider()
        assert prov.is_configured() is False
        avail, msg = prov.check_availability()
        assert avail is False
        assert "not configured" in msg.lower()


def test_primary_and_fallback_provider_selection():
    with patch.dict(os.environ, {
        'AI_PRIMARY_PROVIDER': 'gemini',
        'AI_FALLBACK_PROVIDER': 'freellmapi'
    }):
        manager = AIProviderManager()
        assert manager.get_primary_provider_name() == 'gemini'
        assert manager.get_fallback_provider_name() == 'freellmapi'


def test_fallback_when_primary_fails():
    manager = AIProviderManager()

    # Mock primary (gemini) failing and secondary (freellmapi) succeeding
    mock_gemini = MagicMock()
    mock_gemini.is_configured.return_value = True
    mock_gemini.generate.side_effect = RuntimeError("Quota exceeded on primary provider")

    mock_freellm = MagicMock()
    mock_freellm.is_configured.return_value = True
    mock_freellm.default_model = "llama-3.3-70b"
    mock_freellm.generate.return_value = "Response from FreeLLMAPI fallback"

    manager.providers['gemini'] = mock_gemini
    manager.providers['freellmapi'] = mock_freellm

    with patch.dict(os.environ, {
        'AI_PRIMARY_PROVIDER': 'gemini',
        'AI_FALLBACK_PROVIDER': 'freellmapi'
    }):
        text, provider_used, model_used = manager.generate_with_fallback("Test prompt")
        assert text == "Response from FreeLLMAPI fallback"
        assert provider_used == "freellmapi"
        assert mock_gemini.generate.called
        assert mock_freellm.generate.called


def test_generate_structured_json_clean_and_fenced():
    manager = AIProviderManager()

    # Case 1: Pure JSON string returned by LLM
    mock_prov = MagicMock()
    mock_prov.is_configured.return_value = True
    mock_prov.default_model = "gemini-2.0-flash"
    mock_prov.generate.return_value = '{"title": "Algorithms", "duration": 60}'

    manager.providers['gemini'] = mock_prov

    with patch.dict(os.environ, {'AI_PRIMARY_PROVIDER': 'gemini'}):
        data, prov, model = manager.generate_structured_json("Generate lesson")
        assert data['title'] == "Algorithms"
        assert data['duration'] == 60
        assert prov == "gemini"

    # Case 2: JSON wrapped in markdown ```json ... ``` code fence with extra explanation
    mock_prov.generate.return_value = """Here is the lesson plan:
```json
{
    "lesson_title": "Linked Lists",
    "topics_to_cover": ["Singly", "Doubly"],
    "learning_objectives": ["Understand node pointer relationships"]
}
```
Hope this helps!"""

    with patch.dict(os.environ, {'AI_PRIMARY_PROVIDER': 'gemini'}):
        data, prov, model = manager.generate_structured_json("Generate lesson")
        assert data['lesson_title'] == "Linked Lists"
        assert len(data['topics_to_cover']) == 2
        assert len(data['learning_objectives']) == 1


def test_safe_error_handling_when_no_provider_configured():
    manager = AIProviderManager()
    for prov in manager.providers.values():
        prov.is_configured = MagicMock(return_value=False)

    with pytest.raises(RuntimeError) as exc_info:
        manager.generate_with_fallback("Test query")
    assert "No AI provider configured" in str(exc_info.value)
