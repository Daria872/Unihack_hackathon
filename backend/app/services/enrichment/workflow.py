from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, TypedDict, cast
from langgraph.graph import StateGraph, END

from app.models.product_input import ProductInput
from app.services.retrieval import reference as ref_service
from app.services.retrieval.qdrant_db import get_qdrant_service
from app.services.extraction.gemini_extractor import GeminiAttributeExtractor, ExtractedAttribute

logger = logging.getLogger(__name__)

# State definition
class EnrichmentState(TypedDict):
    # original product input data
    product_input: Dict[str, Any]
    
    # resolved identity
    manufacturer_name: str | None
    brand_name: str | None
    mfg_part_num: str | None
    part_desc: str | None
    classpath: str | None
    
    # evidence
    retrieval_query: str
    evidence_chunks: List[Dict[str, Any]]
    
    # extraction & metrics
    extracted_attributes: Dict[str, Any]      # label -> value
    attribute_evidence: Dict[str, str]        # label -> text snippet
    attribute_confidence: Dict[str, float]    # label -> score
    
    # normalisations and validation
    validated_attributes: Dict[str, Any]      # label -> validated/normalized value
    attribute_uoms: Dict[str, str]            # label -> UOM token (like "V", "A")
    
    # retry control variables
    retry_count: int
    fields_needing_review: List[str]          # labels failing confidence or validation
    needs_retry: bool
    
    # descriptions
    invoice_desc: str | None
    mobile_desc: str | None
    short_desc: str | None
    long_desc1: str | None
    retail_desc: str | None
    marketing_description: str | None
    
    # final output matching 252 fields
    final_output: Dict[str, Any]


# Nodes

def resolve_product(state: EnrichmentState) -> Dict[str, Any]:
    """1. Resolve product identity against master catalog lookups."""
    logger.info("Node: resolve_product")
    inp = state["product_input"]
    part_manuf = inp.get("part_manuf")
    e1_brand = inp.get("e1_brand")
    unilog_brand = inp.get("unilog_brand")
    dib_brand = inp.get("dib_brand")
    mfg_part_num = inp.get("mfg_part_num")
    part_desc = inp.get("part_desc")

    # Call ReferenceDataService to resolve manufacturer name
    canonical_mfr = ref_service.find_manufacturer(part_manuf)
    if not canonical_mfr and part_manuf:
        canonical_mfr = part_manuf.strip()

    # Search brands in order of input columns
    canonical_brand = None
    for brand_candidate in [e1_brand, unilog_brand, dib_brand]:
        if brand_candidate:
            canonical_brand = ref_service.find_brand(brand_candidate, manufacturer=canonical_mfr)
            if canonical_brand:
                break
    
    if not canonical_brand and canonical_mfr:
        # Default brand is the manufacturer name as per ground-truth instruction
        canonical_brand = canonical_mfr

    # Determine classpath: Since our input deals with built-in dishwashers, we check description 
    # to associate with standard classpath
    classpath = "Appliances & Consumer Electronics>Kitchen Appliances>Built-In Dishwashers"
    
    # Basic class routing helper (if input is faucet or fitting we can adapt)
    desc_lower = (part_desc or "").lower()
    if "faucet" in desc_lower:
        classpath = "Plumbing>Faucets>Kitchen Faucets"
    elif "fitting" in desc_lower or "coupling" in desc_lower:
        classpath = "Industrial Supply>Fittings>Hose Fittings"

    return {
        "manufacturer_name": canonical_mfr,
        "brand_name": canonical_brand,
        "mfg_part_num": mfg_part_num,
        "part_desc": part_desc,
        "classpath": classpath,
        "retry_count": 0,
        "fields_needing_review": [],
        "needs_retry": False,
    }


def retrieve_evidence(state: EnrichmentState) -> Dict[str, Any]:
    """2. Retrieve relevant specification document chunks from Qdrant vector store."""
    logger.info("Node: retrieve_evidence")
    # A corrective pass must be judged from fresh retrieval and extraction results.
    fields_needing_review: List[str] = []
    mfg_part_num = state["mfg_part_num"]
    client = get_qdrant_service()
    
    # Query: Match on MPN or brand.
    # On retries (Corrective Retrieval), we widen the search
    if state["retry_count"] > 0:
        query = f"{state['brand_name']} {mfg_part_num} specifications documentation details"
        limit = 10
    else:
        query = f"{mfg_part_num} specifications"
        limit = 5
        
    hits = client.retrieve(query=query, mfg_part_num=mfg_part_num, limit=limit)
    
    # If no results found, try a wider search without MPN filter (Corrective search)
    if not hits:
        hits = client.retrieve(query=f"{mfg_part_num} dishwasher manuals spec datasheet", limit=limit)

    logger.info(f"Retrieved {len(hits)} evidence chunks.")
    return {
        "retrieval_query": query,
        "evidence_chunks": hits,
        "fields_needing_review": fields_needing_review,
    }


def extract_attributes(state: EnrichmentState) -> Dict[str, Any]:
    """3. Extract technical specification attributes using Gemini extractor."""
    logger.info("Node: extract_attributes")
    classpath = state["classpath"]
    allowed_attributes = ref_service.get_allowed_attributes(classpath)
    
    # Use Gemini extractor
    extractor = GeminiAttributeExtractor()
    extracted = extractor.extract_attributes(
        product_desc=state["part_desc"] or "",
        mfg_part_num=state["mfg_part_num"] or "",
        classpath=classpath or "",
        allowed_attributes=allowed_attributes,
        retrieved_chunks=state["evidence_chunks"],
    )
    
    # Populate state dicts
    extracted_attr = {}
    attr_evidence = {}
    attr_confidence = {}
    
    for attr in extracted:
        extracted_attr[attr.name] = attr.value
        attr_evidence[attr.name] = attr.source_evidence
        attr_confidence[attr.name] = attr.confidence

    return {
        "extracted_attributes": extracted_attr,
        "attribute_evidence": attr_evidence,
        "attribute_confidence": attr_confidence,
    }


def verify_evidence(state: EnrichmentState) -> Dict[str, Any]:
    """4. Verify that each attribute is grounded directly in document chunks."""
    logger.info("Node: verify_evidence")
    extracted_attr = state["extracted_attributes"]
    attr_evidence = state["attribute_evidence"]
    chunks_text = " ".join([chunk["text"].lower() for chunk in state["evidence_chunks"]])
    
    fields_needing_review = list(state.get("fields_needing_review", []))
    allowed_attributes = ref_service.get_allowed_attributes(state["classpath"])
    
    # Verify grounding
    for name, val in extracted_attr.items():
        evidence = attr_evidence.get(name, "")
        if not evidence or evidence.strip().lower() not in chunks_text:
            # Low rating or mismatch in grounding
            logger.warning(f"Grounding failure for {name}: {evidence[:50]}")
            if name not in fields_needing_review:
                fields_needing_review.append(name)

    for name in allowed_attributes:
        if name not in extracted_attr and name not in fields_needing_review:
            fields_needing_review.append(name)
                
    return {"fields_needing_review": fields_needing_review}


def confidence_check(state: EnrichmentState) -> Dict[str, Any]:
    """5. Check if attribute confidence values are sufficient."""
    logger.info("Node: confidence_check")
    attr_confidence = state["attribute_confidence"]
    fields_needing_review = list(state.get("fields_needing_review", []))
    
    for name, score in attr_confidence.items():
        if score < 0.8:
            logger.warning(f"Confidence score check failed for {name} ({score} < 0.8)")
            if name not in fields_needing_review:
                fields_needing_review.append(name)
                
    return {"fields_needing_review": fields_needing_review}


def lov_validation(state: EnrichmentState) -> Dict[str, Any]:
    """6. Run deterministic LOV validation."""
    logger.info("Node: lov_validation")
    classpath = state["classpath"]
    extracted = state["extracted_attributes"]
    fields_needing_review = list(state.get("fields_needing_review", []))
    
    validated = {}
    for name, val in extracted.items():
        if not val or str(val).strip() == "":
            validated[name] = None
            continue
            
        # Validate against LOV
        is_valid = ref_service.validate_lov_value(classpath, name, str(val))
        if is_valid:
            # In cases where it was alias, clean value
            allowed_vals = ref_service.get_allowed_values(classpath, name)
            # Find exact canonical value matching or alias
            val_clean = str(val).strip()
            # If there's an alias table in reference service, it will resolve or we default to existing
            validated[name] = val_clean
        else:
            logger.warning(f"LOV compliance failure for {name}: {val}")
            validated[name] = None
            if name not in fields_needing_review:
                fields_needing_review.append(name)
                
    return {
        "validated_attributes": validated,
        "fields_needing_review": fields_needing_review
    }


def uom_normalization(state: EnrichmentState) -> Dict[str, Any]:
    """7. Normalize units and convert fraction layouts."""
    logger.info("Node: uom_normalization")
    validated = dict(state["validated_attributes"])
    fields_needing_review = list(state.get("fields_needing_review", []))
    
    uoms = {}
    for name, val in list(validated.items()):
        if not val:
            uoms[name] = ""
            continue
            
        str_val = str(val).strip()
        
        # Check if the attribute requires UOM normalization
        # e.g., Voltage Rating (V), Amperage Rating (A), Sound Level (dBA), Depth With Door Open (in)
        normalized = ref_service.normalize_uom(str_val)
        if normalized:
            # If normalized contains space + UOM, split it
            # Number spacing rule: "24 in", not "24in".
            parts = normalized.split(" ")
            if len(parts) == 2:
                # E.g. "120 V" -> value "120", UOM "V"
                validated[name] = parts[0]
                uoms[name] = parts[1]
            else:
                validated[name] = normalized
                uoms[name] = ""
        else:
            uoms[name] = ""
            if re.search(r"\d\s*(?:v|volt|a|amp|dba|inch|in)\b", str_val, re.IGNORECASE):
                if name not in fields_needing_review:
                    fields_needing_review.append(name)
            
        # Convert decimal inches to fraction inches (e.g. 50.25 -> 50-1/4)
        # Check if unit indicates inches (either in UOM column or inside value itself)
        if uoms.get(name) == "in" and re.fullmatch(r"[-+]?\d+(?:\.\d+)?\s*in(?:ch(?:es)?)?", str_val, re.IGNORECASE):
            # Extract numeric value
            num_part = re.findall(r"[-+]?\d+(?:\.\d+)?", str_val)
            if num_part:
                fraction_str = ref_service.convert_fraction(num_part[0])
                if fraction_str:
                    validated[name] = fraction_str
                    uoms[name] = "in"

    return {
        "validated_attributes": validated,
        "attribute_uoms": uoms,
        "fields_needing_review": fields_needing_review
    }


def description_generation(state: EnrichmentState) -> Dict[str, Any]:
    """8. Build descriptions complying with character limits and schemas."""
    logger.info("Node: description_generation")
    inp = state["product_input"]
    brand = state["brand_name"] or ""
    mfr = state["manufacturer_name"] or ""
    mpn = state["mfg_part_num"] or ""
    
    validated = state["validated_attributes"]
    uoms = state["attribute_uoms"]
    
    # Pull values for descriptions
    series = validated.get("Series") or ""
    wash_cycles = validated.get("Number of Wash Cycles") or ""
    voltage = validated.get("Voltage Rating") or ""
    volt_uom = uoms.get("Voltage Rating") or ""
    amperage = validated.get("Amperage Rating") or ""
    amp_uom = uoms.get("Amperage Rating") or ""
    mounting = validated.get("Mounting Type") or ""
    sound = validated.get("Sound Level") or ""
    sound_uom = uoms.get("Sound Level") or ""
    material = validated.get("Material") or ""
    color = validated.get("Color") or ""
    size = validated.get("Size") or ""
    door_depth = validated.get("Depth With Door Open") or ""
    door_uom = uoms.get("Depth With Door Open") or ""
    min_height = validated.get("Minimum Height") or ""
    max_height = validated.get("Maximum Height") or ""
    add_info = validated.get("Additional Information") or ""
    
    # ------------------
    # INVOICE_DESC: <=40 characters, ALL CAPS
    # E.g. "DISHWASHER LEG 5 SST 120V 15A 50-1/4IN"
    # ------------------
    invoice_tokens = ["DISHWASHER"]
    if mounting:
        invoice_tokens.append(mounting.upper())
    if wash_cycles:
        invoice_tokens.append(f"{wash_cycles}")
    if material == "Stainless Steel":
        invoice_tokens.append("SST")
    if voltage:
        invoice_tokens.append(f"{voltage}{volt_uom}")
    if amperage:
        invoice_tokens.append(f"{amperage}{amp_uom}")
    
    # Format size/depth if short enough
    if door_depth:
        # No space before UOM in invoice example ("50-1/4IN")
        invoice_tokens.append(f"{door_depth}{door_uom}".upper())
        
    invoice_desc = " ".join([t for t in invoice_tokens if t])
    if len(invoice_desc) > 40:
        # Truncate or drop token if over size
        invoice_desc = invoice_desc[:40].strip()
        
    # ------------------
    # MOBILE_DESC: 60-80 characters
    # E.g. "Rheem Manufacturing FRIGIDAIRE, Dishwasher, Professional Series, PDSH4816AF"
    # ------------------
    mobile_tokens = []
    if mfr:
        mobile_tokens.append(mfr)
    if brand and brand != mfr:
        mobile_tokens.append(brand)
    mobile_tokens.append("Dishwasher")
    if series:
        mobile_tokens.append(series)
    if mpn:
        mobile_tokens.append(mpn)
    if mounting:
        mobile_tokens.append(f"{mounting} Mounting")
        
    mobile_desc = ", ".join([t for t in mobile_tokens if t])
    if len(mobile_desc) < 60:
        # Pad with other information
        if color:
            mobile_desc += f", {color}"
    if len(mobile_desc) > 80:
        mobile_desc = mobile_desc[:80].strip()

    # ------------------
    # Product Title / SHORT_DESC: Brand + Series + MPN + Item Type + key attributes
    # E.g. "FRIGIDAIRE® Professional Series PDSH4816AF Dishwasher With CleanBoost™, Leg Mounting, 5-Wash Cycle, Stainless Steel"
    # ------------------
    short_tokens = []
    if brand:
        short_tokens.append(brand)
    if series:
        short_tokens.append(series)
    if mpn:
        short_tokens.append(mpn)
    short_tokens.append("Dishwasher")
    
    # Details
    details = []
    if mounting:
        details.append(f"{mounting} Mounting")
    if wash_cycles:
        details.append(f"{wash_cycles}-Wash Cycle")
    if color:
        details.append(color)
        
    short_desc = " ".join([t for t in short_tokens if t])
    if details:
        short_desc += " " + ", ".join(details)
        
    # ------------------
    # LONG_DESC1: Product page description
    # ------------------
    # Detail items
    long_desc_items = []
    long_desc_items.append("Dishwasher")
    if series:
        long_desc_items.append(series)
    if wash_cycles:
        long_desc_items.append(f"{wash_cycles} Wash Cycles")
    if voltage:
        long_desc_items.append(f"{voltage} {volt_uom}")
    if amperage:
        long_desc_items.append(f"{amperage} {amp_uom}")
    if mounting:
        long_desc_items.append(f"{mounting} Mounting")
    if size:
        long_desc_items.append(size)
    if door_depth:
        # Keep space before UOM inside long desc
        long_desc_items.append(f"{door_depth}{f' {door_uom}' if door_uom else ''} Depth With Door Open")
    if min_height:
        # Height specs
        if "rack" in min_height.lower():
            long_desc_items.append(f"{min_height} Minimum Height")
        else:
            long_desc_items.append(f"{min_height}{f' {door_uom}' if door_uom else ''} Minimum Height")
    if max_height:
        long_desc_items.append(f"{max_height} Maximum Height")
    if sound:
        long_desc_items.append(f"{sound} {sound_uom} Sound Level")
    if material:
        long_desc_items.append(material)
    if color and color != material:
        long_desc_items.append(color)
    if add_info:
        long_desc_items.append(f"Additional Information: {add_info}")
        
    long_desc1 = f"{brand} " + ", ".join(long_desc_items)

    # Retail / Marketing
    retail_desc = f"{series} Dishwasher"
    if mounting:
        retail_desc += f", {mounting} Mounting"
    if color:
        retail_desc += f", {color}"
        
    marketing = inp.get("part_desc") or ""

    return {
        "invoice_desc": invoice_desc,
        "mobile_desc": mobile_desc,
        "short_desc": short_desc,
        "long_desc1": long_desc1,
        "retail_desc": retail_desc,
        "marketing_description": marketing,
    }


def final_validation(state: EnrichmentState) -> Dict[str, Any]:
    """9. Determine if extraction is fully valid or needs corrective retry."""
    logger.info("Node: final_validation")
    retry_count = state.get("retry_count", 0)
    fields_needing_review = state.get("fields_needing_review", [])
    
    needs_retry = False
    
    # We trigger retry if there are fields needing review AND we haven't hit the retry limit
    if fields_needing_review and retry_count < 2:
        logger.info(f"Validation failures detected for: {fields_needing_review}. Triggering Self-RAG retry. (Count: {retry_count + 1})")
        needs_retry = True
        return {
            "needs_retry": True,
            "retry_count": retry_count + 1,
        }
        
    if fields_needing_review:
        logger.warning(f"Failed enrichment validation for fields: {fields_needing_review} after {retry_count} retries. Marking for human review.")
        
    return {
        "needs_retry": False
    }


def final_output(state: EnrichmentState) -> Dict[str, Any]:
    """10. Assemble the 252-column row complying with the Delivery Format."""
    logger.info("Node: final_output")
    
    inp = state["product_input"]
    validated = state["validated_attributes"]
    uoms = state["attribute_uoms"]
    fields_needing_review = state.get("fields_needing_review", [])
    
    fields_mapped = {}
    
    # Populate the primary input details
    fields_mapped["PART_NUMBER"] = inp.get("part_number") or ""
    fields_mapped["Dept"] = inp.get("dept") or "Appliances"
    fields_mapped["Class"] = inp.get("class") or "Large Appliances"
    fields_mapped["Fine"] = inp.get("fine") or "Dishwashers"
    fields_mapped["SKU - MY_PART_NUMBER"] = inp.get("sku") or ""
    fields_mapped["Mfg_Part_Num"] = state["mfg_part_num"]
    fields_mapped["Part_Desc"] = state["part_desc"]
    fields_mapped["E1_Brand"] = inp.get("e1_brand")
    fields_mapped["Unilog_Brand"] = inp.get("unilog_brand")
    fields_mapped["DIB_Brand"] = inp.get("dib_brand")
    fields_mapped["Part_Manuf"] = inp.get("part_manuf")

    # Resolved Identity
    fields_mapped["MANUFACTURER_NAME"] = state["manufacturer_name"]
    fields_mapped["BRAND_NAME"] = state["brand_name"]
    fields_mapped["TRADE_NAME"] = ""
    fields_mapped["MANUFACTURER_PART_NUMBER"] = state["mfg_part_num"]
    fields_mapped["ALTERNATE_PART_NUMBER"] = ""
    fields_mapped["Classpath"] = state["classpath"]
    
    # Sourced Documents
    # Extract URLs from retrieved chunks
    doc_urls = []
    for chunk in state.get("evidence_chunks", []):
        src = chunk.get("source", "")
        # If it's a URL in source, keep it
        if src.startswith("http://") or src.startswith("https://"):
            doc_urls.append(src)
            
    for key in ("specification_sheet", "ref_url_1", "ref_url_2"):
        value = state["product_input"].get(key)
        if value and value not in doc_urls:
            doc_urls.append(value)

    # Fill MFR URL and Ref URLs
    fields_mapped["MFR URL"] = doc_urls[0] if len(doc_urls) > 0 else ""
    for i in range(1, 6):
        fields_mapped[f"Ref URL {i}"] = doc_urls[i] if i < len(doc_urls) else ""
        
    # Descriptions
    fields_mapped["MOBILE_DESC"] = state["mobile_desc"]
    fields_mapped["INVOICE_DESC"] = state["invoice_desc"]
    fields_mapped["SHORT_DESC"] = state["short_desc"]
    fields_mapped["LONG_DESC1"] = state["long_desc1"]
    fields_mapped["RETAIL_DESC"] = state["retail_desc"]
    fields_mapped["MARKETING_DESCRIPTION"] = state["marketing_description"] or ""

    # Standards compliance
    additional_information = str(validated.get("Additional Information") or "")
    fields_mapped["With"] = "CleanBoost" if "cleanboost" in additional_information.lower() else ""
    fields_mapped["Standard/Approvals"] = ""
    fields_mapped["Prop 65"] = ""
    fields_mapped["Application"] = ""
    fields_mapped["Includes"] = ""
    fields_mapped["Product Name"] = "Dishwasher"

    # Fill attributes up to slot 50
    # Map attributes list to output formats
    allowed_attributes = ref_service.get_allowed_attributes(state["classpath"])
    for idx in range(1, 51):
        if idx <= len(allowed_attributes):
            attr_name = allowed_attributes[idx - 1]
            fields_mapped[f"ATTRIBUTE_LABEL {idx}"] = attr_name
            
            # Check if this attribute failed validation
            if attr_name in fields_needing_review and state.get("retry_count", 0) >= 2:
                # Mark as needs human review
                fields_mapped[f"ATTRIBUTE_VALUE {idx}"] = "NEEDS_HUMAN_REVIEW"
                fields_mapped[f"ATTRIBUTE_UOM {idx}"] = ""
            else:
                fields_mapped[f"ATTRIBUTE_VALUE {idx}"] = validated.get(attr_name) or ""
                fields_mapped[f"ATTRIBUTE_UOM {idx}"] = uoms.get(attr_name) or ""
        else:
            fields_mapped[f"ATTRIBUTE_LABEL {idx}"] = ""
            fields_mapped[f"ATTRIBUTE_VALUE {idx}"] = ""
            fields_mapped[f"ATTRIBUTE_UOM {idx}"] = ""

    # Features
    # If Whirlpool, fill item features
    if additional_information:
        features = [item.strip() for item in re.split(r"[,;]", additional_information) if item.strip()]
        for f_idx in range(1, 21):
            if f_idx <= len(features):
                fields_mapped[f"ITEM_FEATURES_{f_idx}"] = features[f_idx - 1]
            else:
                fields_mapped[f"ITEM_FEATURES_{f_idx}"] = ""
    else:
        for f_idx in range(1, 21):
            fields_mapped[f"ITEM_FEATURES_{f_idx}"] = ""

    # Sells details & weights
    fields_mapped["UPC"] = ""
    fields_mapped["EAN"] = ""
    fields_mapped["GTIN"] = ""
    fields_mapped["UNSPSC"] = ""
    
    fields_mapped["Warranty"] = ""
        
    fields_mapped["List Price"] = ""
    fields_mapped["Selling Qty"] = ""
    fields_mapped["Selling UOM"] = ""
    fields_mapped["Standard Packaging Information"] = ""
    
    # Dimensions
    fields_mapped["LENGTH"] = ""
    fields_mapped["LENGTH_UOM"] = ""
    fields_mapped["HEIGHT"] = ""
    fields_mapped["HEIGHT_UOM"] = ""
    fields_mapped["WIDTH"] = ""
    fields_mapped["WIDTH_UOM"] = ""
    fields_mapped["WEIGHT"] = ""
    fields_mapped["WEIGHT_UOM"] = ""
    fields_mapped["VOLUME"] = ""
    fields_mapped["VOLUME_UOM"] = ""

    # Assets
    fields_mapped["Product Image"] = ""
    fields_mapped["Alternate Image 1"] = ""
    fields_mapped["Alternate Image 2"] = ""
    fields_mapped["Alternate Image 3"] = ""
    fields_mapped["Alternate Image 4"] = ""
    fields_mapped["Specification Sheet"] = doc_urls[0] if doc_urls else ""

    for manual_col in ["SDS", "SDS_1", "Warranty Information", "Catalog",
                       "Instruction/Installation Manual", "Service Manual", 
                       "Owners/User Manual", "Line Drawing", "MTR", "RoHS", 
                       "Full Engineering Drawing", "Energy Star Guide", 
                       "Technical Bulletin", "Submittal", "Compatibility Chart", 
                       "Size Chart", "Product Label/Insert", "Video Link", "Video Link 1"]:
        fields_mapped[manual_col] = ""

    fields_mapped["Country Of Origin"] = ""
    fields_mapped["Discontinued"] = ""
    fields_mapped["Actual Image (Yes/No)"] = "Yes"

    # Keep provenance and validation signals available to the API/UI while
    # export_job_excel strips these internal fields from delivery files.
    confidence = state.get("attribute_confidence", {})
    evidence = state.get("attribute_evidence", {})
    attribute_validation = {}
    for attr_name in allowed_attributes:
        value = validated.get(attr_name)
        attribute_validation[attr_name] = {
            "lov": bool(value) and ref_service.validate_lov_value(state["classpath"], attr_name, str(value)),
            "uom": bool(value) and (bool(uoms.get(attr_name)) or ref_service.normalize_uom(str(value)) is None),
            "source": bool(evidence.get(attr_name)),
            "confidence": float(confidence.get(attr_name, 0.0)),
            "reason": "low confidence" if float(confidence.get(attr_name, 0.0)) < 0.8 else "grounded in indexed evidence",
            "evidence": evidence.get(attr_name, ""),
        }
    fields_mapped["_attribute_validation"] = attribute_validation

    return {"final_output": fields_mapped}


# Router conditional function
def decide_routing(state: EnrichmentState) -> str:
    """Decide if we should go to retry loop or output final state."""
    if state.get("needs_retry"):
        return "retry"
    return "output"


# Create and compile StateGraph
def build_enrichment_graph():
    workflow = StateGraph(EnrichmentState)
    
    # Add nodes
    workflow.add_node("resolve_product", resolve_product)
    workflow.add_node("retrieve_evidence", retrieve_evidence)
    workflow.add_node("extract_attributes", extract_attributes)
    workflow.add_node("verify_evidence", verify_evidence)
    workflow.add_node("confidence_check", confidence_check)
    workflow.add_node("lov_validation", lov_validation)
    workflow.add_node("uom_normalization", uom_normalization)
    workflow.add_node("description_generation", description_generation)
    workflow.add_node("final_validation", final_validation)
    workflow.add_node("final_output", final_output)
    
    # Add edges
    workflow.set_entry_point("resolve_product")
    workflow.add_edge("resolve_product", "retrieve_evidence")
    workflow.add_edge("retrieve_evidence", "extract_attributes")
    workflow.add_edge("extract_attributes", "verify_evidence")
    workflow.add_edge("verify_evidence", "confidence_check")
    workflow.add_edge("confidence_check", "lov_validation")
    workflow.add_edge("lov_validation", "uom_normalization")
    workflow.add_edge("uom_normalization", "description_generation")
    workflow.add_edge("description_generation", "final_validation")
    
    # Conditional edge
    workflow.add_conditional_edges(
        "final_validation",
        decide_routing,
        {
            "retry": "retrieve_evidence",
            "output": "final_output",
        }
    )
    
    workflow.add_edge("final_output", END)
    
    return workflow.compile()


_graph_instance = None

def enrich_product(product: ProductInput) -> dict[str, Any]:
    """Execute LangGraph enrichment pipeline on a single catalog product input."""
    global _graph_instance
    if _graph_instance is None:
        _graph_instance = build_enrichment_graph()
        
    state_input: EnrichmentState = {
        "product_input": {
            "part_number": f"PART_{product.source_row}",
            "dept": "Appliances",
            "class": "Large Appliances",
            "fine": "Dishwashers",
            "sku": f"SKU_{product.source_row}",
            "mfg_part_num": product.mfg_part_num,
            "part_desc": product.part_desc,
            "e1_brand": product.e1_brand,
            "unilog_brand": product.unilog_brand,
            "dib_brand": product.dib_brand,
            "part_manuf": product.part_manuf,
            "specification_sheet": product.specification_sheet,
            "ref_url_1": product.ref_url_1,
            "ref_url_2": product.ref_url_2,
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
    
    result = _graph_instance.invoke(state_input)
    return result["final_output"]
