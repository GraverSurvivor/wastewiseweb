import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


@lru_cache
def get_settings():
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    anon = os.environ.get("SUPABASE_ANON_KEY", "")
    jwt_secret = os.environ.get("SUPABASE_JWT_SECRET", "")
    cors = os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    if not url or not anon:
        raise RuntimeError(
            "Set SUPABASE_URL and SUPABASE_ANON_KEY in backend/.env",
        )
    origins = [o.strip() for o in cors.split(",") if o.strip()]
    return type(
        "Settings",
        (),
        {
            "supabase_url": url,
            "supabase_anon_key": anon,
            "supabase_jwt_secret": jwt_secret,
            "origin_list": origins,
        },
    )()
