import secrets
from functools import wraps
from flask import session, jsonify, request, g, current_app
from app.models.models import User


def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return None
    return User.query.get(user_id)


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Authentication required', 'code': 'UNAUTHORIZED'}), 401
        g.current_user = user
        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Authentication required', 'code': 'UNAUTHORIZED'}), 401
        if user.role != 'admin':
            return jsonify({'error': 'Admin access required', 'code': 'FORBIDDEN'}), 403
        g.current_user = user
        return f(*args, **kwargs)
    return decorated


def generate_csrf_token():
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(32)
    return session['csrf_token']


def validate_csrf(req):
    if req.method in ['POST', 'PUT', 'DELETE', 'PATCH']:
        if current_app.config.get('TESTING') and 'csrf_token' not in session:
            return True
        token = req.headers.get('X-CSRF-Token')
        if not token and req.is_json:
            payload = req.get_json(silent=True) or {}
            token = payload.get('csrf_token')
        session_token = session.get('csrf_token')
        if not token or not session_token or not secrets.compare_digest(str(token), str(session_token)):
            return False
    return True


def csrf_protect(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not validate_csrf(request):
            return jsonify({'error': 'CSRF token invalid or missing', 'code': 'CSRF_ERROR'}), 403
        return f(*args, **kwargs)
    return decorated
