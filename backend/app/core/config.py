from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Unilog AI"
    app_version: str = "0.1.0"
    environment: str = "development"
    reference_dir: str = "../data/reference"
    manufacturer_brand_filename: str = "UniCat_Manufacturer_and_Brand_List.xlsx"
    lov_filename: str = "Unicat_Lov_v1_0_Updated_With_Remarks.xlsx"
    uom_filename: str = "Unilog_Master_UOM_Standards_Abbreviations_and_Terms.xlsx"
    decimal_fraction_filename: str = "Decimal_Fraction.xlsx"
    content_guidelines_filename: str = "UNILOG_INTERNAL_CONTENT_GUIDELINES.docx"


settings = Settings()
