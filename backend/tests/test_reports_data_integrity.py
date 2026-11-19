"""Reports must be derived from stored records only (frontend mastery phase fixes)."""
from datetime import date, time

from app.models.models import (
    User,
    Faculty,
    Department,
    Subject,
    Timetable,
    Absence,
    SubstitutionRequest,
)


def _admin_client(client, session):
    admin = User(name="Admin", email="admin@syncora.edu", password_hash="hash", role="admin")
    session.add(admin)
    session.commit()
    with client.session_transaction() as sess:
        sess['user_id'] = admin.id
    return admin


def test_affected_slots_empty_without_requests(client, session):
    _admin_client(client, session)
    res = client.get('/api/reports/analytics')
    assert res.status_code == 200
    # Previously a hardcoded list was returned regardless of data.
    assert res.get_json()['data']['frequently_affected_slots'] == []


def test_affected_slots_count_real_requests(client, session):
    admin = _admin_client(client, session)
    dept = Department(name="Computer Science", code="CS")
    subj = Subject(name="Algorithms", code="CS102", department=dept)
    fac = Faculty(name="Dr. Rahul Verma", email="rahul@syncora.edu", department=dept, designation="Professor")
    session.add_all([dept, subj, fac])
    session.flush()
    slot = Timetable(
        faculty_id=fac.id, subject_id=subj.id, department_id=dept.id, class_name="CS-A",
        day_of_week="Monday", start_time=time(10, 0), end_time=time(11, 0),
    )
    absence = Absence(faculty_id=fac.id, date=date.today(), reason="Medical leave", reported_by=admin.id)
    session.add_all([slot, absence])
    session.flush()
    session.add_all([
        SubstitutionRequest(absence_id=absence.id, timetable_id=slot.id, date=date.today(), status='PENDING'),
        SubstitutionRequest(absence_id=absence.id, timetable_id=slot.id, date=date.today(), status='APPROVED'),
    ])
    session.commit()

    data = client.get('/api/reports/analytics').get_json()['data']
    assert data['frequently_affected_slots'] == [{'hour': '10:00 - 11:00', 'affected_count': 2}]

    # A department filter that excludes the class removes it.
    other = Department(name="Physics", code="PHY")
    session.add(other)
    session.commit()
    data_other = client.get(f'/api/reports/analytics?department_id={other.id}').get_json()['data']
    assert data_other['frequently_affected_slots'] == []


def test_ai_usage_totals_read_provider_counters(client, session, monkeypatch):
    _admin_client(client, session)
    fake = {
        'freellmapi': {'calls': 3, 'successes': 1, 'failures': 2, 'prompt_tokens': 0, 'completion_tokens': 0},
        'gemini': {'calls': 0, 'successes': 0, 'failures': 0, 'prompt_tokens': 0, 'completion_tokens': 0},
    }
    monkeypatch.setattr('app.routes.reports._USAGE_METRICS', fake)
    gen = client.get('/api/reports/analytics').get_json()['data']['ai_generation']
    assert gen['ai_requests'] == 3
    assert gen['ai_successes'] == 1
    assert gen['ai_failures'] == 2
