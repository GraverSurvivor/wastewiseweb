from __future__ import annotations

import httpx
from fastapi import HTTPException

from .config import get_settings


def bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return authorization[7:].strip()


async def auth_user(token: str) -> dict:
    s = get_settings()
    url = f"{s.supabase_url}/auth/v1/user"
    headers = {
        "apikey": s.supabase_anon_key,
        "Authorization": f"Bearer {token}",
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url, headers=headers)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=503,
            detail="Could not reach Supabase auth service.",
        ) from exc

    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if response.status_code >= 400:
        raise HTTPException(
            status_code=500,
            detail="Could not validate login session.",
        )

    try:
        payload = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=500, detail="Invalid auth response.") from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=500, detail="Invalid auth response.")
    return payload


async def auth_context(authorization: str | None) -> tuple[str, str, dict]:
    token = bearer_token(authorization)
    payload = await auth_user(token)
    uid = payload.get("id") or payload.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return token, str(uid), payload
