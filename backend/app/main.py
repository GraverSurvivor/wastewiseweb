import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import router as api_router


def create_app() -> FastAPI:
    raw_origins = os.environ.get("CORS_ORIGINS", "").strip()
    origins = [item.strip() for item in raw_origins.split(",") if item.strip()]
    app = FastAPI(
        title="WasteWiseWeb API",
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api")
    return app


app = create_app()
