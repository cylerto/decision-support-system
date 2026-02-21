from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from datetime import datetime

from ..extensions import db
from ..models import Expense, TransactionMeta, CategoryLimit
from ..utils import create_notification, ensure_user_settings, get_exchange_rate, log_action, table_exists

expense_bp = Blueprint("expense_bp", __name__, url_prefix="/api/expense")


@expense_bp.route("", methods=["POST"])
@login_required
def add_expense():
    data = request.get_json()

    amount = data.get("amount")
    category_id = data.get("category_id")
    date_str = data.get("date")
    currency = data.get("currency")
    fx_rate = data.get("fx_rate")
    note = data.get("note")

    if not amount:
        return jsonify({"message": "Amount is required"}), 400

    if date_str:
        date = datetime.strptime(date_str, "%Y-%m-%d").date()
    else:
        date = datetime.utcnow().date()

    settings = ensure_user_settings()
    original_amount = amount
    if currency:
        if not fx_rate and currency != settings.base_currency:
            fx_rate = get_exchange_rate(settings.base_currency, currency)
            if fx_rate is None:
                return jsonify({"message": "FX rate not found"}), 400
        if fx_rate and currency != settings.base_currency:
            amount = float(amount) * float(fx_rate)

    expense = Expense(
        amount=amount,
        date=date,
        user_id=current_user.id,
        category_id=category_id
    )

    db.session.add(expense)
    db.session.commit()

    if currency and table_exists("transaction_meta"):
        meta = TransactionMeta(
            transaction_type="expense",
            transaction_id=expense.id,
            currency=currency,
            fx_rate=fx_rate,
            note=note,
            original_amount=original_amount
        )
        db.session.add(meta)

    limit = None
    if category_id:
        limit = CategoryLimit.query.filter_by(user_id=current_user.id, category_id=category_id).first()
    if limit:
        month_total = sum(
            e.amount for e in Expense.query.filter_by(
                user_id=current_user.id,
                category_id=category_id
            ).all()
            if e.date.year == date.year and e.date.month == date.month
        )
        if month_total > float(limit.monthly_limit):
            channels = settings.notify_channels if settings else ["in_app"]
            for channel in channels:
                create_notification("Превышен лимит по категории", channel)

    log_action("create", "expense", expense.id, data)
    db.session.commit()

    return jsonify({"message": "Expense added", "id": expense.id}), 201


@expense_bp.route("", methods=["GET"])
@login_required
def get_expenses():
    query = Expense.query.filter_by(user_id=current_user.id)

    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    category_id = request.args.get("category_id", type=int)
    sort_by = request.args.get("sort_by", "date")
    sort_dir = request.args.get("sort_dir", "desc")
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)

    if date_from == "undefined":
        date_from = None
    if date_to == "undefined":
        date_to = None
    if date_from:
        query = query.filter(Expense.date >= datetime.strptime(date_from, "%Y-%m-%d").date())
    if date_to:
        query = query.filter(Expense.date <= datetime.strptime(date_to, "%Y-%m-%d").date())
    if category_id:
        query = query.filter(Expense.category_id == category_id)

    sort_column = Expense.date
    if sort_by == "amount":
        sort_column = Expense.amount
    elif sort_by == "category":
        sort_column = Expense.category_id

    if sort_dir == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    if items:
        try:
            meta_rows = TransactionMeta.query.filter_by(transaction_type="expense").filter(
                TransactionMeta.transaction_id.in_([e.id for e in items])
            ).all()
            metas = {m.transaction_id: m for m in meta_rows}
        except Exception:
            metas = {}
    else:
        metas = {}

    return jsonify({
        "items": [
            {
                "id": e.id,
                "amount": e.amount,
                "date": e.date.isoformat(),
                "category_id": e.category_id,
                "currency": metas.get(e.id).currency if metas.get(e.id) else None,
                "fx_rate": metas.get(e.id).fx_rate if metas.get(e.id) else None,
                "note": metas.get(e.id).note if metas.get(e.id) else None,
            } for e in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size
    })


@expense_bp.route("/<int:expense_id>", methods=["PUT"])
@login_required
def update_expense(expense_id):
    data = request.get_json() or {}
    expense = Expense.query.filter_by(id=expense_id, user_id=current_user.id).first()
    if not expense:
        return jsonify({"message": "Expense not found"}), 404

    if "amount" in data:
        expense.amount = data["amount"]
    if "category_id" in data:
        expense.category_id = data["category_id"]
    if "date" in data:
        expense.date = datetime.strptime(data["date"], "%Y-%m-%d").date()

    currency = data.get("currency")
    fx_rate = data.get("fx_rate")
    note = data.get("note")

    settings = ensure_user_settings()
    meta = None
    if table_exists("transaction_meta"):
        meta = TransactionMeta.query.filter_by(transaction_type="expense", transaction_id=expense.id).first()
    if (currency or fx_rate or note) and table_exists("transaction_meta"):
        if not meta:
            meta = TransactionMeta(transaction_type="expense", transaction_id=expense.id, currency=settings.base_currency)
            db.session.add(meta)
        if currency:
            if currency != settings.base_currency and not fx_rate:
                fx_rate = get_exchange_rate(settings.base_currency, currency)
                if fx_rate is None:
                    return jsonify({"message": "FX rate not found"}), 400
            meta.currency = currency
        if fx_rate is not None:
            meta.fx_rate = fx_rate
        if note is not None:
            meta.note = note
        if "amount" in data:
            meta.original_amount = data["amount"]
            if meta.currency and meta.currency != settings.base_currency and meta.fx_rate:
                expense.amount = float(data["amount"]) * float(meta.fx_rate)

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
    db.session.delete(expense)
    log_action("delete", "expense", expense.id)
    db.session.commit()
    return jsonify({"message": "Expense deleted"})
