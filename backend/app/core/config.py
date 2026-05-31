from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "InsightPilot API"
    VERSION: str = "0.1.0"
    API_V1_PREFIX: str = "/api/v1"

    DEBUG: bool = False

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:root@localhost:5432/insightpilot"

    # Auth / Security
    SECRET_KEY: str = "change-me-in-production"
    ENCRYPTION_KEY: str = "RNsRiUpL-qTmyvQnbrCSO_P5GAqMAmCpJ-2IoC1YZnA="  # Fernet key for encrypting secrets
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # AI / Gemini (optional — leave empty to use templated insights)
    GEMINI_API_KEY: str = "AIzaSyChfPKMgT8yumEhNNjKcE3Hg5fm1cGrHDM"
    GEMINI_MODEL: str = "gemini-2.0-flash-lite"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


settings = Settings()
