"""Provider-agnostic chat completion interface.

The server never talks to a provider directly; it goes through this protocol.
Providers are selected by the AI_PROVIDER env var and are OpenAI-compatible by
default. Deterministic fallback keeps the app runnable without a key.
"""
from abc import ABC, abstractmethod
from typing import Any, AsyncIterator


class ChatMessage:
    def __init__(self, role: str, content: str) -> None:
        self.role = role
        self.content = content

    def to_dict(self) -> dict[str, str]:
        return {"role": self.role, "content": self.content}


class ChatProvider(ABC):
    """Minimal chat interface all providers implement."""

    @abstractmethod
    async def complete_json(
        self, messages: list[ChatMessage], schema: dict[str, Any], **kwargs: Any
    ) -> dict[str, Any]:
        """Return a JSON object matching `schema`. Must be JSON-serializable."""

    @abstractmethod
    async def stream_text(
        self, messages: list[ChatMessage], **kwargs: Any
    ) -> AsyncIterator[str]:
        """Yield deltas of generated text."""

    @property
    @abstractmethod
    def name(self) -> str:
        ...


class OpenAIBasedProvider(ChatProvider):
    """Speaks the OpenAI-compatible /chat/completions HTTP API.

    Works for OpenAI, DeepSeek, OpenRouter, Ollama's OpenAI shim — anything
    that speaks the same wire format.
    """

    # Extra provider-specific headers (e.g. OpenRouter attribution).
    EXTRA_HEADERS: dict[str, str] = {}

    def __init__(self, model: str, api_key: str, base_url: str = "", name: str = "openai"):
        self.model = model
        self.api_key = api_key
        self.base_url = (base_url or "https://api.openai.com/v1").rstrip("/")
        self._name = name

    @property
    def name(self) -> str:
        return f"openai-compat({self._name})/{self.model}"

    def _headers(self) -> dict[str, str]:
        h = {"Authorization": f"Bearer {self.api_key}"}
        h.update(self.EXTRA_HEADERS)
        return h

    def _mk(self, messages: list[ChatMessage]) -> list[dict]:
        return [m.to_dict() for m in messages]

    async def complete_json(self, messages, schema, **kwargs):
        """JSON-mode completion. `schema` is the system prompt describing shape."""
        import json as _json
        obj = await self.complete(messages, schema, **kwargs)
        if isinstance(obj, dict):
            return obj
        return _json.loads(obj)

    async def complete(self, messages, schema, **kwargs):
        from httpx import AsyncClient
        async with AsyncClient() as client:
            r = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json={
                    "model": self.model,
                    "messages": self._mk(messages),
                    "response_format": {"type": "json_object"},
                    **kwargs,
                },
                timeout=_timeout(),
            )
            r.raise_for_status()
            data = r.json()
            content = data["choices"][0]["message"]["content"]
            import json
            return json.loads(content)

    async def stream_text(self, messages, **kwargs):
        from httpx import AsyncClient
        async with AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json={
                    "model": self.model,
                    "messages": self._mk(messages),
                    "stream": True,
                    **kwargs,
                },
                timeout=_timeout(),
            ) as r:
                r.raise_for_status()
                async for line in r.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    payload = line[6:]
                    if payload.strip() == "[DONE]":
                        break
                    import json
                    try:
                        obj = json.loads(payload)
                    except json.JSONDecodeError:
                        continue
                    choices = obj.get("choices") or []
                    delta = (choices[0].get("delta") or {}).get("content") if choices else None
                    if delta:
                        yield delta


def _timeout():
    from app.config import get_settings
    return get_settings().ai_request_timeout