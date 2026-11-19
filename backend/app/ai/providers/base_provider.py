from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Tuple


class BaseAIProvider(ABC):
    """
    Abstract Base Class for AI Gateway Providers.
    All application-facing AI interactions conform to this standard interface.
    """

    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    def is_configured(self) -> bool:
        """Return True if required API credentials and base URLs are set."""
        pass

    @abstractmethod
    def check_availability(self) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Verify live connectivity to the provider endpoint.
        Returns: (is_available, status_message, telemetry_dict)
        """
        pass

    @abstractmethod
    def get_available_models(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """
        Discover and return models supported by the provider.
        Returns: list of dicts with keys {'id', 'name', 'owned_by', 'context_window'}.
        """
        pass

    @abstractmethod
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
        Generate plain text response for the given prompt.
        """
        pass

    @abstractmethod
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
        """
        pass
