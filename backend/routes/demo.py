import random
from datetime import datetime, timedelta

from flask import Blueprint, jsonify
from flask_login import login_required, current_user

from ..extensions import db
from ..models import Category, Income, Expense
from ..utils import log_action

demo_bp = Blueprint("demo_bp", __name__, url_prefix="/api/demo")


@demo_bp.route("/seed", methods=["POST"])
@login_required
def seed_demo():
    income_categories = ["Зарплата", "Фриланс", "Бонус"]
    expense_categories = ["Еда", "Транспорт", "Коммуналка", "Развлечения", "Покупки"]

    existing = Category.query.filter_by(user_id=current_user.id).all()
    if not existing:
        for name in income_categories:
            db.session.add(Category(name=name, type="income", user_id=current_user.id))
        for name in expense_categories:
            db.session.add(Category(name=name, type="expense", user_id=current_user.id))
        db.session.commit()

    categories = Category.query.filter_by(user_id=current_user.id).all()
    income_cats = [c for c in categories if c.type == "income"]
    expense_cats = [c for c in categories if c.type == "expense"]

    created = {"income": 0, "expense": 0}
    today = datetime.utcnow().date()
    for month_delta in range(0, 6):
        base_date = today - timedelta(days=30 * month_delta)
        for _ in range(6):
            if income_cats:
                income = Income(
                    amount=round(random.uniform(50000, 160000), 2),
                    date=base_date - timedelta(days=random.randint(0, 27)),
                    user_id=current_user.id,
                    category_id=random.choice(income_cats).id
                )
                db.session.add(income)
                created["income"] += 1
        for _ in range(12):
            if expense_cats:
                expense = Expense(
                    amount=round(random.uniform(500, 20000), 2),
                    date=base_date - timedelta(days=random.randint(0, 27)),
                    user_id=current_user.id,
                    category_id=random.choice(expense_cats).id
                )
                db.session.add(expense)
                created["expense"] += 1

    log_action("seed", "demo", None, created)
    db.session.commit()
    return jsonify({"message": "Demo data created", "created": created})
