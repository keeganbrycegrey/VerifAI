# messenger webhook handler
# receives events, runs pipeline, sends verdict

import base64
import httpx
from models import CheckRequest
from pipeline.pipeline import run_pipeline
from bot.message_formatter import format_verdict_for_messenger
from config import get_settings

settings = get_settings()

MESSENGER_SEND_URL = "https://graph.facebook.com/v21.0/me/messages"


async def handle_message(event: dict) -> None:
    sender_id = event.get("sender", {}).get("id")
    if not sender_id:
        return

    message = event.get("message", {})

    if "text" in message:
        input_type = "text"
        content = message["text"]
    elif "attachments" in message:
        attachment = message["attachments"][0]
        if attachment.get("type") == "image":
            content = await _image_url_to_base64(attachment["payload"]["url"])
            input_type = "image_base64"
        else:
            await _send_text(sender_id, "Pasensya na, tanggap lamang ang teksto at mga larawan ngayon.")
            return
    else:
        return

    await _send_action(sender_id, "typing_on")

    try:
        verdict = await run_pipeline(CheckRequest(
            input_type=input_type,
            content=content,
            source_surface="messenger",
            language_hint="auto",
        ))
        reply = format_verdict_for_messenger(verdict)
    except Exception as e:
        print(f"pipeline error in bot: {e}")
        reply = "May nangyaring mali. Subukan muli mamaya. (An error occurred. Please try again.)"

    await _send_text(sender_id, reply)


async def _send_text(recipient_id: str, text: str) -> None:
    # split at 1900 chars — messenger limit is 2000
    chunks = [text[i:i+1900] for i in range(0, len(text), 1900)]
    async with httpx.AsyncClient(timeout=10) as http:
        for chunk in chunks:
            await http.post(
                MESSENGER_SEND_URL,
                params={"access_token": settings.MESSENGER_PAGE_ACCESS_TOKEN},
                json={"recipient": {"id": recipient_id}, "message": {"text": chunk}},
            )


async def _send_action(recipient_id: str, action: str) -> None:
    async with httpx.AsyncClient(timeout=5) as http:
        await http.post(
            MESSENGER_SEND_URL,
            params={"access_token": settings.MESSENGER_PAGE_ACCESS_TOKEN},
            json={"recipient": {"id": recipient_id}, "sender_action": action},
        )


async def _image_url_to_base64(url: str) -> str:
    async with httpx.AsyncClient(timeout=15) as http:
        resp = await http.get(url)
        resp.raise_for_status()
    return base64.b64encode(resp.content).decode("utf-8")