from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from ..extensions import db
from ..models import CategoryLimit

limits_bp = Blueprint("limits", __name__)

# ➕ добавить / обновить лимит
@limits_bp.route("", methods=["POST"])
@login_required
def set_limit():
    data = request.get_json()

    category_id = data.get("category_id")
    monthly_limit = data.get("monthly_limit")

    if not category_id or not monthly_limit:
        return jsonify({"message": "category_id and monthly_limit required"}), 400

    limit = CategoryLimit.query.filter_by(
        user_id=current_user.id,
        category_id=category_id
    ).first()

    if limit:
        limit.monthly_limit = monthly_limit
    else:
        limit = CategoryLimit(
            user_id=current_user.id,
            category_id=category_id,
            monthly_limit=monthly_limit
        )
        db.session.add(limit)

    db.session.commit()
    return jsonify({"message": "Limit saved"}), 200


# 📄 получить все лимиты пользователя
@limits_bp.route("", methods=["GET"])
@login_required
def get_limits():
    limits = CategoryLimit.query.filter_by(user_id=current_user.id).all()

    result = [
        {
            "category_id": l.category_id,
            "monthly_limit": float(l.monthly_limit)
        }
        for l in limits
    ]

    return jsonify(result)
