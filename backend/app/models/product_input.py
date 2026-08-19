from pydantic import BaseModel, ConfigDict, Field


class ProductInputRaw(BaseModel):
    """Original cell values as read from the workbook. Empty cells are None."""

    model_config = ConfigDict(populate_by_name=True)

    Mfg_Part_Num: str | None = None
    Part_Desc: str | None = None
    E1_Brand: str | None = None
    Unilog_Brand: str | None = None
    DIB_Brand: str | None = None
    Part_Manuf: str | None = None


class ProductInput(BaseModel):
    """One ingested catalogue row with cleaned fields and preserved raw values."""

    source_row: int = Field(description="1-based Excel row number, including the header row.")
    mfg_part_num: str | None
    part_desc: str | None
    e1_brand: str | None
    unilog_brand: str | None
    dib_brand: str | None
    part_manuf: str | None
    raw: ProductInputRaw
