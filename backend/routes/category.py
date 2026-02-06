from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from ..extensions import db
from ..models import Category

category_bp = Blueprint("category_bp", __name__, url_prefix="/api/categories")


@category_bp.route("", methods=["POST"])
@login_required
def add_category():
    data = request.get_json()

    if not data or "name" not in data or "type" not in data:
        return jsonify({"message": "Invalid data"}), 400

    if data["type"] not in ["income", "expense"]:
        return jsonify({"message": "Type must be income or expense"}), 400

    category = Category(
        name=data["name"],
        type=data["type"],
        user_id=current_user.id
    )

    db.session.add(category)
    db.session.commit()

    return jsonify({"message": "Category added"}), 201


@category_bp.route("", methods=["GET"])
@login_required
def get_categories():
    categories = Category.query.filter_by(user_id=current_user.id).all()

    return jsonify([
        {
            "id": c.id,
            "name": c.name,
            "type": c.type
        }
        for c in categories
    ])
