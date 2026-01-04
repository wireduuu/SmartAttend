from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from sqlalchemy import func

from app.models import db, Course, SessionCode, Attendance, Student, CourseRepAccess
from app.utils.access_control import has_course_access

dashboard_bp = Blueprint("dashboard_bp", __name__, url_prefix="/dashboard")


# ------------------- GLOBAL DASHBOARD SUMMARY -------------------
@dashboard_bp.route("/summary", methods=["GET"])
@jwt_required()
def dashboard_summary():
    admin_id = get_jwt_identity()

    accessible_courses = (
        db.session.query(Course.id)
        .outerjoin(CourseRepAccess, Course.id == CourseRepAccess.course_id)
        .filter((Course.lecturer_id == admin_id) | (CourseRepAccess.rep_id == admin_id))
        .distinct()
    )

    course_count = accessible_courses.count()
    sessions_count = (
        db.session.query(SessionCode)
        .filter(SessionCode.course_id.in_(accessible_courses))
        .count()
    )
    attendance_count = (
        db.session.query(Attendance)
        .join(SessionCode)
        .filter(SessionCode.course_id.in_(accessible_courses))
        .count()
    )
    students_count = (
        db.session.query(Student)
        .join(Attendance)
        .join(SessionCode)
        .filter(SessionCode.course_id.in_(accessible_courses))
        .distinct()
        .count()
    )

    return (
        jsonify(
            {
                "courses": course_count,
                "sessions": sessions_count,
                "attendance_records": attendance_count,
                "students_marked": students_count,
            }
        ),
        200,
    )


# ------------------- ATTENDANCE TREND -------------------
@dashboard_bp.route("/attendance-trend", methods=["GET"])
@jwt_required()
def attendance_trend():
    admin_id = get_jwt_identity()
    days = int(request.args.get("days", 7))
    start_date = datetime.utcnow() - timedelta(days=days)

    accessible_courses = (
        db.session.query(Course.id)
        .outerjoin(CourseRepAccess, Course.id == CourseRepAccess.course_id)
        .filter((Course.lecturer_id == admin_id) | (CourseRepAccess.rep_id == admin_id))
        .distinct()
    )

    trend_data = (
        db.session.query(
            func.date(Attendance.timestamp).label("date"),
            func.count(Attendance.id).label("attendance_count"),
        )
        .join(SessionCode)
        .filter(SessionCode.course_id.in_(accessible_courses))
        .filter(Attendance.timestamp >= start_date)
        .group_by(func.date(Attendance.timestamp))
        .order_by(func.date(Attendance.timestamp))
        .all()
    )

    result = [
        {"date": str(d.date), "attendance_count": d.attendance_count}
        for d in trend_data
    ]
    return jsonify({"trend": result}), 200


# ------------------- COURSE-SPECIFIC SUMMARY -------------------
@dashboard_bp.route("/course-summary/<int:course_id>", methods=["GET"])
@jwt_required()
def course_summary(course_id):
    admin_id = get_jwt_identity()
    course = Course.query.get_or_404(course_id)

    if not has_course_access(course, admin_id, allow_reps=True):
        return jsonify({"error": "Access denied"}), 403

    sessions = SessionCode.query.filter_by(course_id=course_id).all()
    session_count = len(sessions)

    total_attendance = (
        Attendance.query.join(SessionCode)
        .filter(SessionCode.course_id == course_id)
        .count()
    )
    students_count = (
        Attendance.query.join(SessionCode)
        .filter(SessionCode.course_id == course_id)
        .distinct(Attendance.student_id)
        .count()
    )

    return (
        jsonify(
            {
                "course_id": course.id,
                "course_name": course.course_name,
                "sessions_count": session_count,
                "total_attendance": total_attendance,
                "students_marked": students_count,
            }
        ),
        200,
    )


# ------------------- TOP ATTENDING STUDENTS -------------------
@dashboard_bp.route("/top-students/<int:course_id>", methods=["GET"])
@jwt_required()
def top_students(course_id):
    admin_id = get_jwt_identity()
    limit = int(request.args.get("limit", 10))
    course = Course.query.get_or_404(course_id)

    if not has_course_access(course, admin_id, allow_reps=True):
        return jsonify({"error": "Access denied"}), 403

    student_attendance = (
        db.session.query(
            Attendance.student_id, func.count(Attendance.id).label("attendance_count")
        )
        .join(SessionCode)
        .filter(SessionCode.course_id == course_id)
        .group_by(Attendance.student_id)
        .order_by(func.count(Attendance.id).desc())
        .limit(limit)
        .all()
    )

    result = [
        {"student_id": r.student_id, "attendance_count": r.attendance_count}
        for r in student_attendance
    ]
    return jsonify({"top_students": result}), 200


# ------------------- GEO ATTENDANCE INSIGHTS -------------------
@dashboard_bp.route("/geo-insights/<int:course_id>", methods=["GET"])
@jwt_required()
def geo_attendance_insights(course_id):
    admin_id = get_jwt_identity()
    course = Course.query.get_or_404(course_id)

    if not has_course_access(course, admin_id, allow_reps=True):
        return jsonify({"error": "Access denied"}), 403

    records = (
        db.session.query(
            SessionCode.id,
            SessionCode.latitude,
            SessionCode.longitude,
            Attendance.student_latitude,
            Attendance.student_longitude,
        )
        .join(Attendance)
        .filter(SessionCode.course_id == course_id)
        .all()
    )

    geo_data = [
        {
            "session_id": r.id,
            "session_location": {"latitude": r.latitude, "longitude": r.longitude},
            "student_location": {
                "latitude": r.student_latitude,
                "longitude": r.student_longitude,
            },
        }
        for r in records
    ]
    return jsonify({"geo_data": geo_data}), 200


# ------------------- ALL-IN-ONE COURSE DASHBOARD -------------------
@dashboard_bp.route("/course-dashboard/<int:course_id>", methods=["GET"])
@jwt_required()
def course_dashboard(course_id):
    admin_id = get_jwt_identity()
    course = Course.query.get_or_404(course_id)

    if not has_course_access(course, admin_id, allow_reps=True):
        return jsonify({"error": "Access denied"}), 403

    # Summary
    sessions = SessionCode.query.filter_by(course_id=course_id).all()
    session_count = len(sessions)
    total_attendance = (
        Attendance.query.join(SessionCode)
        .filter(SessionCode.course_id == course_id)
        .count()
    )
    students_count = (
        Attendance.query.join(SessionCode)
        .filter(SessionCode.course_id == course_id)
        .distinct(Attendance.student_id)
        .count()
    )

    # Attendance trend (last 7 days)
    start_date = datetime.utcnow() - timedelta(days=7)
    trend_data = (
        db.session.query(
            func.date(Attendance.timestamp).label("date"),
            func.count(Attendance.id).label("attendance_count"),
        )
        .join(SessionCode)
        .filter(SessionCode.course_id == course_id)
        .filter(Attendance.timestamp >= start_date)
        .group_by(func.date(Attendance.timestamp))
        .order_by(func.date(Attendance.timestamp))
        .all()
    )
    trend = [
        {"date": str(d.date), "attendance_count": d.attendance_count}
        for d in trend_data
    ]

    # Top students (default top 10)
    top_students_data = (
        db.session.query(
            Attendance.student_id, func.count(Attendance.id).label("attendance_count")
        )
        .join(SessionCode)
        .filter(SessionCode.course_id == course_id)
        .group_by(Attendance.student_id)
        .order_by(func.count(Attendance.id).desc())
        .limit(10)
        .all()
    )
    top_students_list = [
        {"student_id": r.student_id, "attendance_count": r.attendance_count}
        for r in top_students_data
    ]

    # Geo insights
    geo_records = (
        db.session.query(
            SessionCode.id,
            SessionCode.latitude,
            SessionCode.longitude,
            Attendance.student_latitude,
            Attendance.student_longitude,
        )
        .join(Attendance)
        .filter(SessionCode.course_id == course_id)
        .all()
    )
    geo_data = [
        {
            "session_id": r.id,
            "session_location": {"latitude": r.latitude, "longitude": r.longitude},
            "student_location": {
                "latitude": r.student_latitude,
                "longitude": r.student_longitude,
            },
        }
        for r in geo_records
    ]

    return (
        jsonify(
            {
                "summary": {
                    "course_id": course.id,
                    "course_name": course.course_name,
                    "sessions_count": session_count,
                    "total_attendance": total_attendance,
                    "students_marked": students_count,
                },
                "attendance_trend": trend,
                "top_students": top_students_list,
                "geo_insights": geo_data,
            }
        ),
        200,
    )
