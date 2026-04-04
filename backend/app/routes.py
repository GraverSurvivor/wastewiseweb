from __future__ import annotations

import uuid
from datetime import datetime, timezone
from urllib.parse import quote
from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field

from . import supabase_rest as sb
from .auth_deps import auth_context, email_from_token
from .helpers import (
    is_admin,
    iso_today_for_request,
    student_on_leave,
    student_row_for_user,
    today_ist_iso,
)
from .meals import MEAL_KEYS, can_cancel_booking, is_booking_closed, now_ist

router = APIRouter()


class MealDateBody(BaseModel):
    meal_type: str
    date: str | None = None


class LeaveBody(BaseModel):
    from_date: str
    to_date: str


class GuestPassBody(BaseModel):
    guest_name: str
    relation: str = "Guest"
    meal_type: str
    date: str | None = None


class ProfileBody(BaseModel):
    name: str
    roll_number: str


class AnnouncementBody(BaseModel):
    message: str = Field(min_length=1)


class WasteEntry(BaseModel):
    meal_type: str
    waste_kg: float


class WasteLogBody(BaseModel):
    date: str | None = None
    entries: list[WasteEntry]


class ComplaintStatusBody(BaseModel):
    status: str


class ScannerStudentBody(BaseModel):
    roll_number: str
    meal_type: str
    date: str | None = None


class ScannerGuestBody(BaseModel):
    qr_code: str
    meal_type: str
    date: str | None = None


@router.post("/bookings/book")
async def book_meal(body: MealDateBody, authorization: str | None = Header(None)):
    token, uid = auth_context(authorization)
    if body.meal_type not in MEAL_KEYS:
        raise HTTPException(400, "Invalid meal_type")
    day = iso_today_for_request(body.date)
    stu = await student_row_for_user(token, uid)
    if not stu:
        raise HTTPException(400, "Complete your student profile first.")
    if await student_on_leave(token, stu["id"], day):
        raise HTTPException(400, "You are on leave for this date.")
    if is_booking_closed(body.meal_type, now_ist()):
        raise HTTPException(400, "Booking closed for this meal.")
    path = (
        "bookings?select=*"
        f"&student_id=eq.{stu['id']}&date=eq.{day}&meal_type=eq.{body.meal_type}"
    )
    rows = await sb.rest_get(path, token)
    row = rows[0] if isinstance(rows, list) and rows else None
    if row and row.get("status") == "attended":
        raise HTTPException(400, "Meal already attended.")
    if row and row.get("id"):
        await sb.rest_patch(f"bookings?id=eq.{row['id']}", token, {"status": "booked"})
        return {"ok": True, "id": row["id"]}
    inserted = await sb.rest_post(
        "bookings",
        token,
        {
            "student_id": stu["id"],
            "meal_type": body.meal_type,
            "date": day,
            "status": "booked",
        },
    )
    rec = inserted[0] if isinstance(inserted, list) else inserted
    return {"ok": True, "id": rec.get("id") if isinstance(rec, dict) else None}


@router.post("/bookings/cancel")
async def cancel_meal(body: MealDateBody, authorization: str | None = Header(None)):
    token, uid = auth_context(authorization)
    if body.meal_type not in MEAL_KEYS:
        raise HTTPException(400, "Invalid meal_type")
    if not can_cancel_booking(body.meal_type, now_ist()):
        raise HTTPException(400, "Cancellation window closed.")
    day = iso_today_for_request(body.date)
    stu = await student_row_for_user(token, uid)
    if not stu:
        raise HTTPException(400, "Student profile not found.")
    path = (
        "bookings?select=*"
        f"&student_id=eq.{stu['id']}&date=eq.{day}&meal_type=eq.{body.meal_type}"
    )
    rows = await sb.rest_get(path, token)
    row = rows[0] if isinstance(rows, list) and rows else None
    if not row or not row.get("id"):
        raise HTTPException(404, "No booking to cancel.")
    await sb.rest_patch(
        f"bookings?id=eq.{row['id']}",
        token,
        {"status": "cancelled"},
    )
    return {"ok": True}


@router.post("/leave")
async def apply_leave(body: LeaveBody, authorization: str | None = Header(None)):
    token, uid = auth_context(authorization)
    if body.from_date > body.to_date:
        raise HTTPException(400, "from_date must be on or before to_date.")
    stu = await student_row_for_user(token, uid)
    if not stu:
        raise HTTPException(400, "Student profile not found.")
    await sb.rest_post(
        "leave_requests",
        token,
        {
            "student_id": stu["id"],
            "from_date": body.from_date,
            "to_date": body.to_date,
        },
    )
    filt = (
        f"and=(student_id.eq.{stu['id']},date.gte.{body.from_date},"
        f"date.lte.{body.to_date})"
    )
    await sb.rest_patch(f"bookings?{filt}", token, {"status": "cancelled"})
    return {"ok": True}


@router.post("/guest-passes")
async def create_guest_pass(body: GuestPassBody, authorization: str | None = Header(None)):
    token, uid = auth_context(authorization)
    if body.meal_type not in MEAL_KEYS:
        raise HTTPException(400, "Invalid meal_type")
    stu = await student_row_for_user(token, uid)
    if not stu:
        raise HTTPException(400, "Student profile not found.")
    gid = str(uuid.uuid4())
    day = iso_today_for_request(body.date)
    payload = {
        "id": gid,
        "student_id": stu["id"],
        "guest_name": body.guest_name.strip(),
        "relation": (body.relation or "Guest").strip(),
        "meal_type": body.meal_type,
        "date": day,
        "qr_code": f"WASTEWISE:{gid}",
        "payment_status": "pending",
    }
    data = await sb.rest_post("guest_passes", token, payload)
    row = data[0] if isinstance(data, list) else data
    return {"ok": True, "pass": row}


@router.post("/complaints")
async def create_complaint(
    authorization: str | None = Header(None),
    title: str = Form(...),
    description: str = Form(""),
    photo: UploadFile | None = File(None),
):
    token, uid = auth_context(authorization)
    stu = await student_row_for_user(token, uid)
    if not stu:
        raise HTTPException(400, "Student profile not found.")
    photo_url = None
    if photo and photo.filename:
        raw = await photo.read()
        ct = photo.content_type or "application/octet-stream"
        safe = f"{stu['id']}/{uuid.uuid4()}_{photo.filename}"
        await sb.storage_upload(token, "complaint-photos", safe, raw, ct)
        photo_url = sb.public_object_url("complaint-photos", safe)
    row = await sb.rest_post(
        "complaints",
        token,
        {
            "student_id": stu["id"],
            "title": title.strip(),
            "description": (description or "-").strip(),
            "photo_url": photo_url,
            "status": "open",
        },
    )
    rec = row[0] if isinstance(row, list) else row
    return {"ok": True, "complaint": rec}


@router.post("/student/profile")
async def upsert_profile(body: ProfileBody, authorization: str | None = Header(None)):
    token, uid = auth_context(authorization)
    email = email_from_token(token)
    if not email:
        raise HTTPException(400, "Missing email on account; sign in again.")
    path = f"students?select=face_registered&user_id=eq.{uid}"
    existing = await sb.rest_get(path, token)
    prev = existing[0] if isinstance(existing, list) and existing else {}
    payload = {
        "user_id": uid,
        "email": email,
        "name": body.name.strip(),
        "roll_number": body.roll_number.strip(),
        "face_registered": prev.get("face_registered") or False,
    }
    await sb.rest_post(
        "students?on_conflict=user_id",
        token,
        payload,
        merge=True,
    )
    return {"ok": True}


@router.post("/admin/announcements")
async def post_announcement(
    body: AnnouncementBody,
    authorization: str | None = Header(None),
):
    token, uid = auth_context(authorization)
    if not await is_admin(token, uid):
        raise HTTPException(403, "Admin only.")
    data = await sb.rest_post(
        "announcements",
        token,
        {"message": body.message.strip(), "created_by": uid},
    )
    row = data[0] if isinstance(data, list) else data
    return {"ok": True, "announcement": row}


@router.post("/admin/waste-log")
async def post_waste_log(
    body: WasteLogBody,
    authorization: str | None = Header(None),
):
    token, uid = auth_context(authorization)
    if not await is_admin(token, uid):
        raise HTTPException(403, "Admin only.")
    day = body.date or today_ist_iso()
    for e in body.entries:
        if e.meal_type not in MEAL_KEYS:
            raise HTTPException(400, f"Invalid meal_type: {e.meal_type}")
        await sb.rest_post(
            "waste_log?on_conflict=date,meal_type",
            token,
            {
                "date": day,
                "meal_type": e.meal_type,
                "waste_kg": e.waste_kg,
                "logged_by": uid,
            },
            merge=True,
        )
    return {"ok": True}


@router.patch("/admin/complaints/{complaint_id}/status")
async def patch_complaint_status(
    complaint_id: str,
    body: ComplaintStatusBody,
    authorization: str | None = Header(None),
):
    token, uid = auth_context(authorization)
    if not await is_admin(token, uid):
        raise HTTPException(403, "Admin only.")
    if body.status not in ("open", "acknowledged", "resolved"):
        raise HTTPException(400, "Invalid status.")
    await sb.rest_patch(
        f"complaints?id=eq.{complaint_id}",
        token,
        {"status": body.status},
    )
    return {"ok": True}


@router.post("/scanner/student")
async def scanner_student(
    body: ScannerStudentBody,
    authorization: str | None = Header(None),
):
    token, uid = auth_context(authorization)
    if not await is_admin(token, uid):
        raise HTTPException(403, "Admin only.")
    day = iso_today_for_request(body.date)
    if body.meal_type not in MEAL_KEYS:
        raise HTTPException(400, "Invalid meal_type.")
    rows = await sb.rest_get(
        f"students?select=id,name,roll_number&roll_number=eq.{body.roll_number.strip()}",
        token,
    )
    stu = rows[0] if isinstance(rows, list) and rows else None
    if not stu:
        return {"ok": True, "granted": False, "message": "Student not found."}
    brows = await sb.rest_get(
        "bookings?select=*"
        f"&student_id=eq.{stu['id']}&date=eq.{day}&meal_type=eq.{body.meal_type}",
        token,
    )
    booking = brows[0] if isinstance(brows, list) and brows else None
    label = body.meal_type
    if not booking or booking.get("status") == "cancelled":
        return {
            "ok": True,
            "granted": False,
            "message": f"Access denied — not booked for {label}.",
        }
    if booking.get("status") == "attended":
        return {
            "ok": True,
            "granted": True,
            "message": f"Already marked attended — {stu['name']}.",
        }
    ts = datetime.now(timezone.utc).isoformat()
    await sb.rest_patch(
        f"bookings?id=eq.{booking['id']}",
        token,
        {"status": "attended", "attended_at": ts},
    )
    return {
        "ok": True,
        "granted": True,
        "message": f"Access granted — {stu['name']} ({stu['roll_number']})",
    }


@router.post("/scanner/guest")
async def scanner_guest(
    body: ScannerGuestBody,
    authorization: str | None = Header(None),
):
    token, uid = auth_context(authorization)
    if not await is_admin(token, uid):
        raise HTTPException(403, "Admin only.")
    day = iso_today_for_request(body.date)
    if body.meal_type not in MEAL_KEYS:
        raise HTTPException(400, "Invalid meal_type.")
    code = body.qr_code.strip()
    rows = await sb.rest_get(
        f"guest_passes?select=*&qr_code=eq.{quote(code, safe='')}",
        token,
    )
    g = rows[0] if isinstance(rows, list) and rows else None
    if not g:
        return {"ok": True, "granted": False, "message": "Invalid guest QR."}
    if g.get("date") != day or g.get("meal_type") != body.meal_type:
        return {"ok": True, "granted": False, "message": "Pass not valid for this meal/day."}
    if g.get("scanned_at"):
        return {
            "ok": True,
            "granted": True,
            "message": f"Guest already entered — {g.get('guest_name')}.",
        }
    ts = datetime.now(timezone.utc).isoformat()
    await sb.rest_patch(
        f"guest_passes?id=eq.{g['id']}",
        token,
        {"scanned_at": ts, "payment_status": "paid"},
    )
    return {"ok": True, "granted": True, "message": f"Guest access — {g.get('guest_name')}"}
