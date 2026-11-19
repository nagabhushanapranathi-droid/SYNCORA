from flask import Blueprint, request
from app import db
from app.models.models import Department
from app.utils.auth import require_admin, csrf_protect
from app.utils.helpers import success_response, error_response

departments_bp = Blueprint('departments', __name__)


@departments_bp.route('', methods=['GET'])
@departments_bp.route('/', methods=['GET'])
def list_departments():
    depts = Department.query.order_by(Department.name).all()
    return success_response(data=[d.to_dict() for d in depts])


@departments_bp.route('', methods=['POST'])
@departments_bp.route('/', methods=['POST'])
@require_admin
@csrf_protect
def create_department():
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    code = data.get('code', '').strip().upper()
    description = data.get('description', '').strip()
    
    if not name or not code:
        return error_response('Name and code are required', status=400)
        
    if Department.query.filter_by(code=code).first():
        return error_response('Department code already exists', status=409)
        
    dept = Department(name=name, code=code, description=description)
    db.session.add(dept)
    db.session.commit()
    return success_response(data=dept.to_dict(), message='Department created successfully', status=201)


@departments_bp.route('/<int:dept_id>', methods=['GET'])
def get_department(dept_id):
    dept = Department.query.get(dept_id)
    if not dept:
        return error_response('Department not found', status=404)
    return success_response(data=dept.to_dict())


@departments_bp.route('/<int:dept_id>', methods=['PUT'])
@require_admin
@csrf_protect
def update_department(dept_id):
    dept = Department.query.get(dept_id)
    if not dept:
        return error_response('Department not found', status=404)
        
    data = request.get_json(silent=True) or {}
    if 'name' in data:
        dept.name = data['name'].strip()
    if 'code' in data:
        new_code = data['code'].strip().upper()
        existing = Department.query.filter_by(code=new_code).first()
        if existing and existing.id != dept.id:
            return error_response('Department code already in use', status=409)
        dept.code = new_code
    if 'description' in data:
        dept.description = data['description'].strip()
        
    db.session.commit()
    return success_response(data=dept.to_dict(), message='Department updated successfully')


@departments_bp.route('/<int:dept_id>', methods=['DELETE'])
@require_admin
@csrf_protect
def delete_department(dept_id):
    dept = Department.query.get(dept_id)
    if not dept:
        return error_response('Department not found', status=404)
    if dept.faculty_members or dept.subjects:
        return error_response('Cannot delete department with associated faculty or subjects', status=400)
    db.session.delete(dept)
    db.session.commit()
    return success_response(message='Department deleted successfully')
