from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from ..extensions import db
from ..models import UserSettings
from ..utils import ensure_user_settings, log_action

settings_bp = Blueprint("settings_bp", __name__, url_prefix="/api/settings")


@settings_bp.route("", methods=["GET"])
@login_required
def get_settings():
    settings = ensure_user_settings()
    return jsonify({
        "base_currency": settings.base_currency,
        "widgets": settings.widgets or {},
        "notify_channels": settings.notify_channels or ["in_app"]
    })


@settings_bp.route("", methods=["PUT"])
@login_required
def update_settings():
    data = request.get_json() or {}
    settings = UserSettings.query.filter_by(user_id=current_user.id).first()
    if not settings:
        settings = ensure_user_settings()

    if "base_currency" in data:
        settings.base_currency = data["base_currency"]
    if "widgets" in data:
        settings.widgets = data["widgets"]
    if "notify_channels" in data:
        settings.notify_channels = data["notify_channels"]

    log_action("update", "settings", settings.id, data)
    db.session.commit()
    return jsonify({"message": "Settings updated"})
