# app/routes/login.py
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt,
    get_jwt_identity,
)
from datetime import timedelta, datetime, timezone

from app.extensions import db
from app.models import Admin

auth_bp = Blueprint("auth", __name__)


# ---------------------------
# Register Admin
# ---------------------------
@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}

    full_name = data.get("full_name")
    email = data.get("email")
    password = data.get("password")

    if not all([full_name, email, password]):
        return jsonify({"error": "All fields are required"}), 400

    if Admin.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409

    admin = Admin(full_name=full_name, email=email)
    admin.set_password(password)

    db.session.add(admin)
    db.session.commit()

    return jsonify({"message": "Registration successful"}), 201


# ---------------------------
# Login
# ---------------------------
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    user = Admin.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid credentials"}), 401

    access_exp_delta = current_app.config.get(
        "JWT_ACCESS_TOKEN_EXPIRES", timedelta(minutes=2)
    )
    refresh_exp_delta = current_app.config.get(
        "JWT_REFRESH_TOKEN_EXPIRES", timedelta(days=1)
    )

    access_token = create_access_token(
        identity=str(user.id), expires_delta=access_exp_delta
    )
    refresh_token = create_refresh_token(
        identity=str(user.id), expires_delta=refresh_exp_delta
    )
    now = datetime.now(timezone.utc)

    return (
        jsonify(
            {
                "message": "Login successful",
                "access_token": access_token,
                "refresh_token": refresh_token,
                "access_exp": int((now + access_exp_delta).timestamp()),
                "refresh_exp": int((now + refresh_exp_delta).timestamp()),
                "user": {
                    "id": user.id,
                    "full_name": user.full_name,
                    "email": user.email,
                },
            }
        ),
        200,
    )


# ---------------------------
# Refresh Access Token
# ---------------------------
@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user_id = int(get_jwt_identity())

    access_exp_delta = current_app.config.get(
        "JWT_ACCESS_TOKEN_EXPIRES", timedelta(minutes=2)
    )

    new_access_token = create_access_token(
        identity=str(user_id), expires_delta=access_exp_delta
    )

    access_exp_unix = int((datetime.now(timezone.utc) + access_exp_delta).timestamp())

    return (
        jsonify(
            {
                "access_token": new_access_token,
                "expires_at": access_exp_unix,
            }
        ),
        200,
    )


# ---------------------------
# Logout (Frontend handles token removal)
# ---------------------------
@auth_bp.route("/logout", methods=["POST"])
@jwt_required(optional=True)
def logout():
    return jsonify({"message": "Logged out successfully"}), 200


# ---------------------------
# Get Profile (Session Restore)
# ---------------------------
@auth_bp.route("/profile", methods=["GET"])
@jwt_required()
def profile():
    user_id = int(get_jwt_identity())
    user = Admin.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    return (
        jsonify({"id": user.id, "full_name": user.full_name, "email": user.email}),
        200,
    )


# ---------------------------
# Token Expiry Info
# ---------------------------
@auth_bp.route("/token-expiry", methods=["GET"])
@jwt_required()
def token_expiry():
    jwt_data = get_jwt()
    return jsonify({"access_exp": jwt_data["exp"]}), 200
