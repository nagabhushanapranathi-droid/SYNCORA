from datetime import date, datetime
from flask import Blueprint, request
from app.models.models import (
    Faculty,
    Attendance,
    Absence,
    SubstitutionRequest,
    SubstitutionAssignment,
    Department,
)
from app.utils.auth import require_auth, csrf_protect
from app.utils.helpers import success_response, error_response
from app.ai.gemini_service import (
    chat_assistant,
    explain_recommendation,
    generate_daily_report,
)
from app.algorithms.allocation import get_substitution_count

from app.ai.academic_tools import (
    tool_get_teaching_schedule,
    tool_get_faculty_assigned_plan,
    tool_get_previous_lecture_progress,
    tool_get_suggested_next_topics,
    tool_get_pending_lesson_plans,
    tool_get_substitutions_missing_handover,
    tool_get_department_workload_summary,
    tool_get_institutional_stats,
)

ai_bp = Blueprint('ai', __name__)


def build_chat_context(query_text: str, user=None) -> dict:
    """Retrieve relevant database context dynamically using predefined academic tools with role scoping."""
    today = date.today()
    q_lower = query_text.lower()
    is_faculty = user and user.role == 'faculty' and user.faculty_id
    is_admin = not user or user.role == 'admin'

    context = {
        'current_date': today.isoformat(),
        'current_time': datetime.now().strftime('%H:%M:%S'),
        'total_active_faculty': Faculty.query.filter_by(is_active=True).count(),
        'user_role': user.role if user else 'anonymous'
    }

    # 1. Faculty personal queries ("What should I teach?", "Show my assigned lesson plan")
    if is_faculty:
        context['faculty_id'] = user.faculty_id
        if any(k in q_lower for k in ['teach', 'tomorrow', 'schedule', 'class', 'lecture', 'my', 'assigned', 'lesson plan']):
            context['my_teaching_schedule'] = tool_get_teaching_schedule(user.faculty_id)
            context['my_assigned_plans'] = tool_get_faculty_assigned_plan(user.faculty_id)

        if any(k in q_lower for k in ['previous', 'covered', 'last week', 'history', 'progress']):
            fac = Faculty.query.get(user.faculty_id)
            sub_ids = [s.id for s in fac.subjects] if fac and fac.subjects else []
            first_sub = sub_ids[0] if sub_ids else None
            context['previous_lecture_progress'] = tool_get_previous_lecture_progress(subject_id=first_sub, limit=5)

    # 2. Admin queries ("Pending lesson plans", "Missing handover notes", "Next topics")
    if is_admin:
        if any(k in q_lower for k in ['pending', 'missing lesson', 'plans']):
            context['pending_lesson_plans'] = tool_get_pending_lesson_plans()

        if any(k in q_lower for k in ['missing handover', 'handover note', 'handover']):
            context['missing_handover_notes'] = tool_get_substitutions_missing_handover()

        if any(k in q_lower for k in ['continue', 'next topic', 'syllabus', 'progress']):
            latest_req = SubstitutionRequest.query.order_by(SubstitutionRequest.id.desc()).first()
            if latest_req and latest_req.timetable:
                context['suggested_next_topics'] = tool_get_suggested_next_topics(
                    latest_req.timetable.subject_id,
                    latest_req.timetable.class_name
                )

    # 3. Attendance / availability keywords (Both Admin and Faculty)
    if any(k in q_lower for k in ['available', 'free', 'present', 'who is here', 'attendance', 'stats']):
        context['attendance_summary'] = tool_get_institutional_stats(today)
        p_records = Attendance.query.filter_by(date=today, status='PRESENT').all()
        context['present_faculty'] = [
            {
                'name': r.faculty.name if r.faculty else 'Unknown',
                'department': r.faculty.department.name if r.faculty and r.faculty.department else None,
                'login_time': r.login_time.strftime('%H:%M') if r.login_time else None
            }
            for r in p_records
        ]

    # 4. Absence keywords
    if any(k in q_lower for k in ['absent', 'leave', 'missing', 'not present', 'away']):
        absences = Absence.query.filter_by(date=today).all()
        context['absent_faculty'] = [
            {
                'name': a.faculty.name if a.faculty else 'Unknown',
                'department': a.faculty.department.name if a.faculty and a.faculty.department else None,
                'reason': a.reason
            }
            for a in absences
        ]

    # 5. Substitution / coverage keywords
    if any(k in q_lower for k in ['substitution', 'request', 'replace', 'coverage']):
        sub_requests = SubstitutionRequest.query.filter_by(date=today).all()
        context['today_substitutions'] = [
            {
                'id': s.id,
                'subject': s.timetable.subject.name if s.timetable and s.timetable.subject else None,
                'slot': f"{s.timetable.start_time.strftime('%H:%M')}-{s.timetable.end_time.strftime('%H:%M')}" if s.timetable else None,
                'status': s.status,
                'recommended': s.recommended_faculty.name if s.recommended_faculty else None
            }
            for s in sub_requests
        ]

    # 6. Workload / statistics keywords
    if any(k in q_lower for k in ['workload', 'distribution', 'busiest', 'assigned']):
        context['substitution_workloads'] = tool_get_department_workload_summary()[:10]

    return context


@ai_bp.route('/chat', methods=['POST'])
@require_auth
@csrf_protect
def chat():
    from flask import g
    data = request.get_json(silent=True) or {}
    message = data.get('message', '').strip()
    if not message:
        return error_response('Message content is required', status=400)

    context = build_chat_context(message, user=g.current_user)
    reply = chat_assistant(message, context)
    return success_response(data={'reply': reply, 'context': context})


@ai_bp.route('/explain-recommendation', methods=['POST'])
@require_auth
@csrf_protect
def explain_rec():
    data = request.get_json(silent=True) or {}
    request_id = data.get('request_id')
    if not request_id:
        return error_response('request_id is required', status=400)
        
    sub_req = SubstitutionRequest.query.get(request_id)
    if not sub_req:
        return error_response('Substitution request not found', status=404)
        
    candidates = sub_req.get_all_candidates()
    explanation = explain_recommendation(sub_req.to_dict(), candidates)
    sub_req.ai_explanation = explanation
    from app import db
    db.session.commit()
    return success_response(data={'explanation': explanation})


@ai_bp.route('/explain', methods=['POST'])
@require_auth
@csrf_protect
def explain_alias():
    """Alias route: frontend calls /ai/explain with substitution_id."""
    data = request.get_json(silent=True) or {}
    request_id = data.get('substitution_id') or data.get('request_id')
    if not request_id:
        return error_response('substitution_id or request_id is required', status=400)

    sub_req = SubstitutionRequest.query.get(request_id)
    if not sub_req:
        return error_response('Substitution request not found', status=404)

    candidates = sub_req.get_all_candidates()
    explanation = explain_recommendation(sub_req.to_dict(), candidates)
    sub_req.ai_explanation = explanation
    from app import db
    db.session.commit()
    return success_response(data={'explanation': explanation})


@ai_bp.route('/report', methods=['POST'])
@require_auth
@csrf_protect
def report_alias():
    """Alias route: frontend calls /ai/report."""
    today = date.today()
    total_faculty = Faculty.query.filter_by(is_active=True).count()
    present_today = Attendance.query.filter_by(date=today, status='PRESENT').count()
    absent_today = Attendance.query.filter_by(date=today, status='ABSENT').count()
    sub_requests = SubstitutionRequest.query.filter_by(date=today).all()

    stats_data = {
        'date': today.isoformat(),
        'total_faculty': total_faculty,
        'present_today': present_today,
        'absent_today': absent_today,
        'total_substitutions': len(sub_requests),
        'pending': sum(1 for s in sub_requests if s.status in ['PENDING', 'RECOMMENDED']),
        'completed': sum(1 for s in sub_requests if s.status in ['APPROVED', 'ASSIGNED']),
        'suspended': sum(1 for s in sub_requests if s.status == 'SUSPENDED')
    }

    narrative_report = generate_daily_report(stats_data)
    return success_response(data={'report': narrative_report, 'metrics': stats_data})


@ai_bp.route('/generate-report', methods=['POST'])
@require_auth
@csrf_protect
def report():
    today = date.today()
    total_faculty = Faculty.query.filter_by(is_active=True).count()
    present_today = Attendance.query.filter_by(date=today, status='PRESENT').count()
    absent_today = Attendance.query.filter_by(date=today, status='ABSENT').count()
    sub_requests = SubstitutionRequest.query.filter_by(date=today).all()
    
    stats_data = {
        'date': today.isoformat(),
        'total_faculty': total_faculty,
        'present_today': present_today,
        'absent_today': absent_today,
        'total_substitutions': len(sub_requests),
        'pending': sum(1 for s in sub_requests if s.status in ['PENDING', 'RECOMMENDED']),
        'completed': sum(1 for s in sub_requests if s.status in ['APPROVED', 'ASSIGNED']),
        'suspended': sum(1 for s in sub_requests if s.status == 'SUSPENDED')
    }
    
    narrative_report = generate_daily_report(stats_data)
    return success_response(data={'report': narrative_report, 'metrics': stats_data})
