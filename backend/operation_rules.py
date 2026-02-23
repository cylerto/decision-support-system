from datetime import datetime

from backend.models import Category, Department, Project


ALLOWED_SORT_FIELDS = {"date", "amount", "category", "department", "project"}
ALLOWED_SORT_DIRECTIONS = {"asc", "desc"}


def parse_date(value, field_name="date", required=True):
    if value is None or value == "":
        if required:
            raise ValueError(f"{field_name} is required (YYYY-MM-DD)")
        return None
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError(f"{field_name} must be in YYYY-MM-DD format") from exc


def parse_amount(value, required=True):
    if value is None or value == "":
        if required:
            raise ValueError("amount is required")
        return None
    try:
        amount = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("amount must be a valid number") from exc
    if amount <= 0:
        raise ValueError("amount must be greater than 0")
    return amount


def require_category(category_id, user_id, category_type):
    if not category_id:
        raise ValueError("P&L category is required")
    category = Category.query.filter_by(id=category_id, user_id=user_id, type=category_type).first()
    if not category:
        raise ValueError(f"{category_type.capitalize()} category not found")
    return category


def require_department(department_id, user_id):
    if not department_id:
        raise ValueError("department_id is required")
    department = Department.query.filter_by(id=department_id, user_id=user_id).first()
    if not department:
        raise ValueError("Department not found")
    return department


def optional_project(project_id, user_id):
    if not project_id:
        return None
    project = Project.query.filter_by(id=project_id, user_id=user_id).first()
    if not project:
        raise ValueError("Project not found")
    return project


def validate_sorting(sort_by, sort_dir):
    by = sort_by if sort_by in ALLOWED_SORT_FIELDS else "date"
    direction = sort_dir if sort_dir in ALLOWED_SORT_DIRECTIONS else "desc"
    return by, direction


def validate_pagination(page, page_size):
    page = max(1, int(page or 1))
    page_size = min(100, max(1, int(page_size or 20)))
    return page, page_size
