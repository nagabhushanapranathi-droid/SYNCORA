from flask import Blueprint, request
from app import db
from app.models.models import Timetable, Faculty, Subject, Department
from app.utils.auth import require_admin, csrf_protect
from app.utils.helpers import success_response, error_response, parse_time, times_overlap
from app.algorithms.allocation import check_timetable_conflict

timetable_bp = Blueprint('timetable', __name__)


@timetable_bp.route('', methods=['GET'])
@timetable_bp.route('/', methods=['GET'])
def list_timetable():
    faculty_id = request.args.get('faculty_id', type=int)
    day = request.args.get('day')
    class_name = request.args.get('class_name')
    dept_id = request.args.get('department_id', type=int)
    
    query = Timetable.query.filter_by(is_active=True)
    if faculty_id:
        query = query.filter_by(faculty_id=faculty_id)
    if day:
        query = query.filter_by(day_of_week=day.capitalize())
    if class_name:
        query = query.filter_by(class_name=class_name)
    if dept_id:
        query = query.filter_by(department_id=dept_id)
        
    entries = query.order_by(Timetable.day_of_week, Timetable.start_time).all()
    return success_response(data=[e.to_dict() for e in entries])


@timetable_bp.route('/weekly', methods=['GET'])
def weekly_timetable():
    dept_id = request.args.get('department_id', type=int)
    query = Timetable.query.filter_by(is_active=True)
    if dept_id:
        query = query.filter_by(department_id=dept_id)
        
    entries = query.order_by(Timetable.start_time).all()
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    weekly_data = {d: [] for d in days}
    for e in entries:
        if e.day_of_week in weekly_data:
            weekly_data[e.day_of_week].append(e.to_dict())
            
    return success_response(data=weekly_data)


@timetable_bp.route('/faculty/<int:faculty_id>/schedule', methods=['GET'])
def faculty_schedule(faculty_id):
    faculty = Faculty.query.get(faculty_id)
    if not faculty:
        return error_response('Faculty not found', status=404)
        
    entries = Timetable.query.filter_by(faculty_id=faculty_id, is_active=True).order_by(
        Timetable.day_of_week, Timetable.start_time
    ).all()
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    schedule_data = {d: [] for d in days}
    for e in entries:
        if e.day_of_week in schedule_data:
            schedule_data[e.day_of_week].append(e.to_dict())
            
    return success_response(data={'faculty': faculty.to_dict(include_subjects=True), 'schedule': schedule_data})


@timetable_bp.route('', methods=['POST'])
@timetable_bp.route('/', methods=['POST'])
@require_admin
@csrf_protect
def create_timetable_entry():
    data = request.get_json(silent=True) or {}
    faculty_id = data.get('faculty_id')
    subject_id = data.get('subject_id')
    department_id = data.get('department_id')
    class_name = data.get('class_name', '').strip()
    section = data.get('section', '').strip()
    classroom = data.get('classroom', '').strip()
    day_of_week = data.get('day_of_week', '').capitalize()
    start_str = data.get('start_time')
    end_str = data.get('end_time')
    
    if not (faculty_id and subject_id and department_id and class_name and day_of_week and start_str and end_str):
        return error_response('Missing required fields for timetable entry', status=400)
        
    if not Faculty.query.get(faculty_id):
        return error_response('Faculty does not exist', status=404)
    if not Subject.query.get(subject_id):
        return error_response('Subject does not exist', status=404)
    if not Department.query.get(department_id):
        return error_response('Department does not exist', status=404)
        
    start_time = parse_time(start_str)
    end_time = parse_time(end_str)
    if start_time >= end_time:
        return error_response('start_time must be earlier than end_time', status=400)
        
    # Check faculty conflict
    if check_timetable_conflict(faculty_id, day_of_week, start_time, end_time):
        return error_response(f'Faculty already has a scheduled class on {day_of_week} at this time slot', status=409)
        
    # Check classroom conflict if room is specified
    if classroom:
        room_clashes = Timetable.query.filter_by(classroom=classroom, day_of_week=day_of_week, is_active=True).all()
        for c in room_clashes:
            if times_overlap(c.start_time, c.end_time, start_time, end_time):
                return error_response(f'Classroom {classroom} is already booked at this time', status=409)
                
    entry = Timetable(
        faculty_id=faculty_id,
        subject_id=subject_id,
        department_id=department_id,
        class_name=class_name,
        section=section,
        classroom=classroom,
        day_of_week=day_of_week,
        start_time=start_time,
        end_time=end_time,
        is_active=True
    )
    db.session.add(entry)
    db.session.commit()
    return success_response(data=entry.to_dict(), message='Timetable entry created successfully', status=201)


@timetable_bp.route('/<int:entry_id>', methods=['PUT'])
@require_admin
@csrf_protect
def update_timetable_entry(entry_id):
    entry = Timetable.query.get(entry_id)
    if not entry:
        return error_response('Timetable entry not found', status=404)
        
    data = request.get_json(silent=True) or {}
    faculty_id = data.get('faculty_id', entry.faculty_id)
    subject_id = data.get('subject_id', entry.subject_id)
    department_id = data.get('department_id', entry.department_id)
    class_name = data.get('class_name', entry.class_name).strip()
    section = data.get('section', entry.section)
    classroom = data.get('classroom', entry.classroom)
    day_of_week = data.get('day_of_week', entry.day_of_week).capitalize()
    start_time = parse_time(data['start_time']) if 'start_time' in data else entry.start_time
    end_time = parse_time(data['end_time']) if 'end_time' in data else entry.end_time
    
    if start_time >= end_time:
        return error_response('start_time must be earlier than end_time', status=400)
        
    # Check faculty conflict
    if check_timetable_conflict(faculty_id, day_of_week, start_time, end_time, exclude_timetable_id=entry.id):
        return error_response('Faculty has a timetable conflict at this time', status=409)
        
    # Check classroom conflict
    if classroom:
        room_clashes = Timetable.query.filter(
            Timetable.classroom == classroom,
            Timetable.day_of_week == day_of_week,
            Timetable.is_active == True,
            Timetable.id != entry.id
        ).all()
        for c in room_clashes:
            if times_overlap(c.start_time, c.end_time, start_time, end_time):
                return error_response(f'Classroom {classroom} is already occupied', status=409)
                
    entry.faculty_id = faculty_id
    entry.subject_id = subject_id
    entry.department_id = department_id
    entry.class_name = class_name
    entry.section = section
    entry.classroom = classroom
    entry.day_of_week = day_of_week
    entry.start_time = start_time
    entry.end_time = end_time
    if 'is_active' in data:
        entry.is_active = bool(data['is_active'])
        
    db.session.commit()
    return success_response(data=entry.to_dict(), message='Timetable entry updated successfully')


@timetable_bp.route('/<int:entry_id>', methods=['DELETE'])
@require_admin
@csrf_protect
def delete_timetable_entry(entry_id):
    entry = Timetable.query.get(entry_id)
    if not entry:
        return error_response('Timetable entry not found', status=404)
    entry.is_active = False
    db.session.commit()
    return success_response(message='Timetable entry deleted successfully')
