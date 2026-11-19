from datetime import date, datetime
from typing import List, Dict, Any, Tuple
from app import db
from app.models.models import (
    Absence,
    SubstitutionRequest,
    SubstitutionAssignment,
    Timetable,
    Faculty,
    Attendance,
)
from app.utils.helpers import get_day_of_week
from app.algorithms.allocation import (
    run_allocation,
    check_attendance_valid,
    check_timetable_conflict,
    check_substitution_conflict,
)
from app.ai.gemini_service import explain_recommendation
from app.services.notification_service import notify_faculty_assignment


def create_absence_and_requests(
    faculty_id: int,
    absence_date: date,
    reason: str,
    remarks: str,
    reported_by_user_id: int
) -> Tuple[Absence, List[SubstitutionRequest]]:
    """Report an absence, mark attendance, and generate substitution requests."""
    # 1. Create Absence
    absence = Absence(
        faculty_id=faculty_id,
        date=absence_date,
        reason=reason,
        remarks=remarks,
        reported_by=reported_by_user_id
    )
    db.session.add(absence)
    db.session.flush()  # populate absence.id
    
    # 2. Mark Attendance as ABSENT
    att = Attendance.query.filter_by(faculty_id=faculty_id, date=absence_date).first()
    if not att:
        att = Attendance(
            faculty_id=faculty_id,
            date=absence_date,
            status='ABSENT',
            notes=f'Reported absence: {reason or "No reason given"}'
        )
        db.session.add(att)
    else:
        att.status = 'ABSENT'
        att.notes = f'Reported absence: {reason or "No reason given"}'
    
    # 3. Find affected timetable entries for that faculty on this day_of_week
    day_name = get_day_of_week(absence_date)
    affected_slots = Timetable.query.filter_by(
        faculty_id=faculty_id,
        day_of_week=day_name,
        is_active=True
    ).order_by(Timetable.start_time).all()
    
    created_requests = []
    for slot in affected_slots:
        sub_req = SubstitutionRequest(
            absence_id=absence.id,
            timetable_id=slot.id,
            date=absence_date,
            status='PENDING'
        )
        db.session.add(sub_req)
        db.session.flush()  # populate sub_req.id
        
        # Run allocation algorithm
        allocation_res = run_allocation(slot.id, absence_date, faculty_id)
        candidates = allocation_res.get('primary_candidates', []) + allocation_res.get('fallback_candidates', [])
        sub_req.set_all_candidates(candidates)
        
        if candidates:
            top = candidates[0]
            sub_req.recommended_faculty_id = top['faculty_id']
            sub_req.recommendation_score = top['score']
            sub_req.status = 'RECOMMENDED'
            try:
                sub_req.ai_explanation = explain_recommendation(sub_req.to_dict(), candidates)
            except Exception:
                sub_req.ai_explanation = f"Recommended {top['faculty_name']} with suitability score {top['score']}/100."
        else:
            sub_req.status = 'PENDING'
            sub_req.ai_explanation = "No eligible faculty candidates available for this slot."
            
        created_requests.append(sub_req)
        
    db.session.commit()
    return absence, created_requests


def approve_request(request_id: int, admin_user_id: int) -> SubstitutionAssignment:
    """Approve the recommended candidate for a substitution request."""
    sub_req = SubstitutionRequest.query.get(request_id)
    if not sub_req:
        raise ValueError("Substitution request not found")
    if not sub_req.recommended_faculty_id:
        raise ValueError("No recommended candidate to approve")
    
    timetable = sub_req.timetable
    rec_id = sub_req.recommended_faculty_id
    
    # Verify candidate is still eligible
    is_present, reason = check_attendance_valid(rec_id, sub_req.date, timetable.start_time)
    if not is_present:
        raise ValueError(f"Recommended faculty is no longer eligible: {reason}")
    if check_timetable_conflict(rec_id, timetable.day_of_week, timetable.start_time, timetable.end_time):
        raise ValueError("Recommended faculty has a timetable conflict")
    if check_substitution_conflict(rec_id, sub_req.date, timetable.start_time, timetable.end_time):
        raise ValueError("Recommended faculty has an overlapping substitution assignment")
        
    assignment = SubstitutionAssignment.query.filter_by(request_id=sub_req.id).first()
    if not assignment:
        assignment = SubstitutionAssignment(
            request_id=sub_req.id,
            assigned_faculty_id=rec_id,
            assigned_by=admin_user_id,
            assigned_at=datetime.utcnow()
        )
        db.session.add(assignment)
    else:
        assignment.assigned_faculty_id = rec_id
        assignment.assigned_by = admin_user_id
        assignment.assigned_at = datetime.utcnow()
        assignment.is_acknowledged = False
        assignment.acknowledged_at = None
        
    sub_req.status = 'APPROVED'
    db.session.commit()

    # Step 1: Automated Lesson Plan Generation with safe error boundary
    try:
        from app.services.lesson_plan_service import generate_lesson_plan
        generate_lesson_plan(sub_req.id, admin_user_id)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Lesson plan generation warning for request #{sub_req.id}: {e}")

    # Step 2: Coordinated Humanized Faculty Notifications
    try:
        from app.services.communication_service import dispatch_substitution_notifications
        dispatch_substitution_notifications(sub_req, is_approved=True)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Notification dispatch warning for request #{sub_req.id}: {e}")

    return assignment


def manual_assign_request(request_id: int, faculty_id: int, admin_user_id: int, notes: str = None) -> SubstitutionAssignment:
    """Manually assign a specific faculty to a substitution request."""
    sub_req = SubstitutionRequest.query.get(request_id)
    if not sub_req:
        raise ValueError("Substitution request not found")
    
    timetable = sub_req.timetable
    
    # Validate eligibility
    is_present, reason = check_attendance_valid(faculty_id, sub_req.date, timetable.start_time)
    if not is_present:
        raise ValueError(f"Candidate is not eligible: {reason}")
    if check_timetable_conflict(faculty_id, timetable.day_of_week, timetable.start_time, timetable.end_time):
        raise ValueError("Candidate has a timetable conflict during this slot")
    if check_substitution_conflict(faculty_id, sub_req.date, timetable.start_time, timetable.end_time):
        raise ValueError("Candidate already has another approved substitution during this slot")
        
    assignment = SubstitutionAssignment.query.filter_by(request_id=sub_req.id).first()
    if not assignment:
        assignment = SubstitutionAssignment(
            request_id=sub_req.id,
            assigned_faculty_id=faculty_id,
            assigned_by=admin_user_id,
            notes=notes,
            assigned_at=datetime.utcnow()
        )
        db.session.add(assignment)
    else:
        assignment.assigned_faculty_id = faculty_id
        assignment.assigned_by = admin_user_id
        assignment.notes = notes
        assignment.assigned_at = datetime.utcnow()
        assignment.is_acknowledged = False
        assignment.acknowledged_at = None
        
    sub_req.recommended_faculty_id = faculty_id
    sub_req.status = 'ASSIGNED'
    db.session.commit()

    # Step 1: Automated Lesson Plan Generation with safe error boundary
    try:
        from app.services.lesson_plan_service import generate_lesson_plan
        generate_lesson_plan(sub_req.id, admin_user_id)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Lesson plan generation warning for request #{sub_req.id}: {e}")

    # Step 2: Coordinated Humanized Faculty Notifications
    try:
        from app.services.communication_service import dispatch_substitution_notifications
        dispatch_substitution_notifications(sub_req, is_approved=True)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Notification dispatch warning for request #{sub_req.id}: {e}")

    return assignment


def reject_request(request_id: int) -> SubstitutionRequest:
    sub_req = SubstitutionRequest.query.get(request_id)
    if not sub_req:
        raise ValueError("Substitution request not found")
    sub_req.status = 'REJECTED'
    db.session.commit()

    # Dispatch rejection notification
    try:
        if sub_req.recommended_faculty and sub_req.recommended_faculty.user:
            from app.services.communication_service import generate_rejection_message, create_controlled_notification
            rej = generate_rejection_message(sub_req.recommended_faculty.name)
            create_controlled_notification(
                user_id=sub_req.recommended_faculty.user.id,
                title=rej['title'],
                message=rej['message'],
                notif_type=rej['type'],
                related_request_id=sub_req.id
            )
    except Exception as e:
        pass

    return sub_req


def suspend_request(request_id: int) -> SubstitutionRequest:
    sub_req = SubstitutionRequest.query.get(request_id)
    if not sub_req:
        raise ValueError("Substitution request not found")
    sub_req.status = 'SUSPENDED'
    db.session.commit()
    return sub_req


def acknowledge_assignment(request_id: int, user_id: int, is_admin: bool = False) -> SubstitutionAssignment:
    assignment = SubstitutionAssignment.query.filter_by(request_id=request_id).first()
    if not assignment:
        raise ValueError("No assignment found for this request")
    
    faculty = Faculty.query.get(assignment.assigned_faculty_id)
    if not is_admin and (not faculty or not faculty.user or faculty.user.id != user_id):
        raise PermissionError("You can only acknowledge your own substitution assignments")
        
    assignment.is_acknowledged = True
    assignment.acknowledged_at = datetime.utcnow()
    db.session.commit()
    return assignment


def recalculate_request(request_id: int) -> SubstitutionRequest:
    sub_req = SubstitutionRequest.query.get(request_id)
    if not sub_req:
        raise ValueError("Substitution request not found")
    
    timetable = sub_req.timetable
    absence = sub_req.absence
    absent_faculty_id = absence.faculty_id if absence else timetable.faculty_id
    
    allocation_res = run_allocation(timetable.id, sub_req.date, absent_faculty_id)
    candidates = allocation_res.get('primary_candidates', []) + allocation_res.get('fallback_candidates', [])
    sub_req.set_all_candidates(candidates)
    
    if candidates:
        top = candidates[0]
        sub_req.recommended_faculty_id = top['faculty_id']
        sub_req.recommendation_score = top['score']
        sub_req.status = 'RECOMMENDED'
        try:
            sub_req.ai_explanation = explain_recommendation(sub_req.to_dict(), candidates)
        except Exception:
            sub_req.ai_explanation = f"Recommended {top['faculty_name']} with suitability score {top['score']}/100."
    else:
        sub_req.status = 'PENDING'
        sub_req.recommended_faculty_id = None
        sub_req.recommendation_score = None
        sub_req.ai_explanation = "No eligible faculty candidates available for this slot."
        
    db.session.commit()
    return sub_req
