# extracts single verifiable claim from text
# uses gemini-1.5-flash with low temperature

import json
import google.generativeai as genai
from google.generativeai import types
from models import PreprocessedInput, ExtractedClaim
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
        _model = genai.GenerativeModel(
            model_name=settings.GEMINI_MODEL,
            system_instruction=(
                "You are a fact-checking assistant specializing in Filipino disinformation. "
                "You extract the single most verifiable factual claim from any text. "
                "You always respond with valid JSON only — no markdown, no explanation."
            ),
            generation_config=types.GenerationConfig(
                temperature=0.1,
                max_output_tokens=512,
                response_mime_type="application/json",
            ),
        )
    return _model


async def extract_claim(preprocessed: PreprocessedInput) -> ExtractedClaim:
    prompt = _build_extraction_prompt(preprocessed.text, preprocessed.language)
    response = _gemini().generate_content(prompt)
    raw = response.text.strip()

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

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