# Field dependency map

This document maps Delivery Format output fields using **only** files present in this repository. Rules that appear only as descriptions of missing files are quoted as descriptions. They are not expanded into invented limits, formulas, or allowed-value lists.

Companion inventory (all 252 Delivery Format columns): `evaluation/field_inventory.csv`.

## Files actually supplied

| Role | Path | What is on disk |
| --- | --- | --- |
| Raw product input | `data/raw/Unihack_ Sample Dataset - Input.csv.xls` | CSV (not Excel). 1,000 rows. 6 columns. Matches the Sample-1000 description in ground truth.docx. |
| 200-item Input vs Delivery Format | `data/reference/Unihack_ Expected Output - Delivery Format.csv` | Delivery Format **excerpt only**: 2 data rows, 252 columns. Input sheet is **not** supplied. |
| Brief / index of the pack | `data/ground_truth/ground truth.docx` | Describes working data, rule-book files, master data, and a two-row dishwasher worked example. |

Original files were not modified.

## Files described in ground truth.docx but not in this repository

These were requested for analysis. Nothing in them can be used beyond what ground truth.docx itself states.

| Requested source | Named in ground truth.docx as | Status |
| --- | --- | --- |
| 200-item Input sheet | `Unilog-Sample_200_Items-Input-vs-Output.xlsx` (Input + Delivery Format, 200 items) | Not supplied. Disk file is a 2-row Delivery Format CSV. |
| Manufacturer and Brand master | `UniCat_Manufacturer_and_Brand_List.xlsx` (27,000+ rows: MANUFACTURER_NAME, MANUFACTURER_CODE, BRAND_NAME, BRAND_CODE) | Not supplied. |
| Unilog LOV | `Unicat_Lov_v1_0_Updated_With_Remarks.xlsx` (~161,000 rows). Also `FAUCETS_LOV.xlsx`, `Fittings_LOV.xlsx` | Not supplied. |
| UOM standards | `Unilog_Master_UOM_Standards_Abbreviations_and_Terms.xlsx` (~500 abbreviations, 89 types, 22 house-style rules) | Not supplied. |
| Decimal/Fraction conversion | `Decimal_Fraction.xlsx` (63 conversions, 1/64 through 63/64, four side-by-side Fraction/Decimal blocks) | Not supplied. |
| Content guidelines | `UNILOG_INTERNAL_CONTENT_GUIDELINES.docx` | Not supplied. |
| Pack index | `Reference_Documents_Summary.xlsx` | Not supplied. |

## How to read the flags

| Flag | Meaning used here |
| --- | --- |
| Retrieval required | Whether manufacturer-site/documentation retrieval is required to populate the field, based on sourcing rules plus whether the field exists on raw input. |
| LLM required | Supplied files **do not mandate an LLM**. ground truth.docx says guideline formulas can be encoded as **prompts or validation rules**. “Not mandated” means that. |
| LOV validation | Stated requirement that values/labels come from Unilog LOV files. Those files are not in the repo. |
| UOM normalization | Stated requirement that any unit use the approved abbreviation, and that combined strings keep a space between number and unit (`24 in`, not `24in`). The UOM workbook is not in the repo. |
| Deterministic rules | Whether supplied text describes a copy, filter, lookup, or formula that does not need generation. Lookups cannot be executed without the missing workbooks. |
| Character limit | Only limits written in supplied files. Absence is recorded as not specified — not guessed from excerpt string lengths except as observations. |

---

## 1. Raw product input

File: `data/raw/Unihack_ Sample Dataset - Input.csv.xls`.

Columns (header row, 1,000 data rows):

| Column | Non-empty | Notes from this file plus ground truth.docx |
| --- | --- | --- |
| `Mfg_Part_Num` | 1,000 | 999 distinct values. `AVM6EV` appears twice with different `Part_Desc` (`AVM6 EV Mini Snip Red` vs `AVM7 EV Mini Snip Green`). |
| `Part_Desc` | 1,000 | Short, abbreviated strings. ground truth.docx example of the problem: `3/8 CPLG BRS 150#`. |
| `E1_Brand` | 1,000 | 799 rows are `-- Unbranded --`. Other values include TREX (122), TIMBERTECH (55), and smaller counts. |
| `Unilog_Brand` | 1,000 | 1,000/1,000 are `-- No Unilog Brand --`. |
| `DIB_Brand` | 1,000 | 755 rows are `-- No DIB Brand --`. Remaining values include Philips, Diablo, DEWALT, Leviton, Satco, Southwire, Milwaukee, and others. |
| `Part_Manuf` | 1,000 | 76 distinct strings, typically `Name (CODE)`. 41 rows are `-`. Highest counts: Phillips Lighting (5831) 111, Milwaukee Accessory (4031) 108, Boise Cascade Building Materials (BOICA) 85, Appliance Dealers Cooperative (APPDE) 84. |

ground truth.docx rule that applies to these brand columns: placeholders `-- Unbranded --`, `-- No Unilog Brand --`, and `-- No DIB Brand --` **mean the field is empty**. Filter them out before matching or prompting.

This 1,000-row file has **no** Dept, Class, Fine, SKU, classpath, URLs, descriptions, attributes, or assets.

---

## 2. 200-item Input vs Delivery Format

ground truth.docx: this workbook is the labelled ground truth. Input = 200 raw rows **adding** Dept / Class / Fine and SKU. Delivery Format = the same 200 items across **252 columns**.

On disk: `Unihack_ Expected Output - Delivery Format.csv` has **252 columns and 2 data rows** (the two dishwashers from the worked example). The Input sheet and the other 198 Delivery Format rows are not here. Scoring 200 known-good rows is not possible from the current files.

### Input columns present as passthrough on the Delivery Format excerpt

`Mfg_Part_Num`, `Part_Desc`, `E1_Brand`, `Unilog_Brand`, `DIB_Brand`, `Part_Manuf`, plus `Dept`, `Class`, `Fine`, `SKU - MY_PART_NUMBER`.

Excerpt input-like values:

| Field | Row 1 | Row 2 |
| --- | --- | --- |
| Part_Desc | PDSH4816AF Dishwasher SS - Display Only | WDTS7024RZ Dishwasher SS - Display Only |
| E1 / Unilog / DIB brand | All placeholders | All placeholders |
| Part_Manuf | Appliance Dealers Cooperative (APPDE) | Appliance Dealers Cooperative (APPDE) |
| Dept / Class / Fine | Appliances / Large Appliances / Dishwashers | same |
| SKU - MY_PART_NUMBER | 1515863 | 1515867 |

### Delivery Format schema (252 columns, in file order)

Evidence URLs: `MFR URL`, `Ref URL 1`–`Ref URL 5`.

Distributor / input: `PART_NUMBER`, `Dept`, `Class`, `Fine`, `SKU - MY_PART_NUMBER`, `Mfg_Part_Num`, `Part_Desc`, `E1_Brand`, `Unilog_Brand`, `DIB_Brand`, `Part_Manuf`.

Canonical identity: `MANUFACTURER_NAME`, `BRAND_NAME`, `TRADE_NAME`, `MANUFACTURER_PART_NUMBER`, `ALTERNATE_PART_NUMBER`, `Classpath`.

Descriptions: `MOBILE_DESC`, `INVOICE_DESC`, `SHORT_DESC`, `LONG_DESC1`, `RETAIL_DESC`, `MARKETING_DESCRIPTION`.

Features: `ITEM_FEATURES_1`–`ITEM_FEATURES_20`, `With`.

Other text: `Standard/Approvals`, `Prop 65`, `Application`, `Includes`, `Product Name`.

Attributes: `ATTRIBUTE_LABEL n`, `ATTRIBUTE_VALUE n`, `ATTRIBUTE_UOM n` for n = 1–50.

Identifiers / commercial: `UPC`, `EAN`, `GTIN`, `UNSPSC`, `Warranty`, `List Price`, `Selling Qty`, `Selling UOM`, `Standard Packaging Information`.

Dimensions: `LENGTH`/`LENGTH_UOM`, `HEIGHT`/`HEIGHT_UOM`, `WIDTH`/`WIDTH_UOM`, `WEIGHT`/`WEIGHT_UOM`, `VOLUME`/`VOLUME_UOM`.

Assets and status: product/alternate images, SDS, manuals, drawings, videos, `Country Of Origin`, `Discontinued`, `Actual Image (Yes/No)`.

### Gaps called out in ground truth.docx and visible in the excerpt

- Blank `UNSPSC` and `Country Of Origin` (both excerpt rows empty).
- Manufacturer vs brand may look mismatched. Excerpt row 1: `MANUFACTURER_NAME` = Rheem Manufacturing, `BRAND_NAME` = FRIGIDAIRE®, `Part_Manuf` = Appliance Dealers Cooperative (APPDE). No supplied file explains the Rheem–Frigidaire pairing; it is not derived from `Part_Manuf`.

---

## 3. Manufacturer and Brand master data

File not supplied. Statements taken only from ground truth.docx:

- Approved rows include `MANUFACTURER_NAME`, `MANUFACTURER_CODE`, `BRAND_NAME`, `BRAND_CODE`.
- Exact legal casing, spacing, suffixes (`Inc` / `LLC` / `Ltd`) and ® / ™ must be preserved.
- Use the list to normalise messy supplier strings to a canonical manufacturer, then pick the paired brand.
- Where an item has no brand, the manufacturer name is used instead.
- Fuzzy matching is described as a candidate method.
- Invented manufacturer/brand strings score zero.

Observed, not a master-data rule: excerpt `Part_Manuf` is a distributor code string and does not equal `MANUFACTURER_NAME`.

---

## 4. Unilog LOV

Files not supplied. Statements taken only from ground truth.docx:

- Cross-category LOV columns described: Classpath | Leaf Node | Filtering Y/N | Attribute Label | Attribute Values | Normalized Label | Normalized Values | Guidelines | Remarks.
- Tells which attributes apply to a classpath, which are filterable, and the normalised form each value must take.
- Attribute values **must come from the LOV files**. A fluent description made of invented values scores zero.
- Faucets LOV (not supplied) is described as: Summary (classpath, UNSPSC), Online Description build order, Attribute Detail (sequence, filtering flag, permitted values, definitions, synonyms), visual style guide. Attribute order and title word order are fixed **for that category**.
- Fittings LOV (not supplied) is described as many-to-one maps: 390 Fitting Types; 1,472 manufacturer connection-type variants → 515 canonical values; 464 Material Construction → 113 Material values.

Excerpt observation (not an LOV file): both dishwasher rows use the same 15 attribute labels in the same order, including labels with empty values (`Model`, `Plug Type`).

---

## 5. UOM standards

File not supplied. Statements taken only from ground truth.docx:

- About 500 approved unit abbreviations across 89 measurement types, with exact capture form and a worked example.
- Sheet 2: 22 house-style rules (hyphenation, symbols, technical abbreviations).
- This is the **only permitted way** to write a unit **anywhere** in output.
- Convert `inches`, `IN.`, `inch` to the single approved form.
- Always keep a space between the number and the unit (`24 in`, not `24in`).
- Spreadsheet may have notes in stray columns; do not assume row 1 is a clean header.

Excerpt units (observations): `V`, `A`, `in`, `dBA` in attribute UOM columns; `24 in`, `120 V`, `15 A`, `47 dBA` in `LONG_DESC1`. Invoice example `50-1/4IN` has **no** space before `IN`, which conflicts with the space rule above. The guidelines workbook is not supplied, so which rule wins is **not specified**.

---

## 6. Decimal / fraction conversion

File not supplied. Statements taken only from ground truth.docx:

- 63 exact inch conversions from 1/64 (0.015625) to 63/64 (0.984375).
- Layout: four side-by-side Fraction | Decimal blocks (not one pair of columns).
- Manufacturers publish decimals; trade buyers search fractions.
- Convert `0.5` to `1/2` and `50.25 in` to `50-1/4 in`.

Excerpt mixed numbers: `50-1/4`, `24-1/4`, `8-1/2`, `11-1/4`, `10-3/8`, `13-1/4`, `33-7/16`, `23-7/8`, `22-5/8`, `50-3/16`, `3-7/16`. The conversion table itself is not in the repo.

---

## 7. Content guidelines

File not supplied. Limits and formulas **written in ground truth.docx**:

| Topic | Text in ground truth.docx |
| --- | --- |
| Product Title example formula | Brand + Series + MPN + Item Type + key attributes |
| Invoice Desc | ≤40 characters, CAPS |
| Mobile Desc | 60–80 characters |
| Rewrite surfaces | Till receipt, mobile app, search results, product page, marketing copy |
| Sourcing | Manufacturer’s own site or documentation. Marketplaces and distributor sites excluded. |
| Digital assets | Guidelines include digital-asset specs; those specs are not in the repo. |
| Pipeline | Input analysis → de-duplication → taxonomy and classification → attribute extraction → enrichment from manufacturer sources → cleansing and normalisation → description building → digital assets. |

Excerpt length checks against **stated** limits:

| Field | Stated limit | Row 1 length | Row 2 length |
| --- | --- | --- | --- |
| INVOICE_DESC | ≤40, CAPS | 38, all caps | 39, all caps |
| MOBILE_DESC | 60–80 | 75 | 64 |
| SHORT_DESC | not specified | 115 | 96 |
| LONG_DESC1 | not specified | 390 | 405 |
| RETAIL_DESC | not specified | 75 | 74 |
| MARKETING_DESCRIPTION | not specified | 0 (empty) | 214 |

---

## Field map (important output fields)

### Evidence URLs

| Field | Source | Retrieval | LLM | LOV | UOM | Deterministic | Char limit | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MFR URL, Ref URL 1–5 | Manufacturer site or manufacturer documentation | Yes | No | No | No | Capture retrieved URLs only; no construction rule supplied | Not specified | Exclude marketplaces and distributor sites |

### Input passthrough

| Field | Source | Retrieval | LLM | LOV | UOM | Deterministic | Char limit | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mfg_Part_Num, Part_Desc | Raw 6-column input | No | No | No | No | Copy | Not specified | Not specified |
| E1_Brand, Unilog_Brand, DIB_Brand | Raw 6-column input | No | No | No | No | Copy after treating named placeholders as empty | Not specified | Placeholders listed in ground truth.docx are empty |
| Part_Manuf | Raw 6-column input | No | No | No | No | Copy; this is not canonical MANUFACTURER_NAME | Not specified | Not specified |
| Dept, Class, Fine, SKU - MY_PART_NUMBER | 200-item Input (described; sheet not supplied) | No | No | No | No | Copy if Input is provided | Not specified | Not specified |
| PART_NUMBER | On Delivery Format; not on 1000-item input; not listed as a 200-item Input add | Not specified | No | No | No | Not specified | Not specified | Not specified |

### Manufacturer, brand, part numbers

| Field | Source | Retrieval | LLM | LOV | UOM | Deterministic | Char limit | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MANUFACTURER_NAME | UniCat manufacturer list (not supplied) | Conditional: excerpt is not a copy of Part_Manuf | No | Yes — exact master-list match (file missing) | No | Partial: fuzzy match to master (file missing) | Not specified | Exact legal casing, suffixes, symbols |
| BRAND_NAME | Paired brand on same master list | Conditional: excerpt brands not in placeholder input columns | No | Yes — exact BRAND_NAME (file missing) | No | Partial: paired brand; if no brand, use manufacturer name | Not specified | Exact symbols |
| TRADE_NAME | Schema only; empty in excerpt | Not specified | Not specified | Not specified | No | Not specified | Not specified | Not specified |
| MANUFACTURER_PART_NUMBER | Equals Mfg_Part_Num in excerpt | No | No | No | No | Observed identity only; copy rule not stated | Not specified | Not specified |
| ALTERNATE_PART_NUMBER | Schema only; empty in excerpt | Not specified | No | No | No | Not specified | Not specified | Not specified |

### Taxonomy

| Field | Source | Retrieval | LLM | LOV | UOM | Deterministic | Char limit | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Classpath | Classification step; LOV keyed by classpath | No | Not specified | Yes if using Unicat LOV (file missing) | No | Not specified | Not specified | Must be a classpath that has LOV attributes (described) |
| Product Name | Item Type in the title example formula | No | Not specified | Conditional: category specs described for faucets/fittings only (files missing) | No | Not specified | Not specified | Not specified |

Excerpt classpath: `Appliances & Consumer Electronics>Kitchen Appliances>Built-In Dishwashers`. The worked example in ground truth.docx prints spaces around `>`. That difference is observed, not resolved.

### Descriptions

| Field | Source | Retrieval | LLM | LOV | UOM | Deterministic | Char limit | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INVOICE_DESC | Generated; till receipt | Conditional (tokens not on Part_Desc) | Not mandated; prompts or rules | Indirect (no invented values) | Yes if units appear; excerpt `50-1/4IN` conflicts with space rule | Partial: CAPS and ≤40 | ≤40, CAPS | All caps; max 40 |
| MOBILE_DESC | Generated; mobile app | Conditional | Not mandated | Indirect | Yes if units appear | Partial: length 60–80 | 60–80 | Length 60–80 |
| SHORT_DESC | Product Title / Short Desc | Conditional | Not mandated | Indirect; faucets title order described only for that LOV file | Yes if units appear | Partial: Brand + Series + MPN + Item Type + key attributes (example formula) | Not specified | Example formula only; full guidelines missing |
| LONG_DESC1 | Product page | Yes for specs not on raw input | Not mandated | Indirect | Yes | Partial: assemble from validated attributes; order not fully specified | Not specified | Approved UOM; fraction inch forms (table missing) |
| RETAIL_DESC | Generated; guidelines missing | Conditional | Not mandated | Indirect | Yes if units appear | Not specified | Not specified | Not specified |
| MARKETING_DESCRIPTION | Marketing copy; filled on 1 of 2 excerpt rows | Conditional; sourcing rules still apply | Not mandated | No | Yes if units appear | No | Not specified | Manufacturer site/documentation only |

### Features and compliance text

| Field | Source | Retrieval | LLM | LOV | UOM | Deterministic | Char limit | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ITEM_FEATURES_1–20 | Schema; no formula supplied | Conditional when filled | Not mandated | Not specified | Yes if units appear | Not specified | Not specified | Not specified |
| With | Schema; excerpt prefixed with “With” | Conditional | Not mandated | Not specified | No | Not specified | Not specified | Not specified |
| Standard/Approvals | Manufacturer documentation | Yes | No | Not specified | No | Not specified | Not specified | Sourcing hierarchy |
| Prop 65, Application, Includes | Schema; empty in excerpt | Not specified | Not specified | Not specified | No | Not specified | Not specified | Not specified |

### Attributes (slots 1–50)

Excerpt uses slots 1–15 with identical labels on both rows. Slots 16–50 are empty. Labels remain present when values are blank.

| Field | Source | Retrieval | LLM | LOV | UOM | Deterministic | Char limit | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ATTRIBUTE_LABEL n | Unicat LOV attribute list for classpath (file missing) | No | No | Yes | No | Yes if LOV loaded, in LOV sequence | Not specified | Allowed label / normalised label for classpath |
| ATTRIBUTE_VALUE n | Extraction + manufacturer enrichment | Yes when not on Part_Desc | Not mandated (extraction is a named step) | Yes | If units are embedded in the value | Partial: LOV membership, fittings synonym maps (missing), fraction lookup (missing) | Not specified | Permitted/normalised LOV value; inch decimal→fraction as described |
| ATTRIBUTE_UOM n | Master UOM list (file missing) | No | No | No | Yes | Yes: lookup to approved capture form | Not specified | Approved abbreviation only |

Excerpt labels 1–15: Series; Model; Number of Wash Cycles; Voltage Rating; Amperage Rating; Mounting Type; Plug Type; Size; Depth With Door Open; Minimum Height; Maximum Height; Sound Level; Material; Color; Additional Information.

Excerpt UOM column values seen: `V`, `A`, `in`, `dBA`. `Size` keeps units inside `ATTRIBUTE_VALUE` and leaves `ATTRIBUTE_UOM` empty.

### Identifiers, commercial, package dimensions

| Field | Source | Retrieval | LLM | LOV | UOM | Deterministic | Char limit | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UPC, EAN, GTIN | Schema; empty in excerpt | Not specified | No | No | No | Not specified | Not specified | Not specified |
| UNSPSC | Schema; Faucets Summary described as containing UNSPSC (file missing) | Not specified | No | No | No | Partial only if a category spec supplies it | Not specified | Blank cells are an acknowledged gap |
| Warranty | Enrichment; 1 of 2 excerpt rows filled | Yes if not on input | No | No | No | Not specified | Not specified | Not specified |
| List Price, Selling Qty, Standard Packaging Information | Schema; empty in excerpt | Not specified | No | No | Packaging text may contain units | Not specified | Not specified | Not specified |
| Selling UOM | Schema; empty in excerpt | Not specified | No | No | Yes | Yes if UOM table loaded | Not specified | Approved UOM only |
| LENGTH/HEIGHT/WIDTH/WEIGHT/VOLUME and *_UOM | Schema; empty in excerpt; distinct from Size attribute | Values: yes if not on input. UOM columns: no | No | No | *_UOM: yes. Inch values: fraction table (missing) | UOM lookup; fraction conversion if inches | Not specified | Approved UOM; inch fraction forms as described |

### Digital assets and status

| Field | Source | Retrieval | LLM | LOV | UOM | Deterministic | Char limit | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Product Image, Alternate Image 1–4, SDS, manuals, drawings, videos, catalog, spec sheet, etc. | Manufacturer assets; digital-asset specs in guidelines (file missing) | Yes | No | No | No | Filename pattern in excerpt only; not a stated rule | Not specified | Guidelines asset specs (missing); sourcing hierarchy |
| Actual Image (Yes/No) | Schema; both excerpt rows `Yes` | No | No | No | No | Header implies Yes/No | Not specified | Header: Yes/No |
| Country Of Origin | Schema; empty; brief says delivery file has blanks | Not specified | No | No | No | Not specified | Not specified | Acknowledged gap |
| Discontinued | Schema; empty in excerpt | Not specified | No | No | No | Not specified | Not specified | Not specified |

Excerpt asset names (observation only): `FRIGIDAIRE_PDSH4816AF.jpg`, `Whirlpool_WDTS7024RZ.jpg`, `{Brand}_{MPN}_Specification_Sheet.pdf`.

---

## What cannot be decided from supplied files

- Allowed attribute values, filter flags, or label sequences for any classpath (LOV workbooks missing).
- Canonical manufacturer/brand spellings (master list missing).
- The approved UOM abbreviation list and the 22 house-style rules (UOM workbook missing).
- The 63 fraction/decimal pairs (conversion workbook missing).
- Character limits and construction formulas other than Invoice ≤40 CAPS, Mobile 60–80, and the Product Title example (guidelines missing).
- Field-level accuracy against 200 labelled rows (only 2 Delivery Format rows on disk; Input sheet missing).

Placeholders, sourcing hierarchy, constrained (non-invented) values, UOM spacing as stated, and the inch mixed-number example `50.25 in` → `50-1/4 in` **are** in the supplied brief and can be used as written.
