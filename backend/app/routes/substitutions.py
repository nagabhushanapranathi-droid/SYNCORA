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
