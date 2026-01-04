from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_, func
from datetime import datetime
from io import BytesIO, StringIO
import pandas as pd
import csv
from sqlalchemy.exc import IntegrityError

from app.models import db, Course, CourseRepAccess, Attendance, SessionCode
from app.utils.access_control import has_course_access
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

course_bp = Blueprint('course_bp', __name__)


# ------------------- CREATE -------------------
@course_bp.route('/', methods=['POST'])
@jwt_required()
def add_course():
    data = request.get_json()
    lecturer_id = int(get_jwt_identity())

    course_code = data.get('course_code')
    course_name = data.get('course_name')
    department = data.get('department')
    semester = data.get('semester')

    if not all([course_code, course_name, department, semester]):
        return jsonify({"error": "Missing required fields"}), 400

    if Course.query.filter_by(course_code=course_code.strip()).first():
        return jsonify({"error": "Course code already exists"}), 400

    course = Course(
        course_code=course_code.strip(),
        course_name=course_name.strip(),
        department=department.strip(),
        semester=semester.strip(),
        lecturer_id=lecturer_id
    )

    try:
        db.session.add(course)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Course code already exists"}), 400

    return jsonify({'message': 'Course added successfully'}), 201


# ------------------- READ -------------------
@course_bp.route('/', methods=['GET'])
@jwt_required()
def get_course_dropdown_list():
    admin_id = int(get_jwt_identity())

    accessible_ids = db.session.query(Course.id).outerjoin(
        CourseRepAccess, Course.id == CourseRepAccess.course_id
    ).filter(
        or_(
            Course.lecturer_id == admin_id,
            CourseRepAccess.rep_id == admin_id
        )
    )

    courses = Course.query.filter(Course.id.in_(accessible_ids)).all()

    return jsonify([
        {'id': c.id, 'code': c.course_code, 'name': c.course_name}
        for c in courses
    ]), 200


@course_bp.route('/all', methods=['GET'])
@jwt_required()
def get_courses():
    admin_id = int(get_jwt_identity())

    search = request.args.get('search', '').lower().strip()
    department = request.args.get('department')
    semester = request.args.get('semester')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))

    accessible_ids = db.session.query(Course.id).outerjoin(
        CourseRepAccess, Course.id == CourseRepAccess.course_id
    ).filter(
        or_(
            Course.lecturer_id == admin_id,
            CourseRepAccess.rep_id == admin_id
        )
    )

    query = Course.query.filter(Course.id.in_(accessible_ids))

    if search:
        query = query.filter(
            or_(
                func.lower(Course.course_code).like(f"%{search}%"),
                func.lower(Course.course_name).like(f"%{search}%")
            )
        )

    if department:
        query = query.filter(func.lower(Course.department) == department.lower())
    if semester:
        query = query.filter(func.lower(Course.semester) == semester.lower())

    paginated = query.order_by(Course.course_name.asc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        'total': paginated.total,
        'page': paginated.page,
        'per_page': paginated.per_page,
        'pages': paginated.pages,
        'courses': [
            {
                'id': c.id,
                'course_code': c.course_code,
                'course_name': c.course_name,
                'department': c.department,
                'semester': c.semester
            } for c in paginated.items
        ]
    }), 200


@course_bp.route('/<int:id>', methods=['GET'])
@jwt_required()
def get_course(id):
    admin_id = int(get_jwt_identity())
    course = Course.query.get_or_404(id)

    if not has_course_access(course, admin_id, allow_reps=True):
        return jsonify({'error': 'Access denied or course not found'}), 403

    return jsonify({
        'id': course.id,
        'course_code': course.course_code,
        'course_name': course.course_name,
        'department': course.department,
        'semester': course.semester
    }), 200


# ------------------- UPDATE -------------------
@course_bp.route('/<int:course_id>', methods=['PUT'])
@jwt_required()
def update_course(course_id):
    admin_id = int(get_jwt_identity())
    course = Course.query.get_or_404(course_id)

    if not has_course_access(course, admin_id, allow_reps=False):
        return jsonify({'error': 'Unauthorized to update this course'}), 403

    data = request.get_json()
    new_code = data.get('course_code')

    if new_code and new_code != course.course_code:
        if Course.query.filter_by(course_code=new_code.strip()).first():
            return jsonify({'error': 'Course code already exists'}), 400
        course.course_code = new_code.strip()

    course.course_name = data.get('course_name', course.course_name)
    course.department = data.get('department', course.department)
    course.semester = data.get('semester', course.semester)

    db.session.commit()
    return jsonify({'message': 'Course updated successfully'}), 200


# ------------------- DELETE -------------------
@course_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_course(id):
    admin_id = int(get_jwt_identity())
    course = Course.query.get_or_404(id)

    if not has_course_access(course, admin_id, allow_reps=False):
        return jsonify({'error': 'Access denied or course not found'}), 403

    db.session.delete(course)
    db.session.commit()
    return jsonify({'message': 'Course deleted successfully'}), 200


@course_bp.route('/attendance/delete/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_attendance(id):
    admin_id = int(get_jwt_identity())
    record = Attendance.query.get_or_404(id)
    session = SessionCode.query.get_or_404(record.session_id)
    course = Course.query.get_or_404(session.course_id)

    if not has_course_access(course, admin_id, allow_reps=False):
        return jsonify({'error': 'Access denied'}), 403

    db.session.delete(record)
    db.session.commit()
    return jsonify({'message': 'Attendance record deleted'}), 200


# ------------------- IMPORT -------------------
@course_bp.route('/import', methods=['POST'])
@jwt_required()
def import_courses():
    admin_id = int(get_jwt_identity())

    if 'file' not in request.files:
        return jsonify({'error': 'CSV file is required'}), 400

    file = request.files['file']
    if not file.filename.endswith('.csv'):
        return jsonify({'error': 'Only CSV files are allowed'}), 400

    stream = StringIO(file.stream.read().decode("UTF8"))
    reader = csv.DictReader(stream)

    imported = 0
    skipped = []

    try:
        for row in reader:
            if not row.get('course_code') or not row.get('course_name'):
                skipped.append({'row': row, 'reason': 'Missing course_code or course_name'})
                continue

            if Course.query.filter_by(course_code=row['course_code'].strip()).first():
                skipped.append({'row': row, 'reason': 'Duplicate course_code'})
                continue

            db.session.add(Course(
                course_code=row['course_code'].strip(),
                course_name=row['course_name'].strip(),
                department=row.get('department', '').strip(),
                semester=row.get('semester', '').strip(),
                lecturer_id=admin_id
            ))
            imported += 1

        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Import failed', 'details': str(e)}), 500

    return jsonify({'message': f'{imported} courses imported', 'skipped': skipped}), 200


# ------------------- EXPORT -------------------
@course_bp.route('/export', methods=['GET'])
@jwt_required()
def export_courses():
    admin_id = int(get_jwt_identity())
    format = request.args.get('format', 'excel').lower()

    owned = Course.query.filter_by(lecturer_id=admin_id)
    rep_ids = [c.course_id for c in CourseRepAccess.query.filter_by(rep_id=admin_id, approved_by_lecturer=True).all()]
    as_rep = Course.query.filter(Course.id.in_(rep_ids))

    courses = owned.union(as_rep).distinct().all()
    if not courses:
        return jsonify({'error': 'No courses to export'}), 404

    data = [{
        'Course Code': c.course_code,
        'Course Name': c.course_name,
        'Department': c.department or '',
        'Semester': c.semester or ''
    } for c in courses]

    df = pd.DataFrame(data)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    if format == 'pdf':
        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        pdf.setFont("Helvetica-Bold", 14)
        pdf.drawString(50, height - 50, f"GeoPresence - Courses ({timestamp})")
        pdf.setFont("Helvetica", 10)

        x, y = 50, height - 80
        headers = ['Course Code', 'Course Name', 'Department', 'Semester']
        row_height = 18

        for i, h in enumerate(headers):
            pdf.drawString(x + i * 120, y, h)

        y -= row_height
        for row in data:
            for i, key in enumerate(headers):
                pdf.drawString(x + i * 120, y, str(row[key]))
            y -= row_height
            if y < 50:
                pdf.showPage()
                pdf.setFont("Helvetica", 10)
                y = height - 50

        pdf.save()
        buffer.seek(0)
        return send_file(buffer, as_attachment=True, download_name=f"courses_{timestamp}.pdf", mimetype="application/pdf")

    buffer = BytesIO()
    df.to_excel(buffer, index=False, engine='xlsxwriter')
    buffer.seek(0)
    return send_file(buffer, as_attachment=True, download_name=f"courses_{timestamp}.xlsx", mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


# ------------------- SAMPLE CSV -------------------
@course_bp.route('/sample-csv', methods=['GET'])
@jwt_required()
def sample_csv():
    sample = StringIO()
    writer = csv.DictWriter(sample, fieldnames=['course_code', 'course_name', 'department', 'semester'])
    writer.writeheader()
    writer.writerow({'course_code': 'CSE101', 'course_name': 'Intro to Programming', 'department': 'CSE', 'semester': 'First'})
    sample.seek(0)

    return send_file(BytesIO(sample.getvalue().encode()), mimetype='text/csv', as_attachment=True, download_name='sample_courses.csv')
