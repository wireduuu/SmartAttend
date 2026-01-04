# app/models.py
from app.extensions import db
from datetime import datetime
from flask_bcrypt import generate_password_hash, check_password_hash


# ---------------------- ADMIN ----------------------
class Admin(db.Model):
    __tablename__ = "admins"
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)

    sessions = db.relationship(
        "SessionCode", backref="admin", lazy=True, cascade="all, delete-orphan"
    )
    courses = db.relationship(
        "Course", backref="lecturer", lazy=True, cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Admin {self.email}>"

    def set_password(self, password):
        self.password_hash = generate_password_hash(password).decode("utf-8")

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


# ---------------------- STUDENT ----------------------
class Student(db.Model):
    __tablename__ = "students"
    id = db.Column(db.Integer, primary_key=True)
    index_number = db.Column(db.String(20), unique=True, nullable=False)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)

    attendance_records = db.relationship(
        "Attendance", backref="student", lazy=True, cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Student {self.index_number}>"


# ---------------------- ATTENDANCE ----------------------
class Attendance(db.Model):
    __tablename__ = "attendance"
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    student_id = db.Column(
        db.Integer, db.ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    session_id = db.Column(
        db.Integer,
        db.ForeignKey("session_codes.id", ondelete="CASCADE"),
        nullable=False,
    )

    student_latitude = db.Column(db.Float)
    student_longitude = db.Column(db.Float)
    status = db.Column(db.String(20), default="present")

    __table_args__ = (
        db.UniqueConstraint("student_id", "session_id", name="unique_student_session"),
    )

    def __repr__(self):
        return f"<Attendance student={self.student_id}, session={self.session_id}>"


# ---------------------- SESSION CODE ----------------------
class SessionCode(db.Model):
    __tablename__ = "session_codes"
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)

    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    geo_radius = db.Column(db.Float, default=3.0)

    admin_id = db.Column(
        db.Integer, db.ForeignKey("admins.id", ondelete="CASCADE"), nullable=False
    )
    course_id = db.Column(
        db.Integer, db.ForeignKey("courses.id", ondelete="CASCADE"), nullable=True
    )

    attendance_records = db.relationship(
        "Attendance", backref="session_code", lazy=True, cascade="all, delete-orphan"
    )
    course_sessions = db.relationship(
        "CourseSession", backref="location", lazy=True, cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Session {self.code}>"


# ---------------------- LOCATION CODE ----------------------
class LocationCode(db.Model):
    __tablename__ = "location_codes"
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(10), unique=True, nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    radius = db.Column(db.Float, nullable=False)

    def __repr__(self):
        return f"<LocationCode {self.code}>"


# ---------------------- COURSE ----------------------
class Course(db.Model):
    __tablename__ = "courses"
    id = db.Column(db.Integer, primary_key=True)
    course_code = db.Column(db.String(20), unique=True, nullable=False)
    course_name = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(50))
    semester = db.Column(db.String(20))

    lecturer_id = db.Column(
        db.Integer, db.ForeignKey("admins.id", ondelete="CASCADE"), nullable=False
    )

    sessions = db.relationship(
        "SessionCode", backref="course", lazy=True, cascade="all, delete-orphan"
    )
    course_sessions = db.relationship(
        "CourseSession", backref="course", lazy=True, cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Course {self.course_code}>"


# ---------------------- COURSE REP ACCESS ----------------------
class CourseRepAccess(db.Model):
    __tablename__ = "course_rep_access"
    id = db.Column(db.Integer, primary_key=True)
    rep_id = db.Column(
        db.Integer, db.ForeignKey("admins.id", ondelete="CASCADE"), nullable=False
    )
    course_id = db.Column(
        db.Integer, db.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    approved_by_lecturer = db.Column(db.Boolean, default=False)

    __table_args__ = (
        db.UniqueConstraint("rep_id", "course_id", name="unique_rep_course"),
    )

    def __repr__(self):
        return f"<CourseRepAccess rep={self.rep_id}, course={self.course_id}, approved={self.approved_by_lecturer}>"


# ---------------------- COURSE SESSION ----------------------
class CourseSession(db.Model):
    __tablename__ = "course_sessions"
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(
        db.Integer, db.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    location_id = db.Column(
        db.Integer,
        db.ForeignKey("session_codes.id", ondelete="CASCADE"),
        nullable=False,
    )
    start_time = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self):
        return f"<CourseSession course={self.course_id}, location={self.location_id}>"
