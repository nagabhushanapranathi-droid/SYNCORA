import pytest
import json
from datetime import date, time
from unittest.mock import patch, MagicMock
from app.models.models import (
    Department,
    Faculty,
    Subject,
    User,
    Timetable,
    Absence,
    SubstitutionRequest,
    SubstitutionAssignment,
    CourseSyllabus,
    LessonProgress,
    LessonPlan,
    HandoverNote,
)
from app.services.lesson_plan_service import (
    calculate_duration_minutes,
    get_academic_context,
    build_deterministic_fallback_plan,
    format_markdown_lesson_plan,
    generate_lesson_plan,
    update_lesson_plan_content,
    record_verified_progress,
)


@pytest.fixture
def academic_setup(session):
    dept = Department(name="Computer Science", code="CS")
    session.add(dept)
    session.flush()

    admin = User(name="Admin", email="admin@syncora.edu", password_hash="hash", role="admin")
    fac1 = Faculty(name="Dr. Priya Sharma", email="priya@syncora.edu", department_id=dept.id, designation="Associate Professor")
    fac2 = Faculty(name="Dr. Rahul Verma", email="rahul@syncora.edu", department_id=dept.id, designation="Professor")
    user2 = User(name="Dr. Rahul Verma", email="rahul@syncora.edu", password_hash="hash", role="faculty")
    sub = Subject(name="Data Structures", code="CS101", department_id=dept.id)
    session.add_all([admin, fac1, fac2, user2, sub])
    session.flush()
    user2.faculty_id = fac2.id

    tt = Timetable(
        faculty_id=fac1.id,
        subject_id=sub.id,
        department_id=dept.id,
        class_name="CS-A",
        section="A",
        day_of_week="Monday",
        start_time=time(10, 0),
        end_time=time(11, 0)
    )
    session.add(tt)
    session.flush()

    abs_rec = Absence(faculty_id=fac1.id, date=date(2026, 11, 23), reason="Conference", reported_by=admin.id)
    session.add(abs_rec)
    session.flush()

    sub_req = SubstitutionRequest(
        absence_id=abs_rec.id,
        timetable_id=tt.id,
        date=date(2026, 11, 23),
        recommended_faculty_id=fac2.id,
        status="APPROVED"
    )
    session.add(sub_req)
    session.flush()

    assign = SubstitutionAssignment(
        request_id=sub_req.id,
        assigned_faculty_id=fac2.id,
        assigned_by=admin.id
    )
    session.add(assign)
    session.commit()

    return {
        'dept': dept,
        'admin': admin,
        'fac1': fac1,
        'fac2': fac2,
        'sub': sub,
        'timetable': tt,
        'request': sub_req,
        'assignment': assign
    }


def test_calculate_duration_minutes():
    assert calculate_duration_minutes(time(9, 0), time(10, 0)) == 60
    assert calculate_duration_minutes(time(14, 0), time(14, 50)) == 50
    assert calculate_duration_minutes(time(10, 30), time(12, 0)) == 90
    assert calculate_duration_minutes(None, None) == 60


def test_get_academic_context_with_missing_progress_generates_warning(academic_setup, session):
    sub_req = academic_setup['request']
    ctx = get_academic_context(sub_req.id)

    assert ctx['subject']['code'] == "CS101"
    assert ctx['class_details']['duration_minutes'] == 60
    assert ctx['class_details']['class_name'] == "CS-A"
    assert ctx['faculty']['original_faculty_name'] == "Dr. Priya Sharma"
    assert ctx['faculty']['substitute_faculty_name'] == "Dr. Rahul Verma"

    # Missing progress records should flag warning
    assert ctx['academic_continuity']['has_warning'] is True
    assert "PROVISIONAL LESSON PLAN WARNING" in ctx['academic_continuity']['warning_message']
    assert ctx['academic_continuity']['verified_completed_topics'] == []


def test_get_academic_context_with_verified_progress_and_handover(academic_setup, session):
    sub = academic_setup['sub']
    fac1 = academic_setup['fac1']
    sub_req = academic_setup['request']

    # Add syllabus unit
    unit1 = CourseSyllabus(
        subject_id=sub.id,
        unit_number=1,
        unit_title="Linear Data Structures",
        topics=json.dumps(["Arrays", "Singly Linked Lists", "Doubly Linked Lists", "Circular Linked Lists"])
    )
    session.add(unit1)

    # Add verified completed topic
    prog1 = LessonProgress(
        subject_id=sub.id,
        faculty_id=fac1.id,
        class_name="CS-A",
        section="A",
        unit_number=1,
        topic_name="Arrays",
        status="COMPLETED",
        is_verified=True,
        completion_date=date(2026, 11, 20)
    )
    # Add in-progress topic
    prog2 = LessonProgress(
        subject_id=sub.id,
        faculty_id=fac1.id,
        class_name="CS-A",
        section="A",
        unit_number=1,
        topic_name="Singly Linked Lists",
        status="IN_PROGRESS",
        is_verified=True
    )
    # Add Handover Note
    note = HandoverNote(
        faculty_id=fac1.id,
        subject_id=sub.id,
        class_name="CS-A",
        section="A",
        current_unit="Unit 1",
        completed_topics=json.dumps(["Arrays"]),
        current_topic="Singly Linked Lists node deletion",
        next_topics=json.dumps(["Doubly Linked Lists"]),
        student_notes="Emphasize pointer redirection"
    )
    session.add_all([prog1, prog2, note])
    session.commit()

    ctx = get_academic_context(sub_req.id)
    assert ctx['academic_continuity']['has_warning'] is False
    assert len(ctx['academic_continuity']['verified_completed_topics']) == 1
    assert len(ctx['academic_continuity']['in_progress_topics']) == 1
    assert ctx['academic_continuity']['handover_note'] is not None
    assert "Singly Linked Lists node deletion" in ctx['academic_continuity']['target_topics']


def test_build_deterministic_fallback_plan(academic_setup):
    sub_req = academic_setup['request']
    ctx = get_academic_context(sub_req.id)
    plan = build_deterministic_fallback_plan(ctx)

    assert "lesson_title" in plan
    assert len(plan["learning_objectives"]) >= 3
    assert len(plan["topics_to_cover"]) >= 1
    assert len(plan["teaching_sequence"]) == 4
    assert plan["time_allocation"]["total_duration_minutes"] == 60
    assert len(plan["classroom_activities"]) >= 2
    assert len(plan["student_engagement_questions"]) >= 3
    assert len(plan["assessment_questions"]) >= 3
    assert len(plan["homework"]) >= 2
    assert len(plan["required_materials"]) >= 2


def test_generate_and_persist_lesson_plan(academic_setup, session):
    sub_req = academic_setup['request']
    admin = academic_setup['admin']

    # Generate lesson plan using deterministic fallback engine
    lp = generate_lesson_plan(sub_req.id, admin.id)

    assert lp.id is not None
    assert lp.substitution_request_id == sub_req.id
    assert lp.duration_minutes == 60
    assert lp.status == "GENERATED"
    assert lp.has_academic_continuity_warning is True  # No progress records in initial setup
    assert lp.get_structured_plan() is not None
    assert len(lp.get_structured_plan()["learning_objectives"]) >= 3
    assert "# " in lp.lesson_content

    # Idempotence: re-calling returns existing plan without creating duplicate
    lp_second = generate_lesson_plan(sub_req.id, admin.id)
    assert lp_second.id == lp.id
    assert LessonPlan.query.filter_by(substitution_request_id=sub_req.id).count() == 1


def test_update_lesson_plan_and_record_progress(academic_setup, session):
    sub_req = academic_setup['request']
    admin = academic_setup['admin']
    fac2 = academic_setup['fac2']
    sub = academic_setup['sub']

    lp = generate_lesson_plan(sub_req.id, admin.id)

    # Substitute updates plan feedback and notes after class
    updated = update_lesson_plan_content(
        lesson_plan_id=lp.id,
        user_id=fac2.id,
        teaching_notes="Conducted thorough chalkboard walkthrough. All students completed pair exercise.",
        feedback="Students were active and engaged.",
        topics_completed=["Arrays and memory representations"],
        status="COMPLETED"
    )
    assert updated.status == "COMPLETED"
    assert updated.teaching_notes.startswith("Conducted thorough")

    # Record verified progress into SQLite
    prog = record_verified_progress(
        subject_id=sub.id,
        faculty_id=fac2.id,
        class_name="CS-A",
        section="A",
        unit_number=1,
        topic_name="Arrays and memory representations",
        status="COMPLETED",
        hours_spent=1.0,
        notes="Substitution class conducted successfully by Dr. Rahul Verma",
        is_verified=True
    )
    assert prog.id is not None
    assert prog.is_verified is True
    assert prog.status == "COMPLETED"
    assert LessonProgress.query.filter_by(subject_id=sub.id).count() == 1
