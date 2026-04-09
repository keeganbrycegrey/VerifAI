from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

RSS_FEEDS: dict[str, str] = {
    "Rappler":              "https://www.rappler.com/feed",
    "GMA News":             "https://data.gmanews.tv/gno/rss/news/feed.xml",
    "Inquirer":             "https://newsinfo.inquirer.net/feed",
    "Philippine News Agency": "https://www.pna.gov.ph/latest.rss",
    "Business Mirror":      "https://businessmirror.com.ph/feed",
    "Eagle News":           "https://www.eaglenews.ph/feed",
    "Google News PH":       "https://news.google.com/rss?hl=en-PH&gl=PH&ceid=PH:en",
}

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    APP_NAME: str = "VerifAI"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # groq
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_VISION_MODEL: str = "meta-llama/llama-4-scout-17b-16e-instruct"

    GOOGLE_FACTCHECK_API_KEY: str = ""
    GOOGLE_FACTCHECK_BASE_URL: str = "https://factchecktools.googleapis.com/v1alpha1/claims:search"

    HUGGINGFACE_TOKEN: str = ""
    HUGGINGFACE_FILIPINO_MODEL: str = "jcblaise/roberta-tagalog-base"

    NEWSAPI_KEY: str = ""
    NEWSAPI_BASE_URL: str = "https://newsapi.org/v2"

    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""

    MESSENGER_PAGE_ACCESS_TOKEN: str = ""
    MESSENGER_VERIFY_TOKEN: str = "VerifAI"

    GDELT_BASE_URL: str = "https://api.gdeltproject.org/api/v2/doc/doc"


@lru_cache()
def get_settings() -> Settings:
    return Settings()