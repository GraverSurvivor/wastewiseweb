from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routes import router as api_router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="WasteWiseWeb API", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # ✅ FIXED
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api")
    return app



app = create_app()