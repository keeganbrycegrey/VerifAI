from fastapi import APIRouter, Request, HTTPException, Query
from config import get_settings
from bot.messenger import handle_message

router = APIRouter()
settings = get_settings()


@router.get("")
async def verify_webhook(
    hub_mode: str           = Query(None, alias="hub.mode"),
    hub_verify_token: str   = Query(None, alias="hub.verify_token"),
    hub_challenge: str      = Query(None, alias="hub.challenge"),
):
    if not hub_challenge:
        raise HTTPException(status_code=400, detail="missing hub.challenge")
    if hub_mode == "subscribe" and hub_verify_token == settings.MESSENGER_VERIFY_TOKEN:
        return int(hub_challenge)
    raise HTTPException(status_code=403, detail="verification failed")


@router.post("")
async def receive_message(request: Request):
    body = await request.json()
    try:
        for entry in body.get("entry", []):
            for event in entry.get("messaging", []):
                await handle_message(event)
    except Exception as e:
        print(f"webhook error: {e}")
    return {"status": "ok"}