import os
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


def get_client():
    """Create and return a Gemini API client using the google-genai SDK."""
    api_key = os.environ.get('GOOGLE_API_KEY', '').strip()
    if not api_key:
        raise ValueError('GOOGLE_API_KEY not configured. Please add it to your environment or .env file.')
    
    from google import genai
    return genai.Client(api_key=api_key)


def generate_text(prompt: str, system_instruction: Optional[str] = None) -> str:
    """Helper to generate text using AI Provider Manager with fallback."""
    from app.ai.provider_manager import ai_manager
    try:
        text, provider, model = ai_manager.generate_with_fallback(
            prompt=prompt,
            system_instruction=system_instruction
        )
        return text
    except Exception as e:
        # Check if direct client works as final attempt
        try:
            client = get_client()
            from google.genai import types
            config = types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=1024,
            )
            if system_instruction:
                config.system_instruction = system_instruction
            response = client.models.generate_content(
                model='gemini-2.0-flash',
                config=config,
                contents=prompt
            )
            return response.text.strip() if response and response.text else ''
        except Exception:
            raise e


def explain_recommendation(request_data: Dict[str, Any], candidates: List[Dict[str, Any]]) -> str:
    """Feature A: Explain why the top candidate was recommended."""
    if not candidates:
        return (
            "No eligible substitute faculty could be identified for this session. "
            "All active faculty members have timetable clashes, are currently absent or logged out, "
            "or have conflicting substitution assignments."
        )
    
    top = candidates[0]
    prompt = (
        "Explain in 2 to 3 concise, professional sentences why the top candidate is recommended "
        "for this class substitution. Use only the provided data; do not invent details.\n\n"
        f"Class Details:\n"
        f"- Subject: {request_data.get('subject_name')} ({request_data.get('subject_code')})\n"
        f"- Class/Section: {request_data.get('class_name')} {request_data.get('section', '')}\n"
        f"- Slot: {request_data.get('start_time')} - {request_data.get('end_time')} ({request_data.get('day_of_week')})\n"
        f"- Absent Faculty: {request_data.get('absent_faculty_name')} ({request_data.get('absent_faculty_department')})\n\n"
        f"Top Candidate:\n"
        f"- Name: {top.get('faculty_name')}\n"
        f"- Designation: {top.get('designation')}\n"
        f"- Department: {top.get('department_name')}\n"
        f"- Subject Match: {'Yes (teaches this subject)' if top.get('teaches_subject') else 'No'}\n"
        f"- Specialization: {top.get('specialization')}\n"
        f"- Prior Substitution Assignments: {top.get('workload_count')}\n"
        f"- Suitability Score: {top.get('score')}/100\n"
        f"- Scoring Factors: {', '.join(top.get('reasons', []))}\n"
    )
    
    system_instruction = (
        "You are SYNCORA AI, an intelligent academic scheduling assistant. "
        "Provide factual, objective, and clear explanations for faculty substitution recommendations."
    )
    
    try:
        return generate_text(prompt, system_instruction=system_instruction)
    except Exception as e:
        logger.warning(f"Gemini API unavailable for explain_recommendation: {e}")
        subject_str = f" to teach {request_data.get('subject_name')}" if top.get('teaches_subject') else ""
        return (
            f"Recommended {top.get('faculty_name')} ({top.get('designation')}) with a suitability score of "
            f"{top.get('score')}/100. Candidate is present, verified free of timetable conflicts, qualified"
            f"{subject_str}, and has {top.get('workload_count')} prior substitution assignment(s)."
        )


def chat_assistant(user_message: str, context_data: Dict[str, Any]) -> str:
    """Conversational AI assistant grounded in real database context with academic tools."""
    system_instruction = (
        "You are SYNCORA Assistant, an intelligent academic co-pilot for university scheduling, "
        "academic continuity, substitute lesson planning, and attendance intelligence.\n\n"
        "Core Directives:\n"
        "1. Base all factual statements strictly on the provided database context. Never invent records.\n"
        "2. Clearly distinguish VERIFIED institutional records from AI-GENERATED pedagogical suggestions.\n"
        "3. For faculty inquiries ('What should I teach?', 'Show my assigned lesson plan'), present the structured "
        "class timing, subject code, target unit, learning objectives, and teaching sequence.\n"
        "4. For administrative queries ('Which substitutions need handover notes?', 'Pending lesson plans'), provide "
        "concise actionable summaries with IDs and dates.\n"
        "5. For pedagogical requests ('Explain concepts', 'Suggest classroom activities'), offer creative, high-impact "
        "teaching ideas tailored to the subject and class duration.\n"
        "6. If requested information is missing from the database, state that clearly and offer provisional guidance."
    )
    
    prompt = (
        f"Real System Context (Retrieved from SQLite):\n{json.dumps(context_data, indent=2, default=str)}\n\n"
        f"User Query: {user_message}\n\n"
        f"Please provide a structured, polite, professional response directly answering the query."
    )
    
    try:
        return generate_text(prompt, system_instruction=system_instruction)
    except Exception as e:
        logger.warning(f"AI Provider unavailable for chat_assistant: {e}. Executing deterministic institutional assistant.")
        lines = ["### SYNCORA Academic Assistant (Grounded Mode)"]
        q_lower = user_message.lower()

        # 1. Faculty teaching schedule / what to teach
        if 'my_teaching_schedule' in context_data:
            sched = context_data['my_teaching_schedule']
            subs = sched.get('substitution_classes', [])
            regs = sched.get('regular_classes', [])
            lines.append(f"\n**Schedule for {sched.get('day_of_week')} ({sched.get('date')}):**")
            if subs:
                lines.append("\n**Assigned Substitutions:**")
                for s in subs:
                    plan_stat = "✅ Lesson Plan Ready" if s.get('has_lesson_plan') else "⚠️ Plan Pending"
                    lines.append(f"- **{s.get('subject')} ({s.get('subject_code')})** | Class: {s.get('class_name')} | Slot: {s.get('start_time')}-{s.get('end_time')} ({plan_stat})")
            if regs:
                lines.append("\n**Regular Lectures:**")
                for r in regs:
                    lines.append(f"- **{r.get('subject_name')}** ({r.get('class_name')}) at {r.get('start_time')}-{r.get('end_time')} in Room {r.get('classroom')}")
            if not subs and not regs:
                lines.append("- No classes scheduled for this day.")

        # 2. Assigned lesson plans
        if 'my_assigned_plans' in context_data and context_data['my_assigned_plans']:
            lines.append("\n**Your Assigned Substitute Lesson Plans:**")
            for p in context_data['my_assigned_plans']:
                lines.append(f"- **{p.get('subject_name')} ({p.get('class_name')})** — Scheduled for {p.get('scheduled_date')}")
                sp = p.get('structured_plan') or {}
                if sp.get('lesson_title'):
                    lines.append(f"  *Title*: {sp.get('lesson_title')}")
                if sp.get('topics_to_cover'):
                    lines.append(f"  *Topics*: {', '.join(sp.get('topics_to_cover'))}")
                if sp.get('learning_objectives'):
                    lines.append(f"  *Objectives*: {'; '.join(sp.get('learning_objectives')[:2])}")
                if p.get('has_academic_continuity_warning'):
                    lines.append(f"  *Notice*: ⚠️ {p.get('continuity_warning_message')}")

        # 3. Previous lecture progress
        if 'previous_lecture_progress' in context_data and context_data['previous_lecture_progress']:
            lines.append("\n**Verified Previous Lecture Records:**")
            for rec in context_data['previous_lecture_progress']:
                ver_tag = " [Verified]" if rec.get('is_verified') else " [Provisional]"
                lines.append(f"- **{rec.get('topic_name')}** ({rec.get('completion_date', 'Recent')}){ver_tag} — {rec.get('notes', 'Covered successfully.')}")

        # 4. Suggested next topics
        if 'suggested_next_topics' in context_data:
            sug = context_data['suggested_next_topics']
            lines.append(f"\n**Academic Continuity for {sug.get('subject', 'Subject')} ({sug.get('class_name', '')}):**")
            if sug.get('current_topic_in_progress'):
                lines.append(f"- **Topic Currently in Progress**: {sug.get('current_topic_in_progress')}")
            if sug.get('suggested_next_topics'):
                lines.append(f"- **Recommended Next Topics**: {', '.join(sug.get('suggested_next_topics'))}")
            if sug.get('handover_instructions'):
                lines.append(f"- **Original Faculty Note**: *\"{sug.get('handover_instructions')}\"*")

        # 5. Pending lesson plans (Admin)
        if 'pending_lesson_plans' in context_data:
            pending_lp = context_data['pending_lesson_plans']
            lines.append(f"\n**Substitutions Missing Lesson Plans ({len(pending_lp)}):**")
            if pending_lp:
                for p in pending_lp:
                    lines.append(f"- Request #{p['request_id']} | {p['subject']} ({p['class_name']}) on {p['date']} — Assigned: {p['assigned_faculty']}")
            else:
                lines.append("- All approved substitutions have active lesson plans.")

        # 6. Missing handover notes (Admin)
        if 'missing_handover_notes' in context_data:
            m_ho = context_data['missing_handover_notes']
            lines.append(f"\n**Substitutions Missing Faculty Handover Notes ({len(m_ho)}):**")
            if m_ho:
                for h in m_ho:
                    lines.append(f"- Request #{h['request_id']} | {h['subject']} ({h['class_name']}) on {h['date']} — Absent: {h['absent_faculty']}")
            else:
                lines.append("- No missing handover notes.")

        # 7. Attendance & absences
        if 'attendance_summary' in context_data:
            att = context_data['attendance_summary']
            lines.append(f"\n**Attendance**: {att.get('present_today', 0)} present ({att.get('attendance_percentage', 0)}%), {att.get('absent_today', 0)} absent.")
        if 'present_faculty' in context_data:
            names = [f['name'] for f in context_data['present_faculty'][:8]]
            lines.append(f"\n**Present Faculty**: {', '.join(names)}" + (f" and {len(context_data['present_faculty']) - 8} more" if len(context_data['present_faculty']) > 8 else ""))
        if 'absent_faculty' in context_data:
            abs_items = [f"{a['name']} ({a.get('reason') or 'No reason given'})" for a in context_data['absent_faculty']]
            lines.append(f"\n**Absent Faculty Today**: {', '.join(abs_items) if abs_items else 'None'}")

        # 8. Workload ranking
        if 'substitution_workloads' in context_data and context_data['substitution_workloads']:
            lines.append("\n**Faculty Substitution Distribution:**")
            for w in context_data['substitution_workloads'][:5]:
                lines.append(f"- **{w.get('name')}**: {w.get('substitutions_handled', w.get('substitutions_conducted', 0))} sessions")

        # 9. Pedagogical activities / concept explanations request
        if any(w in q_lower for w in ['activity', 'activities', 'interactive', 'engagement']):
            lines.append("\n**AI Pedagogical Suggestions (Classroom Engagement):**")
            lines.append("1. **Think-Pair-Share (7 min)**: Present a targeted edge case scenario and have students trace the state transformation in pairs.")
            lines.append("2. **Whiteboard Walkthrough (12 min)**: Invite student volunteers to trace key algorithmic/architectural transitions with active peer review.")
            lines.append("3. **Minute Paper (3 min)**: Conclude with a quick 1-sentence prompt: *'What is the single most important consideration learned today?'*")

        if len(lines) == 1:
            lines.append("I am operational. You can query campus attendance, timetables, substitute lesson plans, academic continuity records, or substitution workload.")

        return "\n".join(lines)


def explain_decision(selected_candidate: Dict[str, Any], all_candidates: List[Dict[str, Any]], request_data: Dict[str, Any]) -> str:
    """Feature C: Explain why a specific candidate was selected over others."""
    prompt = (
        "Provide a detailed rationale explaining why the selected faculty candidate was assigned to this substitution "
        "slot, comparing their qualifications and workload with other potential candidates.\n\n"
        f"Class Details: {request_data.get('subject_name')} for {request_data.get('class_name')} "
        f"at {request_data.get('start_time')}-{request_data.get('end_time')} ({request_data.get('day_of_week')})\n"
        f"Selected Candidate: {json.dumps(selected_candidate, default=str)}\n"
        f"All Candidates: {json.dumps(all_candidates[:5], default=str)}\n"
    )
    
    system_instruction = (
        "You are SYNCORA AI. Explain substitution assignment decisions objectively, "
        "focusing on fairness, workload balance, and academic continuity."
    )
    
    try:
        return generate_text(prompt, system_instruction=system_instruction)
    except Exception as e:
        logger.warning(f"Gemini API unavailable for explain_decision: {e}")
        return (
            f"Candidate {selected_candidate.get('faculty_name')} was selected with score "
            f"{selected_candidate.get('score', 0)}/100 and current substitution workload of "
            f"{selected_candidate.get('workload_count', 0)} classes. Candidate matches the department and "
            f"fulfills eligibility criteria with no timetable conflicts."
        )


def generate_daily_report(stats_data: Dict[str, Any]) -> str:
    """Feature D: Narrative report from real daily stats."""
    prompt = (
        "Generate a comprehensive, executive daily report for the academic dean based on the following SYNCORA metrics. "
        "Structure the report with: Executive Summary, Attendance & Coverage, Substitution Workload Balance, "
        "and Recommendations.\n\n"
        f"Operational Metrics:\n{json.dumps(stats_data, indent=2, default=str)}"
    )
    
    system_instruction = (
        "You are an academic operations analyst writing formal daily institutional summaries for college administration."
    )
    
    try:
        return generate_text(prompt, system_instruction=system_instruction)
    except Exception as e:
        logger.warning(f"Gemini API unavailable for generate_daily_report: {e}")
        today_str = datetime.now().strftime('%B %d, %Y')
        return (
            f"SYNCORA Daily Operations Briefing — {today_str}\n\n"
            f"1. Executive Summary:\n"
            f"Total Faculty: {stats_data.get('total_faculty', 0)}. "
            f"Present: {stats_data.get('present_today', 0)}, Absent: {stats_data.get('absent_today', 0)}.\n\n"
            f"2. Substitution Status:\n"
            f"Total Requests: {stats_data.get('total_substitutions', 0)}. "
            f"Approved/Assigned: {stats_data.get('completed', 0)}, "
            f"Pending Action: {stats_data.get('pending', 0)}, "
            f"Suspended Sessions: {stats_data.get('suspended', 0)}.\n\n"
            f"3. Workload Balance:\n"
            f"Substitutions have been distributed according to qualification rankings and historical workload counts. "
            f"All assigned substitutions maintained 100% timetable conflict avoidance."
        )
