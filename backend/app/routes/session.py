from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta

from app.models import db, SessionCode, Course, LocationCode
from app.utils.access_control import has_course_access
from app.utils.code_generator import generate_unique_session_code, generate_long_session_code

session_bp = Blueprint('session_bp', __name__, url_prefix='/sessions')


# ------------------- CLEANUP EXPIRED SESSIONS -------------------
def delete_expired_sessions():
    """Remove expired sessions with no attendance linked."""
    now = datetime.utcnow()
    expired_sessions = SessionCode.query.filter(
        SessionCode.expires_at < now
    ).all()

    for session in expired_sessions:
        db.session.delete(session)
    db.session.commit()


# ------------------- CREATE SESSION (WITH LOCATION CODE) -------------------
@session_bp.route('/create-with-location', methods=['POST'])
@jwt_required()
def create_session_with_location():
    admin_id = int(get_jwt_identity())
    delete_expired_sessions()  # clean up before creating a new session

    data = request.get_json()
    course_id = data.get('course_id')
    location_code = data.get('location_code')
    expires_at = data.get('expires_at')

    if not all([course_id, location_code, expires_at]):
        return jsonify({'error': 'course_id, location_code, and expires_at are required'}), 400

    course = Course.query.get_or_404(course_id)
    if not has_course_access(course, admin_id, allow_reps=False):
        return jsonify({'error': 'Access denied'}), 403

    active_session = SessionCode.query.filter(
        SessionCode.course_id == course_id,
        SessionCode.expires_at > datetime.utcnow()
    ).first()
    if active_session:
        return jsonify({'error': 'An active session already exists for this course'}), 409

    location = LocationCode.query.filter_by(code=location_code).first()
    if not location:
        return jsonify({'error': 'Invalid location code'}), 404

    try:
        exp_time = datetime.fromisoformat(expires_at)
    except ValueError:
        return jsonify({'error': 'Invalid expires_at format'}), 400
    if exp_time <= datetime.utcnow():
        return jsonify({'error': 'expires_at must be in the future'}), 400

    session = SessionCode(
        code=generate_unique_session_code(length=6),
        created_at=datetime.utcnow(),
        expires_at=exp_time,
        latitude=location.latitude,
        longitude=location.longitude,
        geo_radius=location.radius,
        admin_id=admin_id,
        course_id=course_id
    )

    db.session.add(session)
    db.session.commit()

    return jsonify({
        'message': 'Session created successfully',
        'session_code': session.code,
        'expires_at': session.expires_at.isoformat(),
        'course_id': session.course_id,
        'location': {
            'latitude': session.latitude,
            'longitude': session.longitude,
            'radius': session.geo_radius
        }
    }), 201


# ------------------- CREATE SESSION (WITH COORDINATES) -------------------
@session_bp.route('/create', methods=['POST'])
@jwt_required()
def create_session_with_coords():
    admin_id = int(get_jwt_identity())
    delete_expired_sessions()  # clean up before creating a new session

    data = request.get_json()
    course_id = data.get('course_id')
    latitude = data.get('latitude')
    longitude = data.get('longitude')

    try:
        radius = float(data.get('radius', 3.0))
        duration_minutes = int(data.get('duration', 10))
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid radius or duration'}), 400

    if not all([latitude, longitude, course_id]):
        return jsonify({'error': 'latitude, longitude and course_id are required'}), 400

    course = Course.query.get_or_404(course_id)
    if not has_course_access(course, admin_id, allow_reps=False):
        return jsonify({'error': 'Access denied'}), 403

    now = datetime.utcnow()
    expires_at = now + timedelta(minutes=duration_minutes)

    session = SessionCode(
        code=generate_long_session_code(length=8),
        created_at=now,
        expires_at=expires_at,
        latitude=latitude,
        longitude=longitude,
        geo_radius=radius,
        admin_id=admin_id,
        course_id=course_id
    )

    db.session.add(session)
    db.session.commit()

    return jsonify({
        'message': 'Session created successfully',
        'code': session.code,
        'expires_at': session.expires_at.isoformat()
    }), 201


# ------------------- READ (MY SESSIONS) -------------------
@session_bp.route('/my-sessions', methods=['GET'])
@jwt_required()
def get_my_sessions():
    admin_id = int(get_jwt_identity())
    delete_expired_sessions()  # clean up before listing sessions

    sessions = SessionCode.query.filter_by(admin_id=admin_id).order_by(SessionCode.created_at.desc()).all()
    data = [{
        'id': s.id,
        'code': s.code,
        'created_at': s.created_at.isoformat() if s.created_at else None,
        'expires_at': s.expires_at.isoformat(),
        'latitude': s.latitude,
        'longitude': s.longitude,
        'radius': s.geo_radius,
        'course_id': s.course_id
    } for s in sessions]

    return jsonify({'sessions': data}), 200


# ------------------- READ (SINGLE SESSION) -------------------
@session_bp.route('/<int:session_id>', methods=['GET'])
@jwt_required()
def get_single_session(session_id):
    admin_id = int(get_jwt_identity())
    delete_expired_sessions()  # clean up before fetching session

    session = SessionCode.query.get_or_404(session_id)
    course = Course.query.get_or_404(session.course_id)

    if not has_course_access(course, admin_id, allow_reps=True):
        return jsonify({'error': 'Access denied'}), 403

    return jsonify({
        'id': session.id,
        'code': session.code,
        'expires_at': session.expires_at.isoformat(),
        'course_id': session.course_id,
        'location': {
            'latitude': session.latitude,
            'longitude': session.longitude,
            'radius': session.geo_radius
        }
    }), 200


# ------------------- READ (COURSE SESSIONS) -------------------
@session_bp.route('/course/<int:course_id>', methods=['GET'])
@jwt_required()
def get_course_sessions(course_id):
    admin_id = int(get_jwt_identity())
    delete_expired_sessions()  # clean up before listing sessions

    course = Course.query.get_or_404(course_id)
    if not has_course_access(course, admin_id, allow_reps=True):
        return jsonify({'error': 'Access denied'}), 403

    sessions = SessionCode.query.filter_by(course_id=course_id).order_by(SessionCode.expires_at.desc()).all()
    data = [{
        'id': s.id,
        'code': s.code,
        'expires_at': s.expires_at.isoformat(),
        'location': {
            'latitude': s.latitude,
            'longitude': s.longitude,
            'radius': s.geo_radius
        }
    } for s in sessions]

    return jsonify({'sessions': data}), 200


# ------------------- DELETE SESSION -------------------
@session_bp.route('/delete/<int:session_id>', methods=['DELETE'])
@jwt_required()
def delete_session(session_id):
    admin_id = int(get_jwt_identity())

    session = SessionCode.query.get_or_404(session_id)
    course = Course.query.get_or_404(session.course_id)

    if not has_course_access(course, admin_id, allow_reps=False):
        return jsonify({'error': 'Access denied'}), 403

    db.session.delete(session)
    db.session.commit()

    return jsonify({'message': 'Session deleted successfully'}), 200
