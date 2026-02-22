import os

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_login import current_user, login_required
from sqlalchemy import text

from backend.extensions import db, login_manager
from backend.models import Category, Expense, Income, CategoryLimit
from backend.routes.auth import auth_bp
from backend.routes.category import category_bp
from backend.routes.expense import expense_bp
from backend.routes.income import income_bp
from backend.routes.analytics import analytics_bp
from backend.routes.forecast import forecast_bp
from backend.routes.limits import limits_bp
from backend.routes.budgets import budgets_bp
from backend.routes.goals import goals_bp
from backend.routes.settings import settings_bp
from backend.routes.exchange_rates import rates_bp
from backend.routes.notifications import notifications_bp
from backend.routes.audit import audit_bp
from backend.routes.import_export import import_export_bp
from backend.routes.demo import demo_bp
from backend.routes.directories import directories_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "super-secret-key")
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://dss_user:1234@localhost/decision_support",
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["AUTO_CREATE_DB"] = os.getenv("AUTO_CREATE_DB", "0") == "1"

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
    app.register_blueprint(budgets_bp)
    app.register_blueprint(goals_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(rates_bp)
    app.register_blueprint(notifications_bp)
    app.register_blueprint(audit_bp)
    app.register_blueprint(import_export_bp)
    app.register_blueprint(demo_bp)
    app.register_blueprint(directories_bp)

    if app.config.get("AUTO_CREATE_DB", False):
        with app.app_context():
            db.create_all()

    register_legacy_routes(app)
    return app


def register_legacy_routes(app: Flask) -> None:
    @app.route("/api/health")
    def health():
        return jsonify({
            "status": "ok",
            "authenticated": current_user.is_authenticated,
        })

    @app.route("/api/health/details")
    def health_details():
        db_ok = False
        db_error = None
        try:
            db.session.execute(text("SELECT 1"))
            db_ok = True
        except Exception as error:  # pragma: no cover
            db_error = str(error)

        return jsonify({
            "status": "ok" if db_ok else "degraded",
            "authenticated": current_user.is_authenticated,
            "db": {
                "ok": db_ok,
                "error": db_error,
            },
            "routes_registered": len(app.url_map._rules),
        }), (200 if db_ok else 503)

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
                category_id=category_id,
            ).first()

            if limit:
                limit.monthly_limit = limit_value
            else:
                limit = CategoryLimit(
                    user_id=current_user.id,
                    category_id=category_id,
                    monthly_limit=limit_value,
                )
                db.session.add(limit)

            db.session.commit()
            return jsonify({"message": "Limit saved"}), 200

        limits = CategoryLimit.query.filter_by(user_id=current_user.id).all()
        return jsonify([
            {
                "category_id": row.category_id,
                "limit": float(row.monthly_limit),
            }
            for row in limits
        ])

    @app.route("/api/analytics/dashboard")
    @login_required
    def dashboard():
        incomes = Income.query.filter_by(user_id=current_user.id).all()
        expenses = Expense.query.filter_by(user_id=current_user.id).all()

        total_income = sum(item.amount for item in incomes)
        total_expense = sum(item.amount for item in expenses)
        balance = total_income - total_expense

        by_category = {}
        for item in expenses:
            category = Category.query.get(item.category_id)
            name = category.name if category else "Unknown"
            by_category[name] = by_category.get(name, 0) + item.amount

        return jsonify({
            "summary": {
                "income": total_income,
                "expense": total_expense,
                "balance": balance,
            },
            "expenses_by_category": by_category,
            "counts": {
                "income_records": len(incomes),
                "expense_records": len(expenses),
            },
        })

    @app.route("/api/recommendations")
    @login_required
    def recommendations():
        expenses = Expense.query.filter_by(user_id=current_user.id).all()
        incomes = Income.query.filter_by(user_id=current_user.id).all()

        total_income = sum(item.amount for item in incomes)
        total_expense = sum(item.amount for item in expenses)

        alerts = []
        tips = []
        detailed = []

        if total_income == 0:
            alerts.append("??? ???????")
            detailed.append({
                "type": "alert",
                "priority": "high",
                "message": "??? ???????",
                "reason": "?????????? ?????????? ???????????? ??? ???????? ???????????.",
            })
        else:
            ratio = total_expense / total_income
            if ratio > 0.7:
                alerts.append("??????? ????????? 70% ??????")
                tips.append("????????????? ????????? ???????")
                detailed.append({
                    "type": "alert",
                    "priority": "high",
                    "message": "??????? ????????? 70% ??????",
                    "reason": f"??????? ???? ????????: {round(ratio * 100, 1)}%.",
                })
                detailed.append({
                    "type": "tip",
                    "priority": "medium",
                    "message": "????????????? ????????? ???????",
                    "reason": "???????? ???? ??????? ?????????? ?????.",
                })

        if total_income - total_expense > 0:
            tips.append("??????? ????? ??? ??????????")
            detailed.append({
                "type": "tip",
                "priority": "low",
                "message": "??????? ????? ??? ??????????",
                "reason": "?????? ????????????? ? ????? ??????????? ????? ??????.",
            })

        return jsonify({
            "alerts": alerts,
            "recommendations": tips,
            "detailed": detailed,
        })


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)
