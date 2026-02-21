from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from datetime import datetime

from ..extensions import db
from ..models import Income, TransactionMeta
from ..utils import create_notification, ensure_user_settings, get_exchange_rate, log_action, table_exists

income_bp = Blueprint("income_bp", __name__, url_prefix="/api/income")


@income_bp.route("", methods=["POST"])
@login_required
def add_income():
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

    income = Income(
        amount=amount,
        date=date,
        user_id=current_user.id,
        category_id=category_id
    )

    db.session.add(income)
    db.session.commit()

    if currency and table_exists("transaction_meta"):
        meta = TransactionMeta(
            transaction_type="income",
            transaction_id=income.id,
            currency=currency,
            fx_rate=fx_rate,
            note=note,
            original_amount=original_amount
        )
        db.session.add(meta)

    log_action("create", "income", income.id, data)
    db.session.commit()

    return jsonify({"message": "Income added", "id": income.id}), 201


@income_bp.route("", methods=["GET"])
@login_required
def get_incomes():
    query = Income.query.filter_by(user_id=current_user.id)

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
        query = query.filter(Income.date >= datetime.strptime(date_from, "%Y-%m-%d").date())
    if date_to:
        query = query.filter(Income.date <= datetime.strptime(date_to, "%Y-%m-%d").date())
    if category_id:
        query = query.filter(Income.category_id == category_id)

    sort_column = Income.date
    if sort_by == "amount":
        sort_column = Income.amount
    elif sort_by == "category":
        sort_column = Income.category_id

    if sort_dir == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    if items:
        try:
            meta_rows = TransactionMeta.query.filter_by(transaction_type="income").filter(
                TransactionMeta.transaction_id.in_([i.id for i in items])
            ).all()
            metas = {m.transaction_id: m for m in meta_rows}
        except Exception:
            metas = {}
    else:
        metas = {}

    return jsonify({
        "items": [
            {
                "id": i.id,
                "amount": i.amount,
                "date": i.date.isoformat(),
                "category_id": i.category_id,
                "currency": metas.get(i.id).currency if metas.get(i.id) else None,
                "fx_rate": metas.get(i.id).fx_rate if metas.get(i.id) else None,
                "note": metas.get(i.id).note if metas.get(i.id) else None,
            } for i in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size
    })


@income_bp.route("/<int:income_id>", methods=["PUT"])
@login_required
def update_income(income_id):
    data = request.get_json() or {}
    income = Income.query.filter_by(id=income_id, user_id=current_user.id).first()
    if not income:
        return jsonify({"message": "Income not found"}), 404

    if "amount" in data:
        income.amount = data["amount"]
    if "category_id" in data:
        income.category_id = data["category_id"]
    if "date" in data:
        income.date = datetime.strptime(data["date"], "%Y-%m-%d").date()

    currency = data.get("currency")
    fx_rate = data.get("fx_rate")
    note = data.get("note")

    settings = ensure_user_settings()
    meta = None
    if table_exists("transaction_meta"):
        meta = TransactionMeta.query.filter_by(transaction_type="income", transaction_id=income.id).first()
    if (currency or fx_rate or note) and table_exists("transaction_meta"):
        if not meta:
            meta = TransactionMeta(transaction_type="income", transaction_id=income.id, currency=settings.base_currency)
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
                income.amount = float(data["amount"]) * float(meta.fx_rate)

    log_action("update", "income", income.id, data)
    db.session.commit()
    return jsonify({"message": "Income updated"})


@income_bp.route("/<int:income_id>", methods=["DELETE"])
@login_required
def delete_income(income_id):
    income = Income.query.filter_by(id=income_id, user_id=current_user.id).first()
    if not income:
        return jsonify({"message": "Income not found"}), 404

    TransactionMeta.query.filter_by(transaction_type="income", transaction_id=income.id).delete()
    db.session.delete(income)
    log_action("delete", "income", income.id)
    db.session.commit()
    return jsonify({"message": "Income deleted"})
