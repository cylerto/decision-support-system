from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import func

from ..extensions import db
from ..models import Department, OperationDimension, Project
from ..scope import get_scope_user_id
from ..utils import log_action


directories_bp = Blueprint("directories_bp", __name__, url_prefix="/api/directories")


MODEL_BY_KIND = {
    "departments": Department,
    "projects": Project,
}


@directories_bp.route("/<string:kind>", methods=["GET"])
@login_required
def list_directory(kind):
    scope_user_id = get_scope_user_id(current_user.id)
    model = MODEL_BY_KIND.get(kind)
    if not model:
        return jsonify({"message": "Unknown directory type"}), 404

    rows = model.query.filter_by(user_id=scope_user_id).order_by(model.name.asc()).all()
    return jsonify([{"id": row.id, "name": row.name} for row in rows])


@directories_bp.route("/<string:kind>", methods=["POST"])
@login_required
def create_directory(kind):
    scope_user_id = get_scope_user_id(current_user.id)
    model = MODEL_BY_KIND.get(kind)
    if not model:
        return jsonify({"message": "Unknown directory type"}), 404

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"message": "name is required"}), 400

    row = model(user_id=scope_user_id, name=name)
    db.session.add(row)
    db.session.commit()
    log_action("create", kind[:-1], row.id, {"name": row.name})
    db.session.commit()
    return jsonify({"id": row.id, "name": row.name}), 201


@directories_bp.route("/<string:kind>/<int:row_id>", methods=["PUT"])
@login_required
def update_directory(kind, row_id):
    scope_user_id = get_scope_user_id(current_user.id)
    model = MODEL_BY_KIND.get(kind)
    if not model:
        return jsonify({"message": "Unknown directory type"}), 404

    row = model.query.filter_by(id=row_id, user_id=scope_user_id).first()
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
    scope_user_id = get_scope_user_id(current_user.id)
    model = MODEL_BY_KIND.get(kind)
    if not model:
        return jsonify({"message": "Unknown directory type"}), 404

    row = model.query.filter_by(id=row_id, user_id=scope_user_id).first()
    if not row:
        return jsonify({"message": "Not found"}), 404

    usage_query = (
        db.session.query(
            OperationDimension.transaction_type.label("transaction_type"),
            func.count(OperationDimension.id).label("cnt"),
        )
        .filter(OperationDimension.user_id == scope_user_id)
    )
    if kind == "departments":
        usage_query = usage_query.filter(OperationDimension.department_id == row_id)
    else:
        usage_query = usage_query.filter(OperationDimension.project_id == row_id)

    usage_rows = usage_query.group_by(OperationDimension.transaction_type).all()
    if usage_rows:
        usage = {row.transaction_type: int(row.cnt) for row in usage_rows}
        total = sum(usage.values())
        return jsonify({
            "message": f"Нельзя удалить: элемент используется в {total} операциях.",
            "code": "DIRECTORY_IN_USE",
            "details": {
                "kind": kind,
                "id": row_id,
                "usage": usage,
                "total_operations": total,
            },
        }), 400

    db.session.delete(row)
    log_action("delete", kind[:-1], row.id)
    db.session.commit()
    return jsonify({"message": "deleted"})
