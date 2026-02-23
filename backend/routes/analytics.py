from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from backend.finance_engine import (
    data_quality,
    fix_uncategorized_operations,
    get_balance_monthly,
    get_baseline_monthly,
    get_budget_vs_actual,
    get_categories_monthly,
    get_kpi,
    get_monthly,
    get_segments,
    get_summary,
    get_user_format_settings,
    run_scenario,
)

analytics_bp = Blueprint("analytics", __name__, url_prefix="/api/analytics")


@analytics_bp.route("/summary", methods=["GET"])
@login_required
def summary():
    return jsonify(get_summary(current_user.id))


@analytics_bp.route("/monthly", methods=["GET"])
@login_required
def monthly():
    return jsonify(get_monthly(current_user.id))


@analytics_bp.route("/categories/monthly", methods=["GET"])
@login_required
def categories_monthly():
    return jsonify(get_categories_monthly(current_user.id))


@analytics_bp.route("/balance/monthly", methods=["GET"])
@login_required
def balance_monthly():
    return jsonify(get_balance_monthly(current_user.id))


@analytics_bp.route("/kpi", methods=["GET"])
@login_required
def kpi():
    return jsonify(get_kpi(current_user.id))


@analytics_bp.route("/segments", methods=["GET"])
@login_required
def segments():
    return jsonify(get_segments(current_user.id))


@analytics_bp.route("/budget-vs-actual", methods=["GET"])
@login_required
def budget_vs_actual():
    return jsonify(get_budget_vs_actual(current_user.id))


@analytics_bp.route("/baseline/monthly", methods=["GET"])
@login_required
def baseline_monthly():
    return jsonify(get_baseline_monthly(current_user.id))


@analytics_bp.route("/scenario", methods=["POST"])
@login_required
def scenario():
    data = request.get_json() or {}
    income_change_pct = float(data.get("income_change_pct", 0))
    expense_change_pct = float(data.get("expense_change_pct", 0))
    return jsonify(run_scenario(current_user.id, income_change_pct, expense_change_pct))


@analytics_bp.route("/data-quality", methods=["GET"])
@login_required
def quality():
    return jsonify(data_quality(current_user.id))


@analytics_bp.route("/data-quality/fix-categories", methods=["POST"])
@login_required
def quality_fix_categories():
    return jsonify(fix_uncategorized_operations(current_user.id))


@analytics_bp.route("/format", methods=["GET"])
@login_required
def format_settings():
    return jsonify(get_user_format_settings(current_user.id))
