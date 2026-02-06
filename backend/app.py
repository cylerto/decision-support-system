from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_login import current_user, login_required

from backend.extensions import db, login_manager
from backend.models import Category, Expense, Income, User, CategoryLimit
from backend.routes.auth import auth_bp
from backend.routes.category import category_bp
from backend.routes.expense import expense_bp
from backend.routes.income import income_bp
from backend.routes.analytics import analytics_bp
from backend.routes.forecast import forecast_bp
from backend.routes.limits import limits_bp


app = Flask(__name__)
app.config["SECRET_KEY"] = "super-secret-key"
app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql+psycopg://dss_user:1234@localhost/decision_support"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)
login_manager.init_app(app)
CORS(app, supports_credentials=True)

app.register_blueprint(auth_bp)
app.register_blueprint(category_bp)
app.register_blueprint(income_bp)
app.register_blueprint(expense_bp)
app.register_blueprint(analytics_bp)
app.register_blueprint(forecast_bp)
app.register_blueprint(limits_bp, url_prefix="/api/limits")


@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "authenticated": current_user.is_authenticated
    })


@app.route("/api/category-limits", methods=["GET", "POST"])
@login_required
def legacy_category_limits():
    if request.method == "POST":
        data = request.get_json() or {}
        category_id = data.get("category_id")
        limit_value = data.get("monthly_limit", data.get("limit"))

        if not category_id or limit_value is None:
            return jsonify({"message": "category_id and limit required"}), 400

        limit = CategoryLimit.query.filter_by(
            user_id=current_user.id,
            category_id=category_id
        ).first()

        if limit:
            limit.monthly_limit = limit_value
        else:
            limit = CategoryLimit(
                user_id=current_user.id,
                category_id=category_id,
                monthly_limit=limit_value
            )
            db.session.add(limit)

        db.session.commit()
        return jsonify({"message": "Limit saved"}), 200

    limits = CategoryLimit.query.filter_by(user_id=current_user.id).all()
    return jsonify([
        {
            "category_id": l.category_id,
            "limit": float(l.monthly_limit)
        }
        for l in limits
    ])


@app.route("/api/analytics/dashboard")
@login_required
def dashboard():
    incomes = Income.query.filter_by(user_id=current_user.id).all()
    expenses = Expense.query.filter_by(user_id=current_user.id).all()

    total_income = sum(i.amount for i in incomes)
    total_expense = sum(e.amount for e in expenses)
    balance = total_income - total_expense

    by_category = {}
    for expense in expenses:
        cat = Category.query.get(expense.category_id)
        name = cat.name if cat else "Unknown"
        by_category[name] = by_category.get(name, 0) + expense.amount

    return jsonify({
        "summary": {
            "income": total_income,
            "expense": total_expense,
            "balance": balance
        },
        "expenses_by_category": by_category,
        "counts": {
            "income_records": len(incomes),
            "expense_records": len(expenses)
        }
    })


@app.route("/api/recommendations")
@login_required
def recommendations():
    expenses = Expense.query.filter_by(user_id=current_user.id).all()
    incomes = Income.query.filter_by(user_id=current_user.id).all()

    total_income = sum(i.amount for i in incomes)
    total_expense = sum(e.amount for e in expenses)

    alerts = []
    tips = []

    if total_income == 0:
        alerts.append("Нет доходов")
    else:
        ratio = total_expense / total_income
        if ratio > 0.7:
            alerts.append("Расходы превышают 70% дохода")
            tips.append("Рекомендуется сократить расходы")

    if total_income - total_expense > 0:
        tips.append("Хороший месяц для накоплений")

    return jsonify({
        "alerts": alerts,
        "recommendations": tips
    })


if __name__ == "__main__":
    app.run(debug=True)
