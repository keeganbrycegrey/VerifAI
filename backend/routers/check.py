# post /check — main claim checking endpoint
# accepts text, image_base64, or url

from fastapi import APIRouter, HTTPException
from models import CheckRequest, Verdict
from pipeline.pipeline import run_pipeline

router = APIRouter()


@router.post("", response_model=Verdict)
async def check_claim(request: CheckRequest) -> Verdict:
    try:
        return await run_pipeline(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))