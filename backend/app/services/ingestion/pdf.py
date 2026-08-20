from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

class PDFElement:
    def __init__(self, text: str, page_num: int, element_type: str, metadata: dict | None = None):
        self.text = text
        self.page_num = page_num
        self.element_type = element_type  # "paragraph", "table", "heading", etc.
        self.metadata = metadata or {}

    def to_dict(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "page_num": self.page_num,
            "element_type": self.element_type,
            "metadata": self.metadata,
        }


class PDFProcessor:
    """Processes manufacturer PDFs and extracts text, tables, page numbers, and metadata."""

    @classmethod
    def process_pdf(cls, file_path: str | Path) -> List[PDFElement]:
        path = Path(file_path)
        if not path.is_file():
            raise FileNotFoundError(f"PDF file not found: {path}")

        elements: List[PDFElement] = []
        
        # Try using Docling first
        try:
            from docling.document_converter import DocumentConverter
            logger.info(f"Processing {path.name} using Docling...")
            
            converter = DocumentConverter()
            result = converter.convert(str(path))
            
            # Exported document has nodes
            doc = result.document
            
            # Iterate through the document elements/nodes
            for element, level in doc.iterate_items():
                # Extract page number (Docling 2.x uses prov / page_no or similar)
                page_num = 1
                if hasattr(element, "prov") and element.prov:
                    page_num = element.prov[0].page_no if hasattr(element.prov[0], "page_no") else 1
                elif hasattr(element, "pages") and element.pages:
                    # In some versions it has element.pages list
                    page_num = element.pages[0] if isinstance(element.pages[0], int) else 1
                
                # Check for tables
                text = ""
                element_type = "paragraph"
                
                # Let's detect table
                from docling_core.types.doc.document import TableItem, HeadingItem
                if isinstance(element, TableItem):
                    element_type = "table"
                    # Render table to markdown/csv text if possible
                    text = element.export_to_markdown() if hasattr(element, "export_to_markdown") else str(element)
                elif isinstance(element, HeadingItem):
                    element_type = "heading"
                    text = element.text if hasattr(element, "text") else str(element)
                else:
                    text = element.text if hasattr(element, "text") else str(element)

                if text.strip():
                    elements.append(
                        PDFElement(
                            text=text.strip(),
                            page_num=page_num,
                            element_type=element_type,
                            metadata={"source": path.name}
                        )
                    )
            
            if elements:
                logger.info(f"Loaded {len(elements)} elements using Docling from {path.name}")
                return elements

        except Exception as e:
            logger.warning(f"Docling processing failed for {path.name} ({e}). Falling back to PyPDF...")

        # Fallback to PyPDF
        try:
            import pypdf
            reader = pypdf.PdfReader(path)
            for page_idx, page in enumerate(reader.pages):
                page_num = page_idx + 1
                text = page.extract_text()
                
                # If there are tables in the page, plain extract_text might merge columns, 
                # but it still extracts the text.
                if text and text.strip():
                    # We split page content by double newline to form paragraph-like chunks
                    paragraphs = text.split("\n\n")
                    for p in paragraphs:
                        clean_p = p.strip()
                        if clean_p:
                            elements.append(
                                PDFElement(
                                    text=clean_p,
                                    page_num=page_num,
                                    element_type="paragraph",
                                    metadata={"source": path.name, "fallback": True}
                                )
                            )
            if elements:
                logger.info(f"Loaded {len(elements)} elements using PyPDF fallback from {path.name}")
                return elements
        except Exception as fallback_err:
            logger.warning(f"PyPDF fallback encountered issue for {path.name}: {fallback_err}")

        # Emergency raw text extraction fallback for synthetic/minimal PDFs
        try:
            raw_bytes = path.read_bytes()
            import re
            matches = re.findall(rb"\(([^\(\)]+)\)\s*Tj", raw_bytes)
            if matches:
                extracted_str = " ".join([m.decode("utf-8", "ignore") for m in matches if m.strip()])
                if extracted_str.strip():
                    elements.append(
                        PDFElement(
                            text=extracted_str.strip(),
                            page_num=1,
                            element_type="paragraph",
                            metadata={"source": path.name, "fallback": True}
                        )
                    )
        except Exception as raw_err:
            logger.warning(f"Raw string extraction fallback failed for {path.name}: {raw_err}")

        return elements
