import os
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_login import current_user, login_required
from sqlalchemy import text
try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

from backend.extensions import db, login_manager
from backend.finance_engine import get_dashboard
from backend.models import CategoryLimit
from backend.recommendation_engine import build_recommendations
from backend.routes.auth import auth_bp
from backend.routes.category import category_bp
from backend.routes.expense import expense_bp
from backend.routes.income import income_bp
from backend.routes.analytics import analytics_bp
from backend.routes.forecast import forecast_bp
from backend.routes.limits import limits_bp
from backend.routes.budgets import budgets_bp
from backend.routes.settings import settings_bp
from backend.routes.audit import audit_bp
from backend.routes.import_export import import_export_bp
from backend.routes.directories import directories_bp

if load_dotenv is not None:
    load_dotenv(Path(__file__).resolve().parent.parent / '.env')


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
    app.register_blueprint(settings_bp)
    app.register_blueprint(audit_bp)
    app.register_blueprint(import_export_bp)
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
        return jsonify(get_dashboard(current_user.id))

    @app.route("/api/recommendations")
    @login_required
    def recommendations():
        return jsonify(build_recommendations(current_user.id))


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)




