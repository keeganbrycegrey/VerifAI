# all api keys and env vars live here
# wag ilalagay ang keys KAHIT SAAN, .env lang dapat, at dapat naka .gitignore
# copy .env.example to .env

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

    # gemini
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"

    # google fact check
    GOOGLE_FACTCHECK_API_KEY: str = ""
    GOOGLE_FACTCHECK_BASE_URL: str = "https://factchecktools.googleapis.com/v1alpha1/claims:search"

    # huggingface
    HUGGINGFACE_TOKEN: str = ""
    HUGGINGFACE_FILIPINO_MODEL: str = "jcblaise/roberta-tagalog-base"

    # newsapi
    NEWSAPI_KEY: str = ""
    NEWSAPI_BASE_URL: str = "https://newsapi.org/v2"

    # supabase
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""

    # messenger
    MESSENGER_PAGE_ACCESS_TOKEN: str = ""
    MESSENGER_VERIFY_TOKEN: str = "VerifAI"

    # gdelt 
    GDELT_BASE_URL: str = "https://api.gdeltproject.org/api/v2/doc/doc"


@lru_cache()
def get_settings() -> Settings:
    return Settings()