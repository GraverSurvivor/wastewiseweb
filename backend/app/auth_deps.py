from __future__ import annotations

import jwt
from fastapi import HTTPException
from .config import get_settings


def bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return authorization[7:].strip()


def decode_access_token(token: str) -> dict:
    # ⚠️ TEMPORARY: skip verification (for development only)
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        print("⚠️ TOKEN DECODED WITHOUT VERIFICATION")
        return payload
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token") from e


def auth_context(authorization: str | None) -> tuple[str, str]:
    print("\n--- AUTH CONTEXT DEBUG ---")

    print("AUTH HEADER:", authorization)

    token = bearer_token(authorization)
    print("EXTRACTED TOKEN:", token)

    payload = decode_access_token(token)
    print("PAYLOAD:", payload)

    uid = payload.get("sub")
    print("USER ID:", uid)

    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    print("--- END DEBUG ---\n")

    return token, uid


def email_from_token(token: str) -> str:
    payload = decode_access_token(token)
    return (payload.get("email") or "").strip().lower()