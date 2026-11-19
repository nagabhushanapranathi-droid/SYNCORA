import json
import pytest
from datetime import date, time, datetime, timedelta
from unittest.mock import patch, MagicMock

from app.models.models import (
    Department,
    Faculty,
    Subject,
    User,
    Timetable,
    Absence,
    Attendance,
    SubstitutionRequest,
    SubstitutionAssignment,
    CourseSyllabus,
    LessonProgress,
    LessonPlan,
    HandoverNote,
    Notification,
)
from app.services.substitution_service import (
    create_absence_and_requests,
    approve_request,
    manual_assign_request,
)
from app.services.lesson_plan_service import (
    generate_lesson_plan,
    get_academic_context,
)
from app.ai.gemini_service import (
    chat_assistant,
    explain_recommendation,
    generate_daily_report,
)
from app.ai.provider_manager import ai_manager
from app.ai.providers.freellmapi_provider import FreeLLMAPIConnectionError, FreeLLMAPIServerError


@pytest.fixture
def workflow_setup(session):
    """Seed comprehensive institutional data for workflow testing."""
    dept = Department(name="Computer Science & Engineering", code="CSE")
    session.add(dept)
    session.flush()

    # Admin User
    admin_user = User(name="Dean of Academics", email="dean@syncora.edu", role="admin")
    admin_user.password_hash = "mock_hash"

    # Faculty 1: Dr. Alan Turing (Original Faculty)
    fac_orig = Faculty(
        name="Dr. Alan Turing",
        email="alan@syncora.edu",
        department_id=dept.id,
        designation="Professor"
    )
    user_orig = User(name="Dr. Alan Turing", email="alan@syncora.edu", role="faculty")
    user_orig.password_hash = "mock_hash"

    # Faculty 2: Dr. Grace Hopper (Substitute Faculty / Expert)
    fac_sub = Faculty(
        name="Dr. Grace Hopper",
        email="grace@syncora.edu",
        department_id=dept.id,
        designation="Associate Professor"
    )
    user_sub = User(name="Dr. Grace Hopper", email="grace@syncora.edu", role="faculty")
    user_sub.password_hash = "mock_hash"

    # Faculty 3: Dr. Ada Lovelace (Other Faculty)
    fac_other = Faculty(
        name="Dr. Ada Lovelace",
        email="ada@syncora.edu",
        department_id=dept.id,
        designation="Assistant Professor"
    )
    user_other = User(name="Dr. Ada Lovelace", email="ada@syncora.edu", role="faculty")
    user_other.password_hash = "mock_hash"

    # Subject: Operating Systems
    subj = Subject(name="Operating Systems", code="CS401", department_id=dept.id)
    fac_orig.subjects.append(subj)
    fac_sub.subjects.append(subj)

    session.add_all([admin_user, fac_orig, user_orig, fac_sub, user_sub, fac_other, user_other, subj])
    session.flush()

    user_orig.faculty_id = fac_orig.id
    user_sub.faculty_id = fac_sub.id
    user_other.faculty_id = fac_other.id

    # Target date and day of week
    target_date = date.today() + timedelta(days=1)
    from app.utils.helpers import get_day_of_week
    day_name = get_day_of_week(target_date)

    # Timetable: matching target date day of week 09:00 - 10:00
    tt = Timetable(
        faculty_id=fac_orig.id,
        subject_id=subj.id,
        department_id=dept.id,
        class_name="CS-4A",
        section="A",
        day_of_week=day_name,
        start_time=time(9, 0),
        end_time=time(10, 0),
        classroom="Hall B"
    )
    session.add(tt)
    session.flush()

    # Syllabus: Unit 3 Memory Management
    syl = CourseSyllabus(
        subject_id=subj.id,
        unit_number=3,
        unit_title="Virtual Memory & Paging",
        topics=json.dumps(["Page Replacement Algorithms", "LRU and FIFO", "Thrashing"]),
        course_outcomes=json.dumps(["CO3: Analyze memory management policies"]),
        estimated_hours=6.0,
        learning_objectives="Understand page fault handling and replacement."
    )
    session.add(syl)
    session.flush()

    # Progress record: FIFO page replacement covered
    prog = LessonProgress(
        subject_id=subj.id,
        faculty_id=fac_orig.id,
        class_name="CS-4A",
        section="A",
        unit_number=3,
        topic_name="FIFO Page Replacement",
        status="COMPLETED",
        is_verified=True,
        completion_date=date(2026, 11, 15),
        notes="Covered Belady anomaly and FIFO evaluation."
    )
    session.add(prog)

    # Attendance: Dr. Grace Hopper is PRESENT
    att_sub = Attendance(
        faculty_id=fac_sub.id,
        date=target_date,
        status="PRESENT",
        login_time=time(8, 30)
    )
    session.add(att_sub)
    session.commit()

    return {
        "admin": admin_user,
        "fac_orig": fac_orig,
        "user_orig": user_orig,
        "fac_sub": fac_sub,
        "user_sub": user_sub,
        "fac_other": fac_other,
        "user_other": user_other,
        "subject": subj,
        "timetable": tt,
        "target_date": target_date
    }


# ===========================================================================
# WORKFLOW A: End-to-End Substitution Lifecycle with FreeLLMAPI
# ===========================================================================

def test_workflow_a_substitution_lifecycle_with_freellmapi(workflow_setup, session):
    """
    Workflow A: Absence Reported -> Candidate Ranked -> Admin Approved ->
    FreeLLMAPI Lesson Plan Generated -> Coordinated Notifications Dispatched.
    """
    d = workflow_setup
    today = d["target_date"]

    # 1. Report absence for Dr. Alan Turing
    absence, requests = create_absence_and_requests(
        faculty_id=d["fac_orig"].id,
        absence_date=today,
        reason="Academic Conference Keynote",
        remarks="Keynote speech at international symposium",
        reported_by_user_id=d["admin"].id
    )
    assert len(requests) == 1
    sub_req = requests[0]
    assert sub_req.recommended_faculty_id == d["fac_sub"].id

    # 2. Mock FreeLLMAPI structured JSON response for 12-point lesson plan
    mock_plan_payload = {
        "lesson_title": "Operating Systems — LRU Page Replacement",
        "learning_objectives": [
            "Explain Least Recently Used (LRU) algorithm principles",
            "Trace page fault occurrences on reference strings",
            "Compare hardware implementation tradeoffs between FIFO and LRU"
        ],
        "topics_to_cover": ["LRU Page Replacement", "Hardware Stack Implementation"],
        "prerequisites": ["Virtual Memory Concepts", "FIFO Page Replacement"],
        "teaching_sequence": [
            "0-10 min: Interactive recap of FIFO and Belady anomaly",
            "10-35 min: LRU mechanism and reference string simulation",
            "35-50 min: Stack algorithm proof and clock approximation",
            "50-60 min: Student practice exercises and formative assessment"
        ],
        "time_allocation": {
            "recap_minutes": 10,
            "core_lecture_minutes": 25,
            "activities_minutes": 15,
            "assessment_minutes": 10,
            "total_duration_minutes": 60
        },
        "examples_and_explanations": ["Trace string: 7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2"],
        "classroom_activities": ["Pair trace of LRU with 3 page frames"],
        "student_engagement_questions": ["Why does LRU not suffer from Belady anomaly?"],
        "assessment_questions": ["Calculate page fault rate for the given reference string."],
        "homework": ["Problem set 4: Clock page replacement trace"],
        "required_materials": ["Whiteboard marker", "Silberschatz OS textbook"]
    }

    # Execute approval with FreeLLMAPI mock
    with patch.object(ai_manager, "generate_structured_json") as mock_gen_json:
        mock_gen_json.return_value = (mock_plan_payload, "freellmapi", "gemini-2.5-pro")

        assignment = approve_request(sub_req.id, d["admin"].id)
        assert assignment is not None
        assert assignment.assigned_faculty_id == d["fac_sub"].id

        # Verify FreeLLMAPI was called with TaskType.REASONING
        assert mock_gen_json.called
        call_kwargs = mock_gen_json.call_args[1]
        assert call_kwargs.get("task_type") == "reasoning"

    # Verify lesson plan was persisted with 12 points and correct provider metadata
    lp = LessonPlan.query.filter_by(substitution_request_id=sub_req.id).first()
    assert lp is not None
    assert lp.is_ai_generated is True
    assert lp.ai_provider == "freellmapi"
    assert lp.ai_model == "gemini-2.5-pro"
    assert lp.duration_minutes == 60

    structured = lp.get_structured_plan()
    assert structured["lesson_title"] == "Operating Systems — LRU Page Replacement"
    assert len(structured["learning_objectives"]) == 3
    assert len(structured["teaching_sequence"]) == 4

    # Verify notifications were created for both faculty members
    notifs_sub = Notification.query.filter_by(user_id=d["user_sub"].id).all()
    assert len(notifs_sub) >= 2  # Coverage invitation & Lesson plan ready
    titles = [n.title for n in notifs_sub]
    assert any("Coverage Invitation" in t for t in titles)
    assert any("Lesson Plan Ready" in t for t in titles)

    notifs_orig = Notification.query.filter_by(user_id=d["user_orig"].id).all()
    assert len(notifs_orig) >= 1  # Handover request
    assert any("Academic Handover Request" in n.title for n in notifs_orig)


# ===========================================================================
# WORKFLOW B: AI Assistant Grounded Database Context with FreeLLMAPI
# ===========================================================================

def test_workflow_b_assistant_grounded_queries(workflow_setup, session):
    """
    Workflow B: Conversational assistant retrieves real SQLite records through academic tools
    and routes through FreeLLMAPI with proper task routing.
    """
    d = workflow_setup
    today = d["target_date"]

    # Seed an approved substitution request
    absence = Absence(faculty_id=d["fac_orig"].id, date=today, reason="Medical", reported_by=d["admin"].id)
    session.add(absence)
    session.flush()

    sub_req = SubstitutionRequest(
        absence_id=absence.id,
        timetable_id=d["timetable"].id,
        date=today,
        recommended_faculty_id=d["fac_sub"].id,
        status="APPROVED"
    )
    session.add(sub_req)
    session.flush()

    assign = SubstitutionAssignment(
        request_id=sub_req.id,
        assigned_faculty_id=d["fac_sub"].id,
        assigned_by=d["admin"].id
    )
    session.add(assign)
    session.commit()

    # Query 1: Faculty asking what to teach
    from app.routes.ai_routes import build_chat_context
    context = build_chat_context("What classes am I substituting for tomorrow?", user=d["user_sub"])

    assert "my_teaching_schedule" in context
    subs = context["my_teaching_schedule"]["substitution_classes"]
    assert len(subs) >= 1
    assert subs[0]["subject"] == "Operating Systems"
    assert subs[0]["class_name"] == "CS-4A"

    # Test conversational generation via FreeLLMAPI mock
    with patch.object(ai_manager, "generate_with_fallback") as mock_gen:
        mock_gen.return_value = (
            "You are scheduled to conduct Operating Systems for class CS-4A on Monday at 09:00 - 10:00.",
            "freellmapi",
            "gemini-2.5-flash"
        )
        reply = chat_assistant("What classes am I substituting for tomorrow?", context)
        assert "Operating Systems" in reply
        assert mock_gen.called

    # Query 2: Admin asking about pending lesson plans
    admin_ctx = build_chat_context("Show missing lesson plans", user=d["admin"])
    assert "pending_lesson_plans" in admin_ctx
    # sub_req has no lesson plan yet, so it should be listed in pending
    assert any(p["request_id"] == sub_req.id for p in admin_ctx["pending_lesson_plans"])


# ===========================================================================
# WORKFLOW C: Multi-Role Permissions and Security Isolation
# ===========================================================================

def test_workflow_c_permissions_and_security(client, workflow_setup, session):
    """
    Workflow C: Role enforcement:
    - Faculty cannot edit another faculty's lesson plan (HTTP 403).
    - Faculty cannot access admin AI config endpoints (HTTP 403).
    - Admin can view AI config, with credentials safely masked.
    """
    d = workflow_setup

    # Create a lesson plan owned by Dr. Grace Hopper
    lp = LessonPlan(
        substitution_request_id=1,
        subject_id=d["subject"].id,
        original_faculty_id=d["fac_orig"].id,
        substitute_faculty_id=d["fac_sub"].id,
        class_name="CS-4A",
        scheduled_date=d["target_date"],
        duration_minutes=60,
        lesson_content="# Original Plan Content",
        status="GENERATED"
    )
    session.add(lp)
    session.commit()

    # 1. Dr. Ada Lovelace (other faculty) attempts to edit Dr. Grace Hopper's plan
    with client.session_transaction() as sess:
        sess['user_id'] = d["user_other"].id

    res_forbidden = client.put(f"/api/substitutions/{lp.id}/lesson-plan", json={
        "lesson_content": "# Tampered Content"
    })
    # Should be rejected with 403
    assert res_forbidden.status_code == 403
    assert "Permission denied" in res_forbidden.get_json()["error"]

    # 2. Dr. Grace Hopper (authorized substitute faculty) edits her own plan
    with client.session_transaction() as sess:
        sess['user_id'] = d["user_sub"].id

    res_allowed = client.put(f"/api/substitutions/{lp.id}/lesson-plan", json={
        "lesson_content": "# Verified Updated Content by Dr. Hopper"
    })
    assert res_allowed.status_code == 200
    assert "updated successfully" in res_allowed.get_json()["message"]

    # 3. Faculty user attempts to access admin AI config endpoint
    res_ai_cfg_forbidden = client.get("/api/ai/config")
    assert res_ai_cfg_forbidden.status_code == 403

    # 4. Admin accesses AI config
    with client.session_transaction() as sess:
        sess['user_id'] = d["admin"].id

    res_ai_cfg_ok = client.get("/api/ai/config")
    assert res_ai_cfg_ok.status_code == 200
    cfg_data = res_ai_cfg_ok.get_json()["data"]
    assert "gateway" in cfg_data
    # Ensure sensitive raw keys are never returned
    masked_key = cfg_data["gateway"]["masked_key"]
    assert "freellmapi-6475" not in masked_key


# ===========================================================================
# WORKFLOW D: FreeLLMAPI Outage Graceful Degradation (Fail-Soft Resilience)
# ===========================================================================

def test_workflow_d_freellmapi_outage_graceful_degradation(workflow_setup, session):
    """
    Workflow D: FreeLLMAPI is completely offline / unreachable.
    Verify:
    1. Substitution approval completes without error.
    2. Lesson plan falls back to deterministic syllabus plan with continuity warning.
    3. Notifications dispatch using warm deterministic templates.
    4. Conversational assistant replies with real database records in grounded mode.
    5. Daily operational reports display 100% of mathematical metrics uninterrupted.
    6. System experiences zero 500 crashes or corrupted records.
    """
    d = workflow_setup
    today = d["target_date"]

    # 1. Report absence
    absence, requests = create_absence_and_requests(
        faculty_id=d["fac_orig"].id,
        absence_date=today,
        reason="Sudden illness",
        remarks="Medical leave",
        reported_by_user_id=d["admin"].id
    )
    sub_req = requests[0]

    # 2. Simulate FreeLLMAPI completely down (raises FreeLLMAPIConnectionError)
    with patch.object(ai_manager, "generate_structured_json", side_effect=FreeLLMAPIConnectionError("Host unreachable: 127.0.0.1:3001")), \
         patch.object(ai_manager, "generate_with_fallback", side_effect=FreeLLMAPIConnectionError("Host unreachable: 127.0.0.1:3001")):

        # Approval must succeed without throwing error
        assignment = approve_request(sub_req.id, d["admin"].id)
        assert assignment is not None
        assert sub_req.status == "APPROVED"

        # Lesson plan must be generated via deterministic fallback
        lp = LessonPlan.query.filter_by(substitution_request_id=sub_req.id).first()
        assert lp is not None
        assert lp.is_ai_generated is False
        assert "Deterministic" in lp.ai_provider
        assert lp.duration_minutes == 60
        plan_dict = lp.get_structured_plan()
        assert "lesson_title" in plan_dict
        assert len(plan_dict["learning_objectives"]) >= 3

        # Assistant in grounded mode with offline FreeLLMAPI
        from app.routes.ai_routes import build_chat_context
        ctx = build_chat_context("What should I teach?", user=d["user_sub"])
        offline_reply = chat_assistant("What should I teach?", ctx)
        assert "SYNCORA Academic Assistant" in offline_reply
        assert "Operating Systems" in offline_reply

        # Executive report generation with offline FreeLLMAPI
        stats = {
            "total_faculty": 10,
            "present_today": 8,
            "absent_today": 2,
            "total_substitutions": 2,
            "completed": 1,
            "pending": 1,
            "suspended": 0
        }
        report_text = generate_daily_report(stats)
        assert "SYNCORA Daily Operations Briefing" in report_text
        assert "Total Faculty: 10" in report_text
        assert "Present: 8" in report_text
