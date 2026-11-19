from datetime import date
from flask import Blueprint, request, g
from app.models.models import Absence, Faculty
from app.utils.auth import require_admin, csrf_protect
from app.utils.helpers import success_response, error_response, parse_date
from app.services.substitution_service import create_absence_and_requests

absences_bp = Blueprint('absences', __name__)


@absences_bp.route('', methods=['GET'])
@absences_bp.route('/', methods=['GET'])
def list_absences():
    date_str = request.args.get('date')
    faculty_id = request.args.get('faculty_id', type=int)
    
    query = Absence.query
    if date_str:
        try:
            target_date = parse_date(date_str)
            query = query.filter_by(date=target_date)
        except ValueError:
            return error_response('Invalid date format. Use YYYY-MM-DD.', status=400)
    if faculty_id:
        query = query.filter_by(faculty_id=faculty_id)
        
    absences = query.order_by(Absence.date.desc(), Absence.id.desc()).all()
    result = []
    for a in absences:
        data = a.to_dict()
        data['substitution_requests'] = [sr.to_dict() for sr in a.substitution_requests]
        result.append(data)
    return success_response(data=result)


@absences_bp.route('/today', methods=['GET'])
def today_absences():
    today = date.today()
    absences = Absence.query.filter_by(date=today).order_by(Absence.id.desc()).all()
    result = []
    for a in absences:
        data = a.to_dict()
        data['substitution_requests'] = [sr.to_dict() for sr in a.substitution_requests]
        result.append(data)
    return success_response(data=result)


@absences_bp.route('/<int:absence_id>', methods=['GET'])
def get_absence(absence_id):
    """Retrieve details of a specific absence record."""
    absence = Absence.query.get(absence_id)
    if not absence:
        return error_response('Absence record not found', status=404)
    data = absence.to_dict()
    data['substitution_requests'] = [sr.to_dict() for sr in absence.substitution_requests]
    return success_response(data=data)


@absences_bp.route('', methods=['POST'])
@absences_bp.route('/', methods=['POST'])
@require_admin
@csrf_protect
def report_absence():
    data = request.get_json(silent=True) or {}
    faculty_id = data.get('faculty_id')
    date_str = data.get('date')
    reason = data.get('reason', '').strip()
    remarks = data.get('remarks', '').strip()
    
    if not faculty_id:
        return error_response('faculty_id is required', status=400)
    if not Faculty.query.get(faculty_id):
        return error_response('Faculty not found', status=404)
        
    try:
        absence_date = parse_date(date_str) if date_str else date.today()
    except ValueError:
        return error_response('Invalid date format. Use YYYY-MM-DD.', status=400)
        
    absence, sub_requests = create_absence_and_requests(
        faculty_id=faculty_id,
        absence_date=absence_date,
        reason=reason,
        remarks=remarks,
        reported_by_user_id=g.current_user.id
    )
    
    res = absence.to_dict()
    res['substitution_requests'] = [sr.to_dict() for sr in sub_requests]
    return success_response(data=res, message='Absence reported and substitution requests generated', status=201)
