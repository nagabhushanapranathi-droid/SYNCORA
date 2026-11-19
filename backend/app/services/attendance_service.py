from datetime import date, datetime, time
from typing import Dict, Any, Optional
from app import db
from app.models.models import Attendance, Faculty


def get_today_summary(target_date: Optional[date] = None) -> Dict[str, Any]:
    """Return attendance summary counts and list for a specific date (defaults to today)."""
    if target_date is None:
        target_date = date.today()
    
    total_faculty = Faculty.query.filter_by(is_active=True).count()
    records = Attendance.query.filter_by(date=target_date).all()
    
    present_count = sum(1 for r in records if r.status == 'PRESENT')
    absent_count = sum(1 for r in records if r.status == 'ABSENT')
    logged_out_count = sum(1 for r in records if r.status == 'LOGGED_OUT')
    marked_faculty_ids = {r.faculty_id for r in records}
    not_marked_count = total_faculty - len(marked_faculty_ids)
    
    return {
        'date': target_date.isoformat(),
        'total_faculty': total_faculty,
        'present_count': present_count,
        'absent_count': absent_count,
        'logged_out_count': logged_out_count,
        'not_marked_count': max(0, not_marked_count),
        'records': [r.to_dict() for r in records]
    }


def mark_or_update_attendance(
    faculty_id: int,
    target_date: date,
    status: str,
    login_time: Optional[time] = None,
    logout_time: Optional[time] = None,
    notes: Optional[str] = None,
    override_by: Optional[int] = None
) -> Attendance:
    """Create or update an attendance record with optional admin override logging."""
    record = Attendance.query.filter_by(faculty_id=faculty_id, date=target_date).first()
    now_dt = datetime.utcnow()
    
    if not record:
        record = Attendance(
            faculty_id=faculty_id,
            date=target_date,
            status=status,
            login_time=login_time,
            logout_time=logout_time,
            notes=notes,
            override_by=override_by,
            override_at=now_dt if override_by else None
        )
        db.session.add(record)
    else:
        record.status = status
        if login_time is not None:
            record.login_time = login_time
        if logout_time is not None:
            record.logout_time = logout_time
        if notes is not None:
            record.notes = notes
        if override_by:
            record.override_by = override_by
            record.override_at = now_dt
            
    db.session.commit()
    return record
