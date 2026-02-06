from flask import Blueprint, jsonify
from flask_login import login_required, current_user
from sqlalchemy import extract, func
import numpy as np
from sklearn.linear_model import LinearRegression

from ..extensions import db
from ..models import Income, Expense


forecast_bp = Blueprint(
    "forecast_bp",
    __name__,
    url_prefix="/api/analytics/forecast"
)


MAX_GROWTH_RATE = 0.3  # максимум +30% к последнему месяцу


def _prepare_monthly_data(model):
    data = (
        db.session.query(
            extract("year", model.date).label("year"),
            extract("month", model.date).label("month"),
            func.sum(model.amount).label("total")
        )
        .filter(model.user_id == current_user.id)
        .group_by("year", "month")
        .order_by("year", "month")
        .all()
    )

    if len(data) < 2:
        return None, None, None

    totals = [float(d.total) for d in data]

    X = np.arange(len(totals)).reshape(-1, 1)
    y = np.array(totals)

    return X, y, totals[-1]


def _forecast_next_month(model):
    X, y, last_value = _prepare_monthly_data(model)

    if X is None:
        return None, None

    reg = LinearRegression()
    reg.fit(X, y)

    next_point = np.array([[len(X)]])
    raw_prediction = reg.predict(next_point)[0]

    # 🔒 Ограничение роста
    max_allowed = last_value * (1 + MAX_GROWTH_RATE)
    adjusted_prediction = min(raw_prediction, max_allowed)

    # 📈 Тренд
    if y[-1] > y[-2]:
        trend = "growth"
    elif y[-1] < y[-2]:
        trend = "decline"
    else:
        trend = "stable"

    return round(float(adjusted_prediction), 2), trend


def _confidence_level(data_points):
    if data_points >= 6:
        return "high"
    elif data_points >= 3:
        return "medium"
    return "low"


@forecast_bp.route("", methods=["GET"])
@login_required
def forecast():
    income_pred, income_trend = _forecast_next_month(Income)
    expense_pred, expense_trend = _forecast_next_month(Expense)

    if income_pred is None or expense_pred is None:
        return jsonify({
            "message": "Not enough data for forecast (need at least 2 months)"
        }), 400

    # количество месяцев
    months_count = db.session.query(
        extract("year", Income.date),
        extract("month", Income.date)
    ).filter(Income.user_id == current_user.id).distinct().count()

    return jsonify({
        "predicted_income": income_pred,
        "predicted_expense": expense_pred,
        "predicted_profit": round(income_pred - expense_pred, 2),
        "trend": {
            "income": income_trend,
            "expense": expense_trend
        },
        "confidence": _confidence_level(months_count)
    })
