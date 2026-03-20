# dashboard data endpoints
# all data from supabase, walang pipeline calls

from fastapi import APIRouter, HTTPException
from models import DashboardFeed
from db.supabase_client import (
    get_recent_verdicts,
    get_trending_claims,
    get_verdict_counts,
    get_coverage_heatmap,
    get_daily_usage,       
)

router = APIRouter()

# avoid pls paglagay ng too much logic dito, just call db client functions and return results
@router.get("/feed", response_model=DashboardFeed)
async def get_feed():
    try:
        recent   = await get_recent_verdicts(limit=20)
        trending = await get_trending_claims(limit=10)
        counts   = await get_verdict_counts()
        return DashboardFeed(
            recent_verdicts=recent,
            trending=trending,
            total_checks_today=counts["today"],
            total_checks_all_time=counts["all_time"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trending")
async def get_trending():
    try:
        return await get_trending_claims(limit=10)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/coverage")
async def get_coverage():
    try:
        return await get_coverage_heatmap()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/daily")
async def get_daily():
    try:
        return await get_daily_usage()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))