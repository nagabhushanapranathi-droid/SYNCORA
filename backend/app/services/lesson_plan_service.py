import json
import logging
from datetime import date, datetime
from typing import Dict, Any, List, Optional, Tuple
from app import db
from app.models.models import (
    SubstitutionRequest,
    SubstitutionAssignment,
    Timetable,
    Subject,
    Faculty,
    CourseSyllabus,
    LessonProgress,
    LessonPlan,
    HandoverNote,
)
from app.ai.provider_manager import ai_manager
from app.ai.model_router import TaskType

logger = logging.getLogger(__name__)


def calculate_duration_minutes(start_time, end_time) -> int:
    """Calculate duration between two time objects in minutes."""
    if not start_time or not end_time:
        return 60
    t1 = start_time.hour * 60 + start_time.minute
    t2 = end_time.hour * 60 + end_time.minute
    diff = t2 - t1
    return diff if diff > 0 else 60


def get_academic_context(substitution_request_id: int) -> Dict[str, Any]:
    """
    Retrieve comprehensive academic context for a substitution request.
    Strictly distinguishes:
    - Verified completed topics
    - Recorded topics in progress
    - AI-suggested next topics
    - Unverified academic information
    """
    sub_req = SubstitutionRequest.query.get(substitution_request_id)
    if not sub_req:
        raise ValueError(f"SubstitutionRequest #{substitution_request_id} not found")

    timetable: Timetable = sub_req.timetable
    if not timetable:
        raise ValueError(f"Timetable entry for SubstitutionRequest #{substitution_request_id} not found")

    subject: Subject = timetable.subject
    original_faculty = sub_req.absence.faculty if sub_req.absence and sub_req.absence.faculty else timetable.faculty
    
    # Identify substitute faculty from assignment or recommendation
    substitute_faculty = None
    if sub_req.assignment and sub_req.assignment.assigned_faculty:
        substitute_faculty = sub_req.assignment.assigned_faculty
    elif sub_req.recommended_faculty:
        substitute_faculty = sub_req.recommended_faculty

    duration = calculate_duration_minutes(timetable.start_time, timetable.end_time)

    # 1. Official Syllabus Units
    syllabus_records = CourseSyllabus.query.filter_by(subject_id=subject.id).order_by(CourseSyllabus.unit_number).all()
    syllabus_units = [s.to_dict() for s in syllabus_records]

    # 2. Teaching Progress Records
    progress_query = LessonProgress.query.filter_by(
        subject_id=subject.id,
        class_name=timetable.class_name
    )
    if timetable.section:
        progress_query = progress_query.filter(
            (LessonProgress.section == timetable.section) | (LessonProgress.section.is_(None))
        )
    progress_records = progress_query.order_by(LessonProgress.completion_date.desc(), LessonProgress.id.desc()).all()

    verified_completed = [
        p.to_dict() for p in progress_records if p.is_verified and p.status == 'COMPLETED'
    ]
    in_progress = [
        p.to_dict() for p in progress_records if p.status == 'IN_PROGRESS'
    ]
    unverified_records = [
        p.to_dict() for p in progress_records if not p.is_verified
    ]

    # 3. Faculty Handover Note
    handover = HandoverNote.query.filter_by(
        faculty_id=original_faculty.id if original_faculty else 0,
        subject_id=subject.id,
        class_name=timetable.class_name
    ).order_by(HandoverNote.created_at.desc()).first()

    # If no class-specific note, check if note exists for the substitution request
    if not handover:
        handover = HandoverNote.query.filter_by(substitution_request_id=sub_req.id).first()

    handover_data = handover.to_dict() if handover else None

    # 4. Previous Lesson Plans
    prev_plans = LessonPlan.query.filter(
        LessonPlan.subject_id == subject.id,
        LessonPlan.class_name == timetable.class_name,
        LessonPlan.id != (sub_req.lesson_plans[0].id if sub_req.lesson_plans else -1)
    ).order_by(LessonPlan.scheduled_date.desc()).limit(3).all()
    previous_plans_data = [p.to_dict() for p in prev_plans]

    # 5. Determine Continuity Warning and Next Topics
    has_continuity_warning = False
    warning_message = None

    if not verified_completed and not in_progress and not handover_data:
        has_continuity_warning = True
        warning_message = (
            "PROVISIONAL LESSON PLAN WARNING: No verified lesson progress records or faculty handover notes "
            f"were found for {subject.name} ({subject.code}) in class {timetable.class_name}. "
            "A provisional lesson plan has been derived from the earliest official syllabus unit. "
            "Substitute faculty must verify student progress before lecturing."
        )

    # Determine recommended topics
    suggested_source = "handover"
    target_topics = []
    target_unit = None

    if handover_data and handover_data.get('current_topic'):
        target_topics = [handover_data['current_topic']]
        if handover_data.get('next_topics'):
            target_topics.extend(handover_data['next_topics'][:2])
        target_unit = handover_data.get('current_unit')
        suggested_source = "Faculty Handover Note"
    elif in_progress:
        target_topics = [in_progress[0]['topic_name']]
        target_unit = f"Unit {in_progress[0].get('unit_number', 1)}"
        suggested_source = "Recorded Topic in Progress"
    elif verified_completed:
        # Find next topic from syllabus that is not yet completed
        completed_names = {c['topic_name'].lower().strip() for c in verified_completed}
        found_next = False
        for u in syllabus_units:
            for t in u.get('topics', []):
                if t.lower().strip() not in completed_names:
                    target_topics = [t]
                    target_unit = f"Unit {u['unit_number']}: {u['unit_title']}"
                    found_next = True
                    break
            if found_next:
                break
        suggested_source = "Official Syllabus Sequence (following verified topics)"
    else:
        # First syllabus unit
        if syllabus_units:
            u1 = syllabus_units[0]
            target_unit = f"Unit {u1['unit_number']}: {u1['unit_title']}"
            target_topics = u1.get('topics', [])[:2]
        else:
            target_unit = "Introductory Concepts"
            target_topics = [f"Foundations of {subject.name}"]
        suggested_source = "AI-Suggested Initial Topic (Provisional)"

    return {
        'substitution_request_id': sub_req.id,
        'subject': {
            'id': subject.id,
            'name': subject.name,
            'code': subject.code,
            'description': subject.description,
            'department': subject.department.name if subject.department else None
        },
        'class_details': {
            'class_name': timetable.class_name,
            'section': timetable.section,
            'classroom': timetable.classroom,
            'day_of_week': timetable.day_of_week,
            'start_time': timetable.start_time.strftime('%H:%M') if timetable.start_time else None,
            'end_time': timetable.end_time.strftime('%H:%M') if timetable.end_time else None,
            'duration_minutes': duration,
            'scheduled_date': sub_req.date.isoformat()
        },
        'faculty': {
            'original_faculty_id': original_faculty.id if original_faculty else None,
            'original_faculty_name': original_faculty.name if original_faculty else 'Unknown',
            'original_faculty_designation': original_faculty.designation if original_faculty else '',
            'substitute_faculty_id': substitute_faculty.id if substitute_faculty else None,
            'substitute_faculty_name': substitute_faculty.name if substitute_faculty else 'Assigned Substitute',
            'substitute_faculty_designation': substitute_faculty.designation if substitute_faculty else ''
        },
        'academic_continuity': {
            'has_warning': has_continuity_warning,
            'warning_message': warning_message,
            'target_unit': target_unit,
            'target_topics': target_topics,
            'topic_source': suggested_source,
            'verified_completed_topics': verified_completed,
            'in_progress_topics': in_progress,
            'unverified_records': unverified_records,
            'handover_note': handover_data,
            'syllabus_units': syllabus_units,
            'previous_lesson_plans_count': len(previous_plans_data)
        }
    }


def build_deterministic_fallback_plan(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate an authentic, high-quality 12-point lesson plan deterministically
    when AI providers are unavailable or offline.
    Guarantees strict compliance with required schema and duration.
    """
    subj = context['subject']
    cls = context['class_details']
    fac = context['faculty']
    cont = context['academic_continuity']
    duration = cls['duration_minutes']

    topics_to_cover = cont.get('target_topics') or [f"Key principles of {subj['name']}"]
    unit_str = cont.get('target_unit') or "Core Curriculum"

    # Distribute duration into 4 pedagogical phases
    recap_min = max(5, int(duration * 0.15))
    lecture_min = int(duration * 0.50)
    activity_min = int(duration * 0.20)
    eval_min = duration - (recap_min + lecture_min + activity_min)

    main_topic = topics_to_cover[0] if topics_to_cover else subj['name']

    return {
        "lesson_title": f"{subj['name']} — {main_topic}",
        "learning_objectives": [
            f"Explain core concepts and architectural significance of {main_topic}.",
            f"Apply analytical problem-solving methods to practical instances of {main_topic}.",
            f"Relate {main_topic} with preceding curriculum foundations in {subj['code']}."
        ],
        "topics_to_cover": topics_to_cover,
        "prerequisites": [
            f"Basic familiarity with {subj['name']} fundamentals and prerequisite syllabus modules.",
            "Review of preceding lecture notes recorded in department syllabus tracker."
        ],
        "teaching_sequence": [
            f"Phase 1 (0-{recap_min} min): Welcome, class roll call, and interactive recap of previous lecture concepts.",
            f"Phase 2 ({recap_min}-{recap_min + lecture_min} min): Comprehensive exposition of {main_topic} with board-work and theoretical breakdown.",
            f"Phase 3 ({recap_min + lecture_min}-{recap_min + lecture_min + activity_min} min): Pair problem-solving activity and practical code/diagram walkthrough.",
            f"Phase 4 ({recap_min + lecture_min + activity_min}-{duration} min): Formative assessment questions, student doubts resolution, and homework assignment."
        ],
        "time_allocation": {
            "recap_and_orientation_minutes": recap_min,
            "core_lecture_minutes": lecture_min,
            "classroom_activity_minutes": activity_min,
            "assessment_and_wrapup_minutes": eval_min,
            "total_duration_minutes": duration
        },
        "examples_and_explanations": [
            f"Detailed walkthrough of a representative case study illustrating {main_topic}.",
            f"Step-by-step trace showing inputs, state transformations, and expected outcomes.",
            "Common student misconceptions and edge cases to clarify during demonstration."
        ],
        "classroom_activities": [
            f"Think-Pair-Share exercise: Ask students to trace a mini-example of {main_topic} in pairs for 5 minutes.",
            "Whiteboard volunteer problem: Invite a student to solve a parameter variant while peers verify the output."
        ],
        "student_engagement_questions": [
            f"What primary engineering advantage does {main_topic} provide over earlier alternative techniques?",
            f"Under what real-world computational or operational constraints would this approach fail or experience bottlenecks?",
            "How does this concept connect directly to the upcoming module in the syllabus?"
        ],
        "assessment_questions": [
            f"Formulate a concise definition and standard formulation for {main_topic}.",
            f"Given a standard scenario, describe the sequence of steps to solve it using today's method.",
            "What is the asymptotic complexity or efficiency bound of this technique?"
        ],
        "homework": [
            f"Complete practice exercise set #4 on {main_topic} from recommended course textbook.",
            f"Prepare a 1-page summary comparing {main_topic} with the next topic in {unit_str}."
        ],
        "required_materials": [
            "Classroom chalkboard / whiteboard and colored markers",
            f"Prescribed textbook and reference lecture notes for {subj['name']}",
            "Department projector and presentation slides (if audio-visual room assigned)"
        ]
    }


def format_markdown_lesson_plan(plan_dict: Dict[str, Any], context: Dict[str, Any]) -> str:
    """Format the 12-point structured dictionary into clean markdown."""
    subj = context['subject']
    cls = context['class_details']
    fac = context['faculty']
    cont = context['academic_continuity']

    md_lines = []
    if cont.get('has_warning'):
        md_lines.append(f"> ⚠️ **ACADEMIC CONTINUITY NOTICE**: {cont['warning_message']}\n")

    md_lines.append(f"# {plan_dict.get('lesson_title', 'Substitute Lecture Plan')}\n")
    md_lines.append(f"**Course**: {subj['name']} (`{subj['code']}`) | **Department**: {subj.get('department', 'Academic')}")
    md_lines.append(f"**Class**: {cls['class_name']} (Section {cls.get('section', 'A')}) | **Duration**: {cls['duration_minutes']} minutes")
    md_lines.append(f"**Scheduled Date**: {cls['scheduled_date']} ({cls['day_of_week']})")
    md_lines.append(f"**Original Faculty**: {fac['original_faculty_name']} | **Substitute Faculty**: {fac['substitute_faculty_name']}")
    md_lines.append(f"**Topic Source**: {cont.get('topic_source', 'Syllabus Tracker')}\n")
    md_lines.append("---\n")

    md_lines.append("## 1. Learning Objectives")
    for obj in plan_dict.get('learning_objectives', []):
        md_lines.append(f"- {obj}")
    md_lines.append("")

    md_lines.append("## 2. Topics to Cover")
    for topic in plan_dict.get('topics_to_cover', []):
        md_lines.append(f"- {topic}")
    md_lines.append("")

    md_lines.append("## 3. Prerequisites")
    for prereq in plan_dict.get('prerequisites', []):
        md_lines.append(f"- {prereq}")
    md_lines.append("")

    md_lines.append("## 4. Teaching Sequence & Time Allocation")
    alloc = plan_dict.get('time_allocation', {})
    if isinstance(alloc, dict):
        md_lines.append(f"*Total Class Duration: {cls['duration_minutes']} minutes*")
        for k, v in alloc.items():
            k_clean = k.replace('_', ' ').title()
            md_lines.append(f"- **{k_clean}**: {v} min" if not str(v).endswith('min') and not str(v).endswith('minutes') else f"- **{k_clean}**: {v}")
    for step in plan_dict.get('teaching_sequence', []):
        md_lines.append(f"1. {step}")
    md_lines.append("")

    md_lines.append("## 5. Examples and Explanations")
    for ex in plan_dict.get('examples_and_explanations', []):
        md_lines.append(f"- {ex}")
    md_lines.append("")

    md_lines.append("## 6. Classroom Activities")
    for act in plan_dict.get('classroom_activities', []):
        md_lines.append(f"- {act}")
    md_lines.append("")

    md_lines.append("## 7. Student Engagement Questions")
    for q in plan_dict.get('student_engagement_questions', []):
        md_lines.append(f"- {q}")
    md_lines.append("")

    md_lines.append("## 8. Formative Assessment Questions")
    for a in plan_dict.get('assessment_questions', []):
        md_lines.append(f"- {a}")
    md_lines.append("")

    md_lines.append("## 9. Homework & Follow-up")
    for hw in plan_dict.get('homework', []):
        md_lines.append(f"- {hw}")
    md_lines.append("")

    md_lines.append("## 10. Required Teaching Materials")
    for mat in plan_dict.get('required_materials', []):
        md_lines.append(f"- {mat}")
    md_lines.append("")

    return "\n".join(md_lines)


def generate_lesson_plan(
    substitution_request_id: int,
    user_id: Optional[int] = None,
    force_regenerate: bool = False
) -> LessonPlan:
    """
    Generate and persist a complete, structured substitute lesson plan in SQLite.
    Follows all academic continuity rules and duration requirements.
    """
    # Check if a plan already exists
    existing = LessonPlan.query.filter_by(substitution_request_id=substitution_request_id).first()
    if existing and not force_regenerate:
        logger.info(f"Returning existing LessonPlan #{existing.id} for request #{substitution_request_id}")
        return existing

    context = get_academic_context(substitution_request_id)
    subj = context['subject']
    cls = context['class_details']
    fac = context['faculty']
    cont = context['academic_continuity']

    prompt = (
        f"You are SYNCORA Academic AI. Generate a professional substitute lesson plan for the following scheduled session.\n\n"
        f"Class Details:\n"
        f"- Subject: {subj['name']} ({subj['code']})\n"
        f"- Department: {subj.get('department')}\n"
        f"- Class/Section: {cls['class_name']} {cls.get('section', '')}\n"
        f"- Class Duration: EXACTLY {cls['duration_minutes']} MINUTES\n"
        f"- Scheduled Date: {cls['scheduled_date']} ({cls['day_of_week']})\n"
        f"- Original Faculty: {fac['original_faculty_name']} ({fac['original_faculty_designation']})\n"
        f"- Substitute Faculty: {fac['substitute_faculty_name']} ({fac['substitute_faculty_designation']})\n\n"
        f"Academic Progress Context:\n"
        f"- Target Unit: {cont.get('target_unit')}\n"
        f"- Target Topics to Cover: {', '.join(cont.get('target_topics', []))}\n"
        f"- Verified Completed Topics: {[c['topic_name'] for c in cont.get('verified_completed_topics', [])]}\n"
        f"- Topics in Progress: {[i['topic_name'] for i in cont.get('in_progress_topics', [])]}\n"
        f"- Handover Instructions: {cont['handover_note'].get('student_notes') if cont.get('handover_note') else 'None'}\n\n"
        f"Required JSON Structure (fit all 12 items exactly for {cls['duration_minutes']} minutes):\n"
        "{\n"
        '  "lesson_title": "Title string",\n'
        '  "learning_objectives": ["obj 1", "obj 2", "obj 3"],\n'
        '  "topics_to_cover": ["topic 1", "topic 2"],\n'
        '  "prerequisites": ["prereq 1", "prereq 2"],\n'
        '  "teaching_sequence": ["step 1 with timestamps", "step 2", "step 3", "step 4"],\n'
        f'  "time_allocation": {{"recap_minutes": 10, "core_lecture_minutes": 35, "activities_minutes": 10, "assessment_minutes": 5, "total_duration_minutes": {cls["duration_minutes"]}}},\n'
        '  "examples_and_explanations": ["example 1", "example 2"],\n'
        '  "classroom_activities": ["activity 1", "activity 2"],\n'
        '  "student_engagement_questions": ["question 1", "question 2"],\n'
        '  "assessment_questions": ["eval question 1", "eval question 2"],\n'
        '  "homework": ["hw 1", "hw 2"],\n'
        '  "required_materials": ["marker", "textbook", "slides"]\n'
        "}"
    )

    system_instruction = (
        "You are an expert university curriculum planner. Generate pedagogically sound, structured lesson plans "
        f"tailored to the designated class duration of {cls['duration_minutes']} minutes. Never hallucinate fake syllabus topics."
    )

    structured_dict = None
    provider_used = "Offline Deterministic Engine"
    model_used = "rule-based-pedagogical-generator"
    is_ai = False

    try:
        structured_dict, provider_used, model_used = ai_manager.generate_structured_json(
            prompt=prompt,
            system_instruction=system_instruction,
            task_type=TaskType.REASONING
        )
        is_ai = True
        logger.info(f"Lesson plan successfully generated via AI ({provider_used} - {model_used})")
    except Exception as e:
        logger.warning(f"AI Provider generation failed: {e}. Utilizing deterministic academic fallback.")
        structured_dict = build_deterministic_fallback_plan(context)
        provider_used = "Deterministic Academic Engine"
        model_used = "syllabus-grounded-template"
        is_ai = False

    # Validate all 12 keys exist; fill missing from fallback if any were omitted by AI
    fallback_backup = build_deterministic_fallback_plan(context)
    for required_key in [
        "lesson_title", "learning_objectives", "topics_to_cover", "prerequisites",
        "teaching_sequence", "time_allocation", "examples_and_explanations",
        "classroom_activities", "student_engagement_questions", "assessment_questions",
        "homework", "required_materials"
    ]:
        if required_key not in structured_dict or not structured_dict[required_key]:
            structured_dict[required_key] = fallback_backup[required_key]

    # Generate full markdown
    markdown_content = format_markdown_lesson_plan(structured_dict, context)

    # Persist or update record
    plan_record = existing or LessonPlan(substitution_request_id=substitution_request_id)
    plan_record.subject_id = subj['id']
    plan_record.original_faculty_id = fac['original_faculty_id'] or 1
    plan_record.substitute_faculty_id = fac['substitute_faculty_id'] or 1
    plan_record.class_name = cls['class_name']
    plan_record.section = cls.get('section', 'A')
    plan_record.scheduled_date = date.fromisoformat(cls['scheduled_date'])
    plan_record.duration_minutes = cls['duration_minutes']
    plan_record.academic_context = json.dumps(context)
    plan_record.lesson_content = markdown_content
    plan_record.structured_plan = json.dumps(structured_dict)
    plan_record.has_academic_continuity_warning = cont.get('has_warning', False)
    plan_record.continuity_warning_message = cont.get('warning_message')
    plan_record.is_ai_generated = is_ai
    plan_record.ai_provider = provider_used
    plan_record.ai_model = model_used
    plan_record.status = 'GENERATED'
    plan_record.updated_at = datetime.utcnow()

    if not existing:
        db.session.add(plan_record)

    db.session.commit()
    logger.info(f"LessonPlan #{plan_record.id} persisted in SQLite successfully.")
    return plan_record


def update_lesson_plan_content(
    lesson_plan_id: int,
    user_id: int,
    lesson_content: Optional[str] = None,
    teaching_notes: Optional[str] = None,
    feedback: Optional[str] = None,
    topics_completed: Optional[List[str]] = None,
    status: Optional[str] = None
) -> LessonPlan:
    """Allow authorized faculty to edit their lesson plan or record post-lecture feedback."""
    plan = LessonPlan.query.get(lesson_plan_id)
    if not plan:
        raise ValueError(f"LessonPlan #{lesson_plan_id} not found")

    if lesson_content is not None:
        plan.lesson_content = lesson_content
    if teaching_notes is not None:
        plan.teaching_notes = teaching_notes
    if feedback is not None:
        plan.feedback = feedback
    if topics_completed is not None:
        plan.topics_completed = json.dumps(topics_completed)
    if status is not None:
        plan.status = status
    plan.updated_at = datetime.utcnow()

    db.session.commit()
    return plan


def record_verified_progress(
    subject_id: int,
    faculty_id: int,
    class_name: str,
    section: Optional[str],
    unit_number: Optional[int],
    topic_name: str,
    status: str = 'COMPLETED',
    hours_spent: float = 1.0,
    notes: Optional[str] = None,
    is_verified: bool = True
) -> LessonProgress:
    """Record verified teaching progress. Only invoked through authorized faculty/admin actions."""
    progress = LessonProgress(
        subject_id=subject_id,
        faculty_id=faculty_id,
        class_name=class_name,
        section=section,
        unit_number=unit_number,
        topic_name=topic_name,
        status=status,
        is_verified=is_verified,
        completion_date=date.today() if status == 'COMPLETED' else None,
        hours_spent=hours_spent,
        notes=notes
    )
    db.session.add(progress)
    db.session.commit()
    return progress
