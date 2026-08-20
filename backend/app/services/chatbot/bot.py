from __future__ import annotations

import logging
import os
import re
from typing import Any, Dict, List, TypedDict
from langgraph.graph import StateGraph, END

from app.services.retrieval import reference as ref_service
from app.services.retrieval.qdrant_db import get_qdrant_service

logger = logging.getLogger(__name__)

class ChatbotState(TypedDict):
    query: str
    chat_history: List[Dict[str, str]]
    intent: str                             # "product_query", "general_query"
    resolved_product_mpn: str | None
    retrieved_evidence: List[Dict[str, Any]]
    answer: str
    verified: bool


def classify_intent(state: ChatbotState) -> Dict[str, Any]:
    """Classifies if the query is a product-specific question or general chatbot chatter."""
    query = state["query"].lower()
    
    # Check for references to parts or specific dishwasher models
    # Frigidaire: PDSH4816AF, Whirlpool: WDTS7024RZ
    product_pattern = r"\b(?=[a-z0-9_-]*\d)[a-z0-9][a-z0-9_-]{5,}\b|attribute|specification|evidence|confidence|validation|lov|uom|human review"
    if re.search(product_pattern, query):
        intent = "product_query"
    else:
        intent = "general_query"
        
    return {"intent": intent}


def identify_product(state: ChatbotState) -> Dict[str, Any]:
    """Resolves the referred model number or brand from the query."""
    if state["intent"] != "product_query":
        return {"resolved_product_mpn": None}

    query = state["query"]
    candidates = re.findall(r"\b[A-Z0-9][A-Z0-9_-]{5,}\b", query.upper())
    candidates.sort(key=lambda candidate: (not any(character.isdigit() for character in candidate), -len(candidate)))
    resolved_mpn = candidates[0] if candidates else None
        
    return {"resolved_product_mpn": resolved_mpn}


def retrieve_evidence(state: ChatbotState) -> Dict[str, Any]:
    """Retrieve document specifications matching the query context from Qdrant vector DB."""
    mpn = state["resolved_product_mpn"]
    client = get_qdrant_service()
    hits = client.retrieve(query=state["query"], mfg_part_num=mpn, limit=4)
    resolved = mpn or (hits[0].get("mfg_part_num") if hits else None)
    if resolved and not mpn:
        hits = client.retrieve(query=state["query"], mfg_part_num=resolved, limit=4)
    return {"retrieved_evidence": hits, "resolved_product_mpn": resolved}


def generate_answer(state: ChatbotState) -> Dict[str, Any]:
    """Generate grounded answer with PDF & page number citations."""
    query = state["query"]
    intent = state["intent"]
    mpn = state["resolved_product_mpn"]
    evidence = state["retrieved_evidence"]
    
    # In case of general conversational requests
    if intent == "general_query":
        ans = "Hello! I am the Unilog Product Intelligence assistant. I can answer questions about product specifications, evidence citations, attributes, and validation rules. Ask me about Frigidaire PDSH4816AF or Whirlpool WDTS7024RZ!"
        return {"answer": ans, "verified": True}
        
    if not mpn:
        return {"answer": "Please include the manufacturer part number so I can retrieve the correct product evidence.", "verified": True}

    if not evidence:
        return {"answer": f"No manufacturer evidence was found for {mpn}. I cannot verify that specification from the indexed documents.", "verified": False}

    # Setup evidence citation map
    citations = []
    evidence_text_blocks = []
    
    for chunk in evidence:
        src = chunk.get("source", "Specs PDF")
        page = chunk.get("page_num", 1)
        text = chunk.get("text", "")
        evidence_text_blocks.append(f"[Source: {src}, Page {page}]: {text}")
        citations.append(f"{src} (Page {page})")
        
    # Check if Gemini API key is configured
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            
            prompt = f"""
You are the Unilog AI Product Intelligence Assistant. Answer the User Query based strictly on the provided Technical Evidence Chunks.

User Query: "{query}"
Target Model: {mpn}

TECHNICAL EVIDENCE CHUNKS:
{chr(10).join(evidence_text_blocks)}

INSTRUCTIONS:
1. Base your answer only on the provided evidence. Cite source filenames and page numbers inside your answer when stating values.
2. If the user asks about an attribute that is not in the text, clearly state that this specification was not found in the manufacturer documents.
3. Keep the answer structured, clear, and professional.
"""
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config={"temperature": 0.2}
            )
            return {"answer": response.text, "verified": bool(citations)}
        except Exception as e:
            logger.error(f"Gemini chatbot execution failed ({e}). Falling back to template generation.")

    lines = [f"### Evidence for {mpn}", "The indexed manufacturer evidence contains:"]
    for chunk in evidence[:4]:
        source = chunk.get("source", "unknown source")
        page = chunk.get("page_num", "?")
        lines.append(f"- {chunk.get('text', '').strip()} _(Source: {source}, Page {page})_")
    return {"answer": "\n".join(lines), "verified": bool(citations)}


def verify_answer(state: ChatbotState) -> Dict[str, Any]:
    """Ensures answer stays grounded. Checks that answer does not include external references."""
    if state["intent"] == "general_query":
        return {"verified": True}
    answer = state.get("answer", "")
    evidence = state.get("retrieved_evidence", [])
    citations_present = all(
        str(chunk.get("source", "unknown source")) in answer and
        f"Page {chunk.get('page_num', '?')}" in answer
        for chunk in evidence[:4]
    )
    if not answer or not citations_present:
        citations = " ".join(
            f"({chunk.get('source', 'unknown source')}, Page {chunk.get('page_num', '?')})"
            for chunk in state.get("retrieved_evidence", [])[:4]
        )
        return {
            "answer": f"I could not verify a complete answer from the indexed manufacturer evidence. {citations}".strip(),
            "verified": False,
        }
    return {"verified": True}


def build_chatbot_graph():
    workflow = StateGraph(ChatbotState)
    
    workflow.add_node("classify_intent", classify_intent)
    workflow.add_node("identify_product", identify_product)
    workflow.add_node("retrieve_evidence", retrieve_evidence)
    workflow.add_node("generate_answer", generate_answer)
    workflow.add_node("verify_answer", verify_answer)
    
    workflow.set_entry_point("classify_intent")
    workflow.add_edge("classify_intent", "identify_product")
    workflow.add_edge("identify_product", "retrieve_evidence")
    workflow.add_edge("retrieve_evidence", "generate_answer")
    workflow.add_edge("generate_answer", "verify_answer")
    workflow.add_edge("verify_answer", END)
    
    return workflow.compile()


_bot_instance = None

def chatbot_ask(query: str, chat_history: List[Dict[str, str]] | None = None) -> str:
    """Execute Chatbot workflow on user query and return answer."""
    global _bot_instance
    if _bot_instance is None:
        _bot_instance = build_chatbot_graph()
        
    state_input: ChatbotState = {
        "query": query,
        "chat_history": chat_history or [],
        "intent": "general_query",
        "resolved_product_mpn": None,
        "retrieved_evidence": [],
        "answer": "",
        "verified": False,
    }
    
    result = _bot_instance.invoke(state_input)
    return result["answer"]
