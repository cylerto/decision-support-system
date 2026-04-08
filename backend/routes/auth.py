from flask import Blueprint, request, jsonify
from flask_login import current_user, login_required, login_user, logout_user
from werkzeug.security import generate_password_hash, check_password_hash

from ..authz import ALL_ROLES, ROLE_MANAGER, ROLE_OWNER, get_user_role, normalize_role, set_user_role
from ..models import User
from ..scope import get_scope_user_id, set_company_owner
from ..extensions import db

auth_bp = Blueprint("auth_bp", __name__, url_prefix="/api/auth")


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    if not data or "username" not in data or "password" not in data:
        return jsonify({"message": "Invalid data"}), 400

    if User.query.filter_by(username=data["username"]).first():
        return jsonify({"message": "User already exists"}), 400

    user = User(
        username=data["username"],
        password_hash=generate_password_hash(data["password"]),
    )

    db.session.add(user)
    db.session.flush()
    set_user_role(user.id, ROLE_OWNER)
    set_company_owner(user.id, user.id)
    db.session.commit()

    return jsonify({"message": "User registered successfully"}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    user = User.query.filter_by(username=data["username"]).first()

    if user and check_password_hash(user.password_hash, data["password"]):
        login_user(user)
        return jsonify({"message": "Login successful", "role": get_user_role(user.id), "username": user.username})

    return jsonify({"message": "Invalid credentials"}), 401


@auth_bp.route("/logout", methods=["POST"])
def logout():
    logout_user()
    return jsonify({"message": "Logged out"})


@auth_bp.route("/me", methods=["GET"])
@login_required
def me():
    return jsonify({
        "id": current_user.id,
        "username": current_user.username,
        "role": get_user_role(current_user.id),
        "company_owner_id": get_scope_user_id(current_user.id),
    })


@auth_bp.route("/users", methods=["GET"])
@login_required
def list_users():
    if get_user_role(current_user.id) != ROLE_OWNER:
        return jsonify({"message": "Forbidden"}), 403

    rows = User.query.order_by(User.id.asc()).all()
    return jsonify([
        {"id": row.id, "username": row.username, "role": get_user_role(row.id)}
        for row in rows
    ])


@auth_bp.route("/users", methods=["POST"])
@login_required
def create_user():
    if get_user_role(current_user.id) != ROLE_OWNER:
        return jsonify({"message": "Forbidden"}), 403

    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    role = normalize_role(data.get("role") or ROLE_MANAGER)

    if not username or not password:
        return jsonify({"message": "username and password required"}), 400

    if role not in ALL_ROLES:
        return jsonify({"message": "invalid role"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"message": "User already exists"}), 400

    user = User(
        username=username,
        password_hash=generate_password_hash(password),
    )
    db.session.add(user)
    db.session.flush()
    set_user_role(user.id, role)
    set_company_owner(user.id, get_scope_user_id(current_user.id) or current_user.id)
    db.session.commit()
    return jsonify({"id": user.id, "username": user.username, "role": role}), 201
