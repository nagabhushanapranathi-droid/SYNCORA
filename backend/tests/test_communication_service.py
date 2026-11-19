import pytest
from datetime import datetime, timedelta
from app.models.models import User, Faculty, Department, Notification
from app.services.communication_service import (
    generate_substitution_notification,
    generate_approval_message,
    generate_rejection_message,
    generate_lesson_plan_notification,
    generate_timetable_change_message,
    generate_reminder,
    generate_handover_request,
    generate_attendance_reminder,
    generate_announcement_message,
    create_controlled_notification,
)


def test_generate_substitution_notification():
    msg = generate_substitution_notification(
        faculty_name="Dr. Rahul Verma",
        absent_faculty_name="Dr. Priya Sharma",
        subject_name="Data Structures",
        class_name="CS-A",
        date_str="November 24, 2026",
        time_str="10:00 AM - 11:00 AM"
    )
    assert "Class Coverage Invitation" in msg['title']
    assert "Dear Dr. Rahul Verma" in msg['message']
    assert "Dr. Priya Sharma" in msg['message']
    assert "Data Structures" in msg['message']
    assert "academic continuity" in msg['message']
    assert msg['type'] == 'info'


def test_generate_approval_and_rejection_messages():
    app_msg = generate_approval_message(
        faculty_name="Dr. Rahul Verma",
        subject_name="Data Structures",
        date_str="November 24, 2026",
        time_str="10:00 AM - 11:00 AM",
        lesson_plan_available=True
    )
    assert "Substitution Approved" in app_msg['title']
    assert "lesson plan has been generated" in app_msg['message']
    assert app_msg['type'] == 'success'

    rej_msg = generate_rejection_message("Dr. Rahul Verma", reason="Timetable schedule resolved")
    assert "Substitution Schedule Update" in rej_msg['title']
    assert "Timetable schedule resolved" in rej_msg['message']
    assert rej_msg['type'] == 'warning'


def test_generate_lesson_plan_notification():
    # Normal plan
    lp_msg = generate_lesson_plan_notification(
        faculty_name="Dr. Rahul Verma",
        subject_name="Algorithms",
        class_name="CS-B",
        date_str="November 25, 2026",
        has_continuity_warning=False
    )
    assert "Substitute Lesson Plan Ready" in lp_msg['title']
    assert "learning objectives" in lp_msg['message']

    # Plan with continuity warning
    lp_warn_msg = generate_lesson_plan_notification(
        faculty_name="Dr. Rahul Verma",
        subject_name="Algorithms",
        class_name="CS-B",
        date_str="November 25, 2026",
        has_continuity_warning=True
    )
    assert "provisional plan" in lp_warn_msg['message']


def test_generate_timetable_change_and_reminders():
    tt_msg = generate_timetable_change_message(
        faculty_name="Prof. Kavitha Rao",
        subject_name="Mathematics",
        old_slot_str="Monday 10:00 AM",
        new_slot_str="Tuesday 11:00 AM"
    )
    assert "Timetable Adjustment" in tt_msg['title']
    assert "Monday 10:00 AM" in tt_msg['message']
    assert "Tuesday 11:00 AM" in tt_msg['message']

    rem_msg = generate_reminder(
        faculty_name="Dr. Rahul Verma",
        subject_name="Data Structures",
        class_name="CS-A",
        date_str="November 24, 2026",
        time_str="10:00 AM"
    )
    assert "Upcoming Session Reminder" in rem_msg['title']

    att_msg = generate_attendance_reminder("Dr. Priya Sharma", "November 24, 2026")
    assert "Attendance Check-in" in att_msg['title']

    ann_msg = generate_announcement_message("Holiday Notice", "College will remain closed on Friday.")
    assert "Holiday Notice" in ann_msg['title']
    assert "closed on Friday" in ann_msg['message']


def test_duplicate_notification_prevention(session):
    user = User(name="Faculty User", email="fac@syncora.edu", password_hash="hash", role="faculty")
    session.add(user)
    session.commit()

    # First notification should succeed
    n1 = create_controlled_notification(
        user_id=user.id,
        title="Class Coverage Invitation: CS101",
        message="Please cover CS101",
        notif_type="info"
    )
    assert n1 is not None
    assert Notification.query.filter_by(user_id=user.id).count() == 1

    # Rapid second identical notification within 15 min should be suppressed
    n2 = create_controlled_notification(
        user_id=user.id,
        title="Class Coverage Invitation: CS101",
        message="Please cover CS101",
        notif_type="info"
    )
    assert n2.id == n1.id
    assert Notification.query.filter_by(user_id=user.id).count() == 1
