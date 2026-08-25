"""LangGraph pipeline for one AI chat turn: search decision -> web search ->
{reply generation, emotion classification} run in parallel -> done.

Splitting these into separate nodes/prompts (rather than one call doing
everything, like the old single-prompt-with-an-inline-tag approach) makes
each step more reliable: the search decision and emotion classification are
narrow, structured (JSON) calls with nothing to format wrong, and the reply
generation is free to just write a normal reply with no tag to embed or
strip. Reply generation and emotion classification run concurrently (both
only need the conversation so far, not each other's output) so the avatar
can still flip expression while the reply is still streaming in, instead of
waiting for the whole reply to finish.

This module owns *how* a turn is produced. app/realtime/ai_room.py owns
*when* to run one (debounce, spam gate, retries, persistence, socket wiring).
"""
import logging
from typing import Awaitable, Callable, TypedDict

from langgraph.graph import END, START, StateGraph

from app.ai.chat import search as web_search
from app.ai.chat.responder import classify_emotion, decide_search_query, stream_reply

logger = logging.getLogger(__name__)


class ChatTurnState(TypedDict, total=False):
    history: list[dict]
    room_system_prompt: str
    search_query: str | None
    search_context: str | None
    reply_text: str
    emotion: str
    # Side-effect callbacks into the socket layer; not persisted, not
    # serialized -- this graph is run in-process with no checkpointer.
    emit_chunk: Callable[[str], Awaitable[None]]
    emit_emotion: Callable[[str], Awaitable[None]]


async def _decide_search_node(state: ChatTurnState) -> dict:
    if not web_search.is_configured():
        return {"search_query": None}
    query = await decide_search_query(state["history"])
    return {"search_query": query}


async def _web_search_node(state: ChatTurnState) -> dict:
    query = state.get("search_query")
    if not query:
        return {"search_context": None}
    try:
        results = await web_search.search(query)
        return {"search_context": web_search.format_results(results) if results else None}
    except Exception:
        logger.warning("Web search step failed; answering without it", exc_info=True)
        return {"search_context": None}


async def _generate_reply_node(state: ChatTurnState) -> dict:
    chunks: list[str] = []
    async for chunk in stream_reply(
        state["history"], state.get("room_system_prompt", ""), state.get("search_context")
    ):
        chunks.append(chunk)
        await state["emit_chunk"](chunk)
    return {"reply_text": "".join(chunks).strip()}


async def _classify_emotion_node(state: ChatTurnState) -> dict:
    emotion = await classify_emotion(state["history"], state.get("room_system_prompt", ""))
    await state["emit_emotion"](emotion)
    return {"emotion": emotion}


def _build_graph():
    graph = StateGraph(ChatTurnState)
    graph.add_node("decide_search", _decide_search_node)
    graph.add_node("web_search", _web_search_node)
    graph.add_node("generate_reply", _generate_reply_node)
    graph.add_node("classify_emotion", _classify_emotion_node)

    graph.add_edge(START, "decide_search")
    graph.add_edge("decide_search", "web_search")
    # Fan out: both run concurrently off the same search-enriched state.
    graph.add_edge("web_search", "generate_reply")
    graph.add_edge("web_search", "classify_emotion")
    graph.add_edge("generate_reply", END)
    graph.add_edge("classify_emotion", END)
    return graph.compile()


_compiled = _build_graph()


async def run_chat_turn(
    history: list[dict],
    room_system_prompt: str,
    emit_chunk: Callable[[str], Awaitable[None]],
    emit_emotion: Callable[[str], Awaitable[None]],
) -> tuple[str, str]:
    """Run one full turn. Returns (reply_text, emotion). Raises on failure --
    the caller (app/realtime/ai_room.py) owns retry policy."""
    result = await _compiled.ainvoke(
        {
            "history": history,
            "room_system_prompt": room_system_prompt,
            "emit_chunk": emit_chunk,
            "emit_emotion": emit_emotion,
        }
    )
    return result.get("reply_text", ""), result.get("emotion", "neutral")
