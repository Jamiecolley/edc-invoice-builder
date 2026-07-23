from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg2://edcuser:edcpass@postgres:5432/edc_invoice"
    jwt_secret_key: str = "change_me"
    jwt_expire_minutes: int = 480

    initial_admin_email: str = "admin@example.com"
    initial_admin_password: str = "ChangeMe123!"
    initial_admin_name: str = "Admin User"

    edc_base_url: str = "https://qa.api.edc.dsv.com"
    edc_username: str = ""
    edc_password: str = ""
    edc_timeout_seconds: int = 60

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
