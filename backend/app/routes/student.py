from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from geopy.distance import geodesic
from app.models import db, Student, Attendance, SessionCode

student_bp = Blueprint("student_bp", __name__)


# ------------------ GET STUDENT ATTENDANCE ------------------
@student_bp.route("/attendance", methods=["GET"])
@jwt_required()
def get_attendance():
    """
    Fetch all attendance records for the logged-in student.
    """
    student_id = get_jwt_identity()  # Assume JWT identity is student.id
    student = Student.query.get(student_id)
    if not student:
        return jsonify({"error": "Student not found"}), 404

    records = (
        Attendance.query.filter_by(student_id=student.id)
        .order_by(Attendance.timestamp.desc())
        .all()
    )
    data = [
        {
            "session_id": r.session_id,
            "timestamp": r.timestamp.isoformat(),
            "status": r.status,
            "latitude": r.student_latitude,
            "longitude": r.student_longitude,
        }
        for r in records
    ]
    return jsonify({"attendance": data}), 200


# ------------------ MARK ATTENDANCE ------------------
@student_bp.route("/mark", methods=["POST"])
@jwt_required()
def mark_attendance():
    """
    Mark attendance for a student using a session code and geolocation.
    """
    data = request.get_json()
    session_code = data.get("session_code")
    latitude = data.get("latitude")
    longitude = data.get("longitude")

    if not all([session_code, latitude, longitude]):
        return (
            jsonify({"error": "Session code, latitude, and longitude are required"}),
            400,
        )

    try:
        latitude = float(latitude)
        longitude = float(longitude)
    except ValueError:
        return jsonify({"error": "Latitude and longitude must be numbers"}), 400

    student_id = get_jwt_identity()
    student = Student.query.get(student_id)
    if not student:
        return jsonify({"error": "Student not found"}), 404

    session = SessionCode.query.filter_by(code=session_code).first()
    if not session:
        return jsonify({"error": "Invalid session code"}), 404

    if datetime.utcnow() > session.expires_at:
        return jsonify({"error": "Session has expired"}), 403

    # Check if attendance already exists
    existing = Attendance.query.filter_by(
        student_id=student.id, session_id=session.id
    ).first()
    if existing:
        return jsonify({"error": "Attendance already marked for this session"}), 409

    # Check geolocation distance
    student_loc = (latitude, longitude)
    session_loc = (session.latitude, session.longitude)
    distance = geodesic(student_loc, session_loc).meters
    if distance > session.geo_radius:
        return (
            jsonify(
                {"error": f"Outside allowed location (distance: {round(distance, 2)}m)"}
            ),
            403,
        )

    # Save attendance
    attendance = Attendance(
        student_id=student.id,
        session_id=session.id,
        student_latitude=latitude,
        student_longitude=longitude,
        status="present",
    )
    db.session.add(attendance)
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Attendance marked successfully",
                "session_id": session.id,
                "distance_meters": round(distance, 2),
            }
        ),
        201,
    )
