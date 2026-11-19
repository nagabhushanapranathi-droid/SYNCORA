from datetime import date
from flask import Blueprint, request, g
from app import db
from app.models.models import Attendance, Faculty
from app.utils.auth import require_admin, csrf_protect
from app.utils.helpers import success_response, error_response, parse_date, parse_time
from app.services.attendance_service import get_today_summary, mark_or_update_attendance

attendance_bp = Blueprint('attendance', __name__)


@attendance_bp.route('', methods=['GET'])
@attendance_bp.route('/', methods=['GET'])
def list_attendance():
    date_str = request.args.get('date')
    faculty_id = request.args.get('faculty_id', type=int)
    status = request.args.get('status')
    
    query = Attendance.query
    if date_str:
        try:
            target_date = parse_date(date_str)
            query = query.filter_by(date=target_date)
        except ValueError:
            return error_response('Invalid date format. Use YYYY-MM-DD.', status=400)
    if faculty_id:
        query = query.filter_by(faculty_id=faculty_id)
    if status:
        query = query.filter_by(status=status.upper())
        
    records = query.order_by(Attendance.date.desc(), Attendance.id.asc()).all()
    return success_response(data=[r.to_dict() for r in records])


@attendance_bp.route('/today', methods=['GET'])
def today_attendance():
    date_str = request.args.get('date')
    target_date = None
    if date_str:
        try:
            target_date = parse_date(date_str)
        except ValueError:
            return error_response('Invalid date format. Use YYYY-MM-DD.', status=400)
    summary = get_today_summary(target_date)
    return success_response(data=summary)


@attendance_bp.route('/mark', methods=['POST'])
@require_admin
@csrf_protect
def mark_attendance():
    data = request.get_json(silent=True) or {}
    faculty_id = data.get('faculty_id')
    date_val = data.get('date')
    status = data.get('status', 'PRESENT').upper()
    login_str = data.get('login_time')
    logout_str = data.get('logout_time')
    notes = data.get('notes')
    
    if not faculty_id:
        return error_response('faculty_id is required', status=400)
    if not Faculty.query.get(faculty_id):
        return error_response('Faculty not found', status=404)
        
    try:
        target_date = parse_date(date_val) if date_val else date.today()
    except ValueError:
        return error_response('Invalid date format. Use YYYY-MM-DD.', status=400)
        
    login_time = parse_time(login_str) if login_str else None
    logout_time = parse_time(logout_str) if logout_str else None
    
    record = mark_or_update_attendance(
        faculty_id=faculty_id,
        target_date=target_date,
        status=status,
        login_time=login_time,
        logout_time=logout_time,
        notes=notes,
        override_by=g.current_user.id
    )
    return success_response(data=record.to_dict(), message='Attendance recorded successfully')


@attendance_bp.route('/<int:record_id>', methods=['PUT'])
@require_admin
@csrf_protect
def override_attendance(record_id):
    record = Attendance.query.get(record_id)
    if not record:
        return error_response('Attendance record not found', status=404)
        
    data = request.get_json(silent=True) or {}
    if 'status' in data:
        record.status = data['status'].upper()
    if 'login_time' in data:
        record.login_time = parse_time(data['login_time']) if data['login_time'] else None
    if 'logout_time' in data:
        record.logout_time = parse_time(data['logout_time']) if data['logout_time'] else None
    if 'notes' in data:
        record.notes = data['notes']
        
    record.override_by = g.current_user.id
    from datetime import datetime
    record.override_at = datetime.utcnow()
    
    db.session.commit()
    return success_response(data=record.to_dict(), message='Attendance overridden successfully')
