from flask import Blueprint, request, jsonify, make_response
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
    set_access_cookies,
    unset_jwt_cookies,
)
from datetime import datetime, timedelta
from app.utils.code_generator import generate_unique_session_code
from app.models import db, Admin, Student, Course, SessionCode, CourseSession
from flask_bcrypt import Bcrypt

admin_bp = Blueprint("admin_bp", __name__)
bcrypt = Bcrypt()


@admin_bp.route("/register", methods=["POST"])
def register_admin():
    data = request.get_json()
    full_name = data.get("full_name")
    email = data.get("email")
    password = data.get("password")

    if Admin.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409

    hashed_pw = bcrypt.generate_password_hash(password).decode("utf-8")
    new_admin = Admin(full_name=full_name, email=email, password_hash=hashed_pw)
    db.session.add(new_admin)
    db.session.commit()
    return jsonify({"message": "Admin registered successfully"}), 201


# ---------------------- SEEDING ----------------------
@admin_bp.route("/seed-admin", methods=["POST"])
def seed_admin():
    existing = Admin.query.filter_by(email="admin@example.com").first()
    if existing:
        token = create_access_token(identity=str(existing.id))
        return jsonify({"message": "Admin already exists", "token": token}), 200

    new_admin = Admin(
        full_name="System Admin",
        email="admin@example.com",
        password_hash=bcrypt.generate_password_hash("admin123").decode("utf-8"),
    )
    db.session.add(new_admin)
    db.session.commit()
    token = create_access_token(identity=str(new_admin.id))
    return (
        jsonify(
            {
                "message": "Admin seeded successfully",
                "email": new_admin.email,
                "password": "admin123",
                "token": token,
            }
        ),
        201,
    )


@admin_bp.route("/seed-data", methods=["POST"])
def seed_sample_data():
    try:
        existing_admin = Admin.query.filter_by(email="admin@example.com").first()
        if not existing_admin:
            admin = Admin(
                full_name="System Admin",
                email="admin@example.com",
                password_hash=generate_password_hash("admin123"),
            )
            db.session.add(admin)
            db.session.flush()
        else:
            admin = existing_admin

        students = [
            {"index": "STU001", "name": "Alice Johnson", "email": "alice@example.com"},
            {"index": "STU002", "name": "Bob Smith", "email": "bob@example.com"},
            {
                "index": "STU003",
                "name": "Charlie Brown",
                "email": "charlie@example.com",
            },
            {"index": "STU004", "name": "Diana King", "email": "diana@example.com"},
            {"index": "STU005", "name": "Elvis Pratt", "email": "elvis@example.com"},
        ]
        for s in students:
            if not Student.query.filter_by(index_number=s["index"]).first():
                db.session.add(
                    Student(
                        index_number=s["index"], full_name=s["name"], email=s["email"]
                    )
                )

        courses = [
            {"course_code": "CSE101", "course_name": "Intro to CS"},
            {"course_code": "MTH201", "course_name": "Calculus II"},
            {"course_code": "PHY102", "course_name": "Physics I"},
            {"course_code": "ENG103", "course_name": "English Literature"},
            {"course_code": "BIO110", "course_name": "Biology Fundamentals"},
        ]
        for c in courses:
            if not Course.query.filter_by(course_code=c["course_code"]).first():
                db.session.add(
                    Course(
                        course_code=c["course_code"],
                        course_name=c["course_name"],
                        department="Science",
                        semester="First",
                        lecturer_id=admin.id,
                    )
                )

        db.session.commit()
        return jsonify({"message": "Sample admin, students, and courses created."}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ---------------------- COURSES ----------------------
@admin_bp.route("/courses", methods=["POST"])
@jwt_required()
def add_course():
    data = request.get_json()
    required = ["course_code", "course_name", "department", "semester"]
    if not all(field in data for field in required):
        return jsonify({"error": "Missing required fields"}), 400

    admin_id = int(get_jwt_identity())
    if not Admin.query.get(admin_id):
        return jsonify({"error": "Unauthorized"}), 403

    if Course.query.filter_by(course_code=data["course_code"]).first():
        return jsonify({"error": "Course code already exists"}), 409

    course = Course(
        course_code=data["course_code"],
        course_name=data["course_name"],
        department=data["department"],
        semester=data["semester"],
        lecturer_id=admin_id,
    )
    db.session.add(course)
    db.session.commit()
    return jsonify({"message": "Course added", "course_id": course.id}), 201


@admin_bp.route("/courses", methods=["GET"])
@jwt_required()
def get_all_courses():
    admin_id = int(get_jwt_identity())
    courses = (
        Course.query.filter_by(lecturer_id=admin_id)
        .order_by(Course.course_name.asc())
        .all()
    )

    return (
        jsonify(
            [
                {
                    "id": c.id,
                    "course_code": c.course_code,
                    "course_name": c.course_name,
                    "department": c.department,
                    "semester": c.semester,
                }
                for c in courses
            ]
        ),
        200,
    )


@admin_bp.route("/courses/<int:course_id>", methods=["DELETE"])
@jwt_required()
def delete_course(course_id):
    admin_id = int(get_jwt_identity())
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({"error": "Unauthorized"}), 403

    course = Course.query.get(course_id)
    if not course:
        return jsonify({"error": "Course not found"}), 404

    if course.lecturer_id != admin_id:
        return jsonify({"error": "Permission denied"}), 403

    db.session.delete(course)
    db.session.commit()
    return jsonify({"message": f"Course {course.course_code} deleted"}), 200


# ---------------------- SESSION + CODE ----------------------
@admin_bp.route("/location-code", methods=["GET", "POST"])
@jwt_required()
def location_code():
    admin_id = int(get_jwt_identity())
    if request.method == "GET":
        codes = SessionCode.query.order_by(SessionCode.created_at.desc()).all()
        return (
            jsonify(
                [
                    {
                        "id": c.id,
                        "code": c.code,
                        "created_at": c.created_at.isoformat(),
                        "expires_at": c.expires_at.isoformat(),
                        "latitude": c.latitude,
                        "longitude": c.longitude,
                        "geo_radius": c.geo_radius,
                        "admin_id": c.admin_id,
                        "course_id": c.course_id,
                    }
                    for c in codes
                ]
            ),
            200,
        )

    data = request.get_json()
    required = ["expires_in_minutes", "latitude", "longitude", "admin_id"]
    if not all(field in data for field in required):
        return jsonify({"error": "Missing fields"}), 400

    code = data.get("code") or generate_unique_session_code()
    if SessionCode.query.filter_by(code=code).first():
        return jsonify({"error": "Code already exists"}), 409

    try:
        new_code = SessionCode(
            code=code,
            expires_at=datetime.utcnow()
            + timedelta(minutes=int(data["expires_in_minutes"])),
            latitude=float(data["latitude"]),
            longitude=float(data["longitude"]),
            geo_radius=float(data.get("geo_radius", 3.0)),
            admin_id=admin_id,
            course_id=data.get("course_id"),
        )
        db.session.add(new_code)
        db.session.commit()
        return jsonify({"message": "Code created"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/location-code/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_location_code(id):
    code = SessionCode.query.get(id)
    if not code:
        return jsonify({"error": "Session code not found"}), 404
    db.session.delete(code)
    db.session.commit()
    return jsonify({"message": f"Session code {id} deleted"}), 200


@admin_bp.route("/create-session", methods=["POST"])
@jwt_required()
def create_course_session():
    data = request.get_json()
    if not data.get("course_id") or not data.get("location_id"):
        return jsonify({"error": "Missing fields"}), 400
    session = CourseSession(
        course_id=data["course_id"], location_id=data["location_id"]
    )
    db.session.add(session)
    db.session.commit()
    return jsonify({"message": "Session created", "session_id": session.id}), 201


# Get current admin profile
@admin_bp.route("/me", methods=["GET"])
@jwt_required()
def get_profile():
    admin_id = int(get_jwt_identity())
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({"error": "Admin not found"}), 404

    return (
        jsonify({"id": admin.id, "full_name": admin.full_name, "email": admin.email}),
        200,
    )


# Update admin profile
@admin_bp.route("/me", methods=["PUT"])
@jwt_required()
def update_profile():
    admin_id = int(get_jwt_identity())
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({"error": "Admin not found"}), 404

    data = request.get_json()
    full_name = data.get("full_name")
    email = data.get("email")

    if full_name:
        admin.full_name = full_name
    if email:
        existing_email = Admin.query.filter_by(email=email).first()
        if existing_email and existing_email.id != admin.id:
            return jsonify({"error": "Email already taken"}), 400
        admin.email = email

    db.session.commit()

    return jsonify({"message": "Profile updated successfully"}), 200


# Delete current admin
@admin_bp.route("/me", methods=["DELETE"])
@jwt_required()
def delete_admin():
    admin_id = int(get_jwt_identity())
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({"error": "Admin not found"}), 404

    db.session.delete(admin)
    db.session.commit()
    return jsonify({"message": "Admin deleted successfully"}), 200


# Get all admins
@admin_bp.route("/", methods=["GET"])
@jwt_required()
def get_all_admins():
    admins = Admin.query.all()
    result = [
        {"id": admin.id, "full_name": admin.full_name, "email": admin.email}
        for admin in admins
    ]
    return jsonify(result), 200


# Create new admin (internal use or future admin registration UI)
@admin_bp.route("/", methods=["POST"])
@jwt_required()
def create_admin():
    data = request.get_json()
    full_name = data.get("full_name")
    email = data.get("email")
    password = data.get("password")

    if not full_name or not email or not password:
        return jsonify({"error": "Missing fields"}), 400

    if Admin.query.filter_by(email=email).first():
        return jsonify({"error": "Email already exists"}), 409

    new_admin = Admin(full_name=full_name, email=email)
    new_admin.set_password(password)
    db.session.add(new_admin)
    db.session.commit()

    return jsonify({"message": "Admin created successfully"}), 201
