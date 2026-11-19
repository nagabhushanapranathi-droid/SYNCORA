from datetime import date
from typing import List, Dict, Any, Optional
from app import db
from app.models.models import Faculty, Subject, Attendance, SubstitutionAssignment, SubstitutionRequest
from app.algorithms.allocation import get_substitution_count


def get_all_faculty_with_metadata(today_date: Optional[date] = None) -> List[Dict[str, Any]]:
    """Retrieve all faculty enriched with today's attendance status and substitution count."""
    if today_date is None:
        today_date = date.today()
    
    faculty_list = Faculty.query.all()
    attendances = Attendance.query.filter_by(date=today_date).all()
    attendance_map = {a.faculty_id: a for a in attendances}
    
    result = []
    for f in faculty_list:
        data = f.to_dict(include_subjects=True)
        att = attendance_map.get(f.id)
        data['today_attendance'] = {
            'status': att.status if att else 'NOT_MARKED',
            'login_time': att.login_time.strftime('%H:%M:%S') if att and att.login_time else None,
            'logout_time': att.logout_time.strftime('%H:%M:%S') if att and att.logout_time else None,
            'notes': att.notes if att else None
        }
        data['substitution_count'] = get_substitution_count(f.id)
        result.append(data)
    return result


def add_subject_to_faculty(faculty_id: int, subject_id: int) -> bool:
    faculty = Faculty.query.get(faculty_id)
    subject = Subject.query.get(subject_id)
    if not faculty or not subject:
        return False
    if subject not in faculty.subjects:
        faculty.subjects.append(subject)
        db.session.commit()
    return True


def remove_subject_from_faculty(faculty_id: int, subject_id: int) -> bool:
    faculty = Faculty.query.get(faculty_id)
    subject = Subject.query.get(subject_id)
    if not faculty or not subject:
        return False
    if subject in faculty.subjects:
        faculty.subjects.remove(subject)
        db.session.commit()
    return True
