from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from datetime import datetime

from ..extensions import db
from ..models import Income

income_bp = Blueprint("income_bp", __name__, url_prefix="/api/income")


@income_bp.route("", methods=["POST"])
@login_required
def add_income():
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

    income = Income(
        amount=amount,
        date=date,
        user_id=current_user.id,
        category_id=category_id
    )

    db.session.add(income)
    db.session.commit()

    return jsonify({"message": "Income added"}), 201


@income_bp.route("", methods=["GET"])
@login_required
def get_incomes():
    incomes = Income.query.filter_by(user_id=current_user.id).all()

    return jsonify([
        {
            "id": i.id,
            "amount": i.amount,
            "date": i.date.isoformat(),
            "category_id": i.category_id
        } for i in incomes
    ])
