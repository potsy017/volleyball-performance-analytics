from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    SECRET_KEY: str = "change-me"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173"

    AUTH_ENABLED: bool = False
    SUPABASE_JWT_SECRET: str = ""
    ALLOWED_EMAIL_DOMAINS: str = ""
    DATA_SOURCE: str = "supabase"
    WAREHOUSE_CONNECTION_STRING: str = ""

    # Optional — used on client-changes-sai / after Entra auth merge
    AUTH_ENABLED: bool = False
    SUPABASE_JWT_SECRET: str = ""
    ALLOWED_EMAIL_DOMAINS: str = ""
    DATA_SOURCE: str = "supabase"
    WAREHOUSE_CONNECTION_STRING: str = ""

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    @property
    def allowed_email_domains_list(self) -> list[str]:
        return [d.strip() for d in self.ALLOWED_EMAIL_DOMAINS.split(",") if d.strip()]


settings = Settings()
