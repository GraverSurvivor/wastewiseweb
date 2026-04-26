from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

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


class ProfileBody(BaseModel):
    name: str
    roll_number: str


class AnnouncementBody(BaseModel):
    message: str = Field(min_length=1)
    duration_days: int = Field(default=1, ge=1, le=365)


class WasteEntry(BaseModel):
    meal_type: str
    waste_kg: float = Field(ge=0)


class WasteLogBody(BaseModel):
    date: str | None = None
    entries: list[WasteEntry]


class ComplaintStatusBody(BaseModel):
    status: str


class ScannerStudentBody(BaseModel):
    roll_number: str
    meal_type: str
    date: str | None = None


@router.post("/bookings/book")
async def book_meal(body: MealDateBody, authorization: str | None = Header(None)):
    token, uid = auth_context(authorization)
    if body.meal_type not in MEAL_KEYS:
        raise HTTPException(400, "Invalid meal_type")

    day = iso_today_for_request(body.date)
    student = await student_row_for_user(token, uid)
    if not student:
        raise HTTPException(400, "Complete your student profile first.")
    if await student_on_leave(token, student["id"], day):
        raise HTTPException(400, "You are on leave for this date.")
    if is_booking_closed(body.meal_type, now_ist()):
        raise HTTPException(400, "Booking closed for this meal.")

    path = (
        "bookings?select=*"
        f"&student_id=eq.{student['id']}&date=eq.{day}&meal_type=eq.{body.meal_type}"
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
            "student_id": student["id"],
            "meal_type": body.meal_type,
            "date": day,
            "status": "booked",
        },
    )
    record = inserted[0] if isinstance(inserted, list) else inserted
    return {"ok": True, "id": record.get("id") if isinstance(record, dict) else None}


@router.post("/bookings/cancel")
async def cancel_meal(body: MealDateBody, authorization: str | None = Header(None)):
    token, uid = auth_context(authorization)
    if body.meal_type not in MEAL_KEYS:
        raise HTTPException(400, "Invalid meal_type")
    if not can_cancel_booking(body.meal_type, now_ist()):
        raise HTTPException(400, "Cancellation window closed.")

    day = iso_today_for_request(body.date)
    student = await student_row_for_user(token, uid)
    if not student:
        raise HTTPException(400, "Student profile not found.")

    path = (
        "bookings?select=*"
        f"&student_id=eq.{student['id']}&date=eq.{day}&meal_type=eq.{body.meal_type}"
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

    student = await student_row_for_user(token, uid)
    if not student:
        raise HTTPException(400, "Student profile not found.")

    await sb.rest_post(
        "leave_requests",
        token,
        {
            "student_id": student["id"],
            "from_date": body.from_date,
            "to_date": body.to_date,
        },
    )

    filt = (
        f"and=(student_id.eq.{student['id']},date.gte.{body.from_date},"
        f"date.lte.{body.to_date})"
    )
    await sb.rest_patch(f"bookings?{filt}", token, {"status": "cancelled"})
    return {"ok": True}


@router.post("/complaints")
async def create_complaint(
    authorization: str | None = Header(None),
    title: str = Form(...),
    description: str = Form(""),
    photo: UploadFile | None = File(None),
):
    token, uid = auth_context(authorization)
    student = await student_row_for_user(token, uid)
    if not student:
        raise HTTPException(400, "Student profile not found.")

    photo_url = None
    if photo and photo.filename:
        raw = await photo.read()
        content_type = photo.content_type or "application/octet-stream"
        safe_name = f"{student['id']}/{uuid.uuid4()}_{photo.filename}"
        await sb.storage_upload(token, "complaint-photos", safe_name, raw, content_type)
        photo_url = sb.public_object_url("complaint-photos", safe_name)

    row = await sb.rest_post(
        "complaints",
        token,
        {
            "student_id": student["id"],
            "title": title.strip(),
            "description": (description or "-").strip(),
            "photo_url": photo_url,
            "status": "open",
        },
    )
    record = row[0] if isinstance(row, list) else row
    return {"ok": True, "complaint": record}


@router.post("/student/profile")
async def upsert_profile(body: ProfileBody, authorization: str | None = Header(None)):
    token, uid = auth_context(authorization)
    email = email_from_token(token)
    if not email:
        raise HTTPException(400, "Missing email on account; sign in again.")

    existing = await sb.rest_get(
        f"students?select=id,face_registered&user_id=eq.{uid}",
        token,
    )
    previous = existing[0] if isinstance(existing, list) and existing else None

    payload = {
        "user_id": uid,
        "email": email,
        "name": body.name.strip(),
        "roll_number": body.roll_number.strip(),
        "face_registered": previous.get("face_registered") if previous else False,
    }

    if previous:
        await sb.rest_patch(
            f"students?user_id=eq.{uid}",
            token,
            payload,
        )
    else:
        await sb.rest_post(
            "students",
            token,
            payload,
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

    expires_at = datetime.now(timezone.utc) + timedelta(days=body.duration_days)
    data = await sb.rest_post(
        "announcements",
        token,
        {
            "message": body.message.strip(),
            "created_by": uid,
            "duration_days": body.duration_days,
            "expires_at": expires_at.isoformat(),
        },
    )
    row = data[0] if isinstance(data, list) else data
    return {"ok": True, "announcement": row}


@router.delete("/admin/announcements/{announcement_id}")
async def delete_announcement(
    announcement_id: str,
    authorization: str | None = Header(None),
):
    token, uid = auth_context(authorization)
    if not await is_admin(token, uid):
        raise HTTPException(403, "Admin only.")

    rows = await sb.rest_get(
        f"announcements?select=id,created_by&id=eq.{announcement_id}",
        token,
    )
    row = rows[0] if isinstance(rows, list) and rows else None
    if not row:
        raise HTTPException(404, "Announcement not found.")
    if row.get("created_by") != uid:
        raise HTTPException(403, "You can delete only your own announcements.")

    await sb.rest_delete(f"announcements?id=eq.{announcement_id}", token)
    return {"ok": True}


@router.post("/admin/waste-log")
async def post_waste_log(
    body: WasteLogBody,
    authorization: str | None = Header(None),
):
    token, uid = auth_context(authorization)
    if not await is_admin(token, uid):
        raise HTTPException(403, "Admin only.")

    day = body.date or today_ist_iso()
    for entry in body.entries:
        if entry.meal_type not in MEAL_KEYS:
            raise HTTPException(400, f"Invalid meal_type: {entry.meal_type}")

        await sb.rest_post(
            "waste_log?on_conflict=date,meal_type",
            token,
            {
                "date": day,
                "meal_type": entry.meal_type,
                "waste_kg": entry.waste_kg,
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
    student = rows[0] if isinstance(rows, list) and rows else None
    if not student:
        return {"ok": True, "granted": False, "message": "Student not found."}

    bookings = await sb.rest_get(
        "bookings?select=*"
        f"&student_id=eq.{student['id']}&date=eq.{day}&meal_type=eq.{body.meal_type}",
        token,
    )
    booking = bookings[0] if isinstance(bookings, list) and bookings else None
    label = body.meal_type

    if not booking or booking.get("status") == "cancelled":
        return {
            "ok": True,
            "granted": False,
            "message": f"Access denied - not booked for {label}.",
        }

    if booking.get("status") == "attended":
        return {
            "ok": True,
            "granted": True,
            "message": f"Already marked attended - {student['name']}.",
        }

    timestamp = datetime.now(timezone.utc).isoformat()
    await sb.rest_patch(
        f"bookings?id=eq.{booking['id']}",
        token,
        {"status": "attended", "attended_at": timestamp},
    )
    return {
        "ok": True,
        "granted": True,
        "message": f"Access granted - {student['name']} ({student['roll_number']})",
    }
