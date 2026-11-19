from app.routes.auth import auth_bp
from app.routes.faculty import faculty_bp
from app.routes.departments import departments_bp
from app.routes.subjects import subjects_bp
from app.routes.attendance import attendance_bp
from app.routes.timetable import timetable_bp
from app.routes.absences import absences_bp
from app.routes.substitutions import substitutions_bp
from app.routes.ai_routes import ai_bp
from app.routes.notifications import notifications_bp
from app.routes.reports import reports_bp

__all__ = [
    'auth_bp',
    'faculty_bp',
    'departments_bp',
    'subjects_bp',
    'attendance_bp',
    'timetable_bp',
    'absences_bp',
    'substitutions_bp',
    'ai_bp',
    'notifications_bp',
    'reports_bp',
]
