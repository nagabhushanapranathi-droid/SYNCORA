from datetime import date, time
from typing import List, Dict, Optional, Tuple


def get_substitution_count(faculty_id: int) -> int:
    """Count approved substitutions for a faculty member (actual workload)."""
    from app.models.models import SubstitutionAssignment, SubstitutionRequest
    return SubstitutionAssignment.query.join(
        SubstitutionRequest,
        SubstitutionAssignment.request_id == SubstitutionRequest.id
    ).filter(
        SubstitutionAssignment.assigned_faculty_id == faculty_id,
        SubstitutionRequest.status.in_(['APPROVED', 'ASSIGNED'])
    ).count()


def check_timetable_conflict(faculty_id: int, day_of_week: str, start_time: time, end_time: time, exclude_timetable_id: Optional[int] = None) -> bool:
    """Returns True if the faculty has a timetable conflict."""
    from app.models.models import Timetable
    from app.utils.helpers import times_overlap
    
    query = Timetable.query.filter(
        Timetable.faculty_id == faculty_id,
        Timetable.day_of_week == day_of_week,
        Timetable.is_active == True
    )
    if exclude_timetable_id:
        query = query.filter(Timetable.id != exclude_timetable_id)
    
    for entry in query.all():
        if times_overlap(entry.start_time, entry.end_time, start_time, end_time):
            return True
    return False


def check_substitution_conflict(faculty_id: int, absence_date: date, start_time: time, end_time: time) -> bool:
    """Returns True if faculty already has an approved substitution during this slot."""
    from app import db
    from app.models.models import SubstitutionAssignment, SubstitutionRequest, Timetable
    from app.utils.helpers import times_overlap
    
    assignments = db.session.query(SubstitutionAssignment).join(
        SubstitutionRequest, SubstitutionAssignment.request_id == SubstitutionRequest.id
    ).join(
        Timetable, SubstitutionRequest.timetable_id == Timetable.id
    ).filter(
        SubstitutionAssignment.assigned_faculty_id == faculty_id,
        SubstitutionRequest.date == absence_date,
        SubstitutionRequest.status.in_(['APPROVED', 'ASSIGNED'])
    ).all()
    
    for assignment in assignments:
        slot_timetable = assignment.request.timetable
        if slot_timetable and times_overlap(
            slot_timetable.start_time, slot_timetable.end_time,
            start_time, end_time
        ):
            return True
    return False


def check_attendance_valid(faculty_id: int, absence_date: date, class_start_time: time) -> Tuple[bool, str]:
    """Check if faculty is validly present. Returns (is_eligible, reason)."""
    from app.models.models import Attendance
    
    attendance = Attendance.query.filter_by(
        faculty_id=faculty_id,
        date=absence_date
    ).first()
    
    if not attendance:
        return False, 'No attendance record for today'
    if attendance.status == 'ABSENT':
        return False, 'Marked absent'
    if attendance.status not in ['PRESENT', 'LOGGED_OUT']:
        return False, f'Status is {attendance.status}'
    if not attendance.login_time:
        return False, 'No login recorded'
    if attendance.status == 'LOGGED_OUT' and attendance.logout_time:
        if attendance.logout_time <= class_start_time:
            return False, f'Logged out at {attendance.logout_time.strftime("%H:%M")} before class'
    if attendance.status == 'LOGGED_OUT':
        # Even if logged out after class start, exclude them
        return False, 'Currently logged out'
    return True, 'Present'


def calculate_specialization_match(specialization: Optional[str], subject_name: str, subject_code: str) -> bool:
    """Check if faculty specialization matches subject."""
    if not specialization:
        return False
    spec_lower = specialization.lower()
    subject_words = set(w for w in subject_name.lower().split() if len(w) > 3)
    code_lower = subject_code.lower()
    return any(word in spec_lower for word in subject_words) or (len(code_lower) >= 2 and code_lower[:2] in spec_lower)


def run_allocation(timetable_id: int, absence_date: date, absent_faculty_id: int) -> Dict:
    """
    Main allocation function. Finds and ranks eligible substitutes.
    
    Returns dict with:
    - primary_candidates: list of subject-expert candidates (scored)
    - fallback_candidates: list of available but not subject-expert candidates
    - has_expert: bool
    - eligible_count: int
    - timetable_info: dict or None
    - error: str or None
    """
    from app.models.models import Timetable, Faculty, Subject
    
    # Get the affected timetable entry
    timetable_entry = Timetable.query.get(timetable_id)
    if not timetable_entry:
        return {
            'error': 'Timetable entry not found',
            'primary_candidates': [],
            'fallback_candidates': [],
            'has_expert': False,
            'eligible_count': 0,
            'timetable_info': None
        }
    
    affected_subject = Subject.query.get(timetable_entry.subject_id)
    affected_subject_id = timetable_entry.subject_id
    affected_dept_id = timetable_entry.department_id
    day_of_week = timetable_entry.day_of_week
    start_time = timetable_entry.start_time
    end_time = timetable_entry.end_time
    
    # Get all active faculty except the absent one
    all_faculty = Faculty.query.filter(
        Faculty.id != absent_faculty_id,
        Faculty.is_active == True
    ).all()
    
    eligible_scored = []
    ineligible_reasons = {}
    
    for faculty in all_faculty:
        # Hard check 1: Attendance
        is_present, presence_reason = check_attendance_valid(faculty.id, absence_date, start_time)
        if not is_present:
            ineligible_reasons[faculty.id] = presence_reason
            continue
        
        # Hard check 2: Timetable conflict
        if check_timetable_conflict(faculty.id, day_of_week, start_time, end_time, timetable_id):
            ineligible_reasons[faculty.id] = 'Has a timetable conflict at this time'
            continue
        
        # Hard check 3: Existing substitution conflict
        if check_substitution_conflict(faculty.id, absence_date, start_time, end_time):
            ineligible_reasons[faculty.id] = 'Already assigned as substitute during this slot'
            continue
        
        # Faculty is eligible — now score them
        score = 0
        breakdown = {'subject_expertise': 0, 'department_match': 0, 'specialization': 0, 'workload': 0}
        reasons = []
        
        # Subject expertise: 50 points
        subject_ids = [s.id for s in faculty.subjects]
        teaches_subject = affected_subject_id in subject_ids
        if teaches_subject:
            score += 50
            breakdown['subject_expertise'] = 50
            reasons.append(f'Qualified to teach {affected_subject.name if affected_subject else "this subject"}')
        
        # Department match: 20 points
        same_dept = faculty.department_id == affected_dept_id
        if same_dept:
            score += 20
            breakdown['department_match'] = 20
            reasons.append(f'Same department ({faculty.department.name if faculty.department else "unknown"})')
        
        # Specialization: 10 points
        spec_match = calculate_specialization_match(
            faculty.specialization,
            affected_subject.name if affected_subject else '',
            affected_subject.code if affected_subject else ''
        )
        if spec_match:
            score += 10
            breakdown['specialization'] = 10
            reasons.append(f'Specialization ({faculty.specialization}) is relevant')
        
        # Workload: up to 20 points
        workload_count = get_substitution_count(faculty.id)
        eligible_scored.append({
            '_faculty': faculty,
            '_workload': workload_count,
            'score_partial': score,
            'breakdown': breakdown,
            'reasons': reasons,
            'teaches_subject': teaches_subject,
            'same_dept': same_dept,
            'spec_match': spec_match,
            'workload_count': workload_count
        })
    
    if not eligible_scored:
        return {
            'primary_candidates': [],
            'fallback_candidates': [],
            'has_expert': False,
            'eligible_count': 0,
            'timetable_info': timetable_entry.to_dict(),
            'error': None
        }
    
    # Compute workload scores relative to max
    max_workload = max(c['workload_count'] for c in eligible_scored)
    
    final_scored = []
    for c in eligible_scored:
        workload_count = c['workload_count']
        if max_workload > 0:
            workload_score = round(20 * (1 - workload_count / max_workload))
        else:
            workload_score = 20
        total_score = c['score_partial'] + workload_score
        c['breakdown']['workload'] = workload_score
        if workload_count == 0:
            c['reasons'].append('No previous substitution assignments')
        else:
            c['reasons'].append(f'{workload_count} previous substitution assignment(s)')
        
        faculty = c['_faculty']
        final_scored.append({
            'faculty_id': faculty.id,
            'faculty_name': faculty.name,
            'faculty_email': faculty.email,
            'department_name': faculty.department.name if faculty.department else None,
            'department_id': faculty.department_id,
            'designation': faculty.designation,
            'specialization': faculty.specialization,
            'teaches_subject': c['teaches_subject'],
            'same_department': c['same_dept'],
            'specialization_match': c['spec_match'],
            'workload_count': workload_count,
            'score': total_score,
            'breakdown': c['breakdown'],
            'reasons': c['reasons']
        })
    
    # Sort by score descending, then workload ascending
    final_scored.sort(key=lambda x: (-x['score'], x['workload_count']))
    
    primary = [c for c in final_scored if c['teaches_subject']]
    fallback = [c for c in final_scored if not c['teaches_subject']]
    
    return {
        'primary_candidates': primary,
        'fallback_candidates': fallback,
        'has_expert': len(primary) > 0,
        'eligible_count': len(final_scored),
        'timetable_info': timetable_entry.to_dict(),
        'error': None
    }
