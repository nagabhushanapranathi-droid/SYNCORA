from datetime import date, timedelta
from flask import Blueprint, request
from app.models.models import (
    Faculty,
    Department,
    Attendance,
    SubstitutionRequest,
    SubstitutionAssignment,
    Absence,
    Timetable,
)
from app.utils.auth import require_auth
from app.utils.helpers import success_response
from app.algorithms.allocation import get_substitution_count

reports_bp = Blueprint('reports', __name__)


@reports_bp.route('', methods=['GET'])
@reports_bp.route('/', methods=['GET'])
@require_auth
def get_reports_data():
    today = date.today()
    
    total_faculty = Faculty.query.filter_by(is_active=True).count()
    present_today = Attendance.query.filter_by(date=today, status='PRESENT').count()
    absent_today = Attendance.query.filter_by(date=today, status='ABSENT').count()
    logged_out_today = Attendance.query.filter_by(date=today, status='LOGGED_OUT').count()
    
    all_subs = SubstitutionRequest.query.all()
    total_substitutions = len(all_subs)
    pending = sum(1 for s in all_subs if s.status in ['PENDING', 'RECOMMENDED'])
    completed = sum(1 for s in all_subs if s.status in ['APPROVED', 'ASSIGNED'])
    suspended = sum(1 for s in all_subs if s.status == 'SUSPENDED')
    rejected = sum(1 for s in all_subs if s.status == 'REJECTED')
    
    # Department breakdown
    departments = Department.query.all()
    by_department = []
    for d in departments:
        f_count = Faculty.query.filter_by(department_id=d.id, is_active=True).count()
        t_count = Timetable.query.filter_by(department_id=d.id, is_active=True).count()
        by_department.append({
            'department_id': d.id,
            'department_name': d.name,
            'department_code': d.code,
            'faculty_count': f_count,
            'active_classes': t_count
        })
        
    # Faculty workload ranking
    faculties = Faculty.query.filter_by(is_active=True).all()
    workload_data = []
    for f in faculties:
        sub_count = get_substitution_count(f.id)
        workload_data.append({
            'faculty_id': f.id,
            'faculty_name': f.name,
            'department_name': f.department.name if f.department else None,
            'designation': f.designation,
            'substitution_count': sub_count
        })
    workload_data.sort(key=lambda x: x['substitution_count'], reverse=True)
    
    # Weekly trends (last 7 days)
    weekly_trends = []
    for i in range(6, -1, -1):
        day_d = today - timedelta(days=i)
        day_subs = SubstitutionRequest.query.filter_by(date=day_d).count()
        day_absences = Absence.query.filter_by(date=day_d).count()
        day_presents = Attendance.query.filter_by(date=day_d, status='PRESENT').count()
        weekly_trends.append({
            'date': day_d.isoformat(),
            'day_name': day_d.strftime('%a'),
            'substitutions': day_subs,
            'absences': day_absences,
            'present': day_presents
        })
        
    return success_response(data={
        'date': today.isoformat(),
        'total_faculty': total_faculty,
        'present_today': present_today,
        'absent_today': absent_today,
        'logged_out_today': logged_out_today,
        'total_substitutions': total_substitutions,
        'pending': pending,
        'completed': completed,
        'suspended': suspended,
        'rejected': rejected,
        # Aliased fields for frontend Dashboard compatibility
        'faculty_present': present_today,
        'faculty_absent': absent_today,
        'pending_substitutions': pending,
        'completed_substitutions': completed,
        'suspended_classes': suspended,
        'by_department': by_department,
        'faculty_workload': workload_data,
        'weekly_trends': weekly_trends
    })
