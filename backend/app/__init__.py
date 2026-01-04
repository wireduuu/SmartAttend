from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
from datetime import timedelta
import os

from app.extensions import db, jwt, bcrypt
from app.utils.cleanup import delete_expired_sessions

load_dotenv()


def create_app():
    app = Flask(__name__, instance_relative_config=True)

    # CORS for React frontend
    CORS(
        app,
        resources={r"/*": {"origins": ["http://localhost:5173"]}},
        supports_credentials=True,
    )

    # Instance folder
    os.makedirs(app.instance_path, exist_ok=True)

    db_path = os.path.join(app.instance_path, "geopresence.db")
    app.config.update(
        SQLALCHEMY_DATABASE_URI=f"sqlite:///{db_path}",
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        JWT_SECRET_KEY=os.getenv("JWT_SECRET_KEY", "myjwtsecret"),
        JWT_TOKEN_LOCATION=["headers"],
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(seconds=30),
        JWT_REFRESH_TOKEN_EXPIRES=timedelta(minutes=2),
    )

    # Init extensions
    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)

    # JWT user loader
    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        from app.models import Admin

        identity = jwt_data["sub"]
        return Admin.query.get(identity)

    # Blueprints
    from app.routes.login import auth_bp
    from app.routes.student import student_bp
    from app.routes.admin import admin_bp
    from app.routes.course import course_bp
    from app.routes.attendance import attendance_bp
    from app.routes.session import session_bp
    from app.routes.stats import stats_bp
    from app.routes.test import test_bp

    # Short endpoints
    app.register_blueprint(auth_bp)  # /login, /register, /logout
    app.register_blueprint(student_bp, url_prefix="/students")
    app.register_blueprint(admin_bp, url_prefix="/admins")
    app.register_blueprint(course_bp, url_prefix="/courses")
    app.register_blueprint(attendance_bp, url_prefix="/attendance")
    app.register_blueprint(session_bp, url_prefix="/sessions")
    app.register_blueprint(stats_bp, url_prefix="/stats")
    app.register_blueprint(test_bp)

    @app.route("/health")
    def health_check():
        return jsonify({"status": "GeoPresence API running"})

    with app.app_context():
        db.create_all()
        delete_expired_sessions()

    return app
