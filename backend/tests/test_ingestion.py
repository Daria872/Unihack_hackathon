from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from app.models import ProductInput
from app.services.ingestion import IngestionError, ingest_excel

REQUIRED = [
    "Mfg_Part_Num",
    "Part_Desc",
    "E1_Brand",
    "Unilog_Brand",
    "DIB_Brand",
    "Part_Manuf",
]


def _write_xlsx(path: Path, rows: list[dict[str, object]], extra_columns: list[str] | None = None) -> Path:
    columns = list(REQUIRED)
    if extra_columns:
        columns.extend(extra_columns)
    frame = pd.DataFrame(rows, columns=columns)
    frame.to_excel(path, index=False, engine="openpyxl")
    return path


def test_ingest_excel_returns_product_input_objects(tmp_path: Path) -> None:
    path = _write_xlsx(
        tmp_path / "input.xlsx",
        [
            {
                "Mfg_Part_Num": "PDSH4816AF",
                "Part_Desc": "PDSH4816AF Dishwasher SS - Display Only",
                "E1_Brand": "TREX",
                "Unilog_Brand": "TREX",
                "DIB_Brand": "Diablo",
                "Part_Manuf": "Freud Inc (2435)",
            }
        ],
    )

    products = ingest_excel(path)

    assert len(products) == 1
    product = products[0]
    assert isinstance(product, ProductInput)
    assert product.source_row == 2
    assert product.mfg_part_num == "PDSH4816AF"
    assert product.part_desc == "PDSH4816AF Dishwasher SS - Display Only"
    assert product.e1_brand == "TREX"
    assert product.unilog_brand == "TREX"
    assert product.dib_brand == "Diablo"
    assert product.part_manuf == "Freud Inc (2435)"


def test_placeholders_are_empty_but_raw_values_are_preserved(tmp_path: Path) -> None:
    path = _write_xlsx(
        tmp_path / "placeholders.xlsx",
        [
            {
                "Mfg_Part_Num": "DCB518ASTS06G",
                "Part_Desc": 'DCB518ASTS06G Diablo 1/2"x18" - Sanding Belt 6pc',
                "E1_Brand": "-- Unbranded --",
                "Unilog_Brand": "-- No Unilog Brand --",
                "DIB_Brand": "-- No DIB Brand --",
                "Part_Manuf": "Freud Inc (2435)",
            }
        ],
    )

    product = ingest_excel(path)[0]

    assert product.e1_brand is None
    assert product.unilog_brand is None
    assert product.dib_brand is None
    assert product.raw.E1_Brand == "-- Unbranded --"
    assert product.raw.Unilog_Brand == "-- No Unilog Brand --"
    assert product.raw.DIB_Brand == "-- No DIB Brand --"
    assert product.raw.Mfg_Part_Num == "DCB518ASTS06G"
    assert product.raw.Part_Manuf == "Freud Inc (2435)"


def test_missing_values_become_none_and_whitespace_is_cleaned(tmp_path: Path) -> None:
    path = _write_xlsx(
        tmp_path / "missing.xlsx",
        [
            {
                "Mfg_Part_Num": "  49-94-0013  ",
                "Part_Desc": None,
                "E1_Brand": "",
                "Unilog_Brand": "   ",
                "DIB_Brand": "  Milwaukee  ",
                "Part_Manuf": None,
            }
        ],
    )

    product = ingest_excel(path)[0]

    assert product.mfg_part_num == "49-94-0013"
    assert product.part_desc is None
    assert product.e1_brand is None
    assert product.unilog_brand is None
    assert product.dib_brand == "Milwaukee"
    assert product.part_manuf is None
    assert product.raw.Mfg_Part_Num == "  49-94-0013  "
    assert product.raw.Part_Desc is None
    assert product.raw.E1_Brand is None
    assert product.raw.DIB_Brand == "  Milwaukee  "


def test_placeholder_with_surrounding_whitespace_is_empty(tmp_path: Path) -> None:
    path = _write_xlsx(
        tmp_path / "padded.xlsx",
        [
            {
                "Mfg_Part_Num": "X1",
                "Part_Desc": "Widget",
                "E1_Brand": "  -- Unbranded --  ",
                "Unilog_Brand": "-- No Unilog Brand --",
                "DIB_Brand": "-- No DIB Brand --",
                "Part_Manuf": "Acme",
            }
        ],
    )

    product = ingest_excel(path)[0]
    assert product.e1_brand is None
    assert product.raw.E1_Brand == "  -- Unbranded --  "


def test_blank_rows_are_skipped(tmp_path: Path) -> None:
    path = _write_xlsx(
        tmp_path / "blank.xlsx",
        [
            {
                "Mfg_Part_Num": "A1",
                "Part_Desc": "First",
                "E1_Brand": "TREX",
                "Unilog_Brand": None,
                "DIB_Brand": None,
                "Part_Manuf": "Acme",
            },
            {
                "Mfg_Part_Num": None,
                "Part_Desc": None,
                "E1_Brand": None,
                "Unilog_Brand": None,
                "DIB_Brand": None,
                "Part_Manuf": None,
            },
            {
                "Mfg_Part_Num": "B2",
                "Part_Desc": "Second",
                "E1_Brand": None,
                "Unilog_Brand": None,
                "DIB_Brand": None,
                "Part_Manuf": "Acme",
            },
        ],
    )

    products = ingest_excel(path)
    assert [p.mfg_part_num for p in products] == ["A1", "B2"]
    assert [p.source_row for p in products] == [2, 4]


def test_missing_required_column_raises(tmp_path: Path) -> None:
    path = tmp_path / "bad.xlsx"
    pd.DataFrame(
        [{"Mfg_Part_Num": "A1", "Part_Desc": "Widget", "E1_Brand": "TREX"}]
    ).to_excel(path, index=False, engine="openpyxl")

    with pytest.raises(IngestionError, match="Unilog_Brand"):
        ingest_excel(path)


def test_extra_columns_are_ignored(tmp_path: Path) -> None:
    path = _write_xlsx(
        tmp_path / "extra.xlsx",
        [
            {
                "Mfg_Part_Num": "A1",
                "Part_Desc": "Widget",
                "E1_Brand": "TREX",
                "Unilog_Brand": None,
                "DIB_Brand": "Diablo",
                "Part_Manuf": "Acme",
                "Dept": "Appliances",
            }
        ],
        extra_columns=["Dept"],
    )

    product = ingest_excel(path)[0]
    assert product.mfg_part_num == "A1"
    assert not hasattr(product, "Dept")


def test_source_workbook_is_not_modified(tmp_path: Path) -> None:
    path = _write_xlsx(
        tmp_path / "readonly.xlsx",
        [
            {
                "Mfg_Part_Num": "A1",
                "Part_Desc": "Widget",
                "E1_Brand": "-- Unbranded --",
                "Unilog_Brand": "-- No Unilog Brand --",
                "DIB_Brand": "-- No DIB Brand --",
                "Part_Manuf": "Acme",
            }
        ],
    )
    before = path.read_bytes()

    ingest_excel(path)

    assert path.read_bytes() == before


def test_missing_file_raises(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        ingest_excel(tmp_path / "does-not-exist.xlsx")
