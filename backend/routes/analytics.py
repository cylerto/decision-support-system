from flask import Blueprint, jsonify
from flask_login import login_required, current_user
from sqlalchemy import func, extract

from backend.extensions import db
from backend.models import Income, Expense, Category, MonthlyBudget

analytics_bp = Blueprint("analytics", __name__, url_prefix="/api/analytics")


# =========================
# 1. ОБЩАЯ СВОДКА
# =========================
@analytics_bp.route("/summary", methods=["GET"])
@login_required
def summary():
    total_income = db.session.query(
        func.coalesce(func.sum(Income.amount), 0)
    ).filter(Income.user_id == current_user.id).scalar()

    total_expense = db.session.query(
        func.coalesce(func.sum(Expense.amount), 0)
    ).filter(Expense.user_id == current_user.id).scalar()

    profit = total_income - total_expense
    status = "plus" if profit >= 0 else "minus"

    return jsonify({
        "total_income": float(total_income),
        "total_expense": float(total_expense),
        "profit": float(profit),
        "status": status
    })


# =========================
# 2. ПО МЕСЯЦАМ (income / expense)
# =========================
@analytics_bp.route("/monthly", methods=["GET"])
@login_required
def monthly():
    income_data = db.session.query(
        extract("year", Income.date).label("year"),
        extract("month", Income.date).label("month"),
        func.sum(Income.amount).label("total")
    ).filter(
        Income.user_id == current_user.id
    ).group_by("year", "month").all()

    expense_data = db.session.query(
        extract("year", Expense.date).label("year"),
        extract("month", Expense.date).label("month"),
        func.sum(Expense.amount).label("total")
    ).filter(
        Expense.user_id == current_user.id
    ).group_by("year", "month").all()

    return jsonify({
        "income": [
            {"year": int(y), "month": int(m), "total": float(t)}
            for y, m, t in income_data
        ],
        "expense": [
            {"year": int(y), "month": int(m), "total": float(t)}
            for y, m, t in expense_data
        ]
    })


# =========================
# 3. КАТЕГОРИИ ПО МЕСЯЦАМ
# =========================
@analytics_bp.route("/categories/monthly", methods=["GET"])
@login_required
def categories_monthly():
    rows = db.session.query(
        extract("year", Expense.date).label("year"),
        extract("month", Expense.date).label("month"),
        Category.name,
        func.sum(Expense.amount).label("total")
    ).join(Category, Expense.category_id == Category.id)\
     .filter(Expense.user_id == current_user.id)\
     .group_by("year", "month", Category.name)\
     .order_by("year", "month")\
     .all()

    result = {}

    for year, month, name, total in rows:
        key = f"{int(year)}-{int(month):02d}"
        result.setdefault(key, {})
        result[key][name] = float(total)

    return jsonify(result)


# =========================
# 4. БАЛАНС ПО МЕСЯЦАМ
# =========================
@analytics_bp.route("/balance/monthly", methods=["GET"])
@login_required
def balance_monthly():
    income_rows = db.session.query(
        extract("year", Income.date).label("year"),
        extract("month", Income.date).label("month"),
        func.sum(Income.amount).label("income")
    ).filter(
        Income.user_id == current_user.id
    ).group_by("year", "month").all()

    expense_rows = db.session.query(
        extract("year", Expense.date).label("year"),
        extract("month", Expense.date).label("month"),
        func.sum(Expense.amount).label("expense")
    ).filter(
        Expense.user_id == current_user.id
    ).group_by("year", "month").all()

    data = {}

    for y, m, inc in income_rows:
        key = f"{int(y)}-{int(m):02d}"
        data.setdefault(key, {"income": 0, "expense": 0})
        data[key]["income"] = float(inc)

    for y, m, exp in expense_rows:
        key = f"{int(y)}-{int(m):02d}"
        data.setdefault(key, {"income": 0, "expense": 0})
        data[key]["expense"] = float(exp)

    result = []
    for month, values in sorted(data.items()):
        profit = values["income"] - values["expense"]
        status = "plus" if profit >= 0 else "minus"
        if values["income"] > 0 and values["expense"] / values["income"] > 0.7:
            status = "risk"

        result.append({
            "month": month,
            "income": values["income"],
            "expense": values["expense"],
            "profit": profit,
            "status": status
        })

    return jsonify(result)


# =========================
# 5. KPI (savings/burn)
# =========================
@analytics_bp.route("/kpi", methods=["GET"])
@login_required
def kpi():
    total_income = db.session.query(
        func.coalesce(func.sum(Income.amount), 0)
    ).filter(Income.user_id == current_user.id).scalar()

    total_expense = db.session.query(
        func.coalesce(func.sum(Expense.amount), 0)
    ).filter(Expense.user_id == current_user.id).scalar()

    total_income = float(total_income)
    total_expense = float(total_expense)
    savings = total_income - total_expense
    savings_rate = (savings / total_income) if total_income else 0
    burn_rate = (total_expense / total_income) if total_income else 0

    return jsonify({
        "total_income": total_income,
        "total_expense": total_expense,
        "savings": savings,
        "savings_rate": round(savings_rate, 4),
        "burn_rate": round(burn_rate, 4)
    })


# =========================
# 6. SEGMENTS
# =========================
@analytics_bp.route("/segments", methods=["GET"])
@login_required
def segments():
    expenses = Expense.query.filter_by(user_id=current_user.id).all()
    weekday = {str(i): 0 for i in range(7)}
    weekday_amount = {str(i): 0 for i in range(7)}

    for e in expenses:
        idx = e.date.weekday()
        weekday[str(idx)] += 1
        weekday_amount[str(idx)] += float(e.amount)

    return jsonify({
        "weekday_count": weekday,
        "weekday_amount": weekday_amount
    })


# =========================
# 7. BUDGET VS ACTUAL
# =========================
@analytics_bp.route("/budget-vs-actual", methods=["GET"])
@login_required
def budget_vs_actual():
    budgets = MonthlyBudget.query.filter_by(user_id=current_user.id).all()
    if not budgets:
        return jsonify([])

    income_rows = db.session.query(
        extract("year", Income.date).label("year"),
        extract("month", Income.date).label("month"),
        func.sum(Income.amount).label("income")
    ).filter(
        Income.user_id == current_user.id
    ).group_by("year", "month").all()

    expense_rows = db.session.query(
        extract("year", Expense.date).label("year"),
        extract("month", Expense.date).label("month"),
        func.sum(Expense.amount).label("expense")
    ).filter(
        Expense.user_id == current_user.id
    ).group_by("year", "month").all()

    actual = {}
    for y, m, inc in income_rows:
        key = f"{int(y)}-{int(m):02d}"
        actual.setdefault(key, {"income": 0, "expense": 0})
        actual[key]["income"] = float(inc)
    for y, m, exp in expense_rows:
        key = f"{int(y)}-{int(m):02d}"
        actual.setdefault(key, {"income": 0, "expense": 0})
        actual[key]["expense"] = float(exp)

    result = []
    for b in budgets:
        key = f"{b.year}-{int(b.month):02d}"
        actual_row = actual.get(key, {"income": 0, "expense": 0})
        result.append({
            "month": key,
            "planned_income": float(b.planned_income),
            "planned_expense": float(b.planned_expense),
            "actual_income": float(actual_row["income"]),
            "actual_expense": float(actual_row["expense"])
        })

    return jsonify(sorted(result, key=lambda r: r["month"]))
