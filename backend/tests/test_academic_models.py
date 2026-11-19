import pytest
from datetime import date, datetime, time
import json
from app.models.models import (
    Department,
    Faculty,
    Subject,
    User,
    Timetable,
    Absence,
    SubstitutionRequest,
    CourseSyllabus,
    LessonProgress,
    LessonPlan,
    HandoverNote,
    FacultyHandoverNote,
)


def test_course_syllabus_creation_and_serialization(session):
    dept = Department(name="Computer Science", code="CS")
    session.add(dept)
    session.flush()

    subject = Subject(name="Data Structures", code="CS101", department_id=dept.id)
    session.add(subject)
    session.flush()

    syllabus = CourseSyllabus(
        subject_id=subject.id,
        unit_number=1,
        unit_title="Linear Data Structures",
        topics=json.dumps(["Arrays and Dynamic Arrays", "Singly Linked Lists", "Doubly Linked Lists", "Stacks & Queues"]),
        course_outcomes=json.dumps(["CO1: Implement fundamental linear structures", "CO2: Analyze algorithmic complexity"]),
        estimated_hours=12.0,
        learning_objectives="Master operations, complexities, and memory representations of linear structures."
    )
    session.add(syllabus)
    session.commit()

    saved = CourseSyllabus.query.filter_by(subject_id=subject.id, unit_number=1).first()
    assert saved is not None
    assert saved.unit_title == "Linear Data Structures"
    assert len(saved.get_topics()) == 4
    assert "Stacks & Queues" in saved.get_topics()
    assert saved.estimated_hours == 12.0

    d = saved.to_dict()
    assert d['unit_number'] == 1
    assert d['subject_code'] == "CS101"
    assert isinstance(d['topics'], list)
    assert len(d['topics']) == 4
    assert isinstance(d['course_outcomes'], list)


def test_lesson_progress_verification_states(session):
    dept = Department(name="Computer Science", code="CS")
    session.add(dept)
    session.flush()

    sub = Subject(name="Operating Systems", code="CS203", department_id=dept.id)
    fac = Faculty(name="Dr. Priya Sharma", email="priya@syncora.edu", department_id=dept.id, designation="Associate Professor")
    session.add_all([sub, fac])
    session.flush()

    # 1. Verified completed topic
    p1 = LessonProgress(
        subject_id=sub.id,
        faculty_id=fac.id,
        class_name="CS-A",
        section="A",
        unit_number=2,
        topic_name="Process Scheduling Algorithms (FCFS, SJF, Round Robin)",
        status="COMPLETED",
        is_verified=True,
        completion_date=date(2026, 11, 14),
        hours_spent=1.5,
        notes="Covered Gantt charts and waiting time calculations."
    )

    # 2. In-progress topic
    p2 = LessonProgress(
        subject_id=sub.id,
        faculty_id=fac.id,
        class_name="CS-A",
        section="A",
        unit_number=2,
        topic_name="Multi-level Feedback Queues",
        status="IN_PROGRESS",
        is_verified=True,
        completion_date=None,
        hours_spent=0.5,
        notes="Introduction given; numerical examples pending."
    )

    # 3. Unverified / provisional topic
    p3 = LessonProgress(
        subject_id=sub.id,
        faculty_id=fac.id,
        class_name="CS-A",
        section="A",
        unit_number=3,
        topic_name="Deadlock Detection and Recovery",
        status="PLANNED",
        is_verified=False,
        completion_date=None,
        hours_spent=0.0,
        notes="Provisional syllabus topic."
    )

    session.add_all([p1, p2, p3])
    session.commit()

    records = LessonProgress.query.filter_by(subject_id=sub.id).all()
    assert len(records) == 3

    verified = [r for r in records if r.is_verified and r.status == 'COMPLETED']
    in_progress = [r for r in records if r.status == 'IN_PROGRESS']
    unverified = [r for r in records if not r.is_verified]

    assert len(verified) == 1
    assert verified[0].topic_name.startswith("Process Scheduling")
    assert len(in_progress) == 1
    assert len(unverified) == 1

    d = p1.to_dict()
    assert d['is_verified'] is True
    assert d['status'] == 'COMPLETED'
    assert d['faculty_name'] == "Dr. Priya Sharma"
    assert d['completion_date'] == "2026-11-14"


def test_lesson_plan_structured_fields_and_continuity_warning(session):
    dept = Department(name="Computer Science", code="CS")
    session.add(dept)
    session.flush()

    user = User(name="Admin", email="admin@syncora.edu", password_hash="hash", role="admin")
    fac1 = Faculty(name="Dr. Priya Sharma", email="priya@syncora.edu", department_id=dept.id, designation="Associate Professor")
    fac2 = Faculty(name="Dr. Rahul Verma", email="rahul@syncora.edu", department_id=dept.id, designation="Professor")
    sub = Subject(name="Algorithms", code="CS102", department_id=dept.id)
    session.add_all([user, fac1, fac2, sub])
    session.flush()

    tt = Timetable(
        faculty_id=fac1.id,
        subject_id=sub.id,
        department_id=dept.id,
        class_name="CS-A",
        section="A",
        day_of_week="Monday",
        start_time=time(9, 0),
        end_time=time(10, 0)
    )
    session.add(tt)
    session.flush()

    abs_rec = Absence(faculty_id=fac1.id, date=date(2026, 11, 20), reason="Medical leave", reported_by=user.id)
    session.add(abs_rec)
    session.flush()

    sub_req = SubstitutionRequest(
        absence_id=abs_rec.id,
        timetable_id=tt.id,
        date=date(2026, 11, 20),
        recommended_faculty_id=fac2.id,
        status="APPROVED"
    )
    session.add(sub_req)
    session.flush()

    structured_data = {
        "lesson_title": "Divide and Conquer: Merge Sort Analysis",
        "learning_objectives": ["Understand divide and conquer recurrence", "Implement Merge Sort", "Analyze O(n log n) complexity"],
        "topics_to_cover": ["Recurrence relations", "Merge step algorithm", "Recurrence tree method"],
        "prerequisites": ["Arrays", "Recursion basics"],
        "teaching_sequence": ["Intro & recap (10 min)", "Merge algorithm walkthrough (20 min)", "Trace example on chalkboard (15 min)", "Q&A (15 min)"],
        "time_allocation": {"recap": 10, "core_lecture": 35, "activities": 10, "assessment": 5},
        "examples_and_explanations": ["Trace on array [38, 27, 43, 3, 9, 82, 10]"],
        "classroom_activities": ["Divide class into pairs to trace merge step on 4-element sub-arrays"],
        "student_engagement_questions": ["Why is Merge Sort preferable to Quick Sort for linked lists?"],
        "assessment_questions": ["What is the auxiliary space complexity of standard Merge Sort?"],
        "homework": ["Solve recurrence T(n) = 2T(n/2) + cn using master theorem"],
        "required_materials": ["Whiteboard markers", "Lecture slides (Unit 2)"]
    }

    lp = LessonPlan(
        substitution_request_id=sub_req.id,
        subject_id=sub.id,
        original_faculty_id=fac1.id,
        substitute_faculty_id=fac2.id,
        class_name="CS-A",
        section="A",
        scheduled_date=date(2026, 11, 20),
        duration_minutes=60,
        lesson_content="# Divide and Conquer: Merge Sort Analysis\nDetailed plan content...",
        structured_plan=json.dumps(structured_data),
        has_academic_continuity_warning=False,
        is_ai_generated=True,
        ai_provider="Gemini",
        ai_model="gemini-2.0-flash"
    )
    session.add(lp)
    session.commit()

    saved_lp = LessonPlan.query.get(lp.id)
    assert saved_lp is not None
    assert saved_lp.duration_minutes == 60
    assert saved_lp.has_academic_continuity_warning is False
    assert saved_lp.get_structured_plan()["lesson_title"] == "Divide and Conquer: Merge Sort Analysis"
    assert len(saved_lp.get_structured_plan()["learning_objectives"]) == 3

    d = saved_lp.to_dict()
    assert d['structured_plan'] is not None
    assert d['structured_plan']['lesson_title'] == "Divide and Conquer: Merge Sort Analysis"
    assert d['original_faculty_name'] == "Dr. Priya Sharma"
    assert d['substitute_faculty_name'] == "Dr. Rahul Verma"


def test_handover_note_and_alias(session):
    dept = Department(name="Computer Science", code="CS")
    session.add(dept)
    session.flush()

    sub = Subject(name="Database Systems", code="CS201", department_id=dept.id)
    fac = Faculty(name="Prof. Ananya Krishnan", email="ananya@syncora.edu", department_id=dept.id, designation="Assistant Professor")
    session.add_all([sub, fac])
    session.flush()

    # Verify alias FacultyHandoverNote is identical to HandoverNote
    assert FacultyHandoverNote is HandoverNote

    note = FacultyHandoverNote(
        faculty_id=fac.id,
        subject_id=sub.id,
        class_name="CS-A",
        section="A",
        current_unit="Unit 3: Normalization & Functional Dependencies",
        completed_topics=json.dumps(["1NF, 2NF definitions", "Functional dependency inference rules"]),
        current_topic="Boyce-Codd Normal Form (BCNF)",
        next_topics=json.dumps(["Multi-valued dependencies", "4NF and 5NF overview"]),
        pending_assignments="Assignment 3 due this Friday",
        student_notes="Students grasped 2NF well; spend extra time on lossless join decomposition.",
        additional_instructions="Use slide deck 08 uploaded on college portal."
    )
    session.add(note)
    session.commit()

    saved = HandoverNote.query.get(note.id)
    assert saved is not None
    assert saved.current_topic == "Boyce-Codd Normal Form (BCNF)"
    d = saved.to_dict()
    assert d['faculty_name'] == "Prof. Ananya Krishnan"
    assert len(d['completed_topics']) == 2
    assert "Multi-valued dependencies" in d['next_topics']
