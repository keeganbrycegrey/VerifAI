# extracts single verifiable claim from text
# uses llama 3.3 with low temperature
# ni hao fine shyt

import json
from groq import AsyncGroq
from models import PreprocessedInput, ExtractedClaim
from config import get_settings

settings = get_settings()

# lazy init — avoids crash on empty key
_client: AsyncGroq | None = None

def _groq() -> AsyncGroq:
    global _client
    if _client is None:
        _client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    return _client


async def extract_claim(preprocessed: PreprocessedInput) -> ExtractedClaim:
    prompt = _build_extraction_prompt(preprocessed.text, preprocessed.language)

    response = await _groq().chat.completions.create(
        model=settings.GROQ_TEXT_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a fact-checking assistant specializing in Filipino disinformation. "
                    "You extract the single most verifiable factual claim from any text. "
                    "You always respond with valid JSON only — no markdown, no explanation."
                )
            },
            {"role": "user", "content": prompt},
        ],
        max_tokens=512,
        temperature=0.1,
    )

    raw = response.choices[0].message.content.strip()

    # strip markdown fences if model adds them
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    # fallback if json parsing fails
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return ExtractedClaim(
            core_claim=preprocessed.text[:200],
            entities=[],
            language=preprocessed.language,
            original_text=preprocessed.text,
        )

    return ExtractedClaim(
        core_claim=parsed.get("core_claim", preprocessed.text[:200]),
        entities=parsed.get("entities", []),
        language=preprocessed.language,
        original_text=preprocessed.text,
    )


def _build_extraction_prompt(text: str, language: str) -> str:
    return f"""Analyze the following text and extract the single most specific, verifiable factual claim.

TEXT:
{text}

INSTRUCTIONS:
1. Identify the ONE core factual assertion that can be fact-checked (not opinions, not questions)
2. Restate it as a clear, single declarative sentence
3. Extract all named entities (people, organizations, places, dates, numbers)
4. If the text contains multiple claims, choose the most specific and verifiable one
5. Preserve the original language of the claim ({language})

Respond ONLY with this JSON (no markdown, no extra text):
{{
  "core_claim": "the single verifiable factual claim as a declarative sentence",
  "entities": ["entity1", "entity2", "entity3"]
}}"""