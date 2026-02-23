from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from ..extensions import db
from ..models import Department, OperationDimension, Project
from ..utils import log_action


directories_bp = Blueprint("directories_bp", __name__, url_prefix="/api/directories")


MODEL_BY_KIND = {
    "departments": Department,
    "projects": Project,
}


@directories_bp.route("/<string:kind>", methods=["GET"])
@login_required
def list_directory(kind):
    model = MODEL_BY_KIND.get(kind)
    if not model:
        return jsonify({"message": "Unknown directory type"}), 404

    rows = model.query.filter_by(user_id=current_user.id).order_by(model.name.asc()).all()
    return jsonify([{"id": row.id, "name": row.name} for row in rows])


@directories_bp.route("/<string:kind>", methods=["POST"])
@login_required
def create_directory(kind):
    model = MODEL_BY_KIND.get(kind)
    if not model:
        return jsonify({"message": "Unknown directory type"}), 404

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"message": "name is required"}), 400

    row = model(user_id=current_user.id, name=name)
    db.session.add(row)
    db.session.commit()
    log_action("create", kind[:-1], row.id, {"name": row.name})
    db.session.commit()
    return jsonify({"id": row.id, "name": row.name}), 201


@directories_bp.route("/<string:kind>/<int:row_id>", methods=["PUT"])
@login_required
def update_directory(kind, row_id):
    model = MODEL_BY_KIND.get(kind)
    if not model:
        return jsonify({"message": "Unknown directory type"}), 404

    row = model.query.filter_by(id=row_id, user_id=current_user.id).first()
    if not row:
        return jsonify({"message": "Not found"}), 404

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"message": "name is required"}), 400

    row.name = name
    log_action("update", kind[:-1], row.id, {"name": row.name})
    db.session.commit()
    return jsonify({"message": "updated"})


@directories_bp.route("/<string:kind>/<int:row_id>", methods=["DELETE"])
@login_required
def delete_directory(kind, row_id):
    model = MODEL_BY_KIND.get(kind)
    if not model:
        return jsonify({"message": "Unknown directory type"}), 404

    row = model.query.filter_by(id=row_id, user_id=current_user.id).first()
    if not row:
        return jsonify({"message": "Not found"}), 404

    if kind == "departments":
        in_use = OperationDimension.query.filter_by(user_id=current_user.id, department_id=row_id).first()
    else:
        in_use = OperationDimension.query.filter_by(user_id=current_user.id, project_id=row_id).first()

    if in_use:
        return jsonify({"message": "Directory is in use"}), 400

    db.session.delete(row)
    log_action("delete", kind[:-1], row.id)
    db.session.commit()
    return jsonify({"message": "deleted"})
