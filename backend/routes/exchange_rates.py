from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from ..extensions import db
from ..models import ExchangeRate
from ..utils import log_action

rates_bp = Blueprint("rates_bp", __name__, url_prefix="/api/exchange-rates")


@rates_bp.route("", methods=["GET"])
@login_required
def get_rates():
    base = request.args.get("base")
    quote = request.args.get("quote")
    query = ExchangeRate.query
    if base:
        query = query.filter_by(base_currency=base)
    if quote:
        query = query.filter_by(quote_currency=quote)
    rates = query.order_by(ExchangeRate.date.desc()).limit(200).all()
    return jsonify([
        {
            "id": r.id,
            "base_currency": r.base_currency,
            "quote_currency": r.quote_currency,
            "rate": r.rate,
            "date": r.date.isoformat()
        } for r in rates
    ])


@rates_bp.route("", methods=["POST"])
@login_required
def create_rate():
    data = request.get_json() or {}
    base = data.get("base_currency")
    quote = data.get("quote_currency")
    rate = data.get("rate")
    date_str = data.get("date")
    if not base or not quote or rate is None:
        return jsonify({"message": "base_currency, quote_currency, rate required"}), 400

    rate_row = ExchangeRate(
        base_currency=base,
        quote_currency=quote,
        rate=rate,
        date=datetime.strptime(date_str, "%Y-%m-%d").date() if date_str else datetime.utcnow().date()
    )
    db.session.add(rate_row)
    log_action("create", "exchange_rate", None, data)
    db.session.commit()
    return jsonify({"message": "Rate saved"}), 201
