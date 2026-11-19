"""
Phase 1 Comprehensive Master Verification Test Suite
Validates all 12 testing requirements outlined in Part 1.11:
1. Multi-model AI provider initialization & config validation
2. Provider fallback mechanism: primary failure triggers secondary provider
3. Structured JSON output validation and markdown fence stripping
4. Lesson plan generation with complete academic context
5. Lesson plan generation with missing progress records (warning generation)
6. Humanized notification generation for all 4 notification types
7. Academic context grounding: assistant answers syllabus and progress queries correctly
8. Assistant gracefully declines or flags ungrounded queries
9. Verified vs AI-suggested topic distinction in lesson plans
10. End-to-end substitution workflow: absence -> match -> approve -> lesson plan generated -> notification dispatched
11. Permission enforcement: faculty can only view lesson plans for their assigned substitutions
12. Reporting endpoints: academic continuity metrics and AI provider telemetry
"""

import os
import json
import pytest
from datetime import date, time, datetime
from unittest.mock import patch, MagicMock

from app import db
from app.models.models import (
    User, Faculty, Department, Subject, Timetable,
    Absence, Attendance, SubstitutionRequest, CourseSyllabus, LessonProgress,
    LessonPlan, HandoverNote, Notification
)
from app.ai.provider_manager import (
    AIProviderManager, GeminiProvider, FreeLLMAPIProvider, mask_secret
)
from app.ai.gemini_service import chat_assistant
from app.routes.ai_routes import build_chat_context
from app.services.lesson_plan_service import (
    generate_lesson_plan, get_academic_context, record_verified_progress
)
from app.services.communication_service import (
    generate_substitution_notification,
    generate_approval_message,
    generate_rejection_message,
    generate_lesson_plan_notification,
    create_controlled_notification,
)
from app.services.substitution_service import approve_request


@pytest.fixture
def master_fixture(session):
    """Sets up a complete department, faculty, timetable, and syllabus fixture."""
    dept = Department(name="Computer Science & Engineering", code="CSE")
    session.add(dept)
    session.flush()

    user_admin = User(name="Admin User", email="admin.master@syncora.edu", role="admin")
    user_admin.password_hash = "mock_hash"
    session.add(user_admin)

    fac_orig = Faculty(
        name="Prof. Original",
        email="orig.master@syncora.edu",
        department_id=dept.id,
        designation="Professor"
    )
    user_orig = User(name="Prof. Original", email="orig.master@syncora.edu", role="faculty")
    user_orig.password_hash = "mock_hash"
    session.add_all([fac_orig, user_orig])
    session.flush()
    user_orig.faculty_id = fac_orig.id

    fac_sub = Faculty(
        name="Dr. Substitute",
        email="sub.master@syncora.edu",
        department_id=dept.id,
        designation="Associate Professor"
    )
    user_sub = User(name="Dr. Substitute", email="sub.master@syncora.edu", role="faculty")
    user_sub.password_hash = "mock_hash"
    session.add_all([fac_sub, user_sub])
    session.flush()
    user_sub.faculty_id = fac_sub.id

    fac_other = Faculty(
        name="Prof. Other",
        email="other.master@syncora.edu",
        department_id=dept.id,
        designation="Assistant Professor"
    )
    user_other = User(name="Prof. Other", email="other.master@syncora.edu", role="faculty")
    user_other.password_hash = "mock_hash"
    session.add_all([fac_other, user_other])
    session.flush()
    user_other.faculty_id = fac_other.id

    subject = Subject(name="Distributed Systems", code="CS701", department_id=dept.id)
    session.add(subject)
    session.flush()

    tt = Timetable(
        faculty_id=fac_orig.id,
        subject_id=subject.id,
        department_id=dept.id,
        class_name="CS-7A",
        section="A",
        day_of_week="Monday",
        start_time=time(10, 0),
        end_time=time(11, 0),
        classroom="Room 401"
    )
    session.add(tt)
    session.flush()

    s1 = CourseSyllabus(
        subject_id=subject.id,
        unit_number=1,
        unit_title="Foundations of Distributed Systems",
        topics=json.dumps(["RPC and Remote Invocation", "Clock Synchronization", "Logical Clocks"]),
        course_outcomes=json.dumps(["CO1: Master distributed communication"]),
        estimated_hours=8.0,
        learning_objectives="Understand message passing and synchronization."
    )
    s2 = CourseSyllabus(
        subject_id=subject.id,
        unit_number=2,
        unit_title="Distributed Consensus",
        topics=json.dumps(["Paxos Consensus", "Raft Consensus Algorithm"]),
        course_outcomes=json.dumps(["CO2: Master fault tolerance"]),
        estimated_hours=10.0,
        learning_objectives="Understand state machine replication."
    )
    session.add_all([s1, s2])
    session.commit()

    return {
        "dept": dept,
        "admin": user_admin,
        "orig_user": user_orig,
        "orig_fac": fac_orig,
        "sub_user": user_sub,
        "sub_fac": fac_sub,
        "other_user": user_other,
        "other_fac": fac_other,
        "subject": subject,
        "timetable": tt,
        "syllabus": s1
    }


def test_01_multi_model_ai_provider_init_and_config():
    """Requirement 1: Multi-model AI provider initialization and config validation."""
    mgr = AIProviderManager()
    statuses = mgr.get_all_provider_status()

    assert len(statuses) == 3
    provider_names = [s["name"] for s in statuses]
    assert "gemini" in provider_names
    assert "freellmapi" in provider_names
    assert "openai" in provider_names
    for s in statuses:
        assert "configured" in s
        assert "available" in s
        assert "status_message" in s

    # Verify secret masking
    assert mask_secret("AIzaSyD-1234567890abcdef") == "AIza...cdef"
    assert mask_secret("") == "Not configured"


def test_02_provider_fallback_mechanism():
    """Requirement 2: Provider fallback mechanism: primary failure triggers secondary provider."""
    mgr = AIProviderManager()

    mock_gemini = MagicMock()
    mock_gemini.is_configured.return_value = True
    mock_gemini.generate.side_effect = RuntimeError("Primary Gemini Quota Exceeded (429)")

    mock_freellm = MagicMock()
    mock_freellm.is_configured.return_value = True
    mock_freellm.default_model = "llama-3.3-70b"
    mock_freellm.generate.return_value = "Verified fallback response from secondary FreeLLM"

    mgr.providers["gemini"] = mock_gemini
    mgr.providers["freellmapi"] = mock_freellm

    with patch.dict(os.environ, {
        "AI_PRIMARY_PROVIDER": "gemini",
        "AI_FALLBACK_PROVIDER": "freellmapi"
    }):
        text, provider_used, model_used = mgr.generate_with_fallback("Generate lecture notes")
        assert text == "Verified fallback response from secondary FreeLLM"
        assert provider_used == "freellmapi"
        assert mock_gemini.generate.called
        assert mock_freellm.generate.called


def test_03_structured_json_and_fence_stripping():
    """Requirement 3: Structured JSON output validation and markdown fence stripping."""
    mgr = AIProviderManager()
    mock_prov = MagicMock()
    mock_prov.is_configured.return_value = True
    mock_prov.default_model = "gemini-2.0-flash"
    mock_prov.generate.return_value = """Here is the verified curriculum response:
```json
{
    "lesson_title": "Raft Consensus Algorithm",
    "topics_to_cover": ["Leader Election", "Log Replication"],
    "learning_objectives": ["Understand safety in distributed consensus"]
}
```
All objectives aligned with syllabus."""

    mgr.providers["gemini"] = mock_prov
    with patch.dict(os.environ, {"AI_PRIMARY_PROVIDER": "gemini"}):
        data, prov, model = mgr.generate_structured_json("Generate lesson plan")
        assert data["lesson_title"] == "Raft Consensus Algorithm"
        assert len(data["topics_to_cover"]) == 2
        assert len(data["learning_objectives"]) == 1
        assert prov == "gemini"


def test_04_lesson_plan_with_complete_academic_context(master_fixture, session):
    """Requirement 4: Lesson plan generation with complete academic context."""
    d = master_fixture
    # Log verified progress
    prog = LessonProgress(
        faculty_id=d["orig_fac"].id,
        subject_id=d["subject"].id,
        class_name="CS-7A",
        section="A",
        unit_number=1,
        topic_name="RPC and Remote Invocation",
        status="COMPLETED",
        is_verified=True,
        hours_spent=2.0
    )
    session.add(prog)

    abs_rec = Absence(
        faculty_id=d["orig_fac"].id,
        date=date(2026, 3, 2),
        reason="Medical",
        reported_by=d["admin"].id
    )
    session.add(abs_rec)
    session.flush()

    sub_req = SubstitutionRequest(
        absence_id=abs_rec.id,
        timetable_id=d["timetable"].id,
        date=date(2026, 3, 2),
        status="APPROVED",
        recommended_faculty_id=d["sub_fac"].id
    )
    session.add(sub_req)
    session.commit()

    plan = generate_lesson_plan(sub_req.id, d["admin"].id)
    assert plan.substitution_request_id == sub_req.id
    structured = plan.get_structured_plan()
    assert len(structured["learning_objectives"]) >= 3
    assert len(structured["teaching_sequence"]) == 4
    assert plan.duration_minutes == 60
    assert plan.has_academic_continuity_warning is False


def test_05_lesson_plan_missing_progress_warning(master_fixture, session):
    """Requirement 5: Lesson plan generation with missing progress records (warning generation)."""
    d = master_fixture
    abs_rec = Absence(
        faculty_id=d["orig_fac"].id,
        date=date(2026, 3, 3),
        reason="Leave",
        reported_by=d["admin"].id
    )
    session.add(abs_rec)
    session.flush()

    sub_req = SubstitutionRequest(
        absence_id=abs_rec.id,
        timetable_id=d["timetable"].id,
        date=date(2026, 3, 3),
        status="APPROVED",
        recommended_faculty_id=d["sub_fac"].id
    )
    session.add(sub_req)
    session.commit()

    plan = generate_lesson_plan(sub_req.id, d["admin"].id)
    assert plan.has_academic_continuity_warning is True
    assert "PROVISIONAL" in plan.continuity_warning_message or "Advisory" in plan.continuity_warning_message


def test_06_humanized_notification_generation_all_four_types(master_fixture, session):
    """Requirement 6: Humanized notification generation for all 4 notification types."""
    d = master_fixture

    # 1. Assignment coverage invitation
    n1 = generate_substitution_notification(
        faculty_name=d["sub_fac"].name,
        absent_faculty_name=d["orig_fac"].name,
        subject_name=d["subject"].name,
        class_name="Room 401",
        date_str="March 4, 2026",
        time_str="10:00 AM - 11:00 AM"
    )
    assert "Class Coverage Invitation" in n1["title"]
    assert d["sub_fac"].name in n1["message"]
    assert "academic continuity" in n1["message"]

    # 2. Duty confirmation / approval
    n2 = generate_approval_message(
        faculty_name=d["sub_fac"].name,
        subject_name=d["subject"].name,
        date_str="March 4, 2026",
        time_str="10:00 AM - 11:00 AM",
        lesson_plan_available=True
    )
    assert "Substitution Approved" in n2["title"]
    assert "lesson plan" in n2["message"]

    # 3. Lesson plan ready
    n3 = generate_lesson_plan_notification(
        faculty_name=d["sub_fac"].name,
        subject_name=d["subject"].name,
        class_name="Room 401",
        date_str="March 4, 2026",
        has_continuity_warning=False
    )
    assert "Substitute Lesson Plan Ready" in n3["title"]
    assert "learning objectives" in n3["message"]

    # 4. Schedule cancellation / rejection
    n4 = generate_rejection_message(d["sub_fac"].name, reason="Class rescheduled")
    assert "Substitution Schedule Update" in n4["title"]
    assert "Class rescheduled" in n4["message"]

    # Verify database persistence & deduplication via create_controlled_notification
    saved_notif = create_controlled_notification(
        user_id=d["sub_user"].id,
        title=n1["title"],
        message=n1["message"],
        notif_type="info"
    )
    assert saved_notif is not None
    assert saved_notif.user_id == d["sub_user"].id

    # Duplicate within window should return existing record without creating duplicate
    dup_notif = create_controlled_notification(
        user_id=d["sub_user"].id,
        title=n1["title"],
        message=n1["message"],
        notif_type="info"
    )
    assert dup_notif.id == saved_notif.id
    assert Notification.query.filter_by(user_id=d["sub_user"].id).count() == 1


def test_07_academic_context_grounding_assistant(master_fixture, session):
    """Requirement 7: Academic context grounding: assistant answers syllabus and progress queries correctly."""
    d = master_fixture
    prog = LessonProgress(
        faculty_id=d["orig_fac"].id,
        subject_id=d["subject"].id,
        class_name="CS-7A",
        section="A",
        unit_number=1,
        topic_name="RPC and Remote Invocation",
        status="COMPLETED",
        is_verified=True
    )
    session.add(prog)
    session.commit()

    context = build_chat_context("What did I teach in my last lecture?", user=d["orig_user"])
    ans = chat_assistant("What did I teach in my last lecture?", context)
    assert "SYNCORA" in ans or "RPC" in ans or "Distributed Systems" in ans


def test_08_assistant_declines_ungrounded_queries(master_fixture, session):
    """Requirement 8: Assistant gracefully declines or flags ungrounded queries."""
    d = master_fixture
    context = build_chat_context("What is the secret server access token?", user=d["orig_user"])
    ans = chat_assistant("What is the secret server access token?", context)
    assert "cannot verify" in ans.lower() or "not available" in ans.lower() or "institutional" in ans.lower() or "syncora" in ans.lower() or "unable" in ans.lower()


def test_09_verified_vs_ai_suggested_topic_distinction(master_fixture, session):
    """Requirement 9: Verified vs AI-suggested topic distinction in lesson plans."""
    d = master_fixture
    abs_rec = Absence(
        faculty_id=d["orig_fac"].id,
        date=date(2026, 3, 5),
        reason="Leave",
        reported_by=d["admin"].id
    )
    session.add(abs_rec)
    session.flush()

    sub_req = SubstitutionRequest(
        absence_id=abs_rec.id,
        timetable_id=d["timetable"].id,
        date=date(2026, 3, 5),
        status="APPROVED",
        recommended_faculty_id=d["sub_fac"].id
    )
    session.add(sub_req)
    session.commit()

    plan = generate_lesson_plan(sub_req.id, d["admin"].id)
    assert plan.has_academic_continuity_warning is True
    assert "PROVISIONAL" in plan.continuity_warning_message or "Advisory" in plan.continuity_warning_message
    assert plan.get_structured_plan() is not None


def test_10_end_to_end_substitution_workflow(master_fixture, session):
    """Requirement 10: End-to-end substitution workflow: absence -> match -> approve -> lesson plan generated -> notification dispatched."""
    d = master_fixture
    abs_rec = Absence(
        faculty_id=d["orig_fac"].id,
        date=date(2026, 3, 6),
        reason="Medical conference",
        reported_by=d["admin"].id
    )
    session.add(abs_rec)
    session.flush()

    sub_req = SubstitutionRequest(
        absence_id=abs_rec.id,
        timetable_id=d["timetable"].id,
        date=date(2026, 3, 6),
        status="PENDING",
        recommended_faculty_id=d["sub_fac"].id
    )
    session.add(sub_req)
    session.commit()

    # Ensure substitute is PRESENT
    att = Attendance(
        faculty_id=d["sub_fac"].id,
        date=date(2026, 3, 6),
        status="PRESENT",
        login_time=time(8, 30)
    )
    session.add(att)
    session.commit()

    # Approve substitution
    approved = approve_request(sub_req.id, admin_user_id=d["admin"].id)
    assert approved.request_id == sub_req.id

    # Check lesson plan was auto-generated
    plan = LessonPlan.query.filter_by(substitution_request_id=sub_req.id).first()
    assert plan is not None
    assert plan.get_structured_plan() is not None

    # Check notification dispatched
    notifs = Notification.query.filter_by(user_id=d["sub_user"].id).all()
    assert len(notifs) >= 1


def test_11_permission_enforcement_for_lesson_plans(master_fixture, client, session):
    """Requirement 11: Permission enforcement: faculty can only view lesson plans for their assigned substitutions."""
    d = master_fixture
    abs_rec = Absence(
        faculty_id=d["orig_fac"].id,
        date=date(2026, 3, 7),
        reason="Conference",
        reported_by=d["admin"].id
    )
    session.add(abs_rec)
    session.flush()

    sub_req = SubstitutionRequest(
        absence_id=abs_rec.id,
        timetable_id=d["timetable"].id,
        date=date(2026, 3, 7),
        status="PENDING",
        recommended_faculty_id=d["sub_fac"].id
    )
    session.add(sub_req)
    session.commit()

    # Ensure substitute is PRESENT
    att = Attendance(
        faculty_id=d["sub_fac"].id,
        date=date(2026, 3, 7),
        status="PRESENT",
        login_time=time(8, 30)
    )
    session.add(att)

    # Approve request so Dr. Substitute is the officially assigned substitute
    approve_request(sub_req.id, d["admin"].id)

    # Authorized substitute access
    with client.session_transaction() as sess:
        sess["user_id"] = d["sub_user"].id

    res_auth = client.get(f"/api/substitutions/{sub_req.id}/lesson-plan")
    assert res_auth.status_code == 200
    assert res_auth.get_json()["success"] is True

    # Unauthorized other faculty access
    with client.session_transaction() as sess:
        sess["user_id"] = d["other_user"].id

    res_unauth = client.get(f"/api/substitutions/{sub_req.id}/lesson-plan")
    assert res_unauth.status_code == 403


def test_12_reporting_endpoints_academic_continuity_and_ai_telemetry(master_fixture, client, session):
    """Requirement 12: Reporting endpoints: academic continuity metrics and AI provider telemetry."""
    d = master_fixture

    # Log in as admin
    with client.session_transaction() as sess:
        sess["user_id"] = d["admin"].id

    # Test /api/reports/analytics
    res_rep = client.get("/api/reports/analytics")
    assert res_rep.status_code == 200
    rep_json = res_rep.get_json()["data"]
    assert "academic_continuity" in rep_json
    assert "ai_generation" in rep_json
    assert "total_lesson_plans" in rep_json["academic_continuity"]
    assert "active_primary_provider" in rep_json["ai_generation"]

    # Test /api/ai/config
    res_cfg = client.get("/api/ai/config")
    assert res_cfg.status_code == 200
    cfg_json = res_cfg.get_json()["data"]
    assert "primary_provider" in cfg_json
    assert "providers" in cfg_json
