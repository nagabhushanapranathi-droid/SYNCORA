from flask import Blueprint, request, jsonify
from app import db
from app.models.models import Faculty, Department, Subject, User, SubstitutionAssignment
from app.utils.auth import require_admin, csrf_protect
from app.utils.helpers import success_response, error_response
from app.services.faculty_service import (
    get_all_faculty_with_metadata,
    add_subject_to_faculty,
    remove_subject_from_faculty,
)

faculty_bp = Blueprint('faculty', __name__)


@faculty_bp.route('', methods=['GET'])
@faculty_bp.route('/', methods=['GET'])
def list_faculty():
    data = get_all_faculty_with_metadata()
    return success_response(data=data)


@faculty_bp.route('', methods=['POST'])
@faculty_bp.route('/', methods=['POST'])
@require_admin
@csrf_protect
def create_faculty():
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    department_id = data.get('department_id')
    designation = data.get('designation', '').strip()
    specialization = data.get('specialization', '').strip()
    subject_ids = data.get('subject_ids', [])
    
    if not name or not email or not department_id or not designation:
        return error_response('Name, email, department_id, and designation are required', status=400)
    
    if Faculty.query.filter_by(email=email).first():
        return error_response('Faculty with this email already exists', status=409)
    
    if not Department.query.get(department_id):
        return error_response('Department does not exist', status=404)
    
    faculty = Faculty(
        name=name,
        email=email,
        department_id=department_id,
        designation=designation,
        specialization=specialization,
        is_active=True
    )
    
    if subject_ids:
        subjects = Subject.query.filter(Subject.id.in_(subject_ids)).all()
        faculty.subjects.extend(subjects)
        
    db.session.add(faculty)
    db.session.flush()
    
    # Optionally create associated user account if requested or default
    create_user_account = data.get('create_user', True)
    if create_user_account:
        default_pwd = data.get('password', 'Faculty@123')
        user = User(
            name=name,
            email=email,
            role='faculty',
            faculty_id=faculty.id,
            is_active=True
        )
        user.set_password(default_pwd)
        db.session.add(user)
        
    db.session.commit()
    return success_response(data=faculty.to_dict(include_subjects=True), message='Faculty created successfully', status=201)


@faculty_bp.route('/<int:faculty_id>', methods=['GET'])
def get_faculty(faculty_id):
    faculty = Faculty.query.get(faculty_id)
    if not faculty:
        return error_response('Faculty not found', status=404)
    return success_response(data=faculty.to_dict(include_subjects=True))


@faculty_bp.route('/<int:faculty_id>', methods=['PUT'])
@require_admin
@csrf_protect
def update_faculty(faculty_id):
    faculty = Faculty.query.get(faculty_id)
    if not faculty:
        return error_response('Faculty not found', status=404)
        
    data = request.get_json(silent=True) or {}
    if 'name' in data:
        faculty.name = data['name'].strip()
    if 'designation' in data:
        faculty.designation = data['designation'].strip()
    if 'specialization' in data:
        faculty.specialization = data['specialization'].strip()
    if 'department_id' in data:
        if not Department.query.get(data['department_id']):
            return error_response('Invalid department_id', status=400)
        faculty.department_id = data['department_id']
    if 'is_active' in data:
        faculty.is_active = bool(data['is_active'])
    if 'subject_ids' in data:
        subjects = Subject.query.filter(Subject.id.in_(data['subject_ids'])).all()
        faculty.subjects = subjects
        
    db.session.commit()
    return success_response(data=faculty.to_dict(include_subjects=True), message='Faculty updated successfully')


@faculty_bp.route('/<int:faculty_id>', methods=['DELETE'])
@require_admin
@csrf_protect
def delete_faculty(faculty_id):
    faculty = Faculty.query.get(faculty_id)
    if not faculty:
        return error_response('Faculty not found', status=404)
    faculty.is_active = False
    if faculty.user:
        faculty.user.is_active = False
    db.session.commit()
    return success_response(message='Faculty deactivated successfully')


@faculty_bp.route('/<int:faculty_id>/subjects', methods=['GET'])
def get_faculty_subjects(faculty_id):
    faculty = Faculty.query.get(faculty_id)
    if not faculty:
        return error_response('Faculty not found', status=404)
    return success_response(data=[s.to_dict() for s in faculty.subjects])


@faculty_bp.route('/<int:faculty_id>/subjects', methods=['POST'])
@require_admin
@csrf_protect
def add_faculty_subject(faculty_id):
    data = request.get_json(silent=True) or {}
    subject_id = data.get('subject_id')
    if not subject_id:
        return error_response('subject_id is required', status=400)
    
    success = add_subject_to_faculty(faculty_id, subject_id)
    if not success:
        return error_response('Faculty or Subject not found', status=404)
    return success_response(message='Subject added to faculty')


@faculty_bp.route('/<int:faculty_id>/subjects/<int:subject_id>', methods=['DELETE'])
@require_admin
@csrf_protect
def remove_faculty_subject(faculty_id, subject_id):
    success = remove_subject_from_faculty(faculty_id, subject_id)
    if not success:
        return error_response('Faculty or Subject not found', status=404)
    return success_response(message='Subject removed from faculty')


@faculty_bp.route('/<int:faculty_id>/history', methods=['GET'])
def get_faculty_substitution_history(faculty_id):
    """Retrieve substitution assignment history for a faculty member."""
    faculty = Faculty.query.get(faculty_id)
    if not faculty:
        return error_response('Faculty not found', status=404)

    assignments = SubstitutionAssignment.query.filter_by(
        assigned_faculty_id=faculty_id
    ).order_by(SubstitutionAssignment.assigned_at.desc()).all()

    history = []
    for a in assignments:
        req = a.request
        tt = req.timetable if req else None
        subj_name = tt.subject.name if tt and tt.subject else 'General Lecture'
        class_name = tt.class_name if tt else 'Class'
        date_str = req.date.strftime('%B %d, %Y') if req and req.date else (a.assigned_at.strftime('%B %d, %Y') if a.assigned_at else 'Recent')

        history.append({
            'id': a.id,
            'request_id': a.request_id,
            'subject': subj_name,
            'class_name': class_name,
            'date': date_str,
            'status': req.status if req else 'ASSIGNED'
        })

    return success_response(data={
        'faculty_id': faculty_id,
        'faculty_name': faculty.name,
        'history': history,
        'total_substitutions': len(history)
    })

