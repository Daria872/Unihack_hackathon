from __future__ import annotations

import pytest
from app.models.product_input import ProductInput
from app.services.enrichment.workflow import (
    build_enrichment_graph,
    enrich_product,
    resolve_product,
    retrieve_evidence,
    extract_attributes,
    verify_evidence,
    confidence_check,
    lov_validation,
    uom_normalization,
    description_generation,
    final_validation,
    final_output,
    EnrichmentState,
)
from app.services.retrieval.qdrant_db import get_qdrant_service
from app.services.ingestion.pdf import PDFElement


def test_graph_node_execution_flow() -> None:
    """Verifies that all 10 nodes of the LangGraph workflow execute in correct order."""
    state: EnrichmentState = {
        "product_input": {
            "part_number": "PART_001",
            "mfg_part_num": "PDSH4816AF",
            "part_desc": "Professional Built-In Dishwasher",
            "e1_brand": "Frigidaire",
            "unilog_brand": "Frigidaire",
            "dib_brand": "Frigidaire",
            "part_manuf": "Frigidaire",
        },
        "manufacturer_name": None,
        "brand_name": None,
        "mfg_part_num": None,
        "part_desc": None,
        "classpath": None,
        "retrieval_query": "",
        "evidence_chunks": [],
        "extracted_attributes": {},
        "attribute_evidence": {},
        "attribute_confidence": {},
        "validated_attributes": {},
        "attribute_uoms": {},
        "retry_count": 0,
        "fields_needing_review": [],
        "needs_retry": False,
        "invoice_desc": None,
        "mobile_desc": None,
        "short_desc": None,
        "long_desc1": None,
        "retail_desc": None,
        "marketing_description": None,
        "final_output": {},
    }

    # Step 1: Resolve Product
    res1 = resolve_product(state)
    assert res1["manufacturer_name"] == "Frigidaire"
    assert res1["brand_name"] == "Frigidaire"
    state.update(res1)

    # Step 2: Retrieve Evidence
    res2 = retrieve_evidence(state)
    assert "retrieval_query" in res2
    state.update(res2)

    # Step 3: Extract Attributes
    res3 = extract_attributes(state)
    assert "extracted_attributes" in res3
    state.update(res3)

    # Step 4: Verify Evidence
    res4 = verify_evidence(state)
    assert "fields_needing_review" in res4
    state.update(res4)

    # Step 5: Confidence Check
    res5 = confidence_check(state)
    assert "fields_needing_review" in res5
    state.update(res5)

    # Step 6: LOV Validation
    res6 = lov_validation(state)
    assert "validated_attributes" in res6
    state.update(res6)

    # Step 7: UOM Normalization
    res7 = uom_normalization(state)
    assert "attribute_uoms" in res7
    state.update(res7)

    # Step 8: Description Generation
    res8 = description_generation(state)
    assert res8["invoice_desc"] is not None
    assert len(res8["invoice_desc"]) <= 40
    state.update(res8)

    # Step 9: Final Validation
    res9 = final_validation(state)
    assert "needs_retry" in res9
    state.update(res9)

    # Step 10: Final Output
    res10 = final_output(state)
    assert "final_output" in res10
    out = res10["final_output"]
    assert out["Mfg_Part_Num"] == "PDSH4816AF"
    assert out["MANUFACTURER_NAME"] == "Frigidaire"


def test_successful_enrichment_path() -> None:
    """Verifies successful end-to-end enrichment path on fully grounded evidence."""
    qdrant = get_qdrant_service()
    mpn = "PDSH4816AF_SUCCESS"
    qdrant.index_pdf_elements(
        mpn,
        [
            PDFElement(
                text="Frigidaire Model PDSH4816AF_SUCCESS specs. 5 Wash Cycles. 120 V electrical rating, 15 A. Sound rating: 47 dBA.",
                page_num=1,
                element_type="paragraph",
            )
        ],
    )

    prod = ProductInput(
        source_row=10,
        mfg_part_num=mpn,
        part_desc="Professional Built-In Dishwasher",
        e1_brand="Frigidaire",
        unilog_brand="Frigidaire",
        dib_brand="Frigidaire",
        part_manuf="Frigidaire",
    )

    result = enrich_product(prod)
    assert result["Mfg_Part_Num"] == mpn
    assert result["MANUFACTURER_NAME"] == "Frigidaire"
    assert len(result["INVOICE_DESC"]) <= 40
    assert len(result["MOBILE_DESC"]) > 0


def test_retry_and_human_review_paths() -> None:
    """Verifies Self-RAG corrective retry loop and fallback to NEEDS_HUMAN_REVIEW after 2 failed attempts."""
    # Create state with low confidence / ungrounded attribute
    state: EnrichmentState = {
        "product_input": {
            "part_number": "PART_999",
            "mfg_part_num": "UNKNOWN_MPN_999",
            "part_desc": "Unknown Equipment",
            "e1_brand": "UnknownBrand",
            "unilog_brand": None,
            "dib_brand": None,
            "part_manuf": "UnknownBrand",
        },
        "manufacturer_name": "UnknownBrand",
        "brand_name": "UnknownBrand",
        "mfg_part_num": "UNKNOWN_MPN_999",
        "part_desc": "Unknown Equipment",
        "classpath": "Appliances & Consumer Electronics>Kitchen Appliances>Built-In Dishwashers",
        "retrieval_query": "UNKNOWN_MPN_999 specifications",
        "evidence_chunks": [],
        "extracted_attributes": {"Voltage Rating": "9999 V"},
        "attribute_evidence": {"Voltage Rating": "Invented evidence string"},
        "attribute_confidence": {"Voltage Rating": 0.2},  # Below 0.8 threshold
        "validated_attributes": {"Voltage Rating": "9999 V"},
        "attribute_uoms": {"Voltage Rating": "V"},
        "retry_count": 0,
        "fields_needing_review": ["Voltage Rating"],
        "needs_retry": False,
        "invoice_desc": "UNKNOWN",
        "mobile_desc": "Unknown Brand, Unknown Equipment",
        "short_desc": "Unknown Brand UNKNOWN_MPN_999 Equipment",
        "long_desc1": "Unknown Brand Equipment",
        "retail_desc": "Equipment",
        "marketing_description": "Unknown Equipment",
        "final_output": {},
    }

    # Attempt 1: Final validation triggers retry
    res_val1 = final_validation(state)
    assert res_val1["needs_retry"] is True
    assert res_val1["retry_count"] == 1
    state.update(res_val1)

    # Attempt 2: Final validation triggers retry count 2
    res_val2 = final_validation(state)
    assert res_val2["needs_retry"] is True
    assert res_val2["retry_count"] == 2
    state.update(res_val2)

    # Attempt 3: Retry count hit limit (2), does not trigger retry, proceeds to final output
    res_val3 = final_validation(state)
    assert res_val3["needs_retry"] is False
    state.update(res_val3)

    # Generate final output after 2 failed attempts
    out_res = final_output(state)
    final_dict = out_res["final_output"]

    # Verify that Voltage Rating field value is set to NEEDS_HUMAN_REVIEW
    found_review_field = False
    for i in range(1, 51):
        if final_dict.get(f"ATTRIBUTE_LABEL {i}") == "Voltage Rating":
            assert final_dict.get(f"ATTRIBUTE_VALUE {i}") == "NEEDS_HUMAN_REVIEW"
            found_review_field = True
            break
    assert found_review_field is True
