from flask import Blueprint, jsonify, request
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


def _forecast_series(model, months):
    X, y, last_value = _prepare_monthly_data(model)

    if X is None:
        return None, None, None

    reg = LinearRegression()
    reg.fit(X, y)

    preds = []
    residuals = y - reg.predict(X)
    std = float(np.std(residuals)) if len(residuals) > 1 else 0

    for i in range(1, months + 1):
        next_point = np.array([[len(X) - 1 + i]])
        raw_prediction = reg.predict(next_point)[0]
        max_allowed = last_value * (1 + MAX_GROWTH_RATE)
        adjusted_prediction = min(raw_prediction, max_allowed)
        lower = adjusted_prediction - 1.96 * std
        upper = adjusted_prediction + 1.96 * std
        preds.append({
            "month_offset": i,
            "prediction": round(float(adjusted_prediction), 2),
            "lower": round(float(lower), 2),
            "upper": round(float(upper), 2)
        })

    if y[-1] > y[-2]:
        trend = "growth"
    elif y[-1] < y[-2]:
        trend = "decline"
    else:
        trend = "stable"

    return preds, trend, std


def _confidence_level(data_points):
    if data_points >= 6:
        return "high"
    elif data_points >= 3:
        return "medium"
    return "low"


@forecast_bp.route("", methods=["GET"])
@login_required
def forecast():
    months = int(min(max(int(request.args.get("months", 1)), 1), 6))
    income_series, income_trend, income_std = _forecast_series(Income, months)
    expense_series, expense_trend, expense_std = _forecast_series(Expense, months)

    if income_series is None or expense_series is None:
        return jsonify({
            "message": "Not enough data for forecast (need at least 2 months)",
            "predicted_income": 0,
            "predicted_expense": 0,
            "predicted_profit": 0,
            "trend": {"income": "stable", "expense": "stable"},
            "confidence": "low",
            "series": None
        })

    # количество месяцев
    months_count = db.session.query(
        extract("year", Income.date),
        extract("month", Income.date)
    ).filter(Income.user_id == current_user.id).distinct().count()

    first_income = income_series[0]["prediction"]
    first_expense = expense_series[0]["prediction"]
    return jsonify({
        "predicted_income": first_income,
        "predicted_expense": first_expense,
        "predicted_profit": round(first_income - first_expense, 2),
        "trend": {
            "income": income_trend,
            "expense": expense_trend
        },
        "confidence": _confidence_level(months_count),
        "series": {
            "income": income_series,
            "expense": expense_series
        }
    })
