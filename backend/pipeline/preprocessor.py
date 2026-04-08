# normalizes all input types to plain text
# handles text, base64 image, and url inputs

import base64
import io
import httpx
from bs4 import BeautifulSoup
import google.generativeai as genai
from PIL import Image
from models import PreprocessedInput
from config import get_settings

settings = get_settings()

_model = None

def _gemini():
    global _model
    if _model is None:
        if not settings.GEMINI_API_KEY:
            raise ValueError(
                "GEMINI_API_KEY is not configured in .env. "
                "Get your key from: https://aistudio.google.com/app/apikey"
            )
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _model = genai.GenerativeModel(settings.GEMINI_MODEL)
    return _model


async def preprocess(input_type: str, content: str) -> PreprocessedInput:
    if input_type == "text":
        text = content.strip()
    elif input_type == "image_base64":
        text = await _ocr_image(content)
    elif input_type == "url":
        text = await _fetch_url_text(content)
    else:
        raise ValueError(f"unknown input_type: {input_type}")

    return PreprocessedInput(
        text=text,
        language=_detect_language(text),
        source_url=content if input_type == "url" else None,
    )


async def _ocr_image(base64_image: str) -> str:
    # strip data URI prefix if present
    if "," in base64_image:
        base64_image = base64_image.split(",", 1)[1]

    image_bytes = base64.b64decode(base64_image)
    image = Image.open(io.BytesIO(image_bytes))

    prompt = (
        "Extract ALL visible text from this image exactly as it appears. "
        "Include text from memes, screenshots, captions, watermarks — everything. "
        "Do not summarize, comment, or add anything. Return only the raw extracted text."
    )

    response = _gemini().generate_content([prompt, image])
    return response.text.strip()


async def _fetch_url_text(url: str) -> str:
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as http:
        resp = await http.get(url, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
        tag.decompose()

    article = soup.find("article") or soup.find("main") or soup.body
    paragraphs = article.find_all("p") if article else soup.find_all("p")
    text = " ".join(p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 40)
    return text[:4000]


def _detect_language(text: str) -> str:
    if not text:
        return "en"

    words = text.lower().split()
    if not words:
        return "en"

    filipino_markers = {
        "ang", "ng", "mga", "sa", "na", "ay", "hindi", "ito", "siya",
        "niya", "nila", "daw", "raw", "po", "opo", "kaya", "pero",
        "dahil", "kung", "para", "ayon", "sinabi", "viral", "huwag",
        "talaga", "lang", "din", "rin", "ba", "mo", "ko", "si", "ni",
    }
    english_markers = {
        "the", "is", "are", "was", "were", "has", "have", "that", "this", "with",
    }

    fil_ratio = sum(1 for w in words if w in filipino_markers) / len(words)
    en_ratio  = sum(1 for w in words if w in english_markers) / len(words)

    if fil_ratio > 0.15:
        return "mixed" if en_ratio > 0.05 else "tl"
    return "en"