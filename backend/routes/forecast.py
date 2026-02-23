from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from backend.ai_engine import forecast as ai_forecast
from backend.models import Expense, Income

forecast_bp = Blueprint("forecast_bp", __name__, url_prefix="/api/analytics/forecast")


@forecast_bp.route("", methods=["GET"])
@login_required
def forecast():
    months = int(min(max(int(request.args.get("months", 1)), 1), 6))
    return jsonify(ai_forecast(Income, Expense, current_user.id, months))
