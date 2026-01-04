from app.models import Course, CourseRepAccess

def has_session_access(session, admin_id: int, allow_reps: bool = False) -> bool:
    """
    Check if a user has access to a session.
    """
    if session.admin_id == admin_id:
        return True
    if allow_reps:
        rep_access = CourseRepAccess.query.filter_by(
            rep_id=admin_id,
            course_id=session.course_id,
            approved_by_lecturer=True
        ).first()
        return rep_access is not None
    return False


def has_course_access(course, admin_id: int, allow_reps: bool = False) -> bool:
    """
    Check if a user has access to a course.
    """
    if course.lecturer_id == admin_id:
        return True
    if allow_reps:
        rep_access = CourseRepAccess.query.filter_by(
            rep_id=admin_id,
            course_id=course.id
        ).first()
        return rep_access is not None
    return False


def has_model_access(model_course_id: int, admin_id: int, allow_reps: bool = False) -> bool:
    """
    Generic check if a user has access to a model tied to a course ID.
    """
    course = Course.query.get(model_course_id)
    if not course:
        return False
    if course.lecturer_id == admin_id:
        return True
    if allow_reps:
        rep_access = CourseRepAccess.query.filter_by(
            course_id=model_course_id,
            rep_id=admin_id
        ).first()
        return rep_access is not None
    return False
