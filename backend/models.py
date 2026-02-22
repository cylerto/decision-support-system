from datetime import date, datetime
from flask_login import UserMixin

from .extensions import db, login_manager


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


class User(db.Model, UserMixin):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)


class Category(db.Model):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(10), nullable=False)  # income / expense
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)


class Income(db.Model):
    __tablename__ = "income"

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, default=date.today)
    amount = db.Column(db.Float, nullable=False)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"))


class Expense(db.Model):
    __tablename__ = "expense"

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, default=date.today)
    amount = db.Column(db.Float, nullable=False)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"))


class CategoryLimit(db.Model):
    __tablename__ = "category_limits"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=False)
    monthly_limit = db.Column("monthly_limit", db.Numeric(12, 2), nullable=False)

    __table_args__ = (
        db.UniqueConstraint("user_id", "category_id", name="uix_user_category_limit"),
    )


class UserSettings(db.Model):
    __tablename__ = "user_settings"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True)
    base_currency = db.Column(db.String(8), nullable=False, default="RUB")
    widgets = db.Column(db.JSON, nullable=False, default=dict)
    notify_channels = db.Column(db.JSON, nullable=False, default=list)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CategoryMeta(db.Model):
    __tablename__ = "category_meta"

    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=False, unique=True)
    color = db.Column(db.String(24), nullable=True)
    icon = db.Column(db.String(64), nullable=True)


class TransactionMeta(db.Model):
    __tablename__ = "transaction_meta"

    id = db.Column(db.Integer, primary_key=True)
    transaction_type = db.Column(db.String(10), nullable=False)  # income / expense
    transaction_id = db.Column(db.Integer, nullable=False)
    currency = db.Column(db.String(8), nullable=False, default="RUB")
    fx_rate = db.Column(db.Float, nullable=True)  # to base currency
    note = db.Column(db.String(255), nullable=True)
    original_amount = db.Column(db.Float, nullable=True)

    __table_args__ = (
        db.UniqueConstraint("transaction_type", "transaction_id", name="uix_transaction_meta"),
    )


class ExchangeRate(db.Model):
    __tablename__ = "exchange_rates"

    id = db.Column(db.Integer, primary_key=True)
    base_currency = db.Column(db.String(8), nullable=False)
    quote_currency = db.Column(db.String(8), nullable=False)
    rate = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, default=date.today, nullable=False)

    __table_args__ = (
        db.UniqueConstraint("base_currency", "quote_currency", "date", name="uix_exchange_rate"),
    )


class SavingsGoal(db.Model):
    __tablename__ = "savings_goals"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    target_amount = db.Column(db.Float, nullable=False)
    current_amount = db.Column(db.Float, nullable=False, default=0)
    due_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class MonthlyBudget(db.Model):
    __tablename__ = "monthly_budgets"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)
    planned_income = db.Column(db.Float, nullable=False, default=0)
    planned_expense = db.Column(db.Float, nullable=False, default=0)

    __table_args__ = (
        db.UniqueConstraint("user_id", "year", "month", name="uix_monthly_budget"),
    )


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    channel = db.Column(db.String(20), nullable=False, default="in_app")
    message = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="new")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    action = db.Column(db.String(50), nullable=False)
    entity = db.Column(db.String(50), nullable=False)
    entity_id = db.Column(db.Integer, nullable=True)
    data = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Department(db.Model):
    __tablename__ = "departments"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    name = db.Column(db.String(120), nullable=False)

    __table_args__ = (
        db.UniqueConstraint("user_id", "name", name="uix_department_user_name"),
    )


class Project(db.Model):
    __tablename__ = "projects"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    name = db.Column(db.String(120), nullable=False)

    __table_args__ = (
        db.UniqueConstraint("user_id", "name", name="uix_project_user_name"),
    )


class Counterparty(db.Model):
    __tablename__ = "counterparties"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    name = db.Column(db.String(160), nullable=False)

    __table_args__ = (
        db.UniqueConstraint("user_id", "name", name="uix_counterparty_user_name"),
    )


class OperationDimension(db.Model):
    __tablename__ = "operation_dimensions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    transaction_type = db.Column(db.String(10), nullable=False)  # income / expense
    transaction_id = db.Column(db.Integer, nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=True)
    counterparty_id = db.Column(db.Integer, db.ForeignKey("counterparties.id"), nullable=True)

    __table_args__ = (
        db.UniqueConstraint("transaction_type", "transaction_id", name="uix_operation_dimension"),
    )
