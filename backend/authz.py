from __future__ import annotations

from typing import Iterable


ROLE_OWNER = "owner"
ROLE_MANAGER = "manager"
ROLE_ACCOUNTANT = "accountant"
ROLE_DEPARTMENT_HEAD = "department_head"

ALL_ROLES = {
    ROLE_OWNER,
    ROLE_MANAGER,
    ROLE_ACCOUNTANT,
    ROLE_DEPARTMENT_HEAD,
}


def normalize_role(role: str | None) -> str:
    role_value = (role or ROLE_OWNER).strip().lower()
    return role_value if role_value in ALL_ROLES else ROLE_OWNER


def has_any_role(role: str | None, allowed: Iterable[str]) -> bool:
    return normalize_role(role) in set(allowed)


def get_user_role(user_id: int | None) -> str:
    if not user_id:
        return ROLE_OWNER
    from backend.models import UserSettings  # local import to avoid circular deps

    row = UserSettings.query.filter_by(user_id=user_id).first()
    widgets = row.widgets if row and isinstance(row.widgets, dict) else {}
    return normalize_role(widgets.get("role"))


def set_user_role(user_id: int, role: str | None) -> None:
    from backend.extensions import db  # local import to avoid circular deps
    from backend.models import UserSettings  # local import to avoid circular deps

    role_value = normalize_role(role)
    row = UserSettings.query.filter_by(user_id=user_id).first()
    if row is None:
        row = UserSettings(user_id=user_id, widgets={})
        db.session.add(row)
    widgets = row.widgets if isinstance(row.widgets, dict) else {}
    row.widgets = {**widgets, "role": role_value}


def has_access(path: str, method: str, role: str | None) -> bool:
    role_value = normalize_role(role)
    method_value = (method or "GET").upper()

    if not path.startswith("/api/"):
        return True

    if path in {"/api/health", "/api/health/details"}:
        return True

    if path.startswith("/api/auth/"):
        if path in {"/api/auth/login", "/api/auth/register"}:
            return True
        if path in {"/api/auth/logout", "/api/auth/me"}:
            return True
        if path.startswith("/api/auth/users"):
            return role_value == ROLE_OWNER
        return True

    if path.startswith("/api/income") or path.startswith("/api/expense"):
        if method_value == "GET":
            return has_any_role(role_value, ALL_ROLES)
        if method_value in {"POST", "PUT", "PATCH"}:
            return has_any_role(role_value, {ROLE_OWNER, ROLE_MANAGER, ROLE_ACCOUNTANT})
        if method_value == "DELETE":
            return has_any_role(role_value, {ROLE_OWNER, ROLE_ACCOUNTANT})
        return False

    if path.startswith("/api/categories") or path.startswith("/api/directories"):
        if method_value == "GET":
            return has_any_role(role_value, ALL_ROLES)
        if method_value in {"POST", "PUT", "PATCH"}:
            return has_any_role(role_value, {ROLE_OWNER, ROLE_MANAGER, ROLE_ACCOUNTANT})
        if method_value == "DELETE":
            return has_any_role(role_value, {ROLE_OWNER, ROLE_ACCOUNTANT})
        return False

    if path.startswith("/api/analytics/data-quality/fix-categories"):
        return has_any_role(role_value, {ROLE_OWNER, ROLE_MANAGER, ROLE_ACCOUNTANT})

    if (
        path.startswith("/api/analytics")
        or path.startswith("/api/recommendations")
        or path.startswith("/api/ai/recommendations")
    ):
        return has_any_role(role_value, ALL_ROLES)

    if path.startswith("/api/export") or path.startswith("/api/import"):
        return has_any_role(role_value, {ROLE_OWNER, ROLE_ACCOUNTANT})

    if path.startswith("/api/settings") or path.startswith("/api/budgets") or path.startswith("/api/limits"):
        return has_any_role(role_value, {ROLE_OWNER, ROLE_ACCOUNTANT})

    if path.startswith("/api/category-limits"):
        return has_any_role(role_value, {ROLE_OWNER, ROLE_ACCOUNTANT})

    if path.startswith("/api/audit"):
        return has_any_role(role_value, ALL_ROLES)

    return True
