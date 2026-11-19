from app import db
from app.models.models import Notification, User


def create_notification(user_id: int, title: str, message: str, notif_type: str = 'info', related_request_id: int = None):
    """Create and stage a Notification record."""
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notif_type,
        related_request_id=related_request_id
    )
    db.session.add(notif)
    return notif


def notify_faculty_assignment(faculty_id: int, request):
    """Notify a faculty member about their substitution assignment."""
    from app.models.models import Faculty
    faculty = Faculty.query.get(faculty_id)
    if not faculty or not faculty.user:
        return None
    timetable = request.timetable
    absence = request.absence
    title = 'New Substitution Assignment'
    message = (
        f'You have been assigned to substitute for {absence.faculty.name if absence and absence.faculty else "a faculty member"} '
        f'in {timetable.subject.name if timetable and timetable.subject else "a class"} '
        f'({timetable.class_name if timetable else ""}) '
        f'on {request.date.strftime("%B %d, %Y") if request.date else ""}, '
        f'{timetable.start_time.strftime("%I:%M %p") if timetable and timetable.start_time else ""} - '
        f'{timetable.end_time.strftime("%I:%M %p") if timetable and timetable.end_time else ""}'
    )
    return create_notification(faculty.user.id, title, message, 'info', request.id)


def notify_admin_of_request(request):
    """Notify administrators of a pending substitution request."""
    admins = User.query.filter_by(role='admin', is_active=True).all()
    timetable = request.timetable
    title = 'Substitution Request Pending'
    message = (
        f'Substitution requested for {timetable.subject.name if timetable and timetable.subject else "a class"} '
        f'on {request.date.strftime("%B %d, %Y") if request.date else ""}. Status: {request.status}.'
    )
    for admin in admins:
        create_notification(admin.id, title, message, 'warning', request.id)
