import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.routes import router as api_router


def create_app() -> FastAPI:
    app = FastAPI(title="WasteWiseWeb API", version="1.0.0")
    raw_origins = os.environ.get("CORS_ORIGINS", "").strip()
    origins = [item.strip() for item in raw_origins.split(",") if item.strip()]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)
    return app


app = create_app()
