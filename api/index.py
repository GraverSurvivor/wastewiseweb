from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import get_settings
from backend.app.routes import router as api_router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="WasteWiseWeb API", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origin_list or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Vercel mounts this function at /api, so the app routes here should not
    # add another /api prefix.
    app.include_router(api_router)
    return app


app = create_app()
