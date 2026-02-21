from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from ..extensions import db
from ..models import Category, CategoryMeta
from ..utils import log_action

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

    log_action("create", "category", category.id, {"name": category.name, "type": category.type})
    db.session.commit()

    return jsonify({"message": "Category added", "id": category.id}), 201


@category_bp.route("", methods=["GET"])
@login_required
def get_categories():
    query = Category.query.filter_by(user_id=current_user.id)
    category_type = request.args.get("type")
    search = request.args.get("search")
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 50, type=int)

    if category_type == "undefined":
        category_type = None
    if category_type in ("income", "expense"):
        query = query.filter_by(type=category_type)
    if search == "undefined":
        search = None
    if search:
        query = query.filter(Category.name.ilike(f"%{search}%"))

    total = query.count()
    categories = query.order_by(Category.name.asc()).offset((page - 1) * page_size).limit(page_size).all()
    if categories:
        meta_rows = CategoryMeta.query.filter(
            CategoryMeta.category_id.in_([c.id for c in categories])
        ).all()
        meta_map = {m.category_id: m for m in meta_rows}
    else:
        meta_map = {}

    return jsonify({
        "items": [
            {
                "id": c.id,
                "name": c.name,
                "type": c.type,
                "color": meta_map.get(c.id).color if meta_map.get(c.id) else None,
                "icon": meta_map.get(c.id).icon if meta_map.get(c.id) else None,
            }
            for c in categories
        ],
        "total": total,
        "page": page,
        "page_size": page_size
    })


@category_bp.route("/<int:category_id>", methods=["PUT"])
@login_required
def update_category(category_id):
    data = request.get_json() or {}
    category = Category.query.filter_by(id=category_id, user_id=current_user.id).first()
    if not category:
        return jsonify({"message": "Category not found"}), 404

    name = data.get("name")
    category_type = data.get("type")
    color = data.get("color")
    icon = data.get("icon")

    if name:
        category.name = name
    if category_type:
        if category_type not in ["income", "expense"]:
            return jsonify({"message": "Type must be income or expense"}), 400
        category.type = category_type

    meta = CategoryMeta.query.filter_by(category_id=category.id).first()
    if color or icon:
        if not meta:
            meta = CategoryMeta(category_id=category.id)
            db.session.add(meta)
        if color:
            meta.color = color
        if icon:
            meta.icon = icon

    log_action("update", "category", category.id, data)
    db.session.commit()

    return jsonify({"message": "Category updated"})


@category_bp.route("/<int:category_id>", methods=["DELETE"])
@login_required
def delete_category(category_id):
    category = Category.query.filter_by(id=category_id, user_id=current_user.id).first()
    if not category:
        return jsonify({"message": "Category not found"}), 404

    from ..models import Income, Expense
    in_use = Income.query.filter_by(category_id=category.id, user_id=current_user.id).first()
    if not in_use:
        in_use = Expense.query.filter_by(category_id=category.id, user_id=current_user.id).first()
    if in_use:
        return jsonify({"message": "Category is in use"}), 400

    CategoryMeta.query.filter_by(category_id=category.id).delete()
    db.session.delete(category)
    log_action("delete", "category", category.id)
    db.session.commit()

    return jsonify({"message": "Category deleted"})
