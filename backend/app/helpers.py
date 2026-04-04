from __future__ import annotations

from . import supabase_rest as sb
from .meals import now_ist, to_iso_date_ist


async def student_row_for_user(access_token: str, user_id: str) -> dict | None:
    path = f"students?select=*&user_id=eq.{user_id}"
    rows = await sb.rest_get(path, access_token)
    if isinstance(rows, list) and rows:
        return rows[0]
    return None


async def student_on_leave(access_token: str, student_id: str, iso_date: str) -> bool:
    path = (
        f"leave_requests?select=from_date,to_date&student_id=eq.{student_id}"
    )
    rows = await sb.rest_get(path, access_token)
    if not isinstance(rows, list):
        return False
    for r in rows:
        if r.get("from_date") <= iso_date <= r.get("to_date"):
            return True
    return False


async def is_admin(access_token: str, user_id: str) -> bool:
    path = f"profiles?select=role&id=eq.{user_id}"
    rows = await sb.rest_get(path, access_token)
    if isinstance(rows, list) and rows:
        return rows[0].get("role") == "admin"
    return False


def today_ist_iso() -> str:
    return to_iso_date_ist(now_ist())


def iso_today_for_request(date_override: str | None) -> str:
    if date_override:
        return date_override
    return today_ist_iso()
