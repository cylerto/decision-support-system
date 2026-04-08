from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import and_
from sqlalchemy.orm import aliased

from ..extensions import db
from ..models import Income, OperationDimension, TransactionMeta
from ..operation_rules import (
    optional_project,
    parse_amount,
    parse_date,
    require_category,
    require_department,
    validate_pagination,
    validate_sorting,
)
from ..scope import get_scope_user_id
from ..utils import log_action

income_bp = Blueprint("income_bp", __name__, url_prefix="/api/income")


@income_bp.route("", methods=["POST"])
@login_required
def add_income():
    scope_user_id = get_scope_user_id(current_user.id)
    data = request.get_json() or {}

    try:
        amount = parse_amount(data.get("amount"), required=True)
        date_value = parse_date(data.get("date"), required=True)
        category = require_category(data.get("category_id"), scope_user_id, "income")
        department = require_department(data.get("department_id"), scope_user_id)
        project = optional_project(data.get("project_id"), scope_user_id)
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    income = Income(
        amount=amount,
        date=date_value,
        user_id=scope_user_id,
        category_id=category.id,
    )
    db.session.add(income)
    db.session.flush()

    note = data.get("note")
    if note:
        db.session.add(TransactionMeta(transaction_type="income", transaction_id=income.id, note=note))

    db.session.add(
        OperationDimension(
            user_id=scope_user_id,
            transaction_type="income",
            transaction_id=income.id,
            department_id=department.id,
            project_id=project.id if project else None,
        )
    )

    log_action("create", "income", income.id, data)
    db.session.commit()
    return jsonify({"message": "Income added", "id": income.id}), 201


@income_bp.route("", methods=["GET"])
@login_required
def get_incomes():
    scope_user_id = get_scope_user_id(current_user.id)
    dim = aliased(OperationDimension)
    query = Income.query.filter_by(user_id=scope_user_id).outerjoin(
        dim,
        and_(
            dim.user_id == scope_user_id,
            dim.transaction_type == "income",
            dim.transaction_id == Income.id,
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
            query = query.filter(Income.date >= parse_date(date_from, field_name="date_from", required=True))
        if date_to and date_to != "undefined":
            query = query.filter(Income.date <= parse_date(date_to, field_name="date_to", required=True))
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    if category_id:
        query = query.filter(Income.category_id == category_id)
    if department_id:
        query = query.filter(dim.department_id == department_id)
    if project_id:
        query = query.filter(dim.project_id == project_id)

    sort_column = Income.date
    if sort_by == "amount":
        sort_column = Income.amount
    elif sort_by == "category":
        sort_column = Income.category_id
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
            TransactionMeta.query.filter_by(transaction_type="income")
            .filter(TransactionMeta.transaction_id.in_(ids))
            .all()
        )
        metas = {row.transaction_id: row for row in meta_rows}

        dim_rows = (
            OperationDimension.query.filter_by(user_id=scope_user_id, transaction_type="income")
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


@income_bp.route("/<int:income_id>", methods=["PUT"])
@login_required
def update_income(income_id):
    scope_user_id = get_scope_user_id(current_user.id)
    data = request.get_json() or {}
    income = Income.query.filter_by(id=income_id, user_id=scope_user_id).first()
    if not income:
        return jsonify({"message": "Income not found"}), 404

    try:
        if "amount" in data:
            income.amount = parse_amount(data.get("amount"), required=True)
        if "category_id" in data:
            category = require_category(data.get("category_id"), scope_user_id, "income")
            income.category_id = category.id
        if "date" in data:
            income.date = parse_date(data.get("date"), required=True)
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    meta = TransactionMeta.query.filter_by(transaction_type="income", transaction_id=income.id).first()
    if "note" in data:
        note = data.get("note")
        if meta is None and note:
            meta = TransactionMeta(transaction_type="income", transaction_id=income.id)
            db.session.add(meta)
        if meta is not None:
            meta.note = note

    dim = OperationDimension.query.filter_by(
        user_id=scope_user_id, transaction_type="income", transaction_id=income.id
    ).first()
    if dim is None:
        dim = OperationDimension(user_id=scope_user_id, transaction_type="income", transaction_id=income.id)
        db.session.add(dim)

    try:
        if "department_id" in data:
            department = require_department(data.get("department_id"), scope_user_id)
            dim.department_id = department.id
        if "project_id" in data:
            project = optional_project(data.get("project_id"), scope_user_id)
            dim.project_id = project.id if project else None
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    if not dim.department_id:
        return jsonify({"message": "department_id is required"}), 400

    log_action("update", "income", income.id, data)
    db.session.commit()
    return jsonify({"message": "Income updated"})


@income_bp.route("/<int:income_id>", methods=["DELETE"])
@login_required
def delete_income(income_id):
    scope_user_id = get_scope_user_id(current_user.id)
    income = Income.query.filter_by(id=income_id, user_id=scope_user_id).first()
    if not income:
        return jsonify({"message": "Income not found"}), 404

    TransactionMeta.query.filter_by(transaction_type="income", transaction_id=income.id).delete()
    OperationDimension.query.filter_by(
        user_id=scope_user_id, transaction_type="income", transaction_id=income.id
    ).delete()
    db.session.delete(income)
    log_action("delete", "income", income.id)
    db.session.commit()
    return jsonify({"message": "Income deleted"})
