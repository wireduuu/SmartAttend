from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from app.models import db, Course, CourseRepAccess

stats_bp = Blueprint('stats_bp', __name__, url_prefix='/stats')


@stats_bp.route('/public/department-stats', methods=['GET'])
def public_course_department_stats():
    """
    Public endpoint: Get count of all courses by department.
    """
    results = (
        db.session.query(Course.department, func.count(Course.id))
        .group_by(Course.department)
        .all()
    )
    data = [{"label": dept or "Unknown", "value": count} for dept, count in results]
    return jsonify(data), 200


@stats_bp.route('/private/department-stats', methods=['GET'])
@jwt_required()
def user_course_department_stats():
    """
    Authenticated endpoint: Get count of courses by department for the logged-in user.
    Includes courses the user owns and those they have rep access to.
    """
    # Ensure integer identity
    admin_id = int(get_jwt_identity())

    # Courses owned by the user
    owned_course_ids = db.session.query(Course.id).filter_by(lecturer_id=admin_id).all()
    owned_course_ids = [c.id for c in owned_course_ids]

    # Courses where the user has rep access
    rep_course_ids = db.session.query(CourseRepAccess.course_id).filter_by(rep_id=admin_id).all()
    rep_course_ids = [r.course_id for r in rep_course_ids]

    # Combine course IDs and remove duplicates
    all_course_ids = list(set(owned_course_ids + rep_course_ids))

    if not all_course_ids:
        return jsonify([]), 200

    # Aggregate by department
    stats = (
        db.session.query(Course.department, func.count(Course.id).label("count"))
        .filter(Course.id.in_(all_course_ids))
        .group_by(Course.department)
        .all()
    )

    result = [{"label": dept or "Unknown", "value": count} for dept, count in stats]
    return jsonify(result), 200
