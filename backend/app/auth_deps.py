from __future__ import annotations

import base64
import jwt
from fastapi import HTTPException
from .config import get_settings


def bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return authorization[7:].strip()


def decode_access_token(token: str) -> dict:
    secret = get_settings().supabase_jwt_secret
    
    # Try base64 decoded secret first
    try:
        decoded_secret = base64.b64decode(secret + "==")
    except Exception:
        decoded_secret = secret.encode()
    
    for key in [decoded_secret, secret.encode(), secret]:
        for verify_aud in [True, False]:
            try:
                return jwt.decode(
                    token,
                    key,
                    algorithms=["HS256"],
                    audience="authenticated" if verify_aud else None,
                    options={} if verify_aud else {"verify_aud": False},
                )
            except jwt.PyJWTError:
                continue
    
    raise HTTPException(status_code=401, detail="Invalid or expired token")


def auth_context(authorization: str | None) -> tuple[str, str]:
    token = bearer_token(authorization)
    payload = decode_access_token(token)
    uid = payload.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return token, uid


def email_from_token(token: str) -> str:
    payload = decode_access_token(token)
    return (payload.get("email") or "").strip().lower()