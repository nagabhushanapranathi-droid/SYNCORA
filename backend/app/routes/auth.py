from datetime import date, datetime
from flask import Blueprint, request, jsonify, session, g
from app import db
from app.models.models import User, Attendance
from app.utils.auth import (
    get_current_user,
    require_auth,
    generate_csrf_token,
)
from app.utils.helpers import success_response, error_response

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/csrf-token', methods=['GET'])
def get_csrf():
    token = generate_csrf_token()
    return jsonify({'csrf_token': token})


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    
    if not email or not password:
        return error_response('Email and password are required', code='INVALID_INPUT', status=400)
    
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return error_response('Invalid email or password', code='INVALID_CREDENTIALS', status=401)
    
    if not user.is_active:
        return error_response('User account is inactive', code='ACCOUNT_INACTIVE', status=403)
    
    # Establish session
    session.permanent = True
    session['user_id'] = user.id
    session['user_role'] = user.role
    session['user_name'] = user.name
    csrf_token = generate_csrf_token()
    
    # If faculty, mark today's attendance PRESENT
    if user.role == 'faculty' and user.faculty_id:
        today = date.today()
        now_time = datetime.now().time()
        att = Attendance.query.filter_by(faculty_id=user.faculty_id, date=today).first()
        if not att:
            att = Attendance(
                faculty_id=user.faculty_id,
                date=today,
                login_time=now_time,
                status='PRESENT'
            )
            db.session.add(att)
        else:
            att.status = 'PRESENT'
            if not att.login_time:
                att.login_time = now_time
        db.session.commit()
        
    return jsonify({
        'success': True,
        'user': user.to_dict(),
        'csrf_token': csrf_token
    })


@auth_bp.route('/logout', methods=['POST'])
def logout():
    user = get_current_user()
    if user and user.role == 'faculty' and user.faculty_id:
        today = date.today()
        now_time = datetime.now().time()
        att = Attendance.query.filter_by(faculty_id=user.faculty_id, date=today).first()
        if att:
            att.status = 'LOGGED_OUT'
            att.logout_time = now_time
            db.session.commit()
            
    session.clear()
    return success_response(message='Logged out successfully')


@auth_bp.route('/me', methods=['GET'])
@require_auth
def get_me():
    return success_response(data=g.current_user.to_dict())
