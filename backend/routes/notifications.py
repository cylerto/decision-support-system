from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from ..extensions import db
from ..models import Notification
from ..utils import log_action

notifications_bp = Blueprint("notifications_bp", __name__, url_prefix="/api/notifications")


@notifications_bp.route("", methods=["GET"])
@login_required
def get_notifications():
    status = request.args.get("status")
    query = Notification.query.filter_by(user_id=current_user.id)
    if status:
        query = query.filter_by(status=status)
    items = query.order_by(Notification.created_at.desc()).limit(200).all()
    return jsonify([
        {
            "id": n.id,
            "channel": n.channel,
            "message": n.message,
            "status": n.status,
            "created_at": n.created_at.isoformat()
        } for n in items
    ])


@notifications_bp.route("/<int:notification_id>", methods=["PUT"])
@login_required
def update_notification(notification_id):
    data = request.get_json() or {}
    item = Notification.query.filter_by(id=notification_id, user_id=current_user.id).first()
    if not item:
        return jsonify({"message": "Notification not found"}), 404
    if "status" in data:
        item.status = data["status"]
    log_action("update", "notification", item.id, data)
    db.session.commit()
    return jsonify({"message": "Notification updated"})
