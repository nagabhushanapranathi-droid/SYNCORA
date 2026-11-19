import pytest
from datetime import date
from app.models.models import User, Faculty, Department, Attendance


def test_reports_analytics_endpoint(client, session):
    dept = Department(name="Computer Science", code="CS")
    admin = User(name="Admin", email="admin@syncora.edu", password_hash="hash", role="admin")
    fac = Faculty(name="Dr. Priya Sharma", email="priya@syncora.edu", department=dept, designation="Associate Professor")
    att = Attendance(faculty=fac, date=date.today(), status="PRESENT")
    session.add_all([dept, admin, fac, att])
    session.commit()

    with client.session_transaction() as sess:
        sess['user_id'] = admin.id

    res = client.get('/api/reports/analytics')
    assert res.status_code == 200
    data = res.get_json()['data']
    assert 'daily_attendance' in data
    assert 'present_vs_absent' in data
    assert 'department_comparison' in data
    assert 'workload_distribution' in data
    assert len(data['daily_attendance']) == 7

    # Filter with department_id
    res_dept = client.get(f'/api/reports/analytics?department_id={dept.id}')
    assert res_dept.status_code == 200
    data_dept = res_dept.get_json()['data']
    assert data_dept['filter_department_id'] == dept.id


def test_ai_config_endpoints_admin_only(client, session):
    admin = User(name="Admin", email="admin@syncora.edu", password_hash="hash", role="admin")
    fac_user = User(name="Faculty", email="fac@syncora.edu", password_hash="hash", role="faculty")
    session.add_all([admin, fac_user])
    session.commit()

    # 1. Non-admin should be rejected with 403
    with client.session_transaction() as sess:
        sess['user_id'] = fac_user.id

    res_forbidden = client.get('/api/ai/config')
    assert res_forbidden.status_code == 403

    # 2. Admin can view config
    with client.session_transaction() as sess:
        sess['user_id'] = admin.id

    res_admin = client.get('/api/ai/config')
    assert res_admin.status_code == 200
    config_data = res_admin.get_json()['data']
    assert 'primary_provider' in config_data
    assert 'providers' in config_data
    assert any(p['name'] == 'gemini' for p in config_data['providers'])

    # 3. Admin can update primary provider
    res_update = client.post('/api/ai/config', json={'primary_provider': 'gemini', 'fallback_provider': 'freellmapi'})
    assert res_update.status_code == 200

    # 4. Admin can test provider connectivity
    res_test = client.post('/api/ai/test-provider', json={'provider': 'gemini'})
    assert res_test.status_code == 200
    test_result = res_test.get_json()['data']
    assert 'success' in test_result
