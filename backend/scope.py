from __future__ import annotations

from flask_login import current_user

from .models import User, UserSettings
from .extensions import db


def get_scope_user_id(user_id: int | None = None) -> int | None:
    resolved_user_id = user_id or (current_user.id if getattr(current_user, "is_authenticated", False) else None)
    if not resolved_user_id:
        return None

    settings = UserSettings.query.filter_by(user_id=resolved_user_id).first()
    widgets = settings.widgets if settings and isinstance(settings.widgets, dict) else {}
    owner_id = widgets.get("company_owner_id")
    if isinstance(owner_id, int) and User.query.filter_by(id=owner_id).first():
        return owner_id
    return resolved_user_id


def set_company_owner(user_id: int, company_owner_id: int) -> None:
    settings = UserSettings.query.filter_by(user_id=user_id).first()
    if settings is None:
        settings = UserSettings(user_id=user_id, base_currency="RUB", widgets={}, notify_channels=["in_app"])
        db.session.add(settings)
    widgets = settings.widgets if isinstance(settings.widgets, dict) else {}
    settings.widgets = {**widgets, "company_owner_id": int(company_owner_id)}
