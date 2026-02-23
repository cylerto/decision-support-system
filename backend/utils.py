from datetime import date
from sqlalchemy import inspect

from flask_login import current_user

from .extensions import db
from .models import AuditLog, Notification, UserSettings


def log_action(action, entity, entity_id=None, data=None):
    if not current_user.is_authenticated:
        return
    if not table_exists("audit_logs"):
        return
    try:
        entry = AuditLog(
            user_id=current_user.id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            data=data,
        )
        db.session.add(entry)
    except Exception:
        db.session.rollback()


def ensure_user_settings():
    settings = UserSettings.query.filter_by(user_id=current_user.id).first()
    if not settings:
        settings = UserSettings(user_id=current_user.id, base_currency="RUB", widgets={}, notify_channels=["in_app"])
        db.session.add(settings)
        db.session.commit()
    return settings


def create_notification(message, channel="in_app"):
    if not table_exists("notifications"):
        return None
    note = Notification(
        user_id=current_user.id,
        channel=channel,
        message=message,
        status="new"
    )
    db.session.add(note)
    return note


def table_exists(table_name):
    try:
        inspector = inspect(db.engine)
        return inspector.has_table(table_name)
    except Exception:
        return False
