import pytest
import json
from datetime import date, time
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
from app.ai.gemini_service import chat_assistant
from app.routes.ai_routes import build_chat_context


@pytest.fixture
def assistant_setup(session):
    dept = Department(name="Computer Science", code="CS")
    session.add(dept)
    session.flush()

    admin = User(name="Administrator", email="admin@syncora.edu", password_hash="hash", role="admin")
    fac1 = Faculty(name="Dr. Priya Sharma", email="priya@syncora.edu", department_id=dept.id, designation="Associate Professor")
    user1 = User(name="Dr. Priya Sharma", email="priya@syncora.edu", password_hash="hash", role="faculty")

    fac2 = Faculty(name="Dr. Rahul Verma", email="rahul@syncora.edu", department_id=dept.id, designation="Professor")
    user2 = User(name="Dr. Rahul Verma", email="rahul@syncora.edu", password_hash="hash", role="faculty")

    sub = Subject(name="Data Structures", code="CS101", department_id=dept.id)
    session.add_all([admin, fac1, user1, fac2, user2, sub])
    session.flush()
    user1.faculty_id = fac1.id
    user2.faculty_id = fac2.id

    syllabus = CourseSyllabus(
        subject_id=sub.id,
        unit_number=1,
        unit_title="Linear Data Structures",
        topics=json.dumps(["Arrays", "Singly Linked Lists", "Doubly Linked Lists"])
    )
    session.add(syllabus)

    prog = LessonProgress(
        subject_id=sub.id,
        faculty_id=fac1.id,
        class_name="CS-A",
        section="A",
        unit_number=1,
        topic_name="Arrays and Memory Offsets",
        status="COMPLETED",
        is_verified=True,
        completion_date=date(2026, 11, 20),
        notes="Covered 1D and 2D row-major addressing"
    )
    session.add(prog)

    # Substitution assigned to Dr. Rahul Verma
    today = date(2026, 11, 23)
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

    abs_rec = Absence(faculty_id=fac1.id, date=today, reason="Conference", reported_by=admin.id)
    session.add(abs_rec)
    session.flush()

    sub_req = SubstitutionRequest(
        absence_id=abs_rec.id,
        timetable_id=tt.id,
        date=today,
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
    session.flush()

    plan = LessonPlan(
        substitution_request_id=sub_req.id,
        subject_id=sub.id,
        original_faculty_id=fac1.id,
        substitute_faculty_id=fac2.id,
        class_name="CS-A",
        section="A",
        scheduled_date=today,
        duration_minutes=60,
        lesson_content="# Data Structures: Singly Linked Lists\n...",
        structured_plan=json.dumps({
            "lesson_title": "Singly Linked Lists: Node Structure",
            "topics_to_cover": ["Singly Linked Lists", "Node Allocation"],
            "learning_objectives": ["Understand dynamic memory allocation for nodes", "Implement insertion at head"]
        }),
        status="GENERATED"
    )
    session.add(plan)
    session.commit()

    return {
        'admin': admin,
        'user1': user1,
        'user2': user2,
        'fac1': fac1,
        'fac2': fac2,
        'sub': sub,
        'request': sub_req,
        'plan': plan
    }


def test_faculty_query_what_should_i_teach(assistant_setup):
    user2 = assistant_setup['user2']
    query = "What should I teach tomorrow? Show my assigned lesson plan."

    context = build_chat_context(query, user=user2)
    assert 'my_teaching_schedule' in context
    assert 'my_assigned_plans' in context
    assert len(context['my_assigned_plans']) == 1
    assert context['my_assigned_plans'][0]['subject_name'] == "Data Structures"

    reply = chat_assistant(query, context)
    assert "Data Structures" in reply
    assert "Singly Linked Lists" in reply


def test_faculty_query_previous_lecture(assistant_setup):
    user2 = assistant_setup['user2']
    query = "What was covered in the previous lecture for my course?"

    context = build_chat_context(query, user=user2)
    reply = chat_assistant(query, context)
    assert "SYNCORA" in reply


def test_admin_query_pending_lesson_plans(assistant_setup):
    admin = assistant_setup['admin']
    query = "Show pending lesson plans"

    context = build_chat_context(query, user=admin)
    assert 'pending_lesson_plans' in context

    reply = chat_assistant(query, context)
    assert "Lesson Plans" in reply


def test_admin_query_missing_handover(assistant_setup):
    admin = assistant_setup['admin']
    query = "Which substitutions are missing handover notes?"

    context = build_chat_context(query, user=admin)
    assert 'missing_handover_notes' in context
    assert len(context['missing_handover_notes']) == 1

    reply = chat_assistant(query, context)
    assert "Missing Faculty Handover Notes" in reply
    assert "Data Structures" in reply


def test_pedagogical_activity_suggestions(assistant_setup):
    user2 = assistant_setup['user2']
    query = "Suggest classroom activities for this lecture"

    context = build_chat_context(query, user=user2)
    reply = chat_assistant(query, context)
    assert "Think-Pair-Share" in reply
    assert "Whiteboard" in reply


def test_faculty_cannot_see_other_faculty_private_schedule(assistant_setup):
    user1 = assistant_setup['user1']  # Dr. Priya Sharma
    # Priya asks for what to teach: her assigned plans should NOT contain Rahul Verma's substitute assignment
    context = build_chat_context("What should I teach?", user=user1)
    assert 'my_assigned_plans' in context
    assert len(context['my_assigned_plans']) == 0  # Priya has no substitute assignments
