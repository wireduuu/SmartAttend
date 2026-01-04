# app/routes/test.py
from flask import Blueprint, jsonify
from app.models import Course

test_bp = Blueprint("test_bp", __name__)

@test_bp.route("/test_course/<int:id>")
def test_course(id):
    course = Course.query.get(id)
    if course:
        return {
            "id": course.id,
            "code": course.course_code,
            "name": course.course_name
        }
    return {"error": "Course not found"}
