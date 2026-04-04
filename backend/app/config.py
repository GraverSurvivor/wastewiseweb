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
    if not url or not anon or not jwt_secret:
        raise RuntimeError(
            "Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_JWT_SECRET in backend/.env",
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
