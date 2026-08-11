from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://petplace:petplace@localhost:5432/petplace_db"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "dev-secret-key"
    google_geocoding_api_key: str = ""


settings = Settings()
