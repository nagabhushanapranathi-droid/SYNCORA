import os
import json
import logging
import time
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

from app.ai.providers.base_provider import BaseAIProvider
from app.ai.providers.freellmapi_provider import (
    FreeLLMAPIProvider as RobustFreeLLMAPIProvider,
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

logger = logging.getLogger(__name__)

# Global in-memory log of recent errors and usage for administrative reporting
_RECENT_ERRORS: List[Dict[str, Any]] = []
_USAGE_METRICS: Dict[str, Dict[str, int]] = {
    'gemini': {'calls': 0, 'successes': 0, 'failures': 0, 'prompt_tokens': 0, 'completion_tokens': 0},
    'freellmapi': {'calls': 0, 'successes': 0, 'failures': 0, 'prompt_tokens': 0, 'completion_tokens': 0},
    'openai': {'calls': 0, 'successes': 0, 'failures': 0, 'prompt_tokens': 0, 'completion_tokens': 0},
    'offline': {'calls': 0, 'successes': 0, 'failures': 0, 'prompt_tokens': 0, 'completion_tokens': 0},
}


def log_ai_error(provider: str, model: str, error_msg: str):
    """Store the most recent errors (capped at 50) for admin inspection."""
    logger.error(f"[AI Provider {provider} - {model}] {error_msg}")
    _RECENT_ERRORS.insert(0, {
        'timestamp': datetime.utcnow().isoformat(),
        'provider': provider,
        'model': model,
        'error': str(error_msg)
    })
    if len(_RECENT_ERRORS) > 50:
        _RECENT_ERRORS.pop()


def get_recent_errors(limit: int = 15) -> List[Dict[str, Any]]:
    return _RECENT_ERRORS[:limit]


def get_usage_metrics() -> Dict[str, Dict[str, int]]:
    return _USAGE_METRICS


def mask_secret(secret: Optional[str]) -> str:
    """Mask a secret key for safe admin visibility without exposing raw credentials."""
    return mask_api_key(secret)


class GeminiProvider(BaseAIProvider):
    """
    Compatibility wrapper for Gemini provider identifier.
    In Phase 2, SYNCORA communicates exclusively through FreeLLMAPI as the central gateway.
    Upstream model routing to Gemini is handled inside FreeLLMAPI.
    """
    def __init__(self):
        super().__init__('gemini')
        self.default_model = os.environ.get('GEMINI_MODEL', 'gemini-2.0-flash')

    def get_api_key(self) -> str:
        return os.environ.get('GOOGLE_API_KEY', '').strip() or os.environ.get('GEMINI_API_KEY', '').strip()

    def is_configured(self) -> bool:
        return bool(self.get_api_key())

    def check_availability(self) -> Tuple[bool, str]:
        key = self.get_api_key()
        if not key:
            return False, "GOOGLE_API_KEY is not configured"
        return True, f"Configured with key ({mask_secret(key)}) - Routed via FreeLLMAPI Gateway"

    def get_available_models(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        return [{'id': self.default_model, 'name': self.default_model, 'owned_by': 'google'}]

    def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        timeout: int = 15
    ) -> str:
        key = self.get_api_key()
        if not key:
            raise ValueError("GOOGLE_API_KEY not configured")

        target_model = model or self.default_model
        _USAGE_METRICS['gemini']['calls'] += 1

        # Use FreeLLMAPI gateway to route to the gemini model
        try:
            free_llm = RobustFreeLLMAPIProvider()
            if free_llm.is_configured():
                res = free_llm.generate(
                    prompt=prompt,
                    system_instruction=system_instruction,
                    model=target_model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=timeout
                )
                _USAGE_METRICS['gemini']['successes'] += 1
                return res
            else:
                # If FreeLLMAPI not configured, record error
                raise RuntimeError("Direct Google Gemini calls disabled in Phase 2; configure FreeLLMAPI gateway.")
        except Exception as e:
            _USAGE_METRICS['gemini']['failures'] += 1
            log_ai_error('gemini', target_model, str(e))
            raise

    def generate_structured(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.3,
        timeout: Optional[int] = None
    ) -> Dict[str, Any]:
        target_model = model or self.default_model
        free_llm = RobustFreeLLMAPIProvider()
        return free_llm.generate_structured(
            prompt=prompt,
            system_instruction=system_instruction,
            model=target_model,
            temperature=temperature,
            timeout=timeout
        )


class FreeLLMAPIProvider(RobustFreeLLMAPIProvider):
    """
    FreeLLMAPI provider inheriting robust gateway capabilities.
    Maintains telemetry sync with global _USAGE_METRICS.
    """
    def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        timeout: Optional[int] = None
    ) -> str:
        _USAGE_METRICS['freellmapi']['calls'] += 1
        target_model = model or self.get_default_model()
        try:
            res = super().generate(
                prompt=prompt,
                system_instruction=system_instruction,
                model=target_model,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout
            )
            _USAGE_METRICS['freellmapi']['successes'] += 1
            _USAGE_METRICS['freellmapi']['prompt_tokens'] = self.metrics['prompt_tokens']
            _USAGE_METRICS['freellmapi']['completion_tokens'] = self.metrics['completion_tokens']
            return res
        except Exception as e:
            _USAGE_METRICS['freellmapi']['failures'] += 1
            log_ai_error('freellmapi', target_model, str(e))
            raise


class OpenAICompatibleProvider(BaseAIProvider):
    """Generic OpenAI-compatible provider abstraction for secondary fallback."""
    def __init__(self):
        super().__init__('openai')
        self.default_model = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')
        self.default_base_url = os.environ.get('OPENAI_API_BASE', 'https://api.openai.com/v1')

    def get_api_key(self) -> str:
        return os.environ.get('OPENAI_API_KEY', '').strip()

    def get_base_url(self) -> str:
        return self.default_base_url.rstrip('/')

    def is_configured(self) -> bool:
        return bool(self.get_api_key())

    def check_availability(self) -> Tuple[bool, str]:
        key = self.get_api_key()
        if not key:
            return False, "OPENAI_API_KEY not configured"
        return True, f"Configured endpoint {self.get_base_url()} with key ({mask_secret(key)})"

    def get_available_models(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        return [{'id': self.default_model, 'name': self.default_model, 'owned_by': 'openai'}]

    def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        timeout: int = 15
    ) -> str:
        key = self.get_api_key()
        if not key:
            raise ValueError("OPENAI_API_KEY not configured")

        import requests
        target_model = model or self.default_model
        endpoint = f"{self.get_base_url()}/chat/completions"

        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": target_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }

        _USAGE_METRICS['openai']['calls'] += 1
        try:
            res = requests.post(endpoint, json=payload, headers=headers, timeout=timeout)
            res.raise_for_status()
            data = res.json()
            _USAGE_METRICS['openai']['successes'] += 1
            content = data['choices'][0]['message']['content']
            usage = data.get('usage', {})
            _USAGE_METRICS['openai']['prompt_tokens'] += usage.get('prompt_tokens', 0)
            _USAGE_METRICS['openai']['completion_tokens'] += usage.get('completion_tokens', 0)
            return content.strip() if content else ''
        except Exception as e:
            _USAGE_METRICS['openai']['failures'] += 1
            log_ai_error('openai', target_model, str(e))
            raise

    def generate_structured(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.3,
        timeout: Optional[int] = None
    ) -> Dict[str, Any]:
        text = self.generate(prompt, system_instruction, model, temperature, timeout=timeout or 15)
        return json.loads(text)


class AIProviderManager:
    """
    Centralized Multi-Model AI Provider Orchestrator for SYNCORA.
    Primary gateway is FreeLLMAPI, which manages upstream routing to models.
    Supports task-specific routing, dynamic model discovery, health auditing,
    safe bounded retries, and offline deterministic fallback.
    """
    def __init__(self):
        self.gateway = FreeLLMAPIProvider()
        router.set_provider(self.gateway)

        # Provider registry maintains backward compatibility for existing endpoints and tests
        self.providers: Dict[str, BaseAIProvider] = {
            'freellmapi': self.gateway,
            'gemini': GeminiProvider(),
            'openai': OpenAICompatibleProvider(),
        }

    def get_primary_provider_name(self) -> str:
        """Default primary provider is now FreeLLMAPI in Phase 2."""
        return os.environ.get('AI_PRIMARY_PROVIDER', 'freellmapi').lower().strip()

    def get_fallback_provider_name(self) -> str:
        return os.environ.get('AI_FALLBACK_PROVIDER', '').lower().strip()

    def get_provider(self, name: str) -> Optional[BaseAIProvider]:
        return self.providers.get(name.lower().strip())

    def get_all_provider_status(self) -> List[Dict[str, Any]]:
        results = []
        primary = self.get_primary_provider_name()
        fallback = self.get_fallback_provider_name()

        for name, provider in self.providers.items():
            avail_res = provider.check_availability()
            if isinstance(avail_res, tuple) and len(avail_res) >= 3:
                avail, details, telemetry = avail_res[0], avail_res[1], avail_res[2]
            elif isinstance(avail_res, tuple) and len(avail_res) == 2:
                avail, details = avail_res[0], avail_res[1]
                telemetry = {}
            else:
                avail, details, telemetry = False, "Unknown status", {}

            metrics = _USAGE_METRICS.get(name, {})
            results.append({
                'name': name,
                'is_primary': name == primary,
                'is_fallback': name == fallback,
                'configured': provider.is_configured(),
                'available': avail,
                'status_message': details,
                'telemetry': telemetry,
                'metrics': metrics
            })
        return results

    def get_gateway_telemetry(self) -> Dict[str, Any]:
        """Detailed FreeLLMAPI gateway health & discovery telemetry."""
        is_avail, msg, telemetry = self.gateway.check_availability()
        models = self.gateway.get_available_models()
        return {
            'available': is_avail,
            'message': msg,
            'base_url': self.gateway.get_base_url(),
            'masked_key': mask_secret(self.gateway.get_api_key()),
            'default_model': self.gateway.get_default_model(),
            'models_count': len(models),
            'available_models': models,
            'metrics': self.gateway.metrics,
            'routed_via': 'freellmapi'
        }

    def test_provider(self, provider_name: str) -> Dict[str, Any]:
        """Test a provider with a minimal generation query."""
        provider = self.get_provider(provider_name)
        if not provider:
            return {'success': False, 'message': f"Unknown provider '{provider_name}'"}
        if not provider.is_configured():
            return {'success': False, 'message': f"Provider '{provider_name}' has no API key configured"}

        start = time.time()
        try:
            resp = provider.generate(
                prompt="Respond with the single word 'OK'.",
                system_instruction="Be concise.",
                max_tokens=10,
                timeout=10
            )
            elapsed = round((time.time() - start) * 1000, 1)
            return {'success': True, 'response': resp, 'latency_ms': elapsed, 'message': f"Connectivity verified in {elapsed}ms"}
        except Exception as e:
            elapsed = round((time.time() - start) * 1000, 1)
            return {'success': False, 'error': str(e), 'latency_ms': elapsed, 'message': f"Connection test failed: {str(e)}"}

    def generate_with_fallback(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        task_type: str = TaskType.BALANCED,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        retries: int = 1
    ) -> Tuple[str, str, str]:
        """
        Attempts generation using primary provider, falling back to secondary upon failure.
        Resolves model via ModelRouter if model is not explicitly provided.
        Returns (result_text, provider_used, model_used).
        """
        primary_name = self.get_primary_provider_name()
        fallback_name = self.get_fallback_provider_name()

        # Build execution order
        provider_order = [primary_name]
        if fallback_name and fallback_name != primary_name:
            provider_order.append(fallback_name)

        for name, prov in self.providers.items():
            if name not in provider_order and prov.is_configured():
                provider_order.append(name)

        target_model = router.resolve_model(task_type, requested_model=model)
        errors = []

        for prov_name in provider_order:
            provider = self.get_provider(prov_name)
            if not provider or not provider.is_configured():
                continue

            for attempt in range(retries + 1):
                try:
                    result = provider.generate(
                        prompt=prompt,
                        system_instruction=system_instruction,
                        model=target_model,
                        temperature=temperature,
                        max_tokens=max_tokens
                    )
                    used_model = target_model or getattr(provider, 'default_model', 'standard')
                    return result, prov_name, used_model
                except Exception as e:
                    errors.append(f"{prov_name} (attempt {attempt + 1}): {str(e)}")
                    time.sleep(0.3)

        err_msg = "All AI providers failed or unconfigured: " + "; ".join(errors) if errors else "No AI provider configured"
        logger.warning(err_msg)
        raise RuntimeError(err_msg)

    def generate_structured_json(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        task_type: str = TaskType.REASONING,
        retries: int = 1
    ) -> Tuple[Dict[str, Any], str, str]:
        """
        Generates text and parses it as a JSON dictionary.
        Extracts JSON block cleanly with robust fallback.
        """
        full_sys_inst = (
            (system_instruction or "") +
            "\n\nCRITICAL: Respond ONLY with a valid JSON object. Do not include markdown code fences or explanatory prose outside the JSON."
        ).strip()

        raw_text, provider_name, model_name = self.generate_with_fallback(
            prompt=prompt,
            system_instruction=full_sys_inst,
            model=model,
            task_type=task_type,
            temperature=0.3,
            retries=retries
        )

        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()

        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict):
                return parsed, provider_name, model_name
            else:
                return {'data': parsed}, provider_name, model_name
        except Exception as e:
            logger.warning(f"Failed to parse AI response as JSON: {e}. Raw response: {raw_text[:200]}")
            s_idx = cleaned.find('{')
            e_idx = cleaned.rfind('}')
            if s_idx != -1 and e_idx != -1 and e_idx > s_idx:
                try:
                    parsed = json.loads(cleaned[s_idx:e_idx + 1])
                    return parsed, provider_name, model_name
                except Exception:
                    pass
            raise ValueError(f"AI returned invalid JSON: {cleaned[:150]}")


# Global singleton instance
ai_manager = AIProviderManager()
