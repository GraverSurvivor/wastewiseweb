"""Call Supabase PostgREST with the end-user JWT so RLS stays enforced."""
from __future__ import annotations

import json
from typing import Any, Optional

import httpx

from .config import get_settings


def _headers(access_token: str, extra: Optional[dict[str, str]] = None) -> dict[str, str]:
    s = get_settings()
    h = {
        "apikey": s.supabase_anon_key,
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    if extra:
        h.update(extra)
    return h


async def rest_get(path: str, access_token: str) -> Any:
    s = get_settings()
    url = f"{s.supabase_url}/rest/v1/{path}"
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(url, headers=_headers(access_token))
    if r.status_code >= 400:
        raise RuntimeError(r.text or r.reason_phrase)
    if not r.content:
        return None
    return r.json()


async def rest_post(
    path: str,
    access_token: str,
    body: Any,
    *,
    merge: bool = False,
    prefer: str | None = None,
) -> Any:
    s = get_settings()
    url = f"{s.supabase_url}/rest/v1/{path}"
    if prefer is None:
        prefer = (
            "resolution=merge-duplicates,return=representation"
            if merge
            else "return=representation"
        )
    h = _headers(access_token, {"Prefer": prefer})
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(url, headers=h, content=json.dumps(body))
    if r.status_code >= 400:
        raise RuntimeError(r.text or r.reason_phrase)
    if not r.content:
        return None
    try:
        return r.json()
    except json.JSONDecodeError:
        return None


async def rest_patch(path: str, access_token: str, body: Any) -> Any:
    s = get_settings()
    url = f"{s.supabase_url}/rest/v1/{path}"
    h = _headers(
        access_token,
        {"Prefer": "return=representation"},
    )
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.patch(url, headers=h, content=json.dumps(body))
    if r.status_code >= 400:
        raise RuntimeError(r.text or r.reason_phrase)
    if not r.content:
        return None
    try:
        return r.json()
    except json.JSONDecodeError:
        return None


async def rest_delete(path: str, access_token: str) -> Any:
    s = get_settings()
    url = f"{s.supabase_url}/rest/v1/{path}"
    h = _headers(
        access_token,
        {"Prefer": "return=representation"},
    )
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.delete(url, headers=h)
    if r.status_code >= 400:
        raise RuntimeError(r.text or r.reason_phrase)
    if not r.content:
        return None
    try:
        return r.json()
    except json.JSONDecodeError:
        return None


async def storage_upload(
    access_token: str,
    bucket: str,
    object_path: str,
    data: bytes,
    content_type: str,
) -> None:
    s = get_settings()
    url = f"{s.supabase_url}/storage/v1/object/{bucket}/{object_path}"
    h = {
        "apikey": s.supabase_anon_key,
        "Authorization": f"Bearer {access_token}",
        "Content-Type": content_type,
    }
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, headers=h, content=data)
    if r.status_code >= 400:
        raise RuntimeError(r.text or r.reason_phrase)


def public_object_url(bucket: str, object_path: str) -> str:
    s = get_settings()
    return f"{s.supabase_url}/storage/v1/object/public/{bucket}/{object_path}"
