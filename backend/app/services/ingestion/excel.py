from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from app.models.product_input import ProductInput, ProductInputRaw

REQUIRED_COLUMNS = (
    "Mfg_Part_Num",
    "Part_Desc",
    "E1_Brand",
    "Unilog_Brand",
    "DIB_Brand",
    "Part_Manuf",
)

PLACEHOLDER_VALUES = frozenset(
    {
        "-- Unbranded --",
        "-- No Unilog Brand --",
        "-- No DIB Brand --",
    }
)


class IngestionError(ValueError):
    """Raised when an input workbook cannot be ingested."""


def ingest_excel(
    source: str | Path,
    *,
    sheet_name: str | int = 0,
) -> list[ProductInput]:
    """Read a Unilog product input workbook without modifying the file.

    Placeholder brand values are treated as empty on cleaned fields only.
    Original cell text is stored on ``ProductInput.raw``.
    """
    path = Path(source)
    if not path.is_file():
        raise FileNotFoundError(f"Input workbook not found: {path}")

    try:
        frame = pd.read_excel(
            path,
            sheet_name=sheet_name,
            engine="openpyxl",
            dtype=object,
            header=0,
        )
    except Exception:
        frame = pd.read_csv(
            path,
            dtype=object,
            header=0,
        )
    frame.columns = [str(column).strip() for column in frame.columns]
    _validate_required_columns(frame.columns)

    products: list[ProductInput] = []
    for offset, (_, series) in enumerate(frame.iterrows()):
        excel_row = offset + 2
        raw_values = {
            column: _cell_to_raw(series.get(column)) for column in REQUIRED_COLUMNS
        }
        cleaned = {
            column: _cell_to_cleaned(raw_values[column]) for column in REQUIRED_COLUMNS
        }
        if all(value is None for value in cleaned.values()):
            continue
        products.append(
            ProductInput(
                source_row=excel_row,
                mfg_part_num=cleaned["Mfg_Part_Num"],
                part_desc=cleaned["Part_Desc"],
                e1_brand=cleaned["E1_Brand"],
                unilog_brand=cleaned["Unilog_Brand"],
                dib_brand=cleaned["DIB_Brand"],
                part_manuf=cleaned["Part_Manuf"],
                raw=ProductInputRaw.model_validate(raw_values),
            )
        )
    return products


def _validate_required_columns(columns: Any) -> None:
    present = {str(column).strip() for column in columns}
    missing = [column for column in REQUIRED_COLUMNS if column not in present]
    if missing:
        raise IngestionError(
            "Input workbook is missing required column(s): " + ", ".join(missing)
        )


def _cell_to_raw(value: Any) -> str | None:
    if value is None or _is_missing(value):
        return None
    if isinstance(value, str):
        return value
    return str(value)


def _cell_to_cleaned(raw: str | None) -> str | None:
    if raw is None:
        return None
    stripped = raw.strip()
    if stripped == "" or stripped in PLACEHOLDER_VALUES:
        return None
    return stripped


def _is_missing(value: Any) -> bool:
    try:
        return bool(pd.isna(value))
    except (TypeError, ValueError):
        return False
