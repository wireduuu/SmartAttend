from functools import wraps
from flask_jwt_extended import get_jwt_identity
from flask import jsonify
from app.models import Course

def lecturer_owns_course(func):
    @wraps(func)
    def wrapper(course_id, *args, **kwargs):
        user_id = get_jwt_identity()
        course = Course.query.get(course_id)
        if not course or course.lecturer_id != user_id:
            return jsonify({"error": "Access denied"}), 403
        return func(course_id, *args, **kwargs)
    return wrapper
