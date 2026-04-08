from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from ..models import AuditLog
from ..scope import get_scope_user_id

audit_bp = Blueprint("audit_bp", __name__, url_prefix="/api/audit")


@audit_bp.route("", methods=["GET"])
@login_required
def get_audit():
    scope_user_id = get_scope_user_id(current_user.id)
    entity = request.args.get("entity")
    action = request.args.get("action")
    query = AuditLog.query.filter_by(user_id=scope_user_id)
    if entity:
        query = query.filter_by(entity=entity)
    if action:
        query = query.filter_by(action=action)
    items = query.order_by(AuditLog.created_at.desc()).limit(500).all()
    return jsonify([
        {
            "id": a.id,
            "action": a.action,
            "entity": a.entity,
            "entity_id": a.entity_id,
            "data": a.data,
            "created_at": a.created_at.isoformat()
        } for a in items
    ])
