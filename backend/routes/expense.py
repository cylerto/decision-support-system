from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from datetime import datetime

from ..extensions import db
from ..models import Expense

expense_bp = Blueprint("expense_bp", __name__, url_prefix="/api/expense")


@expense_bp.route("", methods=["POST"])
@login_required
def add_expense():
    data = request.get_json()

    amount = data.get("amount")
    category_id = data.get("category_id")
    date_str = data.get("date")

    if not amount:
        return jsonify({"message": "Amount is required"}), 400

    if date_str:
        date = datetime.strptime(date_str, "%Y-%m-%d").date()
    else:
        date = datetime.utcnow().date()

    expense = Expense(
        amount=amount,
        date=date,
        user_id=current_user.id,
        category_id=category_id
    )

    db.session.add(expense)
    db.session.commit()

    return jsonify({"message": "Expense added"}), 201


@expense_bp.route("", methods=["GET"])
@login_required
def get_expenses():
    expenses = Expense.query.filter_by(user_id=current_user.id).all()

    return jsonify([
        {
            "id": e.id,
            "amount": e.amount,
            "date": e.date.isoformat(),
            "category_id": e.category_id
        } for e in expenses
    ])
