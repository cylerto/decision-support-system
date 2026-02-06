from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from ..extensions import db
from ..models import Category

categories_bp = Blueprint("categories", __name__)


@categories_bp.route("", methods=["GET"])
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


@categories_bp.route("", methods=["POST"])
@login_required
def add_category():
    data = request.get_json()

    name = data.get("name")
    category_type = data.get("type")

    if not name or category_type not in ("income", "expense"):
        return jsonify({"message": "Invalid category data"}), 400

    category = Category(
        name=name,
        type=category_type,
        user_id=current_user.id
    )

    db.session.add(category)
    db.session.commit()

    return jsonify({"message": "Category added"}), 201
