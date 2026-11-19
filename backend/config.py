import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

class Config:
    SECRET_KEY = os.environ.get('FLASK_SECRET_KEY', 'syncora-dev-secret-change-in-prod')
    _db_path = os.path.join(os.path.dirname(__file__), 'instance', 'syncora.db').replace('\\', '/')
    SQLALCHEMY_DATABASE_URI = f'sqlite:///{_db_path}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY', '')
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = False  # True in production with HTTPS
    PERMANENT_SESSION_LIFETIME = timedelta(hours=8)
    CORS_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']
