from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

from fastapi import APIRouter
from app.services.chatbot.bot import chatbot_ask

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chatbot", tags=["chatbot"])


class Message(BaseModel):
    role: str       # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    query: str
    chat_history: Optional[List[Message]] = None


class ChatResponse(BaseModel):
    answer: str


@router.post("/ask", response_model=ChatResponse)
def ask_chatbot(req: ChatRequest) -> ChatResponse:
    """Takes a user question and executes the LangGraph product intelligence chatbot."""
    history_dicts = []
    if req.chat_history:
        for msg in req.chat_history:
            history_dicts.append({
                "role": msg.role,
                "content": msg.content
            })
            
    try:
        answer = chatbot_ask(query=req.query, chat_history=history_dicts)
        return ChatResponse(answer=answer)
    except Exception as e:
        logger.error(f"Chatbot query failed: {e}")
        return ChatResponse(answer=f"Sorry, I encountered an internal error while answering: {e}")
