# normalizes all input types to plain text
# handles text, base64 image, and url inputs

import httpx
from bs4 import BeautifulSoup
from groq import AsyncGroq
from models import PreprocessedInput
from config import get_settings

settings = get_settings()

# lazy init — avoids crash when key is empty at import
_client: AsyncGroq | None = None

def _groq() -> AsyncGroq:
    global _client
    if _client is None:
        _client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    return _client


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
    # ensure proper data uri
    if not base64_image.startswith("data:"):
        base64_image = f"data:image/jpeg;base64,{base64_image}"

    response = await _groq().chat.completions.create(
        model=settings.GROQ_VISION_MODEL,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": base64_image}},
                {
                    "type": "text",
                    "text": (
                        "Extract ALL visible text from this image exactly as it appears. "
                        "Include text from memes, screenshots, captions, watermarks — everything. "
                        "Do not summarize, comment, or add anything. Return only the raw extracted text."
                    )
                }
            ]
        }],
        max_tokens=1024,
    )
    return response.choices[0].message.content.strip()


async def _fetch_url_text(url: str) -> str:
    # fetch and strip html boilerplate
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
    # heuristic — counts filipino function words
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