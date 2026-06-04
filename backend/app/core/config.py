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

    # Gmail SMTP for admin notifications
    GMAIL_USER: str = ""
    GMAIL_APP_PASSWORD: str = ""
    ADMIN_EMAIL: str = ""

    @property
    def origins_list(self) -> list[str]:
        # Strip surrounding quotes Railway sometimes adds, then split
        raw = self.ALLOWED_ORIGINS.strip().strip('"').strip("'")
        return [o.strip().strip('"').strip("'") for o in raw.split(",") if o.strip()]

    @property
    def allowed_email_domains_list(self) -> list[str]:
        return [d.strip() for d in self.ALLOWED_EMAIL_DOMAINS.split(",") if d.strip()]


settings = Settings()
