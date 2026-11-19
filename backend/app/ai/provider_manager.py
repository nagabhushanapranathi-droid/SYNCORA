import os
import json
import logging
import time
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

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
    if not secret:
        return 'Not configured'
    s = secret.strip()
    if len(s) <= 8:
        return '***'
    return f"{s[:4]}...{s[-4:]}"


class AIProvider:
    """Abstract base provider class."""
    def __init__(self, name: str):
        self.name = name

    def is_configured(self) -> bool:
        raise NotImplementedError

    def check_availability(self) -> Tuple[bool, str]:
        raise NotImplementedError

    def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        timeout: int = 15
    ) -> str:
        raise NotImplementedError


class GeminiProvider(AIProvider):
    """Google Gemini integration using google-genai SDK."""
    def __init__(self):
        super().__init__('gemini')
        self.default_model = 'gemini-2.0-flash'

    def get_api_key(self) -> str:
        return os.environ.get('GOOGLE_API_KEY', '').strip() or os.environ.get('GEMINI_API_KEY', '').strip()

    def is_configured(self) -> bool:
        return bool(self.get_api_key())

    def check_availability(self) -> Tuple[bool, str]:
        key = self.get_api_key()
        if not key:
            return False, "GOOGLE_API_KEY is not configured"
        try:
            from google import genai
            client = genai.Client(api_key=key)
            return True, f"Configured with key ({mask_secret(key)})"
        except Exception as e:
            return False, f"Gemini client initialization failed: {str(e)}"

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

        from google import genai
        from google.genai import types

        client = genai.Client(api_key=key)
        target_model = model or self.default_model

        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        if system_instruction:
            config.system_instruction = system_instruction

        _USAGE_METRICS['gemini']['calls'] += 1
        try:
            response = client.models.generate_content(
                model=target_model,
                config=config,
                contents=prompt
            )
            _USAGE_METRICS['gemini']['successes'] += 1
            if hasattr(response, 'usage_metadata') and response.usage_metadata:
                _USAGE_METRICS['gemini']['prompt_tokens'] += getattr(response.usage_metadata, 'prompt_token_count', 0) or 0
                _USAGE_METRICS['gemini']['completion_tokens'] += getattr(response.usage_metadata, 'candidates_token_count', 0) or 0

            return response.text.strip() if response and response.text else ''
        except Exception as e:
            _USAGE_METRICS['gemini']['failures'] += 1
            log_ai_error('gemini', target_model, str(e))
            raise


class FreeLLMAPIProvider(AIProvider):
    """
    FreeLLMAPI provider abstraction.
    Supports OpenAI-compatible /chat/completions endpoint for FreeLLMAPI services.
    """
    def __init__(self):
        super().__init__('freellmapi')
        self.default_model = os.environ.get('FREELLM_MODEL', 'llama-3.3-70b')
        self.default_base_url = os.environ.get('FREELLM_API_BASE', 'https://api.freellmapi.com/v1')

    def get_api_key(self) -> str:
        return os.environ.get('FREELLM_API_KEY', '').strip()

    def get_base_url(self) -> str:
        return self.default_base_url.rstrip('/')

    def is_configured(self) -> bool:
        return bool(self.get_api_key())

    def check_availability(self) -> Tuple[bool, str]:
        key = self.get_api_key()
        if not key:
            return False, "FREELLM_API_KEY not configured (unverified abstraction)"
        return True, f"Configured endpoint {self.get_base_url()} with key ({mask_secret(key)})"

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
            raise ValueError("FREELLM_API_KEY not configured")

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

        _USAGE_METRICS['freellmapi']['calls'] += 1
        try:
            res = requests.post(endpoint, json=payload, headers=headers, timeout=timeout)
            res.raise_for_line_status() if hasattr(res, 'raise_for_line_status') else res.raise_for_status()
            data = res.json()
            _USAGE_METRICS['freellmapi']['successes'] += 1
            content = data['choices'][0]['message']['content']
            usage = data.get('usage', {})
            _USAGE_METRICS['freellmapi']['prompt_tokens'] += usage.get('prompt_tokens', 0)
            _USAGE_METRICS['freellmapi']['completion_tokens'] += usage.get('completion_tokens', 0)
            return content.strip() if content else ''
        except Exception as e:
            _USAGE_METRICS['freellmapi']['failures'] += 1
            log_ai_error('freellmapi', target_model, str(e))
            raise


class OpenAICompatibleProvider(AIProvider):
    """Generic OpenAI-compatible provider (e.g., Groq, DeepSeek, Local Ollama, OpenAI)."""
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


class AIProviderManager:
    """
    Centralized Multi-Model AI Provider Orchestrator.
    Handles primary/secondary fallback, retries, timeouts, and structured JSON parsing.
    """
    def __init__(self):
        self.providers: Dict[str, AIProvider] = {
            'gemini': GeminiProvider(),
            'freellmapi': FreeLLMAPIProvider(),
            'openai': OpenAICompatibleProvider(),
        }

    def get_primary_provider_name(self) -> str:
        return os.environ.get('AI_PRIMARY_PROVIDER', 'gemini').lower().strip()

    def get_fallback_provider_name(self) -> str:
        return os.environ.get('AI_FALLBACK_PROVIDER', 'freellmapi').lower().strip()

    def get_provider(self, name: str) -> Optional[AIProvider]:
        return self.providers.get(name.lower().strip())

    def get_all_provider_status(self) -> List[Dict[str, Any]]:
        results = []
        primary = self.get_primary_provider_name()
        fallback = self.get_fallback_provider_name()

        for name, provider in self.providers.items():
            avail, details = provider.check_availability()
            metrics = _USAGE_METRICS.get(name, {})
            results.append({
                'name': name,
                'is_primary': name == primary,
                'is_fallback': name == fallback,
                'configured': provider.is_configured(),
                'available': avail,
                'status_message': details,
                'metrics': metrics
            })
        return results

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
        temperature: float = 0.7,
        max_tokens: int = 2048,
        retries: int = 1
    ) -> Tuple[str, str, str]:
        """
        Attempts generation using primary provider, falling back to secondary upon failure.
        Returns (result_text, provider_used, model_used).
        """
        primary_name = self.get_primary_provider_name()
        fallback_name = self.get_fallback_provider_name()

        provider_order = [primary_name]
        if fallback_name and fallback_name != primary_name:
            provider_order.append(fallback_name)

        # Also add any configured alternative provider
        for name, prov in self.providers.items():
            if name not in provider_order and prov.is_configured():
                provider_order.append(name)

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
                        model=model,
                        temperature=temperature,
                        max_tokens=max_tokens
                    )
                    used_model = model or getattr(provider, 'default_model', 'standard')
                    return result, prov_name, used_model
                except Exception as e:
                    errors.append(f"{prov_name} (attempt {attempt + 1}): {str(e)}")
                    time.sleep(0.5)

        # If all external providers fail or are unconfigured, raise exception with accumulated error trace
        err_msg = "All AI providers failed or unconfigured: " + "; ".join(errors) if errors else "No AI provider configured"
        logger.warning(err_msg)
        raise RuntimeError(err_msg)

    def generate_structured_json(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        retries: int = 1
    ) -> Tuple[Dict[str, Any], str, str]:
        """
        Generates text and parses it as a JSON dictionary.
        Extracts JSON block if wrapped in markdown code fences.
        """
        full_sys_inst = (
            (system_instruction or "") +
            "\n\nCRITICAL: Respond ONLY with a valid JSON object. Do not include markdown code fences or explanatory prose outside the JSON."
        ).strip()

        raw_text, provider_name, model_name = self.generate_with_fallback(
            prompt=prompt,
            system_instruction=full_sys_inst,
            model=model,
            temperature=0.3,
            retries=retries
        )

        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()

        # Parse JSON
        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict):
                return parsed, provider_name, model_name
            else:
                return {'data': parsed}, provider_name, model_name
        except Exception as e:
            logger.warning(f"Failed to parse AI response as JSON: {e}. Raw response: {raw_text[:200]}")
            # Try to find first { and last }
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
