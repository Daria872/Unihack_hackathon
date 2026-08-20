from __future__ import annotations

import os
from pathlib import Path
import zipfile
import xml.etree.ElementTree as ET
import pandas as pd

def get_reference_dir() -> Path:
    # Resolves C:\Users\asus\Desktop\work\hackathons\unilog-product-intelligence\data\reference
    backend_root = Path(__file__).resolve().parents[1]
    return (backend_root / ".." / "data" / "reference").resolve()

def create_manufacturer_brand_list(dir_path: Path):
    dest = dir_path / "UniCat_Manufacturer_and_Brand_List.xlsx"
    if dest.is_file():
        print(f"Skipping: {dest.name} already exists.")
        return

    data = [
        # Dishwashers
        {"MANUFACTURER_NAME": "Rheem Manufacturing", "BRAND_NAME": "FRIGIDAIRE®", "MANUFACTURER_CODE": "RHEEM", "BRAND_CODE": "FRIG"},
        {"MANUFACTURER_NAME": "Whirlpool Corporation", "BRAND_NAME": "Whirlpool®", "MANUFACTURER_CODE": "WHIRLPOOL", "BRAND_CODE": "WHIRL"},
        {"MANUFACTURER_NAME": "Appliance Dealers Cooperative (APPDE)", "BRAND_NAME": "Frigidaire", "MANUFACTURER_CODE": "APPDE", "BRAND_CODE": "FRIGIDAIRE"},
        
        # Test mocks
        {"MANUFACTURER_NAME": "Freud Inc", "BRAND_NAME": "Diablo", "MANUFACTURER_CODE": "2435", "BRAND_CODE": "DIABLO"},
        {"MANUFACTURER_NAME": "TREX", "BRAND_NAME": "TREX", "MANUFACTURER_CODE": "TREX", "BRAND_CODE": "TREX"},
        {"MANUFACTURER_NAME": "TIMBERTECH", "BRAND_NAME": "TIMBERTECH", "MANUFACTURER_CODE": "TT", "BRAND_CODE": "TT"},
    ]
    df = pd.DataFrame(data)
    df.to_excel(dest, index=False, engine="openpyxl")
    print(f"Created Reference: {dest.name}")

def create_lov_list(dir_path: Path):
    dest = dir_path / "Unicat_Lov_v1_0_Updated_With_Remarks.xlsx"
    if dest.is_file():
        print(f"Skipping: {dest.name} already exists.")
        return

    classpath = "Appliances & Consumer Electronics>Kitchen Appliances>Built-In Dishwashers"
    
    # We will populate list of attributes and their values for Built-In Dishwashers
    lov_records = [
        {"Classpath": classpath, "Attribute Label": "Series", "Normalized Label": "Series", "Attribute Values": "Professional Series", "Normalized Values": "Professional Series"},
        {"Classpath": classpath, "Attribute Label": "Series", "Normalized Label": "Series", "Attribute Values": "Eco Series", "Normalized Values": "Eco Series"},
        {"Classpath": classpath, "Attribute Label": "Model", "Normalized Label": "Model", "Attribute Values": "", "Normalized Values": ""},
        {"Classpath": classpath, "Attribute Label": "Number of Wash Cycles", "Normalized Label": "Number of Wash Cycles", "Attribute Values": "5", "Normalized Values": "5"},
        {"Classpath": classpath, "Attribute Label": "Voltage Rating", "Normalized Label": "Voltage Rating", "Attribute Values": "120 V", "Normalized Values": "120"},
        {"Classpath": classpath, "Attribute Label": "Voltage Rating", "Normalized Label": "Voltage Rating", "Attribute Values": "120", "Normalized Values": "120"},
        {"Classpath": classpath, "Attribute Label": "Amperage Rating", "Normalized Label": "Amperage Rating", "Attribute Values": "15 A", "Normalized Values": "15"},
        {"Classpath": classpath, "Attribute Label": "Amperage Rating", "Normalized Label": "Amperage Rating", "Attribute Values": "15", "Normalized Values": "15"},
        {"Classpath": classpath, "Attribute Label": "Amperage Rating", "Normalized Label": "Amperage Rating", "Attribute Values": "10 A", "Normalized Values": "10"},
        {"Classpath": classpath, "Attribute Label": "Amperage Rating", "Normalized Label": "Amperage Rating", "Attribute Values": "10", "Normalized Values": "10"},
        {"Classpath": classpath, "Attribute Label": "Mounting Type", "Normalized Label": "Mounting Type", "Attribute Values": "Leg", "Normalized Values": "Leg"},
        {"Classpath": classpath, "Attribute Label": "Mounting Type", "Normalized Label": "Mounting Type", "Attribute Values": "Built-in", "Normalized Values": "Built-in"},
        {"Classpath": classpath, "Attribute Label": "Plug Type", "Normalized Label": "Plug Type", "Attribute Values": "", "Normalized Values": ""},
        {"Classpath": classpath, "Attribute Label": "Size", "Normalized Label": "Size", "Attribute Values": "24 in W x 24-1/4 in D", "Normalized Values": "24 in W x 24-1/4 in D"},
        {"Classpath": classpath, "Attribute Label": "Size", "Normalized Label": "Size", "Attribute Values": "33-7/16 in H x 23-7/8 in W x 22-5/8 in D", "Normalized Values": "33-7/16 in H x 23-7/8 in W x 22-5/8 in D"},
        {"Classpath": classpath, "Attribute Label": "Depth With Door Open", "Normalized Label": "Depth With Door Open", "Attribute Values": "50-1/4 in", "Normalized Values": "50-1/4"},
        {"Classpath": classpath, "Attribute Label": "Depth With Door Open", "Normalized Label": "Depth With Door Open", "Attribute Values": "50-3/16 in", "Normalized Values": "50-3/16"},
        {"Classpath": classpath, "Attribute Label": "Minimum Height", "Normalized Label": "Minimum Height", "Attribute Values": "8-1/2 in Upper Rack, 11-1/4 in Lower Rack", "Normalized Values": "8-1/2 in Upper Rack, 11-1/4 in Lower Rack"},
        {"Classpath": classpath, "Attribute Label": "Minimum Height", "Normalized Label": "Minimum Height", "Attribute Values": "33-7/16 in", "Normalized Values": "33-7/16"},
        {"Classpath": classpath, "Attribute Label": "Maximum Height", "Normalized Label": "Maximum Height", "Attribute Values": "10-3/8 in Upper Rack, 13-1/4 in Lower Rack", "Normalized Values": "10-3/8 in Upper Rack, 13-1/4 in Lower Rack"},
        {"Classpath": classpath, "Attribute Label": "Sound Level", "Normalized Label": "Sound Level", "Attribute Values": "47 dBA", "Normalized Values": "47"},
        {"Classpath": classpath, "Attribute Label": "Sound Level", "Normalized Label": "Sound Level", "Attribute Values": "41 dBA", "Normalized Values": "41"},
        {"Classpath": classpath, "Attribute Label": "Material", "Normalized Label": "Material", "Attribute Values": "Stainless Steel", "Normalized Values": "Stainless Steel"},
        {"Classpath": classpath, "Attribute Label": "Color", "Normalized Label": "Color", "Attribute Values": "Stainless Steel", "Normalized Values": "Stainless Steel"},
        {"Classpath": classpath, "Attribute Label": "Additional Information", "Normalized Label": "Additional Information", "Attribute Values": "240 kW-hr Annual Energy, 1 to 12 hr Delay Start Hours", "Normalized Values": "240 kW-hr Annual Energy, 1 to 12 hr Delay Start Hours"},
        {"Classpath": classpath, "Attribute Label": "Additional Information", "Normalized Label": "Additional Information", "Attribute Values": "Folding Tines, Leak Detection System, Moisture Repellent Silverware Basket, Normal Cycle, Quick Wash Cycle, Sani Rinse Option, Sensor Cycle, Triple Wash Spray", "Normalized Values": "Folding Tines, Leak Detection System, Moisture Repellent Silverware Basket, Normal Cycle, Quick Wash Cycle, Sani Rinse Option, Sensor Cycle, Triple Wash Spray"},
    ]
    df = pd.DataFrame(lov_records)
    df.to_excel(dest, index=False, engine="openpyxl")
    print(f"Created Reference: {dest.name}")

def create_uom_list(dir_path: Path):
    dest = dir_path / "Unilog_Master_UOM_Standards_Abbreviations_and_Terms.xlsx"
    if dest.is_file():
        print(f"Skipping: {dest.name} already exists.")
        return

    # Sheet 1: UOM Table
    uom_data = [
        {"Approved Abbreviation": "V", "Term": "Volt"},
        {"Approved Abbreviation": "V", "Term": "Voltage"},
        {"Approved Abbreviation": "V", "Term": "Volts"},
        {"Approved Abbreviation": "A", "Term": "Amp"},
        {"Approved Abbreviation": "A", "Term": "Amperage"},
        {"Approved Abbreviation": "A", "Term": "Amps"},
        {"Approved Abbreviation": "in", "Term": "inch"},
        {"Approved Abbreviation": "in", "Term": "inches"},
        {"Approved Abbreviation": "in", "Term": "IN."},
        {"Approved Abbreviation": "in", "Term": "IN"},
        {"Approved Abbreviation": "dBA", "Term": "decibel"},
        {"Approved Abbreviation": "dBA", "Term": "decibels"},
        {"Approved Abbreviation": "dBA", "Term": "DBA"},
    ]
    df_uom = pd.DataFrame(uom_data)

    # Sheet 2: Style Rules
    style_data = [
        "Always keep a space between number and unit (24 in, not 24in)",
        "Convert inches, IN., inch to in",
        "Convert Volt, Voltage to V",
        "Convert Amp, Amperage to A",
    ]
    df_style = pd.DataFrame(style_data, columns=["Rules"])

    with pd.ExcelWriter(dest, engine="openpyxl") as writer:
        df_uom.to_excel(writer, sheet_name="UOM Abbreviations", index=False)
        df_style.to_excel(writer, sheet_name="House Style Rules", index=False)
    print(f"Created Reference: {dest.name}")

def create_decimal_fraction(dir_path: Path):
    dest = dir_path / "Decimal_Fraction.xlsx"
    if dest.is_file():
        print(f"Skipping: {dest.name} already exists.")
        return

    # We need Fraction/Decimal columns in side by side setup
    data = {
        "Fraction": ["1/64", "1/32", "3/64", "1/16", "5/64", "3/32", "7/64", "1/8", "9/64", "5/32", "11/64", "3/16", "13/64", "7/32", "15/64", "1/4", "1/2", "3/8", "7/16", "7/8", "5/8", "3/16", "5/16", "11/16", "13/16", "9/16", "5/8", "22-5/8", "23-7/8", "33-7/16", "50-3/16", "50-1/4", "24-1/4", "8-1/2", "11-1/4", "10-3/8", "13-1/4"],
        "Decimal": ["0.015625", "0.03125", "0.046875", "0.0625", "0.078125", "0.09375", "0.109375", "0.125", "0.140625", "0.15625", "0.171875", "0.1875", "0.203125", "0.21875", "0.234375", "0.25", "0.5", "0.375", "0.4375", "0.875", "0.625", "0.1875", "0.3125", "0.6875", "0.8125", "0.5625", "0.625", "22.625", "23.875", "33.4375", "50.1875", "50.25", "24.25", "8.5", "11.25", "10.375", "13.25"]
    }
    df = pd.DataFrame(data)
    df.to_excel(dest, index=False, header=True, engine="openpyxl")
    print(f"Created Reference: {dest.name}")

def create_content_guidelines(dir_path: Path):
    dest = dir_path / "UNILOG_INTERNAL_CONTENT_GUIDELINES.docx"
    if dest.is_file():
        print(f"Skipping: {dest.name} already exists.")
        return

    # Let's programmatically construct a valid docx zip archive containing word/document.xml
    # w:document and body namespace elements
    xml_content = """<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>UNILOG PRODUCT CONTENT GUIDELINES</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Invoice Desc: Max 40 characters, ALL CAPS.</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Mobile Desc: Between 60 and 80 characters, professional layout.</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Short Description / Product Title Formula: Brand + Series + MPN + Item Type + key attributes</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Approved units must keep space before unit abbreviations. Convert decimals to fractions for inches measurements.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>"""

    # We also need [Content_Types].xml and rels files for Word to recognise it (minimal Word DOCX package structure)
    content_types_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""

    rels_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

    with zipfile.ZipFile(dest, "w") as docx:
        docx.writestr("word/document.xml", xml_content)
        docx.writestr("[Content_Types].xml", content_types_xml)
        docx.writestr("_rels/.rels", rels_xml)

    print(f"Created Reference: {dest.name}")

def main():
    ref_dir = get_reference_dir()
    ref_dir.mkdir(parents=True, exist_ok=True)
    print(f"Writing reference files to: {ref_dir}")
    create_manufacturer_brand_list(ref_dir)
    create_lov_list(ref_dir)
    create_uom_list(ref_dir)
    create_decimal_fraction(ref_dir)
    create_content_guidelines(ref_dir)
    print("Reference data setup completed successfully!")

if __name__ == "__main__":
    main()
