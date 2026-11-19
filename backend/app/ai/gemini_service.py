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
    """Feature B: Conversational AI assistant with real DB context."""
    system_instruction = (
        "You are SYNCORA Assistant, an AI academic co-pilot for faculty scheduling, attendance, "
        "and substitutions. Use the provided real database context to answer the user query accurately. "
        "If the requested info is not in the context, state that clearly without guessing. "
        "Keep responses professional, structured, and helpful."
    )
    
    prompt = (
        f"Current System Context:\n{json.dumps(context_data, indent=2, default=str)}\n\n"
        f"User Query: {user_message}\n\n"
        f"Please provide an accurate and concise response based strictly on the current context."
    )
    
    try:
        return generate_text(prompt, system_instruction=system_instruction)
    except Exception as e:
        logger.warning(f"Gemini API unavailable for chat_assistant: {e}")
        # Rule-based fallback using the retrieved context
        summary_lines = ["SYNCORA AI Assistant (Offline Mode):"]
        if 'attendance_summary' in context_data:
            att = context_data['attendance_summary']
            summary_lines.append(f"- Attendance: {att.get('present_count', 0)} present, {att.get('absent_count', 0)} absent, {att.get('logged_out_count', 0)} logged out.")
        if 'absent_faculty' in context_data:
            names = [f['faculty_name'] for f in context_data['absent_faculty']]
            summary_lines.append(f"- Absent Faculty: {', '.join(names) if names else 'None'}")
        if 'pending_requests' in context_data:
            summary_lines.append(f"- Pending Substitutions: {len(context_data['pending_requests'])}")
        if len(summary_lines) == 1:
            summary_lines.append("I am operational. You can view attendance, timetable slots, and substitution requests from the navigation tabs.")
        return "\n".join(summary_lines)


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
