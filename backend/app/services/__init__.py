from app.services.notification_service import (
    create_notification,
    notify_faculty_assignment,
    notify_admin_of_request,
)
from app.services.faculty_service import (
    get_all_faculty_with_metadata,
    add_subject_to_faculty,
    remove_subject_from_faculty,
)
from app.services.attendance_service import (
    get_today_summary,
    mark_or_update_attendance,
)
from app.services.substitution_service import (
    create_absence_and_requests,
    approve_request,
    manual_assign_request,
    reject_request,
    suspend_request,
    acknowledge_assignment,
    recalculate_request,
)
from app.services.lesson_plan_service import (
    get_academic_context,
    generate_lesson_plan,
    build_deterministic_fallback_plan,
    format_markdown_lesson_plan,
    update_lesson_plan_content,
    record_verified_progress,
)

__all__ = [
    'create_notification',
    'notify_faculty_assignment',
    'notify_admin_of_request',
    'get_all_faculty_with_metadata',
    'add_subject_to_faculty',
    'remove_subject_from_faculty',
    'get_today_summary',
    'mark_or_update_attendance',
    'create_absence_and_requests',
    'approve_request',
    'manual_assign_request',
    'reject_request',
    'suspend_request',
    'acknowledge_assignment',
    'recalculate_request',
    'get_academic_context',
    'generate_lesson_plan',
    'build_deterministic_fallback_plan',
    'format_markdown_lesson_plan',
    'update_lesson_plan_content',
    'record_verified_progress',
]
