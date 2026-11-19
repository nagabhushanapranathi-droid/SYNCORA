from datetime import date, time, datetime, timedelta
import pytest
from app import db
from app.models.models import (
    Department,
    Faculty,
    Subject,
    Attendance,
    Timetable,
    Absence,
    SubstitutionRequest,
    SubstitutionAssignment,
    User,
)
from app.algorithms.allocation import (
    get_substitution_count,
    check_timetable_conflict,
    check_substitution_conflict,
    check_attendance_valid,
    run_allocation,
)


@pytest.fixture
def base_data(app):
    """Setup basic department, subjects, absent faculty, and timetable slot."""
    dept = Department(name="Computer Science", code="CS")
    dept_ec = Department(name="Electronics", code="EC")
    db.session.add_all([dept, dept_ec])
    db.session.flush()

    sub_ds = Subject(name="Data Structures", code="CS101", department_id=dept.id)
    sub_algo = Subject(name="Algorithms", code="CS102", department_id=dept.id)
    sub_ec = Subject(name="Digital Electronics", code="EC101", department_id=dept_ec.id)
    db.session.add_all([sub_ds, sub_algo, sub_ec])
    db.session.flush()

    absent_fac = Faculty(
        name="Dr. Absent Faculty",
        email="absent@syncora.edu",
        department_id=dept.id,
        designation="Associate Professor",
        specialization="Data Structures"
    )
    absent_fac.subjects.append(sub_ds)
    db.session.add(absent_fac)
    db.session.flush()

    # Slot: Monday 09:00 - 10:00
    slot = Timetable(
        faculty_id=absent_fac.id,
        subject_id=sub_ds.id,
        department_id=dept.id,
        class_name="CS-A",
        day_of_week="Monday",
        start_time=time(9, 0),
        end_time=time(10, 0),
        is_active=True
    )
    db.session.add(slot)
    db.session.commit()

    return {
        'dept_cs': dept,
        'dept_ec': dept_ec,
        'sub_ds': sub_ds,
        'sub_algo': sub_algo,
        'sub_ec': sub_ec,
        'absent_fac': absent_fac,
        'slot': slot,
        'test_date': date(2026, 11, 16)  # A Monday
    }


def test_faculty_absent_excluded(base_data):
    """Absent faculty must not be eligible candidates."""
    candidate = Faculty(
        name="Candidate One",
        email="c1@syncora.edu",
        department_id=base_data['dept_cs'].id,
        designation="Assistant Professor"
    )
    db.session.add(candidate)
    db.session.flush()

    att = Attendance(
        faculty_id=candidate.id,
        date=base_data['test_date'],
        status="ABSENT"
    )
    db.session.add(att)
    db.session.commit()

    is_eligible, reason = check_attendance_valid(candidate.id, base_data['test_date'], time(9, 0))
    assert not is_eligible
    assert 'absent' in reason.lower()

    res = run_allocation(base_data['slot'].id, base_data['test_date'], base_data['absent_fac'].id)
    candidate_ids = [c['faculty_id'] for c in res['primary_candidates'] + res['fallback_candidates']]
    assert candidate.id not in candidate_ids


def test_faculty_logged_out_excluded(base_data):
    """Faculty marked as LOGGED_OUT must not be eligible."""
    candidate = Faculty(
        name="Candidate LoggedOut",
        email="c_lo@syncora.edu",
        department_id=base_data['dept_cs'].id,
        designation="Assistant Professor"
    )
    db.session.add(candidate)
    db.session.flush()

    att = Attendance(
        faculty_id=candidate.id,
        date=base_data['test_date'],
        login_time=time(8, 30),
        logout_time=time(8, 50),
        status="LOGGED_OUT"
    )
    db.session.add(att)
    db.session.commit()

    is_eligible, reason = check_attendance_valid(candidate.id, base_data['test_date'], time(9, 0))
    assert not is_eligible
    assert 'logged out' in reason.lower()


def test_faculty_logged_out_before_class_excluded(base_data):
    """Faculty logged out before class starts must be excluded with specific reason."""
    candidate = Faculty(
        name="Candidate LoggedOutEarly",
        email="c_loe@syncora.edu",
        department_id=base_data['dept_cs'].id,
        designation="Assistant Professor"
    )
    db.session.add(candidate)
    db.session.flush()

    att = Attendance(
        faculty_id=candidate.id,
        date=base_data['test_date'],
        login_time=time(8, 0),
        logout_time=time(8, 45),  # Before 09:00
        status="LOGGED_OUT"
    )
    db.session.add(att)
    db.session.commit()

    is_eligible, reason = check_attendance_valid(candidate.id, base_data['test_date'], time(9, 0))
    assert not is_eligible
    assert '08:45' in reason or 'before class' in reason


def test_faculty_logged_out_after_class_start_excluded(base_data):
    """Faculty currently logged out must be excluded even if logout was after class start."""
    candidate = Faculty(
        name="Candidate LoggedOutLate",
        email="c_lol@syncora.edu",
        department_id=base_data['dept_cs'].id,
        designation="Assistant Professor"
    )
    db.session.add(candidate)
    db.session.flush()

    att = Attendance(
        faculty_id=candidate.id,
        date=base_data['test_date'],
        login_time=time(8, 0),
        logout_time=time(11, 0),  # After 09:00
        status="LOGGED_OUT"
    )
    db.session.add(att)
    db.session.commit()

    is_eligible, reason = check_attendance_valid(candidate.id, base_data['test_date'], time(9, 0))
    assert not is_eligible
    assert 'logged out' in reason.lower()


def test_timetable_conflict_excluded(base_data):
    """Faculty with an overlapping lecture on that day must be excluded."""
    candidate = Faculty(
        name="Candidate Busy",
        email="c_busy@syncora.edu",
        department_id=base_data['dept_cs'].id,
        designation="Professor"
    )
    candidate.subjects.append(base_data['sub_ds'])
    db.session.add(candidate)
    db.session.flush()

    att = Attendance(
        faculty_id=candidate.id,
        date=base_data['test_date'],
        login_time=time(8, 30),
        status="PRESENT"
    )
    db.session.add(att)

    # Conflicting class: Monday 09:30 - 10:30 (overlaps with 09:00 - 10:00)
    clash = Timetable(
        faculty_id=candidate.id,
        subject_id=base_data['sub_ds'].id,
        department_id=base_data['dept_cs'].id,
        class_name="CS-B",
        day_of_week="Monday",
        start_time=time(9, 30),
        end_time=time(10, 30),
        is_active=True
    )
    db.session.add(clash)
    db.session.commit()

    has_conflict = check_timetable_conflict(candidate.id, "Monday", time(9, 0), time(10, 0))
    assert has_conflict

    res = run_allocation(base_data['slot'].id, base_data['test_date'], base_data['absent_fac'].id)
    candidate_ids = [c['faculty_id'] for c in res['primary_candidates'] + res['fallback_candidates']]
    assert candidate.id not in candidate_ids


def test_existing_substitution_conflict_excluded(base_data):
    """Faculty already assigned as substitute during this slot must be excluded."""
    candidate = Faculty(
        name="Candidate SubAssigned",
        email="c_sub@syncora.edu",
        department_id=base_data['dept_cs'].id,
        designation="Professor"
    )
    db.session.add(candidate)
    db.session.flush()

    att = Attendance(
        faculty_id=candidate.id,
        date=base_data['test_date'],
        login_time=time(8, 30),
        status="PRESENT"
    )
    db.session.add(att)

    admin = User(name="Admin", email="admin_test@syncora.edu", password_hash="x", role="admin")
    db.session.add(admin)
    db.session.flush()

    absence = Absence(faculty_id=base_data['absent_fac'].id, date=base_data['test_date'], reported_by=admin.id)
    db.session.add(absence)
    db.session.flush()

    sub_req = SubstitutionRequest(
        absence_id=absence.id,
        timetable_id=base_data['slot'].id,
        date=base_data['test_date'],
        status="APPROVED"
    )
    db.session.add(sub_req)
    db.session.flush()

    assignment = SubstitutionAssignment(
        request_id=sub_req.id,
        assigned_faculty_id=candidate.id,
        assigned_by=admin.id
    )
    db.session.add(assignment)
    db.session.commit()

    has_conflict = check_substitution_conflict(candidate.id, base_data['test_date'], time(9, 0), time(10, 0))
    assert has_conflict


def test_subject_expert_ranked_first(base_data):
    """Faculty who teaches the affected subject scores 50 points higher and ranks first."""
    expert = Faculty(
        name="Dr. Expert",
        email="expert@syncora.edu",
        department_id=base_data['dept_cs'].id,
        designation="Associate Professor"
    )
    expert.subjects.append(base_data['sub_ds'])

    non_expert = Faculty(
        name="Dr. NonExpert",
        email="nonexpert@syncora.edu",
        department_id=base_data['dept_cs'].id,
        designation="Associate Professor"
    )
    non_expert.subjects.append(base_data['sub_algo'])

    db.session.add_all([expert, non_expert])
    db.session.flush()

    for f in [expert, non_expert]:
        att = Attendance(faculty_id=f.id, date=base_data['test_date'], login_time=time(8, 30), status="PRESENT")
        db.session.add(att)
    db.session.commit()

    res = run_allocation(base_data['slot'].id, base_data['test_date'], base_data['absent_fac'].id)
    assert res['has_expert']
    assert len(res['primary_candidates']) == 1
    assert res['primary_candidates'][0]['faculty_id'] == expert.id
    assert res['primary_candidates'][0]['score'] >= res['fallback_candidates'][0]['score'] + 50


def test_department_match_adds_20(base_data):
    """Faculty from the same department receives 20 department match points."""
    cs_faculty = Faculty(
        name="Prof. CS Match",
        email="cs_match@syncora.edu",
        department_id=base_data['dept_cs'].id,
        designation="Lecturer"
    )
    ec_faculty = Faculty(
        name="Prof. EC Diff",
        email="ec_diff@syncora.edu",
        department_id=base_data['dept_ec'].id,
        designation="Lecturer"
    )
    db.session.add_all([cs_faculty, ec_faculty])
    db.session.flush()

    for f in [cs_faculty, ec_faculty]:
        att = Attendance(faculty_id=f.id, date=base_data['test_date'], login_time=time(8, 30), status="PRESENT")
        db.session.add(att)
    db.session.commit()

    res = run_allocation(base_data['slot'].id, base_data['test_date'], base_data['absent_fac'].id)
    candidates_by_id = {c['faculty_id']: c for c in res['fallback_candidates']}
    assert candidates_by_id[cs_faculty.id]['breakdown']['department_match'] == 20
    assert candidates_by_id[ec_faculty.id]['breakdown']['department_match'] == 0
    assert candidates_by_id[cs_faculty.id]['score'] == candidates_by_id[ec_faculty.id]['score'] + 20


def test_workload_ranking(base_data):
    """When qualifications are equal, faculty with lower workload rank higher."""
    admin = User(name="Admin", email="admin_wl@syncora.edu", password_hash="x", role="admin")
    db.session.add(admin)
    db.session.flush()

    fac_busy = Faculty(
        name="Prof. High Workload",
        email="high_wl@syncora.edu",
        department_id=base_data['dept_cs'].id,
        designation="Assistant Professor"
    )
    fac_free = Faculty(
        name="Prof. Zero Workload",
        email="zero_wl@syncora.edu",
        department_id=base_data['dept_cs'].id,
        designation="Assistant Professor"
    )
    fac_busy.subjects.append(base_data['sub_ds'])
    fac_free.subjects.append(base_data['sub_ds'])

    db.session.add_all([fac_busy, fac_free])
    db.session.flush()

    for f in [fac_busy, fac_free]:
        att = Attendance(faculty_id=f.id, date=base_data['test_date'], login_time=time(8, 30), status="PRESENT")
        db.session.add(att)

    # Give fac_busy 2 approved substitutions on earlier dates
    for i in range(2):
        abs_rec = Absence(faculty_id=base_data['absent_fac'].id, date=date(2026, 11, 10 + i), reported_by=admin.id)
        db.session.add(abs_rec)
        db.session.flush()
        req = SubstitutionRequest(
            absence_id=abs_rec.id,
            timetable_id=base_data['slot'].id,
            date=date(2026, 11, 10 + i),
            status="APPROVED"
        )
        db.session.add(req)
        db.session.flush()
        assign = SubstitutionAssignment(
            request_id=req.id,
            assigned_faculty_id=fac_busy.id,
            assigned_by=admin.id
        )
        db.session.add(assign)
    db.session.commit()

    res = run_allocation(base_data['slot'].id, base_data['test_date'], base_data['absent_fac'].id)
    assert len(res['primary_candidates']) >= 2
    top_candidate = res['primary_candidates'][0]
    second_candidate = res['primary_candidates'][1]

    assert top_candidate['faculty_id'] == fac_free.id
    assert second_candidate['faculty_id'] == fac_busy.id
    assert top_candidate['score'] > second_candidate['score']


def test_fallback_candidates_when_no_expert(base_data):
    """When no subject experts are available, fallback candidates are populated."""
    other_fac = Faculty(
        name="Prof. Math Only",
        email="math_only@syncora.edu",
        department_id=base_data['dept_ec'].id,
        designation="Lecturer"
    )
    db.session.add(other_fac)
    db.session.flush()

    att = Attendance(
        faculty_id=other_fac.id,
        date=base_data['test_date'],
        login_time=time(8, 30),
        status="PRESENT"
    )
    db.session.add(att)
    db.session.commit()

    res = run_allocation(base_data['slot'].id, base_data['test_date'], base_data['absent_fac'].id)
    assert not res['has_expert']
    assert len(res['primary_candidates']) == 0
    assert len(res['fallback_candidates']) == 1
    assert res['fallback_candidates'][0]['faculty_id'] == other_fac.id


def test_absent_faculty_not_candidate(base_data):
    """Absent faculty cannot be recommended for their own substitution slot."""
    att = Attendance(
        faculty_id=base_data['absent_fac'].id,
        date=base_data['test_date'],
        login_time=time(8, 30),
        status="PRESENT"
    )
    db.session.add(att)
    db.session.commit()

    res = run_allocation(base_data['slot'].id, base_data['test_date'], base_data['absent_fac'].id)
    all_candidate_ids = [c['faculty_id'] for c in res['primary_candidates'] + res['fallback_candidates']]
    assert base_data['absent_fac'].id not in all_candidate_ids


def test_workload_calculation(base_data):
    """Workload count only counts APPROVED and ASSIGNED substitutions."""
    admin = User(name="Admin", email="admin_wc@syncora.edu", password_hash="x", role="admin")
    db.session.add(admin)
    db.session.flush()

    candidate = Faculty(
        name="Prof. Count Test",
        email="count_test@syncora.edu",
        department_id=base_data['dept_cs'].id,
        designation="Lecturer"
    )
    db.session.add(candidate)
    db.session.flush()

    # 1. APPROVED
    abs1 = Absence(faculty_id=base_data['absent_fac'].id, date=date(2026, 11, 1), reported_by=admin.id)
    db.session.add(abs1)
    db.session.flush()
    r1 = SubstitutionRequest(absence_id=abs1.id, timetable_id=base_data['slot'].id, date=date(2026, 11, 1), status="APPROVED")
    db.session.add(r1)
    db.session.flush()
    a1 = SubstitutionAssignment(request_id=r1.id, assigned_faculty_id=candidate.id, assigned_by=admin.id)
    db.session.add(a1)

    # 2. ASSIGNED
    abs2 = Absence(faculty_id=base_data['absent_fac'].id, date=date(2026, 11, 2), reported_by=admin.id)
    db.session.add(abs2)
    db.session.flush()
    r2 = SubstitutionRequest(absence_id=abs2.id, timetable_id=base_data['slot'].id, date=date(2026, 11, 2), status="ASSIGNED")
    db.session.add(r2)
    db.session.flush()
    a2 = SubstitutionAssignment(request_id=r2.id, assigned_faculty_id=candidate.id, assigned_by=admin.id)
    db.session.add(a2)

    # 3. REJECTED (should NOT count)
    abs3 = Absence(faculty_id=base_data['absent_fac'].id, date=date(2026, 11, 3), reported_by=admin.id)
    db.session.add(abs3)
    db.session.flush()
    r3 = SubstitutionRequest(absence_id=abs3.id, timetable_id=base_data['slot'].id, date=date(2026, 11, 3), status="REJECTED")
    db.session.add(r3)
    db.session.flush()
    a3 = SubstitutionAssignment(request_id=r3.id, assigned_faculty_id=candidate.id, assigned_by=admin.id)
    db.session.add(a3)

    db.session.commit()

    count = get_substitution_count(candidate.id)
    assert count == 2
