from flask import Blueprint, request, g
from app.models.models import SubstitutionRequest, SubstitutionAssignment
from app.utils.auth import require_admin, require_auth, csrf_protect
from app.utils.helpers import success_response, error_response, parse_date
from app.services.substitution_service import (
    approve_request,
    manual_assign_request,
    reject_request,
    suspend_request,
    acknowledge_assignment,
    recalculate_request,
)

substitutions_bp = Blueprint('substitutions', __name__)


@substitutions_bp.route('', methods=['GET'])
@substitutions_bp.route('/', methods=['GET'])
def list_substitutions():
    status = request.args.get('status')
    date_str = request.args.get('date')
    faculty_id = request.args.get('faculty_id', type=int)
    
    query = SubstitutionRequest.query
    if status:
        query = query.filter_by(status=status.upper())
    if date_str:
        try:
            target_date = parse_date(date_str)
            query = query.filter_by(date=target_date)
        except ValueError:
            return error_response('Invalid date format. Use YYYY-MM-DD.', status=400)
    if faculty_id:
        query = query.filter(
            (SubstitutionRequest.recommended_faculty_id == faculty_id) |
            (SubstitutionRequest.absence.has(faculty_id=faculty_id))
        )
        
    requests = query.order_by(SubstitutionRequest.date.desc(), SubstitutionRequest.id.desc()).all()
    return success_response(data=[r.to_dict() for r in requests])


@substitutions_bp.route('/<int:request_id>', methods=['GET'])
def get_substitution(request_id):
    sub_req = SubstitutionRequest.query.get(request_id)
    if not sub_req:
        return error_response('Substitution request not found', status=404)
    return success_response(data=sub_req.to_dict())


@substitutions_bp.route('/<int:request_id>/approve', methods=['POST'])
@require_admin
@csrf_protect
def approve_substitution(request_id):
    try:
        assignment = approve_request(request_id, g.current_user.id)
        sub_req = SubstitutionRequest.query.get(request_id)
        return success_response(data=sub_req.to_dict(), message='Substitution approved and assigned successfully')
    except ValueError as e:
        return error_response(str(e), status=400)


@substitutions_bp.route('/<int:request_id>/manual-assign', methods=['POST'])
@require_admin
@csrf_protect
def manual_assign(request_id):
    data = request.get_json(silent=True) or {}
    faculty_id = data.get('faculty_id')
    notes = data.get('notes')
    
    if not faculty_id:
        return error_response('faculty_id is required', status=400)
        
    try:
        assignment = manual_assign_request(request_id, faculty_id, g.current_user.id, notes)
        sub_req = SubstitutionRequest.query.get(request_id)
        return success_response(data=sub_req.to_dict(), message='Faculty assigned successfully')
    except ValueError as e:
        return error_response(str(e), status=400)


@substitutions_bp.route('/<int:request_id>/reject', methods=['POST'])
@require_admin
@csrf_protect
def reject_substitution(request_id):
    try:
        sub_req = reject_request(request_id)
        return success_response(data=sub_req.to_dict(), message='Substitution request rejected')
    except ValueError as e:
        return error_response(str(e), status=400)


@substitutions_bp.route('/<int:request_id>/suspend', methods=['POST'])
@require_admin
@csrf_protect
def suspend_substitution(request_id):
    try:
        sub_req = suspend_request(request_id)
        return success_response(data=sub_req.to_dict(), message='Class session marked as suspended')
    except ValueError as e:
        return error_response(str(e), status=400)


@substitutions_bp.route('/<int:request_id>/acknowledge', methods=['POST'])
@require_auth
@csrf_protect
def acknowledge(request_id):
    try:
        is_admin = g.current_user.role == 'admin'
        assignment = acknowledge_assignment(request_id, g.current_user.id, is_admin=is_admin)
        return success_response(data=assignment.to_dict(), message='Assignment acknowledged')
    except PermissionError as e:
        return error_response(str(e), status=403)
    except ValueError as e:
        return error_response(str(e), status=404)


@substitutions_bp.route('/generate/<int:request_id>', methods=['POST'])
@require_admin
@csrf_protect
def regenerate_allocation(request_id):
    try:
        sub_req = recalculate_request(request_id)
        return success_response(data=sub_req.to_dict(), message='Allocation candidates recalculated')
    except ValueError as e:
        return error_response(str(e), status=404)


@substitutions_bp.route('/<int:request_id>/academic-context', methods=['GET'])
@require_auth
def get_context(request_id):
    """Retrieve full academic context (syllabus, verified progress, handover notes) for a substitution."""
    from app.services.lesson_plan_service import get_academic_context
    try:
        context = get_academic_context(request_id)
        return success_response(data=context)
    except ValueError as e:
        return error_response(str(e), status=404)


@substitutions_bp.route('/<int:request_id>/lesson-plan', methods=['GET'])
@require_auth
def get_lesson_plan_endpoint(request_id):
    """Retrieve the generated lesson plan for a substitution."""
    from app.models.models import LessonPlan
    sub_req = SubstitutionRequest.query.get(request_id)
    if not sub_req:
        return error_response('Substitution request not found', status=404)

    plan = LessonPlan.query.filter_by(substitution_request_id=request_id).first()
    if not plan:
        return error_response('Lesson plan not found for this substitution', status=404)

    # Permission check: admin, assigned substitute, or original faculty
    current_user = g.current_user
    if current_user.role != 'admin':
        faculty_id = current_user.faculty_id
        if faculty_id not in [plan.substitute_faculty_id, plan.original_faculty_id]:
            return error_response('You do not have permission to view this lesson plan', status=403)

    return success_response(data=plan.to_dict())


@substitutions_bp.route('/<int:request_id>/lesson-plan/generate', methods=['POST'])
@require_auth
@csrf_protect
def generate_lesson_plan_endpoint(request_id):
    """Generate or regenerate an AI-structured substitute lesson plan."""
    from app.services.lesson_plan_service import generate_lesson_plan
    sub_req = SubstitutionRequest.query.get(request_id)
    if not sub_req:
        return error_response('Substitution request not found', status=404)

    current_user = g.current_user
    data = request.get_json(silent=True) or {}
    force = bool(data.get('force', False))

    if current_user.role != 'admin':
        faculty_id = current_user.faculty_id
        assigned_id = sub_req.assignment.assigned_faculty_id if sub_req.assignment else sub_req.recommended_faculty_id
        if faculty_id != assigned_id:
            return error_response('Only the assigned substitute faculty or an administrator can generate this plan', status=403)

    try:
        plan = generate_lesson_plan(request_id, current_user.id, force_regenerate=force)
        return success_response(data=plan.to_dict(), message='Lesson plan generated successfully')
    except Exception as e:
        return error_response(f"Failed to generate lesson plan: {str(e)}", status=500)


@substitutions_bp.route('/<int:request_id>/lesson-plan', methods=['PUT'])
@require_auth
@csrf_protect
def update_lesson_plan_endpoint(request_id):
    """Allow authorized faculty or admin to update lesson plan content, teaching notes, and feedback."""
    from app.models.models import LessonPlan
    from app.services.lesson_plan_service import update_lesson_plan_content

    plan = LessonPlan.query.filter_by(substitution_request_id=request_id).first()
    if not plan:
        return error_response('Lesson plan not found', status=404)

    current_user = g.current_user
    if current_user.role != 'admin':
        if current_user.faculty_id != plan.substitute_faculty_id and current_user.faculty_id != plan.original_faculty_id:
            return error_response('Permission denied: You cannot edit another faculty member\'s lesson plan', status=403)

    data = request.get_json(silent=True) or {}
    try:
        updated = update_lesson_plan_content(
            lesson_plan_id=plan.id,
            user_id=current_user.id,
            lesson_content=data.get('lesson_content'),
            teaching_notes=data.get('teaching_notes'),
            feedback=data.get('feedback'),
            topics_completed=data.get('topics_completed'),
            status=data.get('status')
        )
        return success_response(data=updated.to_dict(), message='Lesson plan updated successfully')
    except ValueError as e:
        return error_response(str(e), status=400)


@substitutions_bp.route('/<int:request_id>/progress', methods=['POST'])
@require_auth
@csrf_protect
def record_progress_endpoint(request_id):
    """Record verified teaching progress after the substitute session is completed."""
    from app.services.lesson_plan_service import record_verified_progress
    sub_req = SubstitutionRequest.query.get(request_id)
    if not sub_req:
        return error_response('Substitution request not found', status=404)

    current_user = g.current_user
    data = request.get_json(silent=True) or {}
    topic_name = data.get('topic_name')
    if not topic_name:
        return error_response('topic_name is required', status=400)

    timetable = sub_req.timetable
    faculty_id = current_user.faculty_id if current_user.role != 'admin' else (
        sub_req.assignment.assigned_faculty_id if sub_req.assignment else sub_req.recommended_faculty_id
    )

    try:
        prog = record_verified_progress(
            subject_id=timetable.subject_id,
            faculty_id=faculty_id or 1,
            class_name=timetable.class_name,
            section=timetable.section,
            unit_number=data.get('unit_number'),
            topic_name=topic_name,
            status=data.get('status', 'COMPLETED'),
            hours_spent=float(data.get('hours_spent', 1.0)),
            notes=data.get('notes'),
            is_verified=True
        )
        return success_response(data=prog.to_dict(), message='Academic progress recorded successfully')
    except Exception as e:
        return error_response(f"Failed to record progress: {str(e)}", status=500)


@substitutions_bp.route('/<int:request_id>/handover', methods=['POST'])
@require_auth
@csrf_protect
def submit_handover_endpoint(request_id):
    """Submit or update a handover note for a substitution request."""
    import json
    from app import db
    from app.models.models import HandoverNote

    sub_req = SubstitutionRequest.query.get(request_id)
    if not sub_req:
        return error_response('Substitution request not found', status=404)

    current_user = g.current_user
    timetable = sub_req.timetable
    data = request.get_json(silent=True) or {}

    faculty_id = current_user.faculty_id if current_user.role != 'admin' else (
        sub_req.absence.faculty_id if sub_req.absence else timetable.faculty_id
    )

    # Check if a handover note already exists
    handover = HandoverNote.query.filter_by(substitution_request_id=request_id).first()
    if not handover:
        handover = HandoverNote(
            substitution_request_id=request_id,
            faculty_id=faculty_id or 1,
            subject_id=timetable.subject_id,
            class_name=timetable.class_name,
            section=timetable.section
        )
        db.session.add(handover)

    handover.current_unit = data.get('current_unit', handover.current_unit)
    handover.current_topic = data.get('current_topic', handover.current_topic)
    if 'completed_topics' in data:
        handover.completed_topics = json.dumps(data['completed_topics']) if isinstance(data['completed_topics'], list) else data['completed_topics']
    if 'next_topics' in data:
        handover.next_topics = json.dumps(data['next_topics']) if isinstance(data['next_topics'], list) else data['next_topics']
    handover.pending_assignments = data.get('pending_assignments', handover.pending_assignments)
    handover.student_notes = data.get('student_notes', handover.student_notes)
    handover.additional_instructions = data.get('additional_instructions', handover.additional_instructions)

    db.session.commit()
    return success_response(data=handover.to_dict(), message='Handover note submitted successfully')
