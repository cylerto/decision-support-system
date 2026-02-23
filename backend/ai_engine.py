import numpy as np
from sqlalchemy import extract, func
from sklearn.linear_model import LinearRegression

from backend.extensions import db


MAX_GROWTH_RATE = 0.3


def _prepare_monthly_data(model, user_id):
    data = (
        db.session.query(
            extract("year", model.date).label("year"),
            extract("month", model.date).label("month"),
            func.sum(model.amount).label("total"),
        )
        .filter(model.user_id == user_id)
        .group_by("year", "month")
        .order_by("year", "month")
        .all()
    )

    if len(data) < 2:
        return None, None, None

    totals = [float(row.total) for row in data]
    x = np.arange(len(totals)).reshape(-1, 1)
    y = np.array(totals)
    return x, y, totals[-1]


def _forecast_series(model, user_id, months):
    x, y, last_value = _prepare_monthly_data(model, user_id)
    if x is None:
        return None, None, None

    reg = LinearRegression()
    reg.fit(x, y)

    residuals = y - reg.predict(x)
    std = float(np.std(residuals)) if len(residuals) > 1 else 0
    predictions = []

    for month_offset in range(1, months + 1):
        next_point = np.array([[len(x) - 1 + month_offset]])
        raw_prediction = reg.predict(next_point)[0]
        max_allowed = last_value * (1 + MAX_GROWTH_RATE)
        adjusted_prediction = min(raw_prediction, max_allowed)
        lower = adjusted_prediction - 1.96 * std
        upper = adjusted_prediction + 1.96 * std
        predictions.append({
            "month_offset": month_offset,
            "prediction": round(float(adjusted_prediction), 2),
            "lower": round(float(lower), 2),
            "upper": round(float(upper), 2),
        })

    if y[-1] > y[-2]:
        trend = "growth"
    elif y[-1] < y[-2]:
        trend = "decline"
    else:
        trend = "stable"

    return predictions, trend, std


def _confidence_level(months_count):
    if months_count >= 6:
        return "high"
    if months_count >= 3:
        return "medium"
    return "low"


def forecast(model_income, model_expense, user_id, months):
    income_series, income_trend, _income_std = _forecast_series(model_income, user_id, months)
    expense_series, expense_trend, _expense_std = _forecast_series(model_expense, user_id, months)

    if income_series is None or expense_series is None:
        return {
            "message": "Not enough data for forecast (need at least 2 months)",
            "predicted_income": 0,
            "predicted_expense": 0,
            "predicted_profit": 0,
            "trend": {"income": "stable", "expense": "stable"},
            "confidence": "low",
            "series": None,
        }

    months_count = (
        db.session.query(extract("year", model_income.date), extract("month", model_income.date))
        .filter(model_income.user_id == user_id)
        .distinct()
        .count()
    )

    predicted_income = income_series[0]["prediction"]
    predicted_expense = expense_series[0]["prediction"]
    return {
        "predicted_income": predicted_income,
        "predicted_expense": predicted_expense,
        "predicted_profit": round(predicted_income - predicted_expense, 2),
        "trend": {"income": income_trend, "expense": expense_trend},
        "confidence": _confidence_level(months_count),
        "series": {"income": income_series, "expense": expense_series},
    }
