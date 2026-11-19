import json
from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Optional
from app.models.models import (
    Faculty,
    Department,
    Subject,
    Attendance,
    Absence,
    Timetable,
    SubstitutionRequest,
    SubstitutionAssignment,
    CourseSyllabus,
    LessonProgress,
    LessonPlan,
    HandoverNote,
)
from app.utils.helpers import get_day_of_week
from app.algorithms.allocation import get_substitution_count


def tool_get_teaching_schedule(faculty_id: int, target_date: Optional[date] = None) -> Dict[str, Any]:
    """Retrieve scheduled classes and substitution assignments for a specific faculty."""
    d = target_date or (date.today() + timedelta(days=1))
    day_name = get_day_of_week(d)

    # 1. Regular timetable slots
    regular_slots = Timetable.query.filter_by(
        faculty_id=faculty_id,
        day_of_week=day_name,
        is_active=True
    ).order_by(Timetable.start_time).all()

    # 2. Assigned substitutions for that date
    assignments = SubstitutionAssignment.query.filter_by(
        assigned_faculty_id=faculty_id
    ).join(SubstitutionRequest).filter(
        SubstitutionRequest.date == d,
        SubstitutionRequest.status.in_(['APPROVED', 'ASSIGNED'])
    ).all()

    return {
        'date': d.isoformat(),
        'day_of_week': day_name,
        'regular_classes': [s.to_dict() for s in regular_slots],
        'substitution_classes': [
            {
                'request_id': a.request_id,
                'subject': a.request.timetable.subject.name if a.request and a.request.timetable and a.request.timetable.subject else None,
                'subject_code': a.request.timetable.subject.code if a.request and a.request.timetable and a.request.timetable.subject else None,
                'class_name': a.request.timetable.class_name if a.request and a.request.timetable else None,
                'start_time': a.request.timetable.start_time.strftime('%H:%M') if a.request and a.request.timetable and a.request.timetable.start_time else None,
                'end_time': a.request.timetable.end_time.strftime('%H:%M') if a.request and a.request.timetable and a.request.timetable.end_time else None,
                'classroom': a.request.timetable.classroom if a.request and a.request.timetable else None,
                'absent_faculty': a.request.absence.faculty.name if a.request and a.request.absence and a.request.absence.faculty else None,
                'has_lesson_plan': bool(a.request.lesson_plans)
            }
            for a in assignments
        ]
    }


def tool_get_faculty_assigned_plan(faculty_id: int, target_date: Optional[date] = None) -> List[Dict[str, Any]]:
    """Retrieve assigned lesson plans for a substitute faculty."""
    query = LessonPlan.query.filter_by(substitute_faculty_id=faculty_id)
    if target_date:
        query = query.filter_by(scheduled_date=target_date)
    plans = query.order_by(LessonPlan.scheduled_date.desc()).limit(5).all()
    return [p.to_dict() for p in plans]


def tool_get_previous_lecture_progress(subject_id: Optional[int] = None, class_name: Optional[str] = None, limit: int = 5) -> List[Dict[str, Any]]:
    """Retrieve verified and recent lecture progress records."""
    query = LessonProgress.query
    if subject_id:
        query = query.filter_by(subject_id=subject_id)
    if class_name:
        query = query.filter_by(class_name=class_name)
    records = query.order_by(LessonProgress.completion_date.desc(), LessonProgress.id.desc()).limit(limit).all()
    return [r.to_dict() for r in records]


def tool_get_suggested_next_topics(subject_id: int, class_name: str) -> Dict[str, Any]:
    """Determine the next topics to teach based on syllabus and verified progress."""
    subject = Subject.query.get(subject_id)
    if not subject:
        return {'error': f"Subject #{subject_id} not found"}

    # Verified completed
    completed = LessonProgress.query.filter_by(
        subject_id=subject_id,
        class_name=class_name,
        status='COMPLETED',
        is_verified=True
    ).all()
    completed_names = {c.topic_name.lower().strip() for c in completed}

    # In-progress
    in_prog = LessonProgress.query.filter_by(
        subject_id=subject_id,
        class_name=class_name,
        status='IN_PROGRESS'
    ).first()

    # Handover note
    handover = HandoverNote.query.filter_by(
        subject_id=subject_id,
        class_name=class_name
    ).order_by(HandoverNote.created_at.desc()).first()

    # Next from syllabus
    syllabi = CourseSyllabus.query.filter_by(subject_id=subject_id).order_by(CourseSyllabus.unit_number).all()
    next_syllabus_topics = []
    current_unit_name = None

    for s in syllabi:
        for t in s.get_topics():
            if t.lower().strip() not in completed_names:
                if not current_unit_name:
                    current_unit_name = f"Unit {s.unit_number}: {s.unit_title}"
                next_syllabus_topics.append(t)
                if len(next_syllabus_topics) >= 3:
                    break
        if len(next_syllabus_topics) >= 3:
            break

    return {
        'subject': subject.name,
        'subject_code': subject.code,
        'class_name': class_name,
        'verified_completed_count': len(completed),
        'last_verified_completed': completed[-1].topic_name if completed else None,
        'current_topic_in_progress': in_prog.topic_name if in_prog else (handover.current_topic if handover else None),
        'handover_instructions': handover.student_notes if handover else None,
        'suggested_next_topics': next_syllabus_topics or ["Review and problem-solving session"],
        'current_unit': current_unit_name or "Comprehensive Curriculum"
    }


def tool_get_pending_lesson_plans() -> List[Dict[str, Any]]:
    """Admin tool: Retrieve approved substitutions that are missing lesson plans."""
    pending_requests = SubstitutionRequest.query.filter(
        SubstitutionRequest.status.in_(['APPROVED', 'ASSIGNED'])
    ).all()

    missing_plans = []
    for req in pending_requests:
        if not req.lesson_plans:
            timetable = req.timetable
            missing_plans.append({
                'request_id': req.id,
                'date': req.date.isoformat() if req.date else None,
                'subject': timetable.subject.name if timetable and timetable.subject else None,
                'class_name': timetable.class_name if timetable else None,
                'assigned_faculty': req.recommended_faculty.name if req.recommended_faculty else 'Unassigned'
            })
    return missing_plans


def tool_get_substitutions_missing_handover() -> List[Dict[str, Any]]:
    """Admin tool: Identify substitutions where original faculty hasn't submitted a handover note."""
    approved_requests = SubstitutionRequest.query.filter(
        SubstitutionRequest.status.in_(['APPROVED', 'ASSIGNED'])
    ).all()

    missing_handover = []
    for req in approved_requests:
        handover = HandoverNote.query.filter_by(substitution_request_id=req.id).first()
        if not handover:
            timetable = req.timetable
            absence = req.absence
            missing_handover.append({
                'request_id': req.id,
                'date': req.date.isoformat() if req.date else None,
                'subject': timetable.subject.name if timetable and timetable.subject else None,
                'class_name': timetable.class_name if timetable else None,
                'absent_faculty': absence.faculty.name if absence and absence.faculty else None,
                'substitute_faculty': req.recommended_faculty.name if req.recommended_faculty else None
            })
    return missing_handover


def tool_get_department_workload_summary() -> List[Dict[str, Any]]:
    """Retrieve exact calculated workload metrics for all faculty members."""
    faculties = Faculty.query.filter_by(is_active=True).all()
    results = []
    for f in faculties:
        sub_cnt = get_substitution_count(f.id)
        results.append({
            'faculty_id': f.id,
            'name': f.name,
            'department': f.department.name if f.department else None,
            'designation': f.designation,
            'substitutions_conducted': sub_cnt
        })
    results.sort(key=lambda x: x['substitutions_conducted'], reverse=True)
    return results


def tool_get_institutional_stats(target_date: Optional[date] = None) -> Dict[str, Any]:
    """Calculate institutional attendance and coverage numbers."""
    d = target_date or date.today()
    total_faculty = Faculty.query.filter_by(is_active=True).count()
    present_count = Attendance.query.filter_by(date=d, status='PRESENT').count()
    absent_count = Attendance.query.filter_by(date=d, status='ABSENT').count()
    sub_requests = SubstitutionRequest.query.filter_by(date=d).all()

    return {
        'date': d.isoformat(),
        'total_active_faculty': total_faculty,
        'present_today': present_count,
        'absent_today': absent_count,
        'attendance_percentage': round((present_count / total_faculty * 100), 1) if total_faculty > 0 else 0.0,
        'substitutions_total': len(sub_requests),
        'substitutions_approved': sum(1 for s in sub_requests if s.status in ['APPROVED', 'ASSIGNED']),
        'substitutions_pending': sum(1 for s in sub_requests if s.status in ['PENDING', 'RECOMMENDED']),
    }
