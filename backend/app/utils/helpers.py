from datetime import date, datetime, time
from typing import Union


def get_day_of_week(d: Union[date, datetime]) -> str:
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    return days[d.weekday()]


def parse_time(time_val: Union[str, time]) -> time:
    """Parse HH:MM or HH:MM:SS string to time object, or return if already time."""
    if isinstance(time_val, time):
        return time_val
    if isinstance(time_val, str):
        parts = time_val.strip().split(':')
        return time(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)
    raise ValueError(f"Invalid time format: {time_val}")


def parse_date(date_val: Union[str, date]) -> date:
    """Parse YYYY-MM-DD string to date object, or return if already date."""
    if isinstance(date_val, date) and not isinstance(date_val, datetime):
        return date_val
    if isinstance(date_val, datetime):
        return date_val.date()
    if isinstance(date_val, str):
        return datetime.strptime(date_val.strip(), '%Y-%m-%d').date()
    raise ValueError(f"Invalid date format: {date_val}")


def times_overlap(start1: time, end1: time, start2: time, end2: time) -> bool:
    """Check if two time ranges overlap."""
    return start1 < end2 and end1 > start2


def success_response(data=None, message=None, status=200):
    resp = {'success': True}
    if data is not None:
        resp['data'] = data
    if message:
        resp['message'] = message
    return resp, status


def error_response(message, code=None, status=400):
    resp = {'success': False, 'error': message}
    if code:
        resp['code'] = code
    return resp, status
