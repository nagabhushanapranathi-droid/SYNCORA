from flask import Blueprint, request
from app import db
from app.models.models import Subject, Department
from app.utils.auth import require_admin, csrf_protect
from app.utils.helpers import success_response, error_response

subjects_bp = Blueprint('subjects', __name__)


@subjects_bp.route('', methods=['GET'])
@subjects_bp.route('/', methods=['GET'])
def list_subjects():
    dept_id = request.args.get('department_id', type=int)
    query = Subject.query
    if dept_id:
        query = query.filter_by(department_id=dept_id)
    subjects = query.order_by(Subject.name).all()
    return success_response(data=[s.to_dict() for s in subjects])


@subjects_bp.route('', methods=['POST'])
@subjects_bp.route('/', methods=['POST'])
@require_admin
@csrf_protect
def create_subject():
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    code = data.get('code', '').strip().upper()
    department_id = data.get('department_id')
    description = data.get('description', '').strip()
    
    if not name or not code or not department_id:
        return error_response('Name, code, and department_id are required', status=400)
        
    if not Department.query.get(department_id):
        return error_response('Department does not exist', status=404)
        
    if Subject.query.filter_by(code=code).first():
        return error_response('Subject code already exists', status=409)
        
    subject = Subject(name=name, code=code, department_id=department_id, description=description)
    db.session.add(subject)
    db.session.commit()
    return success_response(data=subject.to_dict(), message='Subject created successfully', status=201)


@subjects_bp.route('/<int:subject_id>', methods=['GET'])
def get_subject(subject_id):
    subject = Subject.query.get(subject_id)
    if not subject:
        return error_response('Subject not found', status=404)
    return success_response(data=subject.to_dict())


@subjects_bp.route('/<int:subject_id>', methods=['PUT'])
@require_admin
@csrf_protect
def update_subject(subject_id):
    subject = Subject.query.get(subject_id)
    if not subject:
        return error_response('Subject not found', status=404)
        
    data = request.get_json(silent=True) or {}
    if 'name' in data:
        subject.name = data['name'].strip()
    if 'code' in data:
        new_code = data['code'].strip().upper()
        existing = Subject.query.filter_by(code=new_code).first()
        if existing and existing.id != subject.id:
            return error_response('Subject code already in use', status=409)
        subject.code = new_code
    if 'department_id' in data:
        if not Department.query.get(data['department_id']):
            return error_response('Department does not exist', status=404)
        subject.department_id = data['department_id']
    if 'description' in data:
        subject.description = data['description'].strip()
        
    db.session.commit()
    return success_response(data=subject.to_dict(), message='Subject updated successfully')


@subjects_bp.route('/<int:subject_id>', methods=['DELETE'])
@require_admin
@csrf_protect
def delete_subject(subject_id):
    subject = Subject.query.get(subject_id)
    if not subject:
        return error_response('Subject not found', status=404)
    if subject.timetable_entries:
        return error_response('Cannot delete subject that is assigned in timetable', status=400)
    db.session.delete(subject)
    db.session.commit()
    return success_response(message='Subject deleted successfully')
