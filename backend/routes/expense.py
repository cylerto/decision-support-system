from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import and_, extract, func
from sqlalchemy.orm import aliased

from ..extensions import db
from ..models import CategoryLimit, Expense, OperationDimension, TransactionMeta
from ..operation_rules import (
    optional_project,
    parse_amount,
    parse_date,
    require_category,
    require_department,
    validate_pagination,
    validate_sorting,
)
from ..utils import create_notification, ensure_user_settings, log_action

expense_bp = Blueprint("expense_bp", __name__, url_prefix="/api/expense")


@expense_bp.route("", methods=["POST"])
@login_required
def add_expense():
    data = request.get_json() or {}

    try:
        amount = parse_amount(data.get("amount"), required=True)
        date_value = parse_date(data.get("date"), required=True)
        category = require_category(data.get("category_id"), current_user.id, "expense")
        department = require_department(data.get("department_id"), current_user.id)
        project = optional_project(data.get("project_id"), current_user.id)
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    expense = Expense(
        amount=amount,
        date=date_value,
        user_id=current_user.id,
        category_id=category.id,
    )
    db.session.add(expense)
    db.session.flush()

    note = data.get("note")
    if note:
        db.session.add(TransactionMeta(transaction_type="expense", transaction_id=expense.id, note=note))

    db.session.add(
        OperationDimension(
            user_id=current_user.id,
            transaction_type="expense",
            transaction_id=expense.id,
            department_id=department.id,
            project_id=project.id if project else None,
        )
    )

    settings = ensure_user_settings()
    limit = CategoryLimit.query.filter_by(user_id=current_user.id, category_id=category.id).first()
    if limit:
        month_total = (
            db.session.query(func.coalesce(func.sum(Expense.amount), 0))
            .filter(
                Expense.user_id == current_user.id,
                Expense.category_id == category.id,
                extract("year", Expense.date) == date_value.year,
                extract("month", Expense.date) == date_value.month,
            )
            .scalar()
        )
        if float(month_total or 0) > float(limit.monthly_limit):
            channels = settings.notify_channels if settings else ["in_app"]
            for channel in channels:
                create_notification("Превышен лимит по категории", channel)

    log_action("create", "expense", expense.id, data)
    db.session.commit()
    return jsonify({"message": "Expense added", "id": expense.id}), 201


@expense_bp.route("", methods=["GET"])
@login_required
def get_expenses():
    dim = aliased(OperationDimension)
    query = Expense.query.filter_by(user_id=current_user.id).outerjoin(
        dim,
        and_(
            dim.user_id == current_user.id,
            dim.transaction_type == "expense",
            dim.transaction_id == Expense.id,
        ),
    )

    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    category_id = request.args.get("category_id", type=int)
    department_id = request.args.get("department_id", type=int)
    project_id = request.args.get("project_id", type=int)
    sort_by, sort_dir = validate_sorting(request.args.get("sort_by", "date"), request.args.get("sort_dir", "desc"))
    page, page_size = validate_pagination(request.args.get("page", 1, type=int), request.args.get("page_size", 20, type=int))

    try:
        if date_from and date_from != "undefined":
            query = query.filter(Expense.date >= parse_date(date_from, field_name="date_from", required=True))
        if date_to and date_to != "undefined":
            query = query.filter(Expense.date <= parse_date(date_to, field_name="date_to", required=True))
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    if category_id:
        query = query.filter(Expense.category_id == category_id)
    if department_id:
        query = query.filter(dim.department_id == department_id)
    if project_id:
        query = query.filter(dim.project_id == project_id)

    sort_column = Expense.date
    if sort_by == "amount":
        sort_column = Expense.amount
    elif sort_by == "category":
        sort_column = Expense.category_id
    elif sort_by == "department":
        sort_column = dim.department_id
    elif sort_by == "project":
        sort_column = dim.project_id

    query = query.order_by(sort_column.asc() if sort_dir == "asc" else sort_column.desc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    ids = [row.id for row in items]
    if ids:
        meta_rows = (
            TransactionMeta.query.filter_by(transaction_type="expense")
            .filter(TransactionMeta.transaction_id.in_(ids))
            .all()
        )
        metas = {row.transaction_id: row for row in meta_rows}

        dim_rows = (
            OperationDimension.query.filter_by(user_id=current_user.id, transaction_type="expense")
            .filter(OperationDimension.transaction_id.in_(ids))
            .all()
        )
        dims = {row.transaction_id: row for row in dim_rows}
    else:
        metas = {}
        dims = {}

    return jsonify(
        {
            "items": [
                {
                    "id": row.id,
                    "amount": row.amount,
                    "date": row.date.isoformat(),
                    "category_id": row.category_id,
                    "note": metas.get(row.id).note if metas.get(row.id) else None,
                    "department_id": dims.get(row.id).department_id if dims.get(row.id) else None,
                    "project_id": dims.get(row.id).project_id if dims.get(row.id) else None,
                }
                for row in items
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    )


@expense_bp.route("/<int:expense_id>", methods=["PUT"])
@login_required
def update_expense(expense_id):
    data = request.get_json() or {}
    expense = Expense.query.filter_by(id=expense_id, user_id=current_user.id).first()
    if not expense:
        return jsonify({"message": "Expense not found"}), 404

    try:
        if "amount" in data:
            expense.amount = parse_amount(data.get("amount"), required=True)
        if "category_id" in data:
            category = require_category(data.get("category_id"), current_user.id, "expense")
            expense.category_id = category.id
        if "date" in data:
            expense.date = parse_date(data.get("date"), required=True)
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    meta = TransactionMeta.query.filter_by(transaction_type="expense", transaction_id=expense.id).first()
    if "note" in data:
        note = data.get("note")
        if meta is None and note:
            meta = TransactionMeta(transaction_type="expense", transaction_id=expense.id)
            db.session.add(meta)
        if meta is not None:
            meta.note = note

    dim = OperationDimension.query.filter_by(
        user_id=current_user.id, transaction_type="expense", transaction_id=expense.id
    ).first()
    if dim is None:
        dim = OperationDimension(user_id=current_user.id, transaction_type="expense", transaction_id=expense.id)
        db.session.add(dim)

    try:
        if "department_id" in data:
            department = require_department(data.get("department_id"), current_user.id)
            dim.department_id = department.id
        if "project_id" in data:
            project = optional_project(data.get("project_id"), current_user.id)
            dim.project_id = project.id if project else None
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    if not dim.department_id:
        return jsonify({"message": "department_id is required"}), 400

    log_action("update", "expense", expense.id, data)
    db.session.commit()
    return jsonify({"message": "Expense updated"})


@expense_bp.route("/<int:expense_id>", methods=["DELETE"])
@login_required
def delete_expense(expense_id):
    expense = Expense.query.filter_by(id=expense_id, user_id=current_user.id).first()
    if not expense:
        return jsonify({"message": "Expense not found"}), 404

    TransactionMeta.query.filter_by(transaction_type="expense", transaction_id=expense.id).delete()
    OperationDimension.query.filter_by(
        user_id=current_user.id, transaction_type="expense", transaction_id=expense.id
    ).delete()
    db.session.delete(expense)
    log_action("delete", "expense", expense.id)
    db.session.commit()
    return jsonify({"message": "Expense deleted"})
