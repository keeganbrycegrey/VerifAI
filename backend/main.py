# fastapi entry point
# run: uvicorn main:app --reload
# main file, wag gagalawin. chat ako if may need ibago

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import get_settings
from routers import check, webhook, dashboard

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-Powered Filipino Disinformation Detection System",
)

# allow extension and dashboard to call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(check.router,     prefix="/check",     tags=["check"])
app.include_router(webhook.router,   prefix="/webhook",   tags=["bot"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])


@app.get("/", tags=["health"])
async def root():
    return {"status": "online", "app": settings.APP_NAME, "version": settings.APP_VERSION}


@app.get("/health", tags=["health"])
async def health():
    return {"status": "healthy"}