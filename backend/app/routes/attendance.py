from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from geopy.distance import geodesic
import csv
from sqlalchemy import or_

from app.models import db, SessionCode, Student, Attendance, Course, CourseRepAccess
from app.utils.access_control import has_course_access

attendance_bp = Blueprint("attendance_bp", __name__)


# ------------------- CLEANUP EXPIRED SESSIONS -------------------
def delete_expired_sessions():
    """
    Delete expired sessions that have no attendance records.
    Returns the number of sessions deleted.
    """
    now = datetime.utcnow()
    expired_sessions = SessionCode.query.filter(
        SessionCode.expires_at < now, ~SessionCode.attendance_records.any()
    ).all()

    count = len(expired_sessions)
    for session in expired_sessions:
        db.session.delete(session)

    db.session.commit()
    return count


# ------------------- MARK ATTENDANCE -------------------
@attendance_bp.route("/mark-attendance", methods=["POST"])
def mark_attendance():
    delete_expired_sessions()  # cleanup before marking

    data = request.get_json()
    code = data.get("session_code")
    index_number = data.get("index_number")
    email = data.get("email")
    try:
        latitude = float(data.get("latitude"))
        longitude = float(data.get("longitude"))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid latitude or longitude"}), 400

    if not all([code, index_number, email, latitude, longitude]):
        return jsonify({"error": "All fields are required"}), 400

    session = SessionCode.query.filter_by(code=code).first()
    if not session:
        return jsonify({"error": "Invalid session code"}), 404
    if datetime.utcnow() > session.expires_at:
        return jsonify({"error": "Session code has expired"}), 403

    student = Student.query.filter_by(index_number=index_number, email=email).first()
    if not student:
        return jsonify({"error": "Student not found"}), 404

    if Attendance.query.filter_by(student_id=student.id, session_id=session.id).first():
        return jsonify({"error": "Attendance already marked for this session"}), 409

    distance = round(
        geodesic((latitude, longitude), (session.latitude, session.longitude)).meters, 2
    )
    if distance > session.geo_radius:
        return (
            jsonify({"error": f"Outside allowed location (distance: {distance}m)"}),
            403,
        )

    attendance = Attendance(
        student_id=student.id,
        session_id=session.id,
        student_latitude=latitude,
        student_longitude=longitude,
        status="present",
    )

    db.session.add(attendance)
    db.session.commit()
    return jsonify({"message": "Attendance marked", "distance": distance}), 201


# ------------------- VIEW ATTENDANCE -------------------
@attendance_bp.route("/by-session/<int:session_id>", methods=["GET"])
@jwt_required()
def view_attendance_by_session(session_id):
    admin_id = get_jwt_identity()
    session = SessionCode.query.get_or_404(session_id)
    course = Course.query.get(session.course_id)

    if not has_course_access(course, admin_id, allow_reps=True):
        return jsonify({"error": "Access denied"}), 403

    records = Attendance.query.filter_by(session_id=session_id).all()
    result = [
        {
            "student_id": r.student_id,
            "timestamp": r.timestamp.isoformat(),
            "status": r.status,
        }
        for r in records
    ]
    return jsonify({"attendance": result}), 200


@attendance_bp.route("/course/<int:course_id>", methods=["GET"])
@jwt_required()
def get_attendance_by_course(course_id):
    admin_id = get_jwt_identity()
    course = Course.query.get_or_404(course_id)

    if not has_course_access(course, admin_id, allow_reps=True):
        return jsonify({"error": "Access denied"}), 403

    session_ids = [s.id for s in SessionCode.query.filter_by(course_id=course_id)]
    records = (
        Attendance.query.filter(Attendance.session_id.in_(session_ids))
        .order_by(Attendance.timestamp.desc())
        .all()
    )

    result = [
        {
            "student_id": r.student_id,
            "timestamp": r.timestamp.isoformat(),
            "session_id": r.session_id,
            "status": r.status,
        }
        for r in records
    ]
    return jsonify({"attendance": result}), 200


@attendance_bp.route("/<int:session_id>", methods=["GET"])
@jwt_required()
def get_attendance_for_session(session_id):
    admin_id = get_jwt_identity()
    session = SessionCode.query.get_or_404(session_id)
    course = Course.query.get(session.course_id)

    if not has_course_access(course, admin_id, allow_reps=True):
        return jsonify({"error": "Access denied"}), 403

    records = Attendance.query.filter_by(session_id=session_id).all()
    result = [
        {
            "id": r.id,
            "student_id": r.student_id,
            "timestamp": r.timestamp.isoformat(),
            "status": r.status,
        }
        for r in records
    ]
    return jsonify({"attendance": result}), 200


@attendance_bp.route("/student/<string:index_number>", methods=["GET"])
@jwt_required()
def get_attendance_for_student(index_number):
    admin_id = get_jwt_identity()

    accessible_ids = (
        db.session.query(Course.id)
        .outerjoin(CourseRepAccess, Course.id == CourseRepAccess.course_id)
        .filter(or_(Course.lecturer_id == admin_id, CourseRepAccess.rep_id == admin_id))
        .distinct()
        .subquery()
    )

    session_ids = (
        db.session.query(SessionCode.id)
        .filter(SessionCode.course_id.in_(accessible_ids))
        .subquery()
    )
    records = (
        Attendance.query.join(Student)
        .filter(
            Attendance.session_id.in_(session_ids), Student.index_number == index_number
        )
        .all()
    )

    result = [
        {
            "session_id": r.session_id,
            "timestamp": r.timestamp.isoformat(),
            "status": r.status,
        }
        for r in records
    ]
    return jsonify({"attendance": result}), 200


# ------------------- DELETE ATTENDANCE -------------------
@attendance_bp.route("/delete/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_attendance(id):
    admin_id = get_jwt_identity()
    record = Attendance.query.get_or_404(id)
    course = Course.query.get(SessionCode.query.get(record.session_id).course_id)

    if not has_course_access(course, admin_id, allow_reps=False):
        return jsonify({"error": "Access denied"}), 403

    db.session.delete(record)
    db.session.commit()
    return jsonify({"message": "Attendance deleted"}), 200


@attendance_bp.route("/delete/by-session/<int:session_id>", methods=["DELETE"])
@jwt_required()
def delete_attendance_by_session(session_id):
    admin_id = get_jwt_identity()
    session = SessionCode.query.get_or_404(session_id)
    course = Course.query.get(session.course_id)

    if not has_course_access(course, admin_id):
        return jsonify({"error": "Access denied"}), 403

    Attendance.query.filter_by(session_id=session_id).delete()
    db.session.commit()
    return jsonify({"message": "Deleted successfully"}), 200


# ------------------- FILTER -------------------
@attendance_bp.route("/filter", methods=["GET"])
@jwt_required()
def filter_attendance():
    admin_id = get_jwt_identity()
    from_date = request.args.get("from")
    to_date = request.args.get("to")
    course_id = request.args.get("course_id")
    session_id = request.args.get("session_id")
    index_number = request.args.get("index_number")

    query = (
        Attendance.query.join(SessionCode)
        .join(Course)
        .join(Student)
        .filter(
            or_(
                Course.lecturer_id == admin_id,
                Course.id.in_(
                    db.session.query(CourseRepAccess.course_id).filter(
                        CourseRepAccess.rep_id == admin_id
                    )
                ),
            )
        )
    )

    if course_id:
        query = query.filter(SessionCode.course_id == course_id)
    if session_id:
        query = query.filter(Attendance.session_id == session_id)
    if index_number:
        query = query.filter(Student.index_number == index_number)
    if from_date:
        query = query.filter(Attendance.timestamp >= datetime.fromisoformat(from_date))
    if to_date:
        query = query.filter(Attendance.timestamp <= datetime.fromisoformat(to_date))

    results = query.all()
    data = [
        {
            "student": r.student.index_number,
            "timestamp": r.timestamp.isoformat(),
            "status": r.status,
            "session_id": r.session_id,
        }
        for r in results
    ]

    return jsonify({"filtered": data}), 200


# ------------------- EXPORT -------------------
@attendance_bp.route("/export", methods=["GET"])
@jwt_required()
def export_attendance_csv():
    admin_id = get_jwt_identity()
    course_id = request.args.get("course_id")

    query = (
        Attendance.query.join(SessionCode)
        .join(Course)
        .join(Student)
        .filter(
            or_(
                Course.lecturer_id == admin_id,
                Course.id.in_(
                    db.session.query(CourseRepAccess.course_id).filter(
                        CourseRepAccess.rep_id == admin_id
                    )
                ),
            )
        )
    )

    if course_id:
        query = query.filter(SessionCode.course_id == course_id)

    records = query.yield_per(100)

    def generate():
        yield "Index Number,Session ID,Timestamp,Status\n"
        for r in records:
            yield f"{r.student.index_number},{r.session_id},{r.timestamp},{r.status}\n"

    return Response(
        generate(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=attendance.csv"},
    )
