import os
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

db = SQLAlchemy()


def create_app(config_class=None):
    app = Flask(__name__, instance_relative_config=True)
    
    if config_class is None:
        from config import Config
        config_class = Config
    
    app.config.from_object(config_class)
    
    # Ensure instance folder exists
    os.makedirs(app.instance_path, exist_ok=True)
    
    db.init_app(app)
    
    CORS(
        app,
        origins=app.config.get('CORS_ORIGINS', ['http://localhost:5173', 'http://127.0.0.1:5173']),
        supports_credentials=True,
        allow_headers=['Content-Type', 'X-CSRF-Token'],
        methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    )
    
    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.faculty import faculty_bp
    from app.routes.departments import departments_bp
    from app.routes.subjects import subjects_bp
    from app.routes.attendance import attendance_bp
    from app.routes.timetable import timetable_bp
    from app.routes.absences import absences_bp
    from app.routes.substitutions import substitutions_bp
    from app.routes.ai_routes import ai_bp
    from app.routes.notifications import notifications_bp
    from app.routes.reports import reports_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(faculty_bp, url_prefix='/api/faculty')
    app.register_blueprint(departments_bp, url_prefix='/api/departments')
    app.register_blueprint(subjects_bp, url_prefix='/api/subjects')
    app.register_blueprint(attendance_bp, url_prefix='/api/attendance')
    app.register_blueprint(timetable_bp, url_prefix='/api/timetable')
    app.register_blueprint(absences_bp, url_prefix='/api/absences')
    app.register_blueprint(substitutions_bp, url_prefix='/api/substitutions')
    app.register_blueprint(ai_bp, url_prefix='/api/ai')
    app.register_blueprint(notifications_bp, url_prefix='/api/notifications')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({'status': 'ok', 'app': 'SYNCORA Backend', 'version': '1.0.0'})
    
    with app.app_context():
        db.create_all()
    
    return app
