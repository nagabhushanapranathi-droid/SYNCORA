from app import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
import json


class Department(db.Model):
    __tablename__ = 'department'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(20), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


# FacultySubject association table
faculty_subject = db.Table(
    'faculty_subject',
    db.Column('faculty_id', db.Integer, db.ForeignKey('faculty.id'), primary_key=True),
    db.Column('subject_id', db.Integer, db.ForeignKey('subject.id'), primary_key=True)
)


class Faculty(db.Model):
    __tablename__ = 'faculty'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'), nullable=False)
    designation = db.Column(db.String(100), nullable=False)
    specialization = db.Column(db.String(200), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    department = db.relationship('Department', backref='faculty_members')
    subjects = db.relationship('Subject', secondary=faculty_subject, backref='faculty_members', lazy='subquery')
    
    def to_dict(self, include_subjects=True, include_attendance=False):
        data = {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'department_id': self.department_id,
            'department_name': self.department.name if self.department else None,
            'designation': self.designation,
            'specialization': self.specialization,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_subjects:
            data['subjects'] = [s.to_dict() for s in self.subjects]
        return data


class Subject(db.Model):
    __tablename__ = 'subject'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(20), unique=True, nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    department = db.relationship('Department', backref='subjects')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'department_id': self.department_id,
            'department_name': self.department.name if self.department else None,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='faculty')  # admin or faculty
    faculty_id = db.Column(db.Integer, db.ForeignKey('faculty.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    faculty = db.relationship('Faculty', backref='user', uselist=False)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.role,
            'faculty_id': self.faculty_id,
            'faculty_name': self.faculty.name if self.faculty else None,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Attendance(db.Model):
    __tablename__ = 'attendance'
    id = db.Column(db.Integer, primary_key=True)
    faculty_id = db.Column(db.Integer, db.ForeignKey('faculty.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    login_time = db.Column(db.Time, nullable=True)
    logout_time = db.Column(db.Time, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='ABSENT')  # PRESENT, ABSENT, LOGGED_OUT
    override_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    override_at = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('faculty_id', 'date', name='uq_faculty_date'),)
    
    faculty = db.relationship('Faculty', backref='attendances')
    
    def to_dict(self):
        return {
            'id': self.id,
            'faculty_id': self.faculty_id,
            'faculty_name': self.faculty.name if self.faculty else None,
            'faculty_department': self.faculty.department.name if self.faculty and self.faculty.department else None,
            'date': self.date.isoformat() if self.date else None,
            'login_time': self.login_time.strftime('%H:%M:%S') if self.login_time else None,
            'logout_time': self.logout_time.strftime('%H:%M:%S') if self.logout_time else None,
            'status': self.status,
            'notes': self.notes
        }


class Timetable(db.Model):
    __tablename__ = 'timetable'
    id = db.Column(db.Integer, primary_key=True)
    faculty_id = db.Column(db.Integer, db.ForeignKey('faculty.id'), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subject.id'), nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'), nullable=False)
    class_name = db.Column(db.String(50), nullable=False)
    section = db.Column(db.String(10), nullable=True)
    classroom = db.Column(db.String(50), nullable=True)
    day_of_week = db.Column(db.String(20), nullable=False)  # Monday-Saturday
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    faculty = db.relationship('Faculty', backref='timetable_entries')
    subject = db.relationship('Subject', backref='timetable_entries')
    department = db.relationship('Department', backref='timetable_entries')
    
    def to_dict(self):
        return {
            'id': self.id,
            'faculty_id': self.faculty_id,
            'faculty_name': self.faculty.name if self.faculty else None,
            'subject_id': self.subject_id,
            'subject_name': self.subject.name if self.subject else None,
            'subject_code': self.subject.code if self.subject else None,
            'department_id': self.department_id,
            'department_name': self.department.name if self.department else None,
            'class_name': self.class_name,
            'section': self.section,
            'classroom': self.classroom,
            'day_of_week': self.day_of_week,
            'start_time': self.start_time.strftime('%H:%M') if self.start_time else None,
            'end_time': self.end_time.strftime('%H:%M') if self.end_time else None,
            'is_active': self.is_active
        }


class Absence(db.Model):
    __tablename__ = 'absence'
    id = db.Column(db.Integer, primary_key=True)
    faculty_id = db.Column(db.Integer, db.ForeignKey('faculty.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    reason = db.Column(db.String(300), nullable=True)
    remarks = db.Column(db.Text, nullable=True)
    reported_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    faculty = db.relationship('Faculty', backref='absences')
    reporter = db.relationship('User', foreign_keys=[reported_by])
    substitution_requests = db.relationship('SubstitutionRequest', backref='absence', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'faculty_id': self.faculty_id,
            'faculty_name': self.faculty.name if self.faculty else None,
            'faculty_department': self.faculty.department.name if self.faculty and self.faculty.department else None,
            'date': self.date.isoformat() if self.date else None,
            'reason': self.reason,
            'remarks': self.remarks,
            'reported_by_name': self.reporter.name if self.reporter else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class SubstitutionRequest(db.Model):
    __tablename__ = 'substitution_request'
    id = db.Column(db.Integer, primary_key=True)
    absence_id = db.Column(db.Integer, db.ForeignKey('absence.id'), nullable=False)
    timetable_id = db.Column(db.Integer, db.ForeignKey('timetable.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    recommended_faculty_id = db.Column(db.Integer, db.ForeignKey('faculty.id'), nullable=True)
    recommendation_score = db.Column(db.Float, nullable=True)
    ai_explanation = db.Column(db.Text, nullable=True)
    all_candidates_json = db.Column(db.Text, nullable=True)  # JSON of ranked candidates
    status = db.Column(db.String(20), nullable=False, default='PENDING')
    # Statuses: PENDING, RECOMMENDED, APPROVED, REJECTED, ASSIGNED, SUSPENDED
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    timetable = db.relationship('Timetable', backref='substitution_requests')
    recommended_faculty = db.relationship('Faculty', foreign_keys=[recommended_faculty_id], backref='recommended_for')
    assignment = db.relationship('SubstitutionAssignment', backref='request', uselist=False)
    
    def get_all_candidates(self):
        if self.all_candidates_json:
            try:
                return json.loads(self.all_candidates_json)
            except Exception:
                return []
        return []
    
    def set_all_candidates(self, candidates):
        self.all_candidates_json = json.dumps(candidates)
    
    def to_dict(self):
        timetable = self.timetable
        absence = self.absence
        return {
            'id': self.id,
            'absence_id': self.absence_id,
            'absent_faculty_id': absence.faculty_id if absence else None,
            'absent_faculty_name': absence.faculty.name if absence and absence.faculty else None,
            'absent_faculty_department': absence.faculty.department.name if absence and absence.faculty and absence.faculty.department else None,
            'timetable_id': self.timetable_id,
            'subject_name': timetable.subject.name if timetable and timetable.subject else None,
            'subject_code': timetable.subject.code if timetable and timetable.subject else None,
            'class_name': timetable.class_name if timetable else None,
            'section': timetable.section if timetable else None,
            'classroom': timetable.classroom if timetable else None,
            'day_of_week': timetable.day_of_week if timetable else None,
            'start_time': timetable.start_time.strftime('%H:%M') if timetable and timetable.start_time else None,
            'end_time': timetable.end_time.strftime('%H:%M') if timetable and timetable.end_time else None,
            'date': self.date.isoformat() if self.date else None,
            'recommended_faculty_id': self.recommended_faculty_id,
            'recommended_faculty_name': self.recommended_faculty.name if self.recommended_faculty else None,
            'recommendation_score': self.recommendation_score,
            'ai_explanation': self.ai_explanation,
            'all_candidates': self.get_all_candidates(),
            'status': self.status,
            'assignment': self.assignment.to_dict() if self.assignment else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class SubstitutionAssignment(db.Model):
    __tablename__ = 'substitution_assignment'
    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey('substitution_request.id'), nullable=False, unique=True)
    assigned_faculty_id = db.Column(db.Integer, db.ForeignKey('faculty.id'), nullable=False)
    assigned_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.Text, nullable=True)
    is_acknowledged = db.Column(db.Boolean, default=False)
    acknowledged_at = db.Column(db.DateTime, nullable=True)
    
    assigned_faculty = db.relationship('Faculty', foreign_keys=[assigned_faculty_id], backref='substitution_assignments')
    assigner = db.relationship('User', foreign_keys=[assigned_by])
    
    def to_dict(self):
        return {
            'id': self.id,
            'request_id': self.request_id,
            'assigned_faculty_id': self.assigned_faculty_id,
            'assigned_faculty_name': self.assigned_faculty.name if self.assigned_faculty else None,
            'assigned_by_name': self.assigner.name if self.assigner else None,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
            'notes': self.notes,
            'is_acknowledged': self.is_acknowledged,
            'acknowledged_at': self.acknowledged_at.isoformat() if self.acknowledged_at else None
        }


class Notification(db.Model):
    __tablename__ = 'notification'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(50), nullable=False, default='info')  # info, success, warning, error
    is_read = db.Column(db.Boolean, default=False)
    related_request_id = db.Column(db.Integer, db.ForeignKey('substitution_request.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='notifications')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'message': self.message,
            'type': self.type,
            'is_read': self.is_read,
            'related_request_id': self.related_request_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }



class CourseSyllabus(db.Model):
    __tablename__ = 'course_syllabus'
    id = db.Column(db.Integer, primary_key=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('subject.id'), nullable=False)
    unit_number = db.Column(db.Integer, nullable=False)
    unit_title = db.Column(db.String(200), nullable=False)
    topics = db.Column(db.Text, nullable=False)  # JSON list of topic strings
    course_outcomes = db.Column(db.Text, nullable=True)  # JSON list or text
    estimated_hours = db.Column(db.Float, default=10.0)
    learning_objectives = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    subject = db.relationship('Subject', backref=db.backref('syllabus_units', lazy='dynamic', order_by='CourseSyllabus.unit_number'))

    def get_topics(self):
        if self.topics:
            try:
                return json.loads(self.topics)
            except Exception:
                return []
        return []

    def set_topics(self, topics_list):
        self.topics = json.dumps(topics_list)

    def to_dict(self):
        co = self.course_outcomes
        if co:
            try:
                co = json.loads(co)
            except Exception:
                pass
        return {
            'id': self.id,
            'subject_id': self.subject_id,
            'subject_name': self.subject.name if self.subject else None,
            'subject_code': self.subject.code if self.subject else None,
            'unit_number': self.unit_number,
            'unit_title': self.unit_title,
            'topics': self.get_topics(),
            'course_outcomes': co,
            'estimated_hours': self.estimated_hours,
            'learning_objectives': self.learning_objectives,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class LessonProgress(db.Model):
    __tablename__ = 'lesson_progress'
    id = db.Column(db.Integer, primary_key=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('subject.id'), nullable=False)
    faculty_id = db.Column(db.Integer, db.ForeignKey('faculty.id'), nullable=False)
    class_name = db.Column(db.String(50), nullable=False)
    section = db.Column(db.String(10), nullable=True)
    unit_number = db.Column(db.Integer, nullable=True)
    topic_name = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(20), default='COMPLETED')  # COMPLETED, IN_PROGRESS, PLANNED
    is_verified = db.Column(db.Boolean, default=True)  # True = verified lecture conducted; False = unverified/draft
    completion_date = db.Column(db.Date, nullable=True)
    hours_spent = db.Column(db.Float, default=1.0)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    subject = db.relationship('Subject', backref='lesson_progress_records')
    faculty = db.relationship('Faculty', backref='lesson_progress_records')

    def to_dict(self):
        return {
            'id': self.id,
            'subject_id': self.subject_id,
            'subject_name': self.subject.name if self.subject else None,
            'subject_code': self.subject.code if self.subject else None,
            'faculty_id': self.faculty_id,
            'faculty_name': self.faculty.name if self.faculty else None,
            'class_name': self.class_name,
            'section': self.section,
            'unit_number': self.unit_number,
            'topic_name': self.topic_name,
            'status': self.status,
            'is_verified': self.is_verified,
            'completion_date': self.completion_date.isoformat() if self.completion_date else None,
            'hours_spent': self.hours_spent,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class LessonPlan(db.Model):
    __tablename__ = 'lesson_plan'
    id = db.Column(db.Integer, primary_key=True)
    substitution_request_id = db.Column(db.Integer, db.ForeignKey('substitution_request.id'), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subject.id'), nullable=False)
    original_faculty_id = db.Column(db.Integer, db.ForeignKey('faculty.id'), nullable=False)
    substitute_faculty_id = db.Column(db.Integer, db.ForeignKey('faculty.id'), nullable=False)
    class_name = db.Column(db.String(50), nullable=True)
    section = db.Column(db.String(10), nullable=True)
    scheduled_date = db.Column(db.Date, nullable=False)
    duration_minutes = db.Column(db.Integer, nullable=True)
    academic_context = db.Column(db.Text, nullable=True)  # JSON: syllabus progress, previous topics
    lesson_content = db.Column(db.Text, nullable=False)  # The AI-generated lesson plan narrative / markdown
    structured_plan = db.Column(db.Text, nullable=True)  # JSON string of structured 12-point lesson plan
    teaching_notes = db.Column(db.Text, nullable=True)  # Substitute's notes after class
    status = db.Column(db.String(20), default='GENERATED')  # GENERATED, VIEWED, IN_PROGRESS, COMPLETED
    feedback = db.Column(db.Text, nullable=True)
    topics_completed = db.Column(db.Text, nullable=True)  # JSON array of completed topics
    has_academic_continuity_warning = db.Column(db.Boolean, default=False)
    continuity_warning_message = db.Column(db.Text, nullable=True)
    is_ai_generated = db.Column(db.Boolean, default=True)
    ai_provider = db.Column(db.String(50), nullable=True)
    ai_model = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    substitution_request = db.relationship('SubstitutionRequest', backref='lesson_plans')
    subject = db.relationship('Subject', backref='lesson_plans')
    original_faculty = db.relationship('Faculty', foreign_keys=[original_faculty_id], backref='lesson_plans_as_original')
    substitute_faculty = db.relationship('Faculty', foreign_keys=[substitute_faculty_id], backref='lesson_plans_as_substitute')

    def get_structured_plan(self):
        if self.structured_plan:
            try:
                return json.loads(self.structured_plan)
            except Exception:
                return None
        return None
    
    def to_dict(self):
        return {
            'id': self.id,
            'substitution_request_id': self.substitution_request_id,
            'subject_id': self.subject_id,
            'subject_name': self.subject.name if self.subject else None,
            'subject_code': self.subject.code if self.subject else None,
            'original_faculty_id': self.original_faculty_id,
            'original_faculty_name': self.original_faculty.name if self.original_faculty else None,
            'substitute_faculty_id': self.substitute_faculty_id,
            'substitute_faculty_name': self.substitute_faculty.name if self.substitute_faculty else None,
            'class_name': self.class_name,
            'section': self.section,
            'scheduled_date': self.scheduled_date.isoformat() if self.scheduled_date else None,
            'duration_minutes': self.duration_minutes,
            'academic_context': json.loads(self.academic_context) if self.academic_context else None,
            'lesson_content': self.lesson_content,
            'structured_plan': self.get_structured_plan(),
            'teaching_notes': self.teaching_notes,
            'status': self.status,
            'feedback': self.feedback,
            'topics_completed': json.loads(self.topics_completed) if self.topics_completed else None,
            'has_academic_continuity_warning': bool(self.has_academic_continuity_warning),
            'continuity_warning_message': self.continuity_warning_message,
            'is_ai_generated': self.is_ai_generated,
            'ai_provider': self.ai_provider,
            'ai_model': self.ai_model,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class HandoverNote(db.Model):
    __tablename__ = 'handover_note'
    id = db.Column(db.Integer, primary_key=True)
    substitution_request_id = db.Column(db.Integer, db.ForeignKey('substitution_request.id'), nullable=True)
    faculty_id = db.Column(db.Integer, db.ForeignKey('faculty.id'), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subject.id'), nullable=False)
    class_name = db.Column(db.String(50), nullable=True)
    section = db.Column(db.String(10), nullable=True)
    current_unit = db.Column(db.String(200), nullable=True)
    completed_topics = db.Column(db.Text, nullable=True)  # JSON array
    current_topic = db.Column(db.String(200), nullable=True)
    next_topics = db.Column(db.Text, nullable=True)  # JSON array
    pending_assignments = db.Column(db.Text, nullable=True)
    student_notes = db.Column(db.Text, nullable=True)
    additional_instructions = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    substitution_request = db.relationship('SubstitutionRequest', backref='handover_notes')
    faculty = db.relationship('Faculty', backref='handover_notes')
    subject = db.relationship('Subject', backref='handover_notes')
    
    def to_dict(self):
        return {
            'id': self.id,
            'substitution_request_id': self.substitution_request_id,
            'faculty_id': self.faculty_id,
            'faculty_name': self.faculty.name if self.faculty else None,
            'subject_id': self.subject_id,
            'subject_name': self.subject.name if self.subject else None,
            'subject_code': self.subject.code if self.subject else None,
            'class_name': self.class_name,
            'section': self.section,
            'current_unit': self.current_unit,
            'completed_topics': json.loads(self.completed_topics) if self.completed_topics else [],
            'current_topic': self.current_topic,
            'next_topics': json.loads(self.next_topics) if self.next_topics else [],
            'pending_assignments': self.pending_assignments,
            'student_notes': self.student_notes,
            'additional_instructions': self.additional_instructions,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


FacultyHandoverNote = HandoverNote


class WorkloadRecord(db.Model):
    __tablename__ = 'workload_record'
    id = db.Column(db.Integer, primary_key=True)
    faculty_id = db.Column(db.Integer, db.ForeignKey('faculty.id'), nullable=False)
    week_start = db.Column(db.Date, nullable=False)
    regular_hours = db.Column(db.Float, default=0.0)
    substitution_hours = db.Column(db.Float, default=0.0)
    total_hours = db.Column(db.Float, default=0.0)
    substitution_count = db.Column(db.Integer, default=0)
    consecutive_hours_max = db.Column(db.Integer, default=0)
    short_notice_count = db.Column(db.Integer, default=0)
    workload_category = db.Column(db.String(20), default='BALANCED')  # UNDERUTILIZED, BALANCED, HIGH, OVERLOADED
    fairness_score = db.Column(db.Float, nullable=True)  # 0-100
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('faculty_id', 'week_start', name='uq_faculty_week'),)
    
    faculty = db.relationship('Faculty', backref='workload_records')
    
    def to_dict(self):
        return {
            'id': self.id,
            'faculty_id': self.faculty_id,
            'faculty_name': self.faculty.name if self.faculty else None,
            'department_name': self.faculty.department.name if self.faculty and self.faculty.department else None,
            'week_start': self.week_start.isoformat() if self.week_start else None,
            'regular_hours': self.regular_hours,
            'substitution_hours': self.substitution_hours,
            'total_hours': self.total_hours,
            'substitution_count': self.substitution_count,
            'consecutive_hours_max': self.consecutive_hours_max,
            'short_notice_count': self.short_notice_count,
            'workload_category': self.workload_category,
            'fairness_score': self.fairness_score,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class AIConfig(db.Model):
    __tablename__ = 'ai_config'
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text, nullable=True)
    description = db.Column(db.String(300), nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'key': self.key,
            'value': self.value,
            'description': self.description,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class WorkloadConfig(db.Model):
    __tablename__ = 'workload_config'
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text, nullable=True)
    description = db.Column(db.String(300), nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'key': self.key,
            'value': self.value,
            'description': self.description,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
