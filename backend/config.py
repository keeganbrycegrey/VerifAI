# all api keys and env vars live here
# never hardcode keys elsewhere
# copy .env.example to .env

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

# rss feeds outside settings — complex dicts break pydantic-settings
RSS_FEEDS: dict[str, str] = {
    "Rappler":        "https://www.rappler.com/feed",
    "GMA News":       "https://data.gmanews.tv/gno/rss/news/feed.xml",
    "Inquirer":       "https://newsinfo.inquirer.net/feed",
    "PNA":            "https://www.pna.gov.ph/latest.rss",
    "Google News PH": "https://news.google.com/rss?hl=en-PH&gl=PH&ceid=PH:en",
}

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    # app
    APP_NAME: str = "TSEK.AI"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # groq — console.groq.com
    GROQ_API_KEY: str = ""
    GROQ_TEXT_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_VISION_MODEL: str = "llava-v1.5-7b-4096-preview"

    # google fact check — console.cloud.google.com
    GOOGLE_FACTCHECK_API_KEY: str = ""
    GOOGLE_FACTCHECK_BASE_URL: str = "https://factchecktools.googleapis.com/v1alpha1/claims:search"

    # huggingface — huggingface.co/settings/tokens
    HUGGINGFACE_TOKEN: str = ""
    HUGGINGFACE_FILIPINO_MODEL: str = "jcblaise/roberta-tagalog-base"

    # newsapi — newsapi.org/register
    NEWSAPI_KEY: str = ""
    NEWSAPI_BASE_URL: str = "https://newsapi.org/v2"

    # supabase — supabase.com
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""

    # messenger — developers.facebook.com
    MESSENGER_PAGE_ACCESS_TOKEN: str = ""
    MESSENGER_VERIFY_TOKEN: str = "tsek_ai_verify"

    # gdelt — no key needed
    GDELT_BASE_URL: str = "https://api.gdeltproject.org/api/v2/doc/doc"


@lru_cache()
def get_settings() -> Settings:
    return Settings()