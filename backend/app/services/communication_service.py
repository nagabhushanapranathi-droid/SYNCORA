import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from app import db
from app.models.models import Notification, User, Faculty, SubstitutionRequest

logger = logging.getLogger(__name__)


def generate_substitution_notification(
    faculty_name: str,
    absent_faculty_name: str,
    subject_name: str,
    class_name: str,
    date_str: str,
    time_str: str,
    urgency: str = 'medium'
) -> Dict[str, str]:
    """Generate a warm, respectful, empathetic, and professional substitution assignment message."""
    urgency_tag = " [Short Notice]" if urgency == 'high' else ""
    title = f"Class Coverage Invitation{urgency_tag}: {subject_name} ({class_name})"
    message = (
        f"Dear {faculty_name},\n\n"
        f"We kindly request your assistance to conduct the {subject_name} lecture for class {class_name} on "
        f"{date_str} during {time_str}, covering for {absent_faculty_name}. "
        "Your department and colleagues deeply appreciate your collaborative support in ensuring uninterrupted academic continuity for our students.\n\n"
        "A customized substitute lesson plan with syllabus context and teaching objectives is available in your SYNCORA faculty portal."
    )
    return {'title': title, 'message': message, 'type': 'info', 'urgency': urgency}


def generate_approval_message(
    faculty_name: str,
    subject_name: str,
    date_str: str,
    time_str: str,
    lesson_plan_available: bool = True
) -> Dict[str, str]:
    """Generate approval notification for assigned faculty."""
    title = f"Substitution Approved: {subject_name}"
    plan_note = " An AI-structured lesson plan has been generated and linked to your portal for review." if lesson_plan_available else ""
    message = (
        f"Dear {faculty_name},\n\n"
        f"Your substitution assignment for {subject_name} on {date_str} ({time_str}) has been officially confirmed by Academic Administration.{plan_note} "
        "Thank you for upholding academic excellence."
    )
    return {'title': title, 'message': message, 'type': 'success', 'urgency': 'medium'}


def generate_rejection_message(faculty_name: str, reason: Optional[str] = None) -> Dict[str, str]:
    """Generate respectful rejection / adjustment message."""
    title = "Substitution Schedule Update"
    reason_str = f" Reason: {reason}." if reason else ""
    message = (
        f"Dear {faculty_name},\n\n"
        f"Please note that the tentative substitution assignment has been updated or reassigned by administration.{reason_str} "
        "No further action is required from you for this slot. Thank you for your continued readiness to assist."
    )
    return {'title': title, 'message': message, 'type': 'warning', 'urgency': 'low'}


def generate_lesson_plan_notification(
    faculty_name: str,
    subject_name: str,
    class_name: str,
    date_str: str,
    has_continuity_warning: bool = False
) -> Dict[str, str]:
    """Generate contextual notification when a lesson plan is generated or ready."""
    title = f"Substitute Lesson Plan Ready: {subject_name}"
    warning_clause = (
        "\n\n*Note: This is a provisional plan because prior verified teaching records are pending confirmation. "
        "Please review the topics and adjust as necessary.*" if has_continuity_warning else ""
    )
    message = (
        f"Dear {faculty_name},\n\n"
        f"Your pedagogical lesson plan for {subject_name} (Class {class_name}) on {date_str} has been prepared. "
        f"It includes learning objectives, classroom activities, timing allocations, and assessment questions.{warning_clause}\n\n"
        "You can review, edit, or print the plan directly from your SYNCORA dashboard."
    )
    return {'title': title, 'message': message, 'type': 'info', 'urgency': 'medium'}


def generate_timetable_change_message(
    faculty_name: str,
    subject_name: str,
    old_slot_str: str,
    new_slot_str: str
) -> Dict[str, str]:
    """Generate respectful timetable adjustment message."""
    title = f"Timetable Adjustment: {subject_name}"
    message = (
        f"Dear {faculty_name},\n\n"
        f"Please be advised of an update to your teaching timetable for {subject_name}. "
        f"The previous slot ({old_slot_str}) has been rescheduled to {new_slot_str}. "
        "Please consult your updated weekly timetable in SYNCORA."
    )
    return {'title': title, 'message': message, 'type': 'warning', 'urgency': 'high'}


def generate_reminder(
    faculty_name: str,
    subject_name: str,
    class_name: str,
    date_str: str,
    time_str: str,
    reminder_type: str = 'assignment'
) -> Dict[str, str]:
    """Generate friendly, timely reminder for upcoming substitution or task."""
    title = f"Upcoming Session Reminder: {subject_name}"
    message = (
        f"Dear {faculty_name},\n\n"
        f"This is a gentle reminder that your substitution session for {subject_name} ({class_name}) "
        f"is scheduled for tomorrow, {date_str} at {time_str}. "
        "Please ensure you have reviewed the lesson plan and required classroom materials."
    )
    return {'title': title, 'message': message, 'type': 'info', 'urgency': 'medium'}


def generate_handover_request(
    original_faculty_name: str,
    substitute_faculty_name: str,
    subject_name: str,
    class_name: str,
    date_str: str
) -> Dict[str, str]:
    """Generate polite request to original faculty to leave a handover note."""
    title = f"Academic Handover Request: {subject_name}"
    message = (
        f"Dear {original_faculty_name},\n\n"
        f"As you are scheduled away on {date_str}, {substitute_faculty_name} has been assigned to cover your "
        f"{subject_name} lecture for class {class_name}. "
        "To ensure seamless academic continuity, we kindly invite you to submit a brief handover note indicating "
        "your current unit progress, completed topics, and any specific instructions for the substitute."
    )
    return {'title': title, 'message': message, 'type': 'info', 'urgency': 'low'}


def generate_attendance_reminder(faculty_name: str, date_str: str) -> Dict[str, str]:
    """Generate courteous attendance check-in reminder."""
    title = "Daily Attendance Check-in"
    message = (
        f"Dear {faculty_name},\n\n"
        f"Good morning! Please remember to record your morning attendance for {date_str} upon campus arrival. "
        "Timely check-ins assist our department in maintaining smooth academic scheduling."
    )
    return {'title': title, 'message': message, 'type': 'info', 'urgency': 'low'}


def generate_announcement_message(title: str, content: str, sender_name: str = 'Academic Administration') -> Dict[str, str]:
    """Generate formal institutional broadcast message."""
    full_title = f"Notice: {title}"
    message = f"Announcement from {sender_name}:\n\n{content}"
    return {'title': full_title, 'message': message, 'type': 'info', 'urgency': 'medium'}


def create_controlled_notification(
    user_id: int,
    title: str,
    message: str,
    notif_type: str = 'info',
    related_request_id: Optional[int] = None,
    prevent_duplicate_minutes: int = 15
) -> Optional[Notification]:
    """
    Creates and persists a Notification record in SQLite with duplicate prevention.
    If an identical notification was sent to this user within prevent_duplicate_minutes, skip it.
    """
    cutoff = datetime.utcnow() - timedelta(minutes=prevent_duplicate_minutes)
    duplicate = Notification.query.filter(
        Notification.user_id == user_id,
        Notification.title == title,
        Notification.created_at >= cutoff
    ).first()

    if duplicate:
        logger.info(f"Duplicate notification suppressed for user {user_id}: '{title}'")
        return duplicate

    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notif_type,
        related_request_id=related_request_id
    )
    db.session.add(notif)
    db.session.commit()
    logger.info(f"Notification #{notif.id} created for user {user_id}: '{title}'")
    return notif


def get_faculty_user(faculty: Optional[Faculty]) -> Optional[User]:
    """Safely obtain the single User record associated with a faculty member."""
    if not faculty:
        return None
    if hasattr(faculty, 'user'):
        u = faculty.user
        if isinstance(u, list):
            return u[0] if u else None
        return u
    return User.query.filter_by(faculty_id=faculty.id).first()


def dispatch_substitution_notifications(sub_req: SubstitutionRequest, is_approved: bool = True):
    """
    Dispatch coordinated humanized notifications upon substitution assignment/approval.
    Notifies substitute faculty of assignment & lesson plan, and requests handover from original faculty.
    """
    timetable = sub_req.timetable
    if not timetable:
        return

    substitute_faculty = None
    if sub_req.assignment and sub_req.assignment.assigned_faculty:
        substitute_faculty = sub_req.assignment.assigned_faculty
    elif sub_req.recommended_faculty:
        substitute_faculty = sub_req.recommended_faculty

    original_faculty = sub_req.absence.faculty if sub_req.absence and sub_req.absence.faculty else timetable.faculty

    date_str = sub_req.date.strftime("%B %d, %Y") if sub_req.date else ""
    time_str = f"{timetable.start_time.strftime('%I:%M %p')} - {timetable.end_time.strftime('%I:%M %p')}" if timetable.start_time and timetable.end_time else ""

    sub_user = get_faculty_user(substitute_faculty)
    orig_user = get_faculty_user(original_faculty)

    # 1. Notify substitute faculty
    if substitute_faculty and sub_user:
        content = generate_substitution_notification(
            faculty_name=substitute_faculty.name,
            absent_faculty_name=original_faculty.name if original_faculty else "a colleague",
            subject_name=timetable.subject.name if timetable.subject else "your subject",
            class_name=timetable.class_name,
            date_str=date_str,
            time_str=time_str
        )
        create_controlled_notification(
            user_id=sub_user.id,
            title=content['title'],
            message=content['message'],
            notif_type=content['type'],
            related_request_id=sub_req.id
        )

        # Also notify that lesson plan is ready
        has_warning = False
        if sub_req.lesson_plans:
            has_warning = sub_req.lesson_plans[0].has_academic_continuity_warning

        lp_content = generate_lesson_plan_notification(
            faculty_name=substitute_faculty.name,
            subject_name=timetable.subject.name if timetable.subject else "",
            class_name=timetable.class_name,
            date_str=date_str,
            has_continuity_warning=has_warning
        )
        create_controlled_notification(
            user_id=sub_user.id,
            title=lp_content['title'],
            message=lp_content['message'],
            notif_type=lp_content['type'],
            related_request_id=sub_req.id
        )

    # 2. Notify original faculty requesting handover note if not yet submitted
    if original_faculty and orig_user and substitute_faculty:
        handover_content = generate_handover_request(
            original_faculty_name=original_faculty.name,
            substitute_faculty_name=substitute_faculty.name,
            subject_name=timetable.subject.name if timetable.subject else "",
            class_name=timetable.class_name,
            date_str=date_str
        )
        create_controlled_notification(
            user_id=orig_user.id,
            title=handover_content['title'],
            message=handover_content['message'],
            notif_type=handover_content['type'],
            related_request_id=sub_req.id
        )
