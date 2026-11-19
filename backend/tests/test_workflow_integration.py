import pytest
import json
from datetime import date, time, datetime
from app.models.models import (
    Department,
    Faculty,
    Subject,
    User,
    Attendance,
    Timetable,
    Absence,
    SubstitutionRequest,
    SubstitutionAssignment,
    CourseSyllabus,
    LessonProgress,
    LessonPlan,
    HandoverNote,
    Notification,
)
from app.services.substitution_service import approve_request, manual_assign_request


@pytest.fixture
def workflow_setup(session):
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

    # Syllabus
    syllabus = CourseSyllabus(
        subject_id=sub.id,
        unit_number=1,
        unit_title="Linear Structures",
        topics=json.dumps(["Arrays", "Linked Lists", "Stacks", "Queues"])
    )
    session.add(syllabus)

    # Attendance: substitute is PRESENT
    today = date(2026, 11, 23)
    att1 = Attendance(faculty_id=fac1.id, date=today, status="ABSENT")
    att2 = Attendance(faculty_id=fac2.id, date=today, status="PRESENT", login_time=time(8, 30))
    session.add_all([att1, att2])

    # Timetable slot for Dr. Priya Sharma on Monday 10:00 - 11:00
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

    # Absence for Dr. Priya Sharma
    abs_rec = Absence(
        faculty_id=fac1.id,
        date=today,
        reason="Medical Consultation",
        reported_by=admin.id
    )
    session.add(abs_rec)
    session.flush()

    # Substitution Request
    sub_req = SubstitutionRequest(
        absence_id=abs_rec.id,
        timetable_id=tt.id,
        date=today,
        recommended_faculty_id=fac2.id,
        recommendation_score=90.0,
        status="RECOMMENDED"
    )
    session.add(sub_req)
    session.commit()

    return {
        'dept': dept,
        'admin': admin,
        'user1': user1,
        'user2': user2,
        'fac1': fac1,
        'fac2': fac2,
        'sub': sub,
        'timetable': tt,
        'request': sub_req
    }


def test_approve_request_triggers_lesson_plan_and_notifications(workflow_setup, session):
    sub_req = workflow_setup['request']
    admin = workflow_setup['admin']
    fac2 = workflow_setup['fac2']
    user2 = workflow_setup['user2']

    # Initial state: no lesson plan, no notifications
    assert LessonPlan.query.filter_by(substitution_request_id=sub_req.id).count() == 0
    assert Notification.query.filter_by(user_id=user2.id).count() == 0

    # 1. Admin approves substitution
    assignment = approve_request(sub_req.id, admin.id)

    # 2. Verify substitution status updated
    assert sub_req.status == "APPROVED"
    assert assignment.assigned_faculty_id == fac2.id

    # 3. Verify Lesson Plan was automatically generated and persisted in SQLite
    plan = LessonPlan.query.filter_by(substitution_request_id=sub_req.id).first()
    assert plan is not None
    assert plan.duration_minutes == 60
    assert plan.substitute_faculty_id == fac2.id
    assert plan.original_faculty_id == workflow_setup['fac1'].id
    assert plan.structured_plan is not None
    assert len(plan.get_structured_plan()["learning_objectives"]) >= 3

    # 4. Verify Humanized Notifications dispatched to substitute faculty
    notifs = Notification.query.filter_by(user_id=user2.id).all()
    assert len(notifs) >= 1
    titles = [n.title for n in notifs]
    assert any("Class Coverage Invitation" in t for t in titles)


def test_api_lesson_plan_and_progress_flow(client, workflow_setup, session):
    sub_req = workflow_setup['request']
    admin = workflow_setup['admin']
    user2 = workflow_setup['user2']
    fac2 = workflow_setup['fac2']

    # Approve request first
    approve_request(sub_req.id, admin.id)

    # Login as substitute faculty user2
    with client.session_transaction() as sess:
        sess['user_id'] = user2.id

    # GET /api/substitutions/<id>/lesson-plan
    res = client.get(f"/api/substitutions/{sub_req.id}/lesson-plan")
    assert res.status_code == 200
    data = res.get_json()['data']
    assert data['duration_minutes'] == 60
    assert data['substitute_faculty_id'] == fac2.id

    # PUT /api/substitutions/<id>/lesson-plan (substitute updates post-class notes)
    update_payload = {
        'teaching_notes': "Walked through linked list node deletion on chalkboard.",
        'feedback': "Class understood pointer manipulations well.",
        'topics_completed': ["Linked Lists: Node Deletion"],
        'status': "COMPLETED"
    }
    res_update = client.put(f"/api/substitutions/{sub_req.id}/lesson-plan", json=update_payload)
    assert res_update.status_code == 200
    assert res_update.get_json()['data']['status'] == "COMPLETED"

    # POST /api/substitutions/<id>/progress (record official verified progress)
    prog_payload = {
        'topic_name': "Linked Lists: Node Deletion",
        'unit_number': 1,
        'status': "COMPLETED",
        'hours_spent': 1.0,
        'notes': "Substitute lecture successfully conducted"
    }
    res_prog = client.post(f"/api/substitutions/{sub_req.id}/progress", json=prog_payload)
    assert res_prog.status_code == 200
    assert res_prog.get_json()['data']['is_verified'] is True
    assert res_prog.get_json()['data']['topic_name'] == "Linked Lists: Node Deletion"


def test_permission_enforcement_for_other_faculty(client, workflow_setup, session):
    sub_req = workflow_setup['request']
    admin = workflow_setup['admin']
    approve_request(sub_req.id, admin.id)

    # Create unrelated 3rd faculty member
    dept = workflow_setup['dept']
    fac3 = Faculty(name="Dr. Suresh Nair", email="suresh@syncora.edu", department_id=dept.id, designation="Professor")
    user3 = User(name="Dr. Suresh Nair", email="suresh@syncora.edu", password_hash="hash", role="faculty")
    session.add_all([fac3, user3])
    session.flush()
    user3.faculty_id = fac3.id
    session.commit()

    # Login as user3 (unrelated faculty)
    with client.session_transaction() as sess:
        sess['user_id'] = user3.id

    # Attempt to view lesson plan of Dr. Priya Sharma / Dr. Rahul Verma
    res = client.get(f"/api/substitutions/{sub_req.id}/lesson-plan")
    assert res.status_code == 403
    assert "permission" in (res.get_json().get('error') or '').lower()

    # Attempt to edit someone else's lesson plan
    res_edit = client.put(f"/api/substitutions/{sub_req.id}/lesson-plan", json={'teaching_notes': "Hacked notes"})
    assert res_edit.status_code == 403
