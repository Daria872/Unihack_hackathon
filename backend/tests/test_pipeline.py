from __future__ import annotations

import os
from pathlib import Path
import pytest

from app.models.product_input import ProductInput
from app.services.ingestion.pdf import PDFProcessor
from app.services.retrieval.qdrant_db import get_qdrant_service
from app.services.extraction.gemini_extractor import GeminiAttributeExtractor
from app.services.enrichment.workflow import enrich_product
from app.services.chatbot.bot import chatbot_ask
from app.api.pipeline import make_dummy_pdf


def test_pdf_processor_extractor(tmp_path: Path) -> None:
    """Verifies that the PDF processor extracts text and pages correctly from a PDF."""
    pdf_path = tmp_path / "test_spec.pdf"
    test_text = "Voltage Rating: 120 V. Sound Level: 47 dBA. Number of wash cycles: 5. Model PDSH4816AF."
    make_dummy_pdf(test_text, pdf_path)

    elements = PDFProcessor.process_pdf(pdf_path)
    assert len(elements) >= 1
    assert any("Voltage Rating" in el.text for el in elements)
    assert elements[0].page_num == 1


def test_qdrant_indexing_and_search() -> None:
    """Tests indexing document chunks in Qdrant database and retrieving them."""
    qdrant = get_qdrant_service()
    from app.services.ingestion.pdf import PDFElement
    
    mpn = "TEST_MPN_123"
    elements = [
        PDFElement(text="Amperage configuration is 15 A. Height: 33-7/16 in.", page_num=1, element_type="paragraph"),
        PDFElement(text="General dishwasher specifications for models TEST_MPN_123.", page_num=2, element_type="paragraph")
    ]
    
    qdrant.index_pdf_elements(mpn, elements)
    
    # Retrieve
    hits = qdrant.retrieve(query="Amperage configuration", mfg_part_num=mpn, limit=2)
    assert len(hits) >= 1
    assert any("Amperage" in h["text"] for h in hits)
    assert hits[0]["mfg_part_num"] == mpn


def test_gemini_attribute_extractor() -> None:
    """Tests that Gemini or back-up heuristic correctly parses specs from retrieved chunks."""
    extractor = GeminiAttributeExtractor()
    
    retrieved = [
        {
            "text": "Model PDSH4816AF specs. Normal wash cycles: 5. Sound rating: 47 dBA.",
            "page_num": 1,
            "source": "manual.pdf",
            "mfg_part_num": "PDSH4816AF"
        }
    ]
    
    allowed = ["Number of Wash Cycles", "Sound Level", "Voltage Rating"]
    
    extracted = extractor.extract_attributes(
        product_desc="Built-in Dishwasher Stainless Steel",
        mfg_part_num="PDSH4816AF",
        classpath="Kitchen Appliances",
        allowed_attributes=allowed,
        retrieved_chunks=retrieved
    )
    
    # Check that values mapped correctly
    extracted_names = [attr.name for attr in extracted]
    assert "Number of Wash Cycles" in extracted_names
    assert "Sound Level" in extracted_names
    
    cycles_attr = next(a for a in extracted if a.name == "Number of Wash Cycles")
    assert "5" in cycles_attr.value or cycles_attr.value == 5


def test_full_langgraph_enrichment_flow() -> None:
    """Runs the full LangGraph enrichment workflow loop on a sample ProductInput."""
    # Seed mock specs in Qdrant first so retrieval succeeds
    qdrant = get_qdrant_service()
    from app.services.ingestion.pdf import PDFElement
    
    mpn = "PDSH4816AF"
    elements = [
        PDFElement(text="Frigidaire Model PDSH4816AF. 5 Wash Cycles. 120 V electrical hookup, 15 A. 47 dBA sound rating.", page_num=1, element_type="paragraph")
    ]
    qdrant.index_pdf_elements(mpn, elements)

    prod = ProductInput(
        source_row=2,
        mfg_part_num="PDSH4816AF",
        part_desc="Professional Built-In Dishwasher",
        e1_brand="Frigidaire",
        unilog_brand="Frigidaire",
        dib_brand="Frigidaire",
        part_manuf="Frigidaire"
    )

    enriched = enrich_product(prod)
    
    # Assert primary delivery fields exist
    assert enriched["Mfg_Part_Num"] == "PDSH4816AF"
    assert enriched["MANUFACTURER_NAME"] == "Frigidaire"
    assert enriched["BRAND_NAME"] == "Frigidaire"
    assert len(enriched["INVOICE_DESC"]) <= 40
    assert len(enriched["MOBILE_DESC"]) > 0
    
    # Attribute mapping checks
    attr_labels = [enriched.get(f"ATTRIBUTE_LABEL {i}") for i in range(1, 10)]
    assert "Number of Wash Cycles" in attr_labels or "Series" in attr_labels


def test_chatbot_answering_workflow() -> None:
    """Verifies that the chatbot intent routing and citation lookup return correct spec details."""
    qdrant = get_qdrant_service()
    from app.services.ingestion.pdf import PDFElement

    mpn = "PDSH4816AF"
    elements = [
        PDFElement(text="Frigidaire Model PDSH4816AF. 5 Wash Cycles. 120 V electrical hookup, 15 A. 47 dBA sound rating.", page_num=1, element_type="paragraph")
    ]
    qdrant.index_pdf_elements(mpn, elements)

    query = "What is the noise level of the Frigidaire PDSH4816AF dishwasher?"
    answer = chatbot_ask(query=query)
    
    assert "47" in answer
    assert "dBA" in answer or "dba" in answer.lower()
    
    # General query check
    general_answer = chatbot_ask(query="Hello there how are you")
    assert "assistant" in general_answer.lower() or "unilog" in general_answer.lower() or "help" in general_answer.lower()
