"""Mess schedule and booking windows (IST). Backend source of truth for cutoff rules."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

MEAL_KEYS = frozenset({"breakfast", "lunch", "snacks", "dinner"})


@dataclass(frozen=True)
class MealDef:
    key: str
    start_h: int
    start_m: int
    end_h: int
    end_m: int


MEALS: tuple[MealDef, ...] = (
    MealDef("breakfast", 7, 30, 9, 0),
    MealDef("lunch", 12, 0, 14, 0),
    MealDef("snacks", 16, 30, 17, 30),
    MealDef("dinner", 19, 30, 21, 30),
)

BOOKING_CUTOFF_MINUTES = {
    "breakfast": 120,
    "lunch": 120,
    "snacks": 120,
    "dinner": 15,
}


def now_ist() -> datetime:
    return datetime.now(IST)


def to_iso_date_ist(d: Optional[datetime] = None) -> str:
    return (d or now_ist()).date().isoformat()


def _at_on_day(day: date, h: int, m: int) -> datetime:
    return datetime(day.year, day.month, day.day, h, m, tzinfo=IST)


def booking_cutoff_utc_for_display(meal_key: str, day: Optional[date] = None) -> datetime:
    """First instant when booking is closed for the meal (IST)."""
    meal = next((x for x in MEALS if x.key == meal_key), None)
    if not meal:
        return now_ist()
    d = day or now_ist().date()
    start = _at_on_day(d, meal.start_h, meal.start_m)
    cutoff_minutes = BOOKING_CUTOFF_MINUTES.get(meal_key, 120)
    return start - timedelta(minutes=cutoff_minutes)


def is_booking_closed(meal_key: str, when: Optional[datetime] = None) -> bool:
    when = when or now_ist()
    d = when.date()
    return when >= booking_cutoff_utc_for_display(meal_key, d)


def can_cancel_booking(meal_key: str, when: Optional[datetime] = None) -> bool:
    return not is_booking_closed(meal_key, when)


def meal_window_end_ist(meal_key: str, day: Optional[date] = None) -> datetime:
    meal = next((x for x in MEALS if x.key == meal_key), None)
    if not meal:
        return now_ist()
    d = day or now_ist().date()
    return _at_on_day(d, meal.end_h, meal.end_m)


def get_active_serving_meal(when: Optional[datetime] = None) -> Optional[str]:
    when = when or now_ist()
    d = when.date()
    for m in MEALS:
        a = _at_on_day(d, m.start_h, m.start_m)
        b = _at_on_day(d, m.end_h, m.end_m)
        if a <= when <= b:
            return m.key
    return None
