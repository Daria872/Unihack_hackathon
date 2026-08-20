from __future__ import annotations

import os
from pathlib import Path
import pytest

from app.services.ingestion.pdf import PDFProcessor, PDFElement, chunk_pdf_elements
from app.services.retrieval.qdrant_db import QdrantDBService, DeterministicEmbedder
from app.services.extraction.gemini_extractor import GeminiAttributeExtractor, ExtractedAttribute
from app.api.pipeline import make_dummy_pdf


def test_pdf_processing_extracts_elements_and_metadata(tmp_path: Path) -> None:
    """Test 1: Docling / PDF Processor extracts text, page numbers, element types, and metadata."""
    pdf_path = tmp_path / "sample_manufacturer_spec.pdf"
    content = (
        "Frigidaire Dishwasher Model PDSH4816AF Specifications\n"
        "Page 1 details: Voltage Rating: 120 V. Amperage Rating: 15 A.\n"
        "Sound Level: 47 dBA. Mounting Type: Built-in.\n"
        "Number of Wash Cycles: 5 wash cycles available."
    )
    make_dummy_pdf(content, pdf_path)

    elements = PDFProcessor.process_pdf(pdf_path)
    
    assert len(elements) > 0
    for el in elements:
        assert isinstance(el, PDFElement)
        assert isinstance(el.text, str) and len(el.text) > 0
        assert isinstance(el.page_num, int) and el.page_num >= 1
        assert el.element_type in ("paragraph", "table", "heading")
        assert "source" in el.metadata
        assert el.metadata["source"] == pdf_path.name


def test_qdrant_vector_store_indexing_and_mpn_retrieval() -> None:
    """Test 2: Chunk storage in Qdrant and retrieval via MPN/keyword + semantic search."""
    db = QdrantDBService(location=":memory:")
    mpn = "PDSH4816AF_TEST"

    elements = [
        PDFElement(
            text="Electrical requirements: 120 V voltage rating, 15 A amperage rating.",
            page_num=1,
            element_type="paragraph",
            metadata={"source": "spec_sheet.pdf"}
        ),
        PDFElement(
            text="Acoustic specifications: Sound level operates at whisper-quiet 47 dBA.",
            page_num=2,
            element_type="paragraph",
            metadata={"source": "spec_sheet.pdf"}
        ),
        PDFElement(
            text="Dimensions: 24 in W x 24-1/4 in D. Depth with door open: 50-1/4 in.",
            page_num=2,
            element_type="paragraph",
            metadata={"source": "spec_sheet.pdf"}
        ),
    ]

    # Index into Qdrant
    db.index_pdf_elements(mfg_part_num=mpn, elements=elements)

    # Retrieval Test A: Filtered by MPN with semantic query
    results = db.retrieve(query="What is the sound level in dBA?", mfg_part_num=mpn, limit=2)
    assert len(results) >= 1
    top_hit = results[0]
    assert top_hit["mfg_part_num"] == mpn
    assert "47 dBA" in top_hit["text"] or "Acoustic" in top_hit["text"]
    assert top_hit["page_num"] == 2
    assert top_hit["source"] == "spec_sheet.pdf"

    # Retrieval Test B: Non-matching MPN should return no results
    empty_results = db.retrieve(query="sound level", mfg_part_num="NON_EXISTENT_MPN", limit=5)
    assert len(empty_results) == 0


def test_gemini_attribute_extraction_schema_and_evidence() -> None:
    """Test 3: Gemini structured attribute extraction with name, value, confidence, and source evidence."""
    extractor = GeminiAttributeExtractor()

    retrieved_chunks = [
        {
            "text": "Frigidaire PDSH4816AF. 5 Wash Cycles. Voltage Rating: 120 V. Sound Level: 47 dBA. Stainless Steel finish.",
            "page_num": 1,
            "element_type": "paragraph",
            "source": "PDSH4816AF_spec.pdf",
            "mfg_part_num": "PDSH4816AF",
        }
    ]

    allowed_attributes = ["Number of Wash Cycles", "Voltage Rating", "Sound Level", "Material"]

    extracted = extractor.extract_attributes(
        product_desc="Frigidaire Professional Built-in Dishwasher",
        mfg_part_num="PDSH4816AF",
        classpath="Appliances > Dishwashers",
        allowed_attributes=allowed_attributes,
        retrieved_chunks=retrieved_chunks,
    )

    assert len(extracted) >= 3
    for attr in extracted:
        assert isinstance(attr, ExtractedAttribute)
        assert attr.name in allowed_attributes
        assert isinstance(attr.value, str) and len(attr.value) > 0
        assert 0.0 <= attr.confidence <= 1.0
        assert isinstance(attr.source_evidence, str) and len(attr.source_evidence) > 0

    # Verify specific extracted values match ground truth evidence
    cycles_attr = next(a for a in extracted if a.name == "Number of Wash Cycles")
    assert cycles_attr.value == "5"
    assert "5 Wash Cycles" in cycles_attr.source_evidence or "5" in cycles_attr.source_evidence

    voltage_attr = next(a for a in extracted if a.name == "Voltage Rating")
    assert voltage_attr.value == "120" or "120" in voltage_attr.value

    sound_attr = next(a for a in extracted if a.name == "Sound Level")
    assert sound_attr.value == "47" or "47" in sound_attr.value


def test_attribute_extractor_never_invents_unsupported_attributes() -> None:
    """Test 4: Strict instruction test — attributes not found in evidence are NOT extracted/invented."""
    extractor = GeminiAttributeExtractor()

    retrieved_chunks = [
        {
            "text": "Basic specification sheet. Color: Stainless Steel.",
            "page_num": 1,
            "element_type": "paragraph",
            "source": "unknown.pdf",
            "mfg_part_num": "BASIC_123",
        }
    ]

    # Ask for attributes that are NOT present in the chunks (e.g. Horsepower, BTU Rating)
    allowed_attributes = ["Horsepower", "BTU Rating", "Color"]

    extracted = extractor.extract_attributes(
        product_desc="Generic Product",
        mfg_part_num="BASIC_123",
        classpath="General",
        allowed_attributes=allowed_attributes,
        retrieved_chunks=retrieved_chunks,
    )

    extracted_names = [a.name for a in extracted]
    assert "Horsepower" not in extracted_names
    assert "BTU Rating" not in extracted_names
    assert "Color" in extracted_names


def test_pdf_chunking_retains_page_and_provenance() -> None:
    element = PDFElement(
        text="word " * 500,
        page_num=7,
        element_type="table",
        metadata={"source": "manual.pdf", "table_data": "| A | B |"},
    )

    chunks = chunk_pdf_elements([element], max_chars=100, overlap=20)

    assert len(chunks) > 1
    assert all(chunk.page_num == 7 for chunk in chunks)
    assert all(chunk.metadata["source"] == "manual.pdf" for chunk in chunks)
    assert all(chunk.element_type == "table" for chunk in chunks)
    assert chunks[0].text.split()[-1] in chunks[1].text


def test_qdrant_hybrid_search_uses_lexical_match_and_normalized_mpn() -> None:
    db = QdrantDBService(location=":memory:")
    db.index_pdf_elements("ABC-123", [
        PDFElement("Voltage rating: 120 V", 1, "paragraph", {"source": "a.pdf"}),
        PDFElement("The product has a quiet stainless steel finish", 2, "paragraph", {"source": "a.pdf"}),
    ])

    results = db.retrieve("stainless steel finish", mfg_part_num="abc-123", limit=1)

    assert len(results) == 1
    assert "stainless steel" in results[0]["text"].lower()
    assert results[0]["hybrid_score"] >= 0


def test_gemini_response_validation_rejects_ungrounded_attributes() -> None:
    extractor = GeminiAttributeExtractor()

    class FakeModels:
        def generate_content(self, **_: object) -> object:
            return type("Response", (), {"text": '{"attributes": [{"name": "Voltage Rating", "value": "240", "confidence": 1.0, "source_evidence": "Voltage Rating: 240 V"}]}'})()

    extractor.client = type("Client", (), {"models": FakeModels()})()
    extracted = extractor.extract_attributes(
        product_desc="Widget",
        mfg_part_num="ABC-123",
        classpath="General",
        allowed_attributes=["Voltage Rating"],
        retrieved_chunks=[{"text": "Voltage Rating: 120 V", "page_num": 1, "source": "a.pdf"}],
    )

    assert extracted == []
