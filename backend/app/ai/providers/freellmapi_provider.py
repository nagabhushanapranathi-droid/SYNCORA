import os
import json
import time
import random
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

import requests

from app.ai.providers.base_provider import BaseAIProvider

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Custom Exception Hierarchy
# ---------------------------------------------------------------------------

class FreeLLMAPIError(Exception):
    """Base exception for all FreeLLMAPI communication errors."""
    def __init__(self, message: str, status_code: Optional[int] = None, response_body: Optional[str] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body


class FreeLLMAPIConnectionError(FreeLLMAPIError):
    """Network connection failure, DNS resolution failure, or unreachable host."""
    pass


class FreeLLMAPIAuthError(FreeLLMAPIError):
    """Authentication or authorization failure (HTTP 401 or 403)."""
    pass


class FreeLLMAPITimeoutError(FreeLLMAPIError):
    """Request exceeded configured timeout."""
    pass


class FreeLLMAPIRateLimitError(FreeLLMAPIError):
    """Upstream rate limit exceeded (HTTP 429)."""
    pass


class FreeLLMAPIServerError(FreeLLMAPIError):
    """Gateway or upstream server failure (HTTP 500, 502, 503, 504)."""
    pass


class FreeLLMAPIMalformedResponseError(FreeLLMAPIError):
    """Response payload was not valid JSON or lacked expected OpenAI schema."""
    pass


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def mask_api_key(key: Optional[str]) -> str:
    """Mask sensitive API key for safe admin visibility."""
    if not key:
        return "Not configured"
    s = key.strip()
    if len(s) <= 8:
        return "***"
    return f"{s[:4]}...{s[-4:]}"


# ---------------------------------------------------------------------------
# FreeLLMAPI Provider Implementation
# ---------------------------------------------------------------------------

class FreeLLMAPIProvider(BaseAIProvider):
    """
    Central, exclusive application-facing AI provider for SYNCORA.
    Communicates exclusively with FreeLLMAPI via OpenAI-compatible endpoints:
      - GET /v1/models (model discovery & capabilities)
      - POST /v1/chat/completions (chat, instruction, structured JSON)

    Upstream provider routing (Gemini, Llama, Claude, etc.) is delegated entirely
    to FreeLLMAPI. SYNCORA does not communicate directly with upstream providers.
    """

    def __init__(self):
        super().__init__(name="freellmapi")
        self._models_cache: List[Dict[str, Any]] = []
        self._models_cache_timestamp: float = 0
        self._cache_ttl_seconds: int = 300  # 5-minute cache

        # Usage & Telemetry Metrics
        self.metrics = {
            'calls': 0,
            'successes': 0,
            'failures': 0,
            'retries': 0,
            'prompt_tokens': 0,
            'completion_tokens': 0,
            'last_latency_ms': 0.0,
            'last_call_timestamp': None,
            'last_error': None
        }

    # -----------------------------------------------------------------------
    # Configuration Accessors
    # -----------------------------------------------------------------------

    def get_api_key(self) -> str:
        """Retrieve configured API key with backwards-compatible fallback and Flask config awareness."""
        try:
            from flask import current_app
            if current_app and 'FREELLMAPI_API_KEY' in current_app.config:
                val = current_app.config.get('FREELLMAPI_API_KEY')
                if val is not None and str(val).strip() == '':
                    return ''
        except Exception:
            pass

        return (
            os.environ.get("FREELLMAPI_API_KEY", "").strip() or
            os.environ.get("FREELLM_API_KEY", "").strip()
        )

    def get_base_url(self) -> str:
        """Retrieve FreeLLMAPI base URL, normalized without trailing slash."""
        base = (
            os.environ.get("FREELLMAPI_BASE_URL", "").strip() or
            os.environ.get("FREELLM_API_BASE", "").strip() or
            "http://127.0.0.1:3001/v1"
        )
        return base.rstrip("/")

    def get_default_model(self) -> str:
        """Retrieve default model alias or fallback to auto."""
        return (
            os.environ.get("FREELLMAPI_DEFAULT_MODEL", "").strip() or
            os.environ.get("FREELLM_MODEL", "").strip() or
            "auto"
        )

    def get_timeout(self) -> int:
        """Retrieve request timeout in seconds."""
        try:
            return int(os.environ.get("FREELLMAPI_TIMEOUT", "60"))
        except (ValueError, TypeError):
            return 60

    def get_max_retries(self) -> int:
        """Retrieve maximum retry attempts for transient errors."""
        try:
            return int(os.environ.get("FREELLMAPI_MAX_RETRIES", "2"))
        except (ValueError, TypeError):
            return 2

    def is_ai_enabled(self) -> bool:
        """Check whether AI operations are enabled globally."""
        val = os.environ.get("SYNCORA_AI_ENABLED", "true").lower().strip()
        return val in ("true", "1", "yes", "on")

    def is_configured(self) -> bool:
        """Return True if API key and base URL are present."""
        return bool(self.get_api_key()) and bool(self.get_base_url())

    # -----------------------------------------------------------------------
    # Headers
    # -----------------------------------------------------------------------

    def _get_headers(self, custom_headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        """Construct standard HTTP headers for FreeLLMAPI gateway."""
        headers = {
            "Authorization": f"Bearer {self.get_api_key()}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-App-Name": "SYNCORA",
            "X-Client-Version": "2.0",
            "X-Routed-Via": "freellmapi"
        }
        if custom_headers:
            headers.update(custom_headers)
        return headers

    # -----------------------------------------------------------------------
    # Dynamic Model Discovery
    # -----------------------------------------------------------------------

    def get_available_models(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """
        Fetch available models dynamically from FreeLLMAPI /v1/models endpoint.
        Uses in-memory TTL caching (300 seconds) to avoid redundant network calls.
        """
        now = time.time()
        if not force_refresh and self._models_cache and (now - self._models_cache_timestamp < self._cache_ttl_seconds):
            return self._models_cache

        if not self.is_configured():
            logger.debug("FreeLLMAPI not configured; skipping model discovery")
            return []

        url = f"{self.get_base_url()}/models"
        headers = self._get_headers()

        try:
            res = requests.get(url, headers=headers, timeout=10)
            if res.status_code == 200:
                payload = res.json()
                raw_models = payload.get("data", []) if isinstance(payload, dict) else []
                parsed_models = []
                for m in raw_models:
                    if isinstance(m, dict):
                        parsed_models.append({
                            "id": m.get("id"),
                            "name": m.get("id") or m.get("name", "Unknown"),
                            "owned_by": m.get("owned_by", "freellmapi"),
                            "context_window": m.get("context_window", 8192)
                        })
                    elif isinstance(m, str):
                        parsed_models.append({
                            "id": m,
                            "name": m,
                            "owned_by": "freellmapi",
                            "context_window": 8192
                        })

                self._models_cache = parsed_models
                self._models_cache_timestamp = now
                logger.info(f"Discovered {len(parsed_models)} models from FreeLLMAPI gateway")
                return parsed_models
            else:
                logger.warning(f"FreeLLMAPI /v1/models returned HTTP {res.status_code}: {res.text[:150]}")
                return self._models_cache
        except Exception as e:
            logger.warning(f"Failed to fetch models from FreeLLMAPI gateway: {e}")
            return self._models_cache

    # -----------------------------------------------------------------------
    # Health and Connectivity Check
    # -----------------------------------------------------------------------

    def check_availability(self) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Perform a live connectivity audit against FreeLLMAPI.
        Returns: (is_available, status_message, telemetry_dict)
        """
        if not self.is_ai_enabled():
            return False, "SYNCORA_AI_ENABLED is disabled via configuration", {
                "configured": False,
                "latency_ms": 0,
                "base_url": self.get_base_url(),
                "masked_key": mask_api_key(self.get_api_key()),
                "models_count": 0
            }

        if not self.is_configured():
            return False, "FREELLMAPI_API_KEY is not configured", {
                "configured": False,
                "latency_ms": 0,
                "base_url": self.get_base_url(),
                "masked_key": "Not configured",
                "models_count": 0
            }

        start = time.time()
        url = f"{self.get_base_url()}/models"
        headers = self._get_headers()

        try:
            res = requests.get(url, headers=headers, timeout=min(10, self.get_timeout()))
            latency = round((time.time() - start) * 1000, 1)

            if res.status_code == 200:
                models = self.get_available_models(force_refresh=True)
                msg = f"Connected to FreeLLMAPI gateway at {self.get_base_url()} ({latency}ms, {len(models)} models available)"
                telemetry = {
                    "configured": True,
                    "available": True,
                    "latency_ms": latency,
                    "base_url": self.get_base_url(),
                    "masked_key": mask_api_key(self.get_api_key()),
                    "default_model": self.get_default_model(),
                    "models_count": len(models),
                    "models": [m["id"] for m in models[:10]],
                    "routed_via": "freellmapi"
                }
                return True, msg, telemetry
            elif res.status_code in (401, 403):
                msg = f"FreeLLMAPI Authentication Failed (HTTP {res.status_code}): Invalid or expired API key"
                return False, msg, {
                    "configured": True,
                    "available": False,
                    "status_code": res.status_code,
                    "latency_ms": latency,
                    "base_url": self.get_base_url(),
                    "masked_key": mask_api_key(self.get_api_key())
                }
            else:
                msg = f"FreeLLMAPI Gateway returned HTTP {res.status_code}: {res.text[:100]}"
                return False, msg, {
                    "configured": True,
                    "available": False,
                    "status_code": res.status_code,
                    "latency_ms": latency,
                    "base_url": self.get_base_url()
                }

        except requests.exceptions.Timeout:
            latency = round((time.time() - start) * 1000, 1)
            msg = f"FreeLLMAPI Gateway connection timed out after {latency}ms"
            return False, msg, {"configured": True, "available": False, "timeout": True, "latency_ms": latency}
        except requests.exceptions.ConnectionError as ce:
            latency = round((time.time() - start) * 1000, 1)
            msg = f"FreeLLMAPI Gateway unreachable at {self.get_base_url()}: Connection refused"
            return False, msg, {"configured": True, "available": False, "connection_error": str(ce), "latency_ms": latency}
        except Exception as e:
            latency = round((time.time() - start) * 1000, 1)
            msg = f"FreeLLMAPI check failed: {str(e)}"
            return False, msg, {"configured": True, "available": False, "error": str(e), "latency_ms": latency}

    # -----------------------------------------------------------------------
    # Low-Level Request Execution with Resilient Retries & Backoff
    # -----------------------------------------------------------------------

    def _execute_chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        timeout: Optional[int] = None
    ) -> Tuple[Dict[str, Any], int]:
        """
        Execute POST /v1/chat/completions with exponential backoff and error classification.
        Returns: (response_json, fallback_attempts_count)
        """
        if not self.is_ai_enabled():
            raise FreeLLMAPIError("AI operations are disabled via SYNCORA_AI_ENABLED")

        if not self.is_configured():
            raise FreeLLMAPIAuthError("FREELLMAPI_API_KEY is not configured")

        target_model = model or self.get_default_model()
        endpoint = f"{self.get_base_url()}/chat/completions"
        is_testing = os.environ.get("TESTING") == "True" or os.environ.get("FLASK_ENV") == "testing"
        connect_timeout = 0.5 if is_testing else 2.5
        req_timeout = timeout or self.get_timeout()
        timeout_tuple = (connect_timeout, req_timeout)
        max_retries = 1 if is_testing else self.get_max_retries()

        payload = {
            "model": target_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }

        attempts = 0
        last_exception = None

        self.metrics['calls'] += 1

        for attempt in range(max_retries + 1):
            start_time = time.time()
            attempts = attempt
            try:
                headers = self._get_headers({"X-Fallback-Attempts": str(attempt)})
                res = requests.post(endpoint, json=payload, headers=headers, timeout=timeout_tuple)
                latency = round((time.time() - start_time) * 1000, 1)
                self.metrics['last_latency_ms'] = latency
                self.metrics['last_call_timestamp'] = datetime.utcnow().isoformat()

                if res.status_code == 200:
                    try:
                        data = res.json()
                    except Exception as json_err:
                        raise FreeLLMAPIMalformedResponseError(
                            f"FreeLLMAPI response was not valid JSON: {res.text[:150]}",
                            status_code=200,
                            response_body=res.text
                        ) from json_err

                    # Validate OpenAI schema
                    choices = data.get("choices")
                    if not choices or not isinstance(choices, list) or len(choices) == 0:
                        raise FreeLLMAPIMalformedResponseError(
                            "FreeLLMAPI response missing 'choices' array",
                            status_code=200,
                            response_body=res.text
                        )

                    msg_obj = choices[0].get("message")
                    if not msg_obj or "content" not in msg_obj:
                        raise FreeLLMAPIMalformedResponseError(
                            "FreeLLMAPI choice missing 'message.content'",
                            status_code=200,
                            response_body=res.text
                        )

                    # Update metrics
                    self.metrics['successes'] += 1
                    usage = data.get("usage", {})
                    self.metrics['prompt_tokens'] += usage.get("prompt_tokens", 0) or 0
                    self.metrics['completion_tokens'] += usage.get("completion_tokens", 0) or 0

                    return data, attempt

                elif res.status_code in (401, 403):
                    # Authentication errors should not be retried
                    raise FreeLLMAPIAuthError(
                        f"FreeLLMAPI Authentication failed (HTTP {res.status_code}): {res.text[:200]}",
                        status_code=res.status_code,
                        response_body=res.text
                    )

                elif res.status_code == 429:
                    # Rate limit - transient, retry with exponential backoff
                    retry_after = res.headers.get("Retry-After")
                    sleep_time = float(retry_after) if retry_after and retry_after.isdigit() else (1.5 ** attempt) + random.uniform(0.1, 0.5)
                    logger.warning(f"FreeLLMAPI 429 Rate Limit on attempt {attempt + 1}. Retrying in {sleep_time:.2f}s...")
                    self.metrics['retries'] += 1
                    time.sleep(sleep_time)
                    last_exception = FreeLLMAPIRateLimitError(
                        f"FreeLLMAPI 429 Rate Limit: {res.text[:150]}",
                        status_code=429,
                        response_body=res.text
                    )
                    continue

                elif res.status_code in (500, 502, 503, 504):
                    # Upstream or gateway failure - retry
                    sleep_time = (1.5 ** attempt) + random.uniform(0.1, 0.4)
                    logger.warning(f"FreeLLMAPI HTTP {res.status_code} server error on attempt {attempt + 1}. Retrying in {sleep_time:.2f}s...")
                    self.metrics['retries'] += 1
                    time.sleep(sleep_time)
                    last_exception = FreeLLMAPIServerError(
                        f"FreeLLMAPI server error HTTP {res.status_code}: {res.text[:150]}",
                        status_code=res.status_code,
                        response_body=res.text
                    )
                    continue

                else:
                    # Client errors (400, 404, etc.)
                    raise FreeLLMAPIError(
                        f"FreeLLMAPI request failed (HTTP {res.status_code}): {res.text[:200]}",
                        status_code=res.status_code,
                        response_body=res.text
                    )

            except requests.exceptions.Timeout as te:
                logger.warning(f"FreeLLMAPI request timeout on attempt {attempt + 1}: {te}")
                self.metrics['retries'] += 1
                last_exception = FreeLLMAPITimeoutError(f"FreeLLMAPI request timed out after {req_timeout}s")
                if attempt < max_retries:
                    time.sleep(1.0 + random.uniform(0.1, 0.3))
                continue

            except requests.exceptions.ConnectionError as ce:
                logger.warning(f"FreeLLMAPI connection error on attempt {attempt + 1}: {ce}")
                self.metrics['retries'] += 1
                last_exception = FreeLLMAPIConnectionError(f"FreeLLMAPI host unreachable: {ce}")
                if attempt < max_retries:
                    time.sleep(0.05 if is_testing else 0.5)
                continue

            except FreeLLMAPIError:
                # Re-raise non-retryable classified FreeLLMAPI errors directly
                self.metrics['failures'] += 1
                raise

            except Exception as e:
                logger.error(f"Unexpected error calling FreeLLMAPI on attempt {attempt + 1}: {e}")
                self.metrics['retries'] += 1
                last_exception = FreeLLMAPIError(f"Unexpected FreeLLMAPI error: {str(e)}")
                if attempt < max_retries:
                    time.sleep(1.0)
                continue

        # If loop finishes without returning, all attempts failed
        self.metrics['failures'] += 1
        self.metrics['last_error'] = str(last_exception)
        logger.error(f"FreeLLMAPI failed after {attempts + 1} attempts. Last error: {last_exception}")
        raise last_exception or FreeLLMAPIError("FreeLLMAPI failed after max retries")

    # -----------------------------------------------------------------------
    # Public Generation API
    # -----------------------------------------------------------------------

    def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        timeout: Optional[int] = None
    ) -> str:
        """
        Generate plain text response via FreeLLMAPI.
        """
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        data, _ = self._execute_chat_completion(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout
        )

        content = data["choices"][0]["message"]["content"]
        return content.strip() if content else ""

    def generate_structured(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.3,
        timeout: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Generate structured JSON response parsed into a Python dictionary.
        Enforces strict JSON constraint, strips markdown code blocks,
        and handles repair of common JSON anomalies.
        """
        strict_system = (
            (system_instruction or "") +
            "\n\nCRITICAL INSTRUCTION: You MUST respond ONLY with a single valid JSON object. "
            "Do NOT include markdown formatting, code fences (```json), or any conversational text before or after the JSON."
        ).strip()

        raw_text = self.generate(
            prompt=prompt,
            system_instruction=strict_system,
            model=model,
            temperature=temperature,
            timeout=timeout
        )

        return self._extract_json(raw_text)

    # -----------------------------------------------------------------------
    # Robust JSON Extractor
    # -----------------------------------------------------------------------

    def _extract_json(self, raw_text: str) -> Dict[str, Any]:
        """Extract and parse JSON safely from raw LLM output."""
        cleaned = raw_text.strip()

        # 1. Strip markdown fences if present
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()

        # 2. Direct JSON parse
        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict):
                return parsed
            elif isinstance(parsed, list):
                return {"items": parsed}
            return {"data": parsed}
        except Exception:
            pass

        # 3. Locate outer JSON bounds { ... }
        start_brace = cleaned.find("{")
        end_brace = cleaned.rfind("}")
        if start_brace != -1 and end_brace != -1 and end_brace > start_brace:
            sub = cleaned[start_brace:end_brace + 1]
            try:
                parsed = json.loads(sub)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                pass

        # 4. Locate outer JSON bounds [ ... ]
        start_bracket = cleaned.find("[")
        end_bracket = cleaned.rfind("]")
        if start_bracket != -1 and end_bracket != -1 and end_bracket > start_bracket:
            sub = cleaned[start_bracket:end_bracket + 1]
            try:
                parsed = json.loads(sub)
                return {"items": parsed}
            except Exception:
                pass

        # 5. If everything fails, raise malformed error
        raise FreeLLMAPIMalformedResponseError(
            f"FreeLLMAPI response could not be parsed as valid JSON: {raw_text[:200]}",
            response_body=raw_text
        )
