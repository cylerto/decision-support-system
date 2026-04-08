from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from ..finance_engine import ai_forecast
from ..models import Expense, Income
from ..scope import get_scope_user_id

forecast_bp = Blueprint("forecast_bp", __name__, url_prefix="/api/analytics/forecast")


@forecast_bp.route("", methods=["GET"])
@login_required
def get_forecast():
    months = max(1, min(12, request.args.get("months", default=6, type=int)))
    return jsonify(ai_forecast(Income, Expense, get_scope_user_id(current_user.id), months))
