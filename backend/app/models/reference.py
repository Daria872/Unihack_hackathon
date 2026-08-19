from pydantic import BaseModel, Field


class ManufacturerBrandRow(BaseModel):
    manufacturer_name: str
    manufacturer_code: str | None = None
    brand_name: str | None = None
    brand_code: str | None = None


class LovAttribute(BaseModel):
    classpath: str
    label: str
    filterable: bool | None = None


class UomTerm(BaseModel):
    term: str
    approved_abbreviation: str
    measurement_type: str | None = None
