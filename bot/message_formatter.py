# formats verdict into filipino messenger message
# mobile-friendly, no markdown

from models import Verdict

RATING_EMOJI = {
    "true":          "✅",
    "false":         "❌",
    "misleading":    "⚠️",
    "unverified":    "🔍",
    "needs_context": "ℹ️",
}

RATING_LABEL_TL = {
    "true":          "TOTOO",
    "false":         "MALI",
    "misleading":    "NAKAKALITO",
    "unverified":    "HINDI PA NAPATUNAYAN",
    "needs_context": "KAILANGAN NG KONTEKSTO",
}


def format_verdict_for_messenger(verdict: Verdict) -> str:
    emoji = RATING_EMOJI.get(verdict.rating, "🔍")
    label = RATING_LABEL_TL.get(verdict.rating, "HINDI MALINAW")
    pct   = int(verdict.confidence * 100)

    # coverage summary lines
    covering_names = [o.outlet for o in verdict.coverage.covering]
    blind_spot = ""
    if covering_names:
        blind_spot = f"\n📰 Sumasaklaw: {', '.join(covering_names[:3])}"
        if len(covering_names) > 3:
            blind_spot += f" at {len(covering_names) - 3} pa"
    if verdict.coverage.not_covering:
        blind_spot += f"\n🚫 Hindi sumasaklaw: {', '.join(verdict.coverage.not_covering[:3])}"

    # source lines
    if verdict.sources:
        source_text = "\n\n🔗 Mga Sanggunian:\n" + "\n".join(f"• {s}" for s in verdict.sources[:3])
    elif verdict.fact_checks_found:
        fc = verdict.fact_checks_found[0]
        source_text = f"\n\n🔗 Fact-check: {fc.source} — {fc.verdict}\n{fc.url}"
    else:
        source_text = ""

    return (
        f"{emoji} TSEK.AI HATOL: {label}\n"
        f"Kumpiyansa: {pct}%\n"
        f"{'─' * 30}\n"
        f"📋 CLAIM:\n{verdict.claim}\n"
        f"{'─' * 30}\n"
        f"📝 PALIWANAG:\n{verdict.explanation_tl}"
        f"{blind_spot}"
        f"{source_text}\n"
        f"{'─' * 30}\n"
        f"🤖 Pinagana ng TSEK.AI | Huwag basta maniwala — mag-tsek muna!"
    )