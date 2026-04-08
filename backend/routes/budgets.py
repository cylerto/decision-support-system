from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from ..extensions import db
from ..models import MonthlyBudget
from ..scope import get_scope_user_id
from ..utils import log_action

budgets_bp = Blueprint("budgets_bp", __name__, url_prefix="/api/budgets")


@budgets_bp.route("", methods=["GET"])
@login_required
def get_budgets():
    scope_user_id = get_scope_user_id(current_user.id)
    year = request.args.get("year", type=int)
    query = MonthlyBudget.query.filter_by(user_id=scope_user_id)
    if year:
        query = query.filter_by(year=year)
    budgets = query.order_by(MonthlyBudget.year.desc(), MonthlyBudget.month.desc()).all()
    return jsonify([
        {
            "id": b.id,
            "year": b.year,
            "month": b.month,
            "planned_income": b.planned_income,
            "planned_expense": b.planned_expense
        } for b in budgets
    ])


@budgets_bp.route("", methods=["POST"])
@login_required
def upsert_budget():
    scope_user_id = get_scope_user_id(current_user.id)
    data = request.get_json() or {}
    year = data.get("year")
    month = data.get("month")
    if not year or not month:
        return jsonify({"message": "year and month are required"}), 400

    budget = MonthlyBudget.query.filter_by(
        user_id=scope_user_id, year=year, month=month
    ).first()

    if not budget:
        budget = MonthlyBudget(user_id=scope_user_id, year=year, month=month)
        db.session.add(budget)

    budget.planned_income = data.get("planned_income", budget.planned_income)
    budget.planned_expense = data.get("planned_expense", budget.planned_expense)

    log_action("upsert", "budget", budget.id, data)
    db.session.commit()
    return jsonify({"message": "Budget saved"})


@budgets_bp.route("/<int:budget_id>", methods=["DELETE"])
@login_required
def delete_budget(budget_id):
    scope_user_id = get_scope_user_id(current_user.id)
    budget = MonthlyBudget.query.filter_by(id=budget_id, user_id=scope_user_id).first()
    if not budget:
        return jsonify({"message": "Budget not found"}), 404
    db.session.delete(budget)
    log_action("delete", "budget", budget.id)
    db.session.commit()
    return jsonify({"message": "Budget deleted"})
