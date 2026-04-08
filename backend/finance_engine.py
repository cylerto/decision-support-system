from collections import defaultdict
from datetime import datetime

from sqlalchemy import extract, func

from backend.extensions import db
from backend.models import (
    Category,
    Department,
    Expense,
    Income,
    MonthlyBudget,
    OperationDimension,
    Project,
    UserSettings,
)


DEFAULT_INCOME_CATEGORY = "Прочие доходы"
DEFAULT_EXPENSE_CATEGORY = "Прочие затраты"


def _month_key(year, month):
    return f"{int(year)}-{int(month):02d}"


def _sum_amount(model, user_id):
    value = db.session.query(func.coalesce(func.sum(model.amount), 0)).filter(model.user_id == user_id).scalar()
    return float(value or 0)


def _monthly_totals(model, user_id):
    rows = (
        db.session.query(
            extract("year", model.date).label("year"),
            extract("month", model.date).label("month"),
            func.sum(model.amount).label("total"),
        )
        .filter(model.user_id == user_id)
        .group_by("year", "month")
        .order_by("year", "month")
        .all()
    )
    return [{"year": int(y), "month": int(m), "total": float(t or 0)} for y, m, t in rows]


def get_summary(user_id):
    total_income = _sum_amount(Income, user_id)
    total_expense = _sum_amount(Expense, user_id)
    profit = total_income - total_expense
    return {
        "total_income": total_income,
        "total_expense": total_expense,
        "profit": profit,
        "status": "plus" if profit >= 0 else "minus",
    }


def get_monthly(user_id):
    return {
        "income": _monthly_totals(Income, user_id),
        "expense": _monthly_totals(Expense, user_id),
    }


def get_categories_monthly(user_id):
    rows = (
        db.session.query(
            extract("year", Expense.date).label("year"),
            extract("month", Expense.date).label("month"),
            func.coalesce(Category.name, DEFAULT_EXPENSE_CATEGORY).label("category_name"),
            func.sum(Expense.amount).label("total"),
        )
        .outerjoin(Category, Expense.category_id == Category.id)
        .filter(Expense.user_id == user_id)
        .group_by("year", "month", "category_name")
        .order_by("year", "month", "category_name")
        .all()
    )

    result = defaultdict(dict)
    for year, month, category_name, total in rows:
        result[_month_key(year, month)][category_name] = float(total or 0)
    return dict(result)


def get_balance_monthly(user_id):
    monthly = get_monthly(user_id)
    merged = {}

    for row in monthly["income"]:
        key = _month_key(row["year"], row["month"])
        merged.setdefault(key, {"income": 0.0, "expense": 0.0})
        merged[key]["income"] = float(row["total"])

    for row in monthly["expense"]:
        key = _month_key(row["year"], row["month"])
        merged.setdefault(key, {"income": 0.0, "expense": 0.0})
        merged[key]["expense"] = float(row["total"])

    result = []
    for month in sorted(merged.keys()):
        income = merged[month]["income"]
        expense = merged[month]["expense"]
        profit = income - expense
        status = "plus" if profit >= 0 else "minus"
        if income > 0 and (expense / income) > 0.7:
            status = "risk"
        result.append({
            "month": month,
            "income": income,
            "expense": expense,
            "profit": profit,
            "status": status,
        })
    return result


def get_kpi(user_id):
    summary = get_summary(user_id)
    income = summary["total_income"]
    expense = summary["total_expense"]
    savings = summary["profit"]
    savings_rate = (savings / income) if income else 0.0
    burn_rate = (expense / income) if income else 0.0
    return {
        "total_income": income,
        "total_expense": expense,
        "savings": savings,
        "savings_rate": round(savings_rate, 4),
        "burn_rate": round(burn_rate, 4),
    }


def get_profit_by_departments(user_id):
    departments = Department.query.filter_by(user_id=user_id).order_by(Department.name.asc()).all()
    name_map = {row.id: row.name for row in departments}

    income_rows = (
        db.session.query(
            OperationDimension.department_id,
            func.coalesce(func.sum(Income.amount), 0).label("total_income"),
        )
        .join(
            Income,
            (Income.id == OperationDimension.transaction_id) & (Income.user_id == user_id),
        )
        .filter(
            OperationDimension.user_id == user_id,
            OperationDimension.transaction_type == "income",
        )
        .group_by(OperationDimension.department_id)
        .all()
    )
    expense_rows = (
        db.session.query(
            OperationDimension.department_id,
            func.coalesce(func.sum(Expense.amount), 0).label("total_expense"),
        )
        .join(
            Expense,
            (Expense.id == OperationDimension.transaction_id) & (Expense.user_id == user_id),
        )
        .filter(
            OperationDimension.user_id == user_id,
            OperationDimension.transaction_type == "expense",
        )
        .group_by(OperationDimension.department_id)
        .all()
    )

    totals = {}
    for department_id, total_income in income_rows:
        key = int(department_id) if department_id is not None else 0
        totals.setdefault(key, {"income": 0.0, "expense": 0.0})
        totals[key]["income"] = float(total_income or 0)

    for department_id, total_expense in expense_rows:
        key = int(department_id) if department_id is not None else 0
        totals.setdefault(key, {"income": 0.0, "expense": 0.0})
        totals[key]["expense"] = float(total_expense or 0)

    result = []
    for department_id, values in totals.items():
        income = values["income"]
        expense = values["expense"]
        result.append(
            {
                "department_id": None if department_id == 0 else department_id,
                "department_name": name_map.get(department_id, "Не указано"),
                "income": round(income, 2),
                "expense": round(expense, 2),
                "profit": round(income - expense, 2),
            }
        )

    return sorted(result, key=lambda item: item["profit"], reverse=True)


def get_profit_by_projects(user_id):
    projects = Project.query.filter_by(user_id=user_id).order_by(Project.name.asc()).all()
    name_map = {row.id: row.name for row in projects}
    name_map[0] = "Без проекта"

    income_rows = (
        db.session.query(
            OperationDimension.project_id,
            func.coalesce(func.sum(Income.amount), 0).label("total_income"),
        )
        .join(
            Income,
            (Income.id == OperationDimension.transaction_id) & (Income.user_id == user_id),
        )
        .filter(
            OperationDimension.user_id == user_id,
            OperationDimension.transaction_type == "income",
        )
        .group_by(OperationDimension.project_id)
        .all()
    )
    expense_rows = (
        db.session.query(
            OperationDimension.project_id,
            func.coalesce(func.sum(Expense.amount), 0).label("total_expense"),
        )
        .join(
            Expense,
            (Expense.id == OperationDimension.transaction_id) & (Expense.user_id == user_id),
        )
        .filter(
            OperationDimension.user_id == user_id,
            OperationDimension.transaction_type == "expense",
        )
        .group_by(OperationDimension.project_id)
        .all()
    )

    totals = {}
    for project_id, total_income in income_rows:
        key = int(project_id) if project_id is not None else 0
        totals.setdefault(key, {"income": 0.0, "expense": 0.0})
        totals[key]["income"] = float(total_income or 0)

    for project_id, total_expense in expense_rows:
        key = int(project_id) if project_id is not None else 0
        totals.setdefault(key, {"income": 0.0, "expense": 0.0})
        totals[key]["expense"] = float(total_expense or 0)

    result = []
    for project_id, values in totals.items():
        income = values["income"]
        expense = values["expense"]
        result.append(
            {
                "project_id": None if project_id == 0 else project_id,
                "project_name": name_map.get(project_id, "Без проекта"),
                "income": round(income, 2),
                "expense": round(expense, 2),
                "profit": round(income - expense, 2),
            }
        )

    return sorted(result, key=lambda item: item["profit"], reverse=True)


def get_segments(user_id):
    expenses = Expense.query.filter_by(user_id=user_id).all()
    weekday_count = {str(i): 0 for i in range(7)}
    weekday_amount = {str(i): 0.0 for i in range(7)}
    for row in expenses:
        idx = row.date.weekday()
        key = str(idx)
        weekday_count[key] += 1
        weekday_amount[key] += float(row.amount)
    return {"weekday_count": weekday_count, "weekday_amount": weekday_amount}


def get_budget_vs_actual(user_id):
    budgets = MonthlyBudget.query.filter_by(user_id=user_id).all()
    if not budgets:
        return []

    monthly = get_monthly(user_id)
    actual_map = {}
    for row in monthly["income"]:
        key = _month_key(row["year"], row["month"])
        actual_map.setdefault(key, {"income": 0.0, "expense": 0.0})
        actual_map[key]["income"] = row["total"]
    for row in monthly["expense"]:
        key = _month_key(row["year"], row["month"])
        actual_map.setdefault(key, {"income": 0.0, "expense": 0.0})
        actual_map[key]["expense"] = row["total"]

    result = []
    for budget in budgets:
        month = f"{budget.year}-{int(budget.month):02d}"
        actual = actual_map.get(month, {"income": 0.0, "expense": 0.0})
        result.append({
            "month": month,
            "planned_income": float(budget.planned_income or 0),
            "planned_expense": float(budget.planned_expense or 0),
            "actual_income": float(actual["income"]),
            "actual_expense": float(actual["expense"]),
        })

    return sorted(result, key=lambda item: item["month"])


def get_baseline_monthly(user_id):
    budget_map = {row["month"]: row for row in get_budget_vs_actual(user_id)}
    monthly = get_monthly(user_id)
    months = set()
    actual = {}

    for row in monthly["income"]:
        key = _month_key(row["year"], row["month"])
        months.add(key)
        actual.setdefault(key, {"income": 0.0, "expense": 0.0})
        actual[key]["income"] = float(row["total"])

    for row in monthly["expense"]:
        key = _month_key(row["year"], row["month"])
        months.add(key)
        actual.setdefault(key, {"income": 0.0, "expense": 0.0})
        actual[key]["expense"] = float(row["total"])

    months.update(budget_map.keys())
    result = []

    for month in sorted(months):
        income = float(actual.get(month, {}).get("income", 0))
        expense = float(actual.get(month, {}).get("expense", 0))
        profit = income - expense
        margin = (profit / income * 100) if income > 0 else 0
        burn = (expense / income * 100) if income > 0 else 0

        planned_expense = float(budget_map.get(month, {}).get("planned_expense", 0))
        deviation = expense - planned_expense
        deviation_pct = (deviation / planned_expense * 100) if planned_expense > 0 else 0

        result.append({
            "month": month,
            "income": income,
            "expense": expense,
            "profit": profit,
            "profit_margin_pct": round(margin, 2),
            "burn_rate_pct": round(burn, 2),
            "planned_expense": planned_expense,
            "budget_deviation": round(deviation, 2),
            "budget_deviation_pct": round(deviation_pct, 2),
        })

    return result


def run_scenario(user_id, income_change_pct=0.0, expense_change_pct=0.0):
    base = get_summary(user_id)
    base_income = base["total_income"]
    base_expense = base["total_expense"]
    base_profit = base["profit"]

    scenario_income = base_income * (1 + income_change_pct / 100)
    scenario_expense = base_expense * (1 + expense_change_pct / 100)
    scenario_profit = scenario_income - scenario_expense

    base_margin = (base_profit / base_income * 100) if base_income > 0 else 0
    scenario_margin = (scenario_profit / scenario_income * 100) if scenario_income > 0 else 0
    base_burn = (base_expense / base_income * 100) if base_income > 0 else 0
    scenario_burn = (scenario_expense / scenario_income * 100) if scenario_income > 0 else 0

    return {
        "input": {
            "income_change_pct": float(income_change_pct),
            "expense_change_pct": float(expense_change_pct),
        },
        "base": {
            "income": round(base_income, 2),
            "expense": round(base_expense, 2),
            "profit": round(base_profit, 2),
            "profit_margin_pct": round(base_margin, 2),
            "burn_rate_pct": round(base_burn, 2),
        },
        "scenario": {
            "income": round(scenario_income, 2),
            "expense": round(scenario_expense, 2),
            "profit": round(scenario_profit, 2),
            "profit_margin_pct": round(scenario_margin, 2),
            "burn_rate_pct": round(scenario_burn, 2),
        },
        "delta": {
            "profit": round(scenario_profit - base_profit, 2),
            "profit_margin_pct": round(scenario_margin - base_margin, 2),
            "burn_rate_pct": round(scenario_burn - base_burn, 2),
        },
    }


def get_recommendations(user_id):
    summary = get_summary(user_id)
    total_income = summary["total_income"]
    total_expense = summary["total_expense"]

    alerts = []
    tips = []
    detailed = []

    def push_item(problem, cause, action, priority="medium", item_type="tip"):
        entry = {
            "type": item_type,
            "priority": priority,
            "problem": problem,
            "cause": cause,
            "action": action,
            "message": problem,
            "reason": cause,
        }
        detailed.append(entry)
        if item_type == "alert":
            alerts.append(problem)
        tips.append(action)

    if summary["profit"] < 0:
        push_item(
            problem="Отрицательный баланс",
            cause=f"Текущий финансовый результат: {round(summary['profit'], 2)}.",
            action="Сократить переменные затраты и пересмотреть убыточные статьи.",
            priority="high",
            item_type="alert",
        )

    if total_income == 0:
        push_item(
            problem="Нет доходов",
            cause="Отсутствуют операции выручки за анализируемый период.",
            action="Добавить источники выручки в систему и проверить корректность импорта.",
            priority="high",
            item_type="alert",
        )
    else:
        ratio = total_expense / total_income
        if ratio > 0.7:
            push_item(
                problem="Расходы превышают 70% доходов",
                cause=f"Текущая доля расходов: {round(ratio * 100, 1)}%.",
                action="Оптимизировать постоянные затраты и ввести лимиты по проблемным категориям.",
                priority="high",
                item_type="alert",
            )

    if summary["profit"] > 0:
        push_item(
            problem="Низкий резерв устойчивости",
            cause="Прибыль не закреплена в резервном фонде.",
            action="Направить часть прибыли в резерв на покрытие кассовых разрывов.",
            priority="low",
            item_type="tip",
        )

    baseline = get_baseline_monthly(user_id)
    overspent_months = [row for row in baseline if row["planned_expense"] > 0 and row["budget_deviation"] > 0]
    if overspent_months:
        latest = overspent_months[-1]
        push_item(
            problem="Есть перерасход бюджета",
            cause=f"{latest['month']}: отклонение {latest['budget_deviation']} ({latest['budget_deviation_pct']}%).",
            action="Пересмотреть бюджет и усилить контроль статей с перерасходом.",
            priority="medium",
            item_type="alert",
        )

    unique_tips = []
    for tip in tips:
        if tip not in unique_tips:
            unique_tips.append(tip)

    return {"alerts": alerts, "recommendations": unique_tips, "detailed": detailed}


def get_financial_stability(user_id):
    baseline = get_baseline_monthly(user_id)
    summary = get_summary(user_id)

    latest = baseline[-1] if baseline else None
    previous = baseline[-2] if len(baseline) > 1 else None

    profit_margin_pct = float(latest["profit_margin_pct"]) if latest else 0.0
    budget_deviation_pct = float(latest["budget_deviation_pct"]) if latest else 0.0

    if previous and float(previous.get("expense", 0)) > 0:
        expense_growth_pct = (
            (float(latest.get("expense", 0)) - float(previous.get("expense", 0)))
            / float(previous.get("expense", 0))
        ) * 100.0
    else:
        expense_growth_pct = 0.0

    from backend.ai_engine import evaluate_financial_stability

    return evaluate_financial_stability(
        {
            "profit_margin_pct": round(profit_margin_pct, 2),
            "expense_growth_pct": round(expense_growth_pct, 2),
            "budget_deviation_pct": round(budget_deviation_pct, 2),
            "profit": round(float(summary.get("profit", 0)), 2),
        }
    )


def get_dashboard(user_id):
    summary = get_summary(user_id)
    expense_rows = Expense.query.filter_by(user_id=user_id).all()
    by_category = defaultdict(float)
    for row in expense_rows:
        category = Category.query.get(row.category_id)
        name = category.name if category else DEFAULT_EXPENSE_CATEGORY
        by_category[name] += float(row.amount)

    counts = {
        "income_records": Income.query.filter_by(user_id=user_id).count(),
        "expense_records": len(expense_rows),
    }

    return {
        "summary": {
            "income": summary["total_income"],
            "expense": summary["total_expense"],
            "balance": summary["profit"],
        },
        "expenses_by_category": dict(by_category),
        "counts": counts,
    }


def get_user_format_settings(user_id):
    settings = UserSettings.query.filter_by(user_id=user_id).first()
    return {
        "currency": (settings.base_currency if settings else "RUB") or "RUB",
        "timezone": "UTC",
        "date_format": "YYYY-MM-DD",
        "updated_at_utc": datetime.utcnow().isoformat(timespec="seconds") + "Z",
    }


def data_quality(user_id):
    uncategorized_income = Income.query.filter_by(user_id=user_id, category_id=None).count()
    uncategorized_expense = Expense.query.filter_by(user_id=user_id, category_id=None).count()
    empty_name_categories = Category.query.filter_by(user_id=user_id).filter(
        (Category.name == None) | (Category.name == "")
    ).count()
    missing_income_department = (
        db.session.query(Income.id)
        .outerjoin(
            OperationDimension,
            (OperationDimension.user_id == user_id)
            & (OperationDimension.transaction_type == "income")
            & (OperationDimension.transaction_id == Income.id),
        )
        .filter(Income.user_id == user_id)
        .filter((OperationDimension.id == None) | (OperationDimension.department_id == None))
        .count()
    )
    missing_expense_department = (
        db.session.query(Expense.id)
        .outerjoin(
            OperationDimension,
            (OperationDimension.user_id == user_id)
            & (OperationDimension.transaction_type == "expense")
            & (OperationDimension.transaction_id == Expense.id),
        )
        .filter(Expense.user_id == user_id)
        .filter((OperationDimension.id == None) | (OperationDimension.department_id == None))
        .count()
    )

    return {
        "issues": {
            "uncategorized_income": uncategorized_income,
            "uncategorized_expense": uncategorized_expense,
            "empty_name_categories": empty_name_categories,
            "missing_income_department": missing_income_department,
            "missing_expense_department": missing_expense_department,
        },
        "total_issues": (
            uncategorized_income
            + uncategorized_expense
            + empty_name_categories
            + missing_income_department
            + missing_expense_department
        ),
    }


def fix_uncategorized_operations(user_id):
    income_category = Category.query.filter_by(
        user_id=user_id, type="income", name=DEFAULT_INCOME_CATEGORY
    ).first()
    if not income_category:
        income_category = Category(user_id=user_id, type="income", name=DEFAULT_INCOME_CATEGORY)
        db.session.add(income_category)
        db.session.flush()

    expense_category = Category.query.filter_by(
        user_id=user_id, type="expense", name=DEFAULT_EXPENSE_CATEGORY
    ).first()
    if not expense_category:
        expense_category = Category(user_id=user_id, type="expense", name=DEFAULT_EXPENSE_CATEGORY)
        db.session.add(expense_category)
        db.session.flush()

    updated_income = Income.query.filter_by(user_id=user_id, category_id=None).update(
        {"category_id": income_category.id}
    )
    updated_expense = Expense.query.filter_by(user_id=user_id, category_id=None).update(
        {"category_id": expense_category.id}
    )

    default_department = Department.query.filter_by(user_id=user_id, name="Не указано").first()
    if not default_department:
        default_department = Department(user_id=user_id, name="Не указано")
        db.session.add(default_department)
        db.session.flush()

    for row in Income.query.filter_by(user_id=user_id).all():
        dim = OperationDimension.query.filter_by(
            user_id=user_id, transaction_type="income", transaction_id=row.id
        ).first()
        if not dim:
            dim = OperationDimension(
                user_id=user_id,
                transaction_type="income",
                transaction_id=row.id,
                department_id=default_department.id,
            )
            db.session.add(dim)
        elif not dim.department_id:
            dim.department_id = default_department.id

    for row in Expense.query.filter_by(user_id=user_id).all():
        dim = OperationDimension.query.filter_by(
            user_id=user_id, transaction_type="expense", transaction_id=row.id
        ).first()
        if not dim:
            dim = OperationDimension(
                user_id=user_id,
                transaction_type="expense",
                transaction_id=row.id,
                department_id=default_department.id,
            )
            db.session.add(dim)
        elif not dim.department_id:
            dim.department_id = default_department.id

    db.session.commit()
    return {
        "message": "Uncategorized operations fixed",
        "updated_income": updated_income,
        "updated_expense": updated_expense,
        "default_department_id": default_department.id,
    }


def _simple_linear_predict(values, steps):
    n = len(values)
    if n == 0:
        return [0.0] * steps
    if n == 1:
        return [float(values[0])] * steps

    x = list(range(n))
    x_mean = sum(x) / n
    y_mean = sum(values) / n
    num = sum((x[i] - x_mean) * (values[i] - y_mean) for i in range(n))
    den = sum((x[i] - x_mean) ** 2 for i in range(n)) or 1
    slope = num / den
    intercept = y_mean - slope * x_mean

    return [max(0.0, intercept + slope * (n + i)) for i in range(steps)]


def ai_forecast(income_model, expense_model, user_id, months=6):
    income_rows = _monthly_totals(income_model, user_id)
    expense_rows = _monthly_totals(expense_model, user_id)

    month_keys = sorted({
        _month_key(row["year"], row["month"]) for row in income_rows + expense_rows
    })
    stability = get_financial_stability(user_id)
    if len(month_keys) < 2:
        return {
            "message": "Недостаточно данных для прогноза",
            "series": None,
            "confidence": "низкая",
            "stability": stability,
        }

    income_by_month = {
        _month_key(row["year"], row["month"]): float(row["total"]) for row in income_rows
    }
    expense_by_month = {
        _month_key(row["year"], row["month"]): float(row["total"]) for row in expense_rows
    }

    income_series = [income_by_month.get(month, 0.0) for month in month_keys]
    expense_series = [expense_by_month.get(month, 0.0) for month in month_keys]

    predicted_income = _simple_linear_predict(income_series, months)
    predicted_expense = _simple_linear_predict(expense_series, months)

    last_year, last_month = map(int, month_keys[-1].split("-"))
    labels = []
    y, m = last_year, last_month
    for _ in range(months):
        m += 1
        if m > 12:
            y += 1
            m = 1
        labels.append(f"{y}-{m:02d}")

    confidence = "высокая" if len(month_keys) >= 6 else ("средняя" if len(month_keys) >= 4 else "низкая")
    return {
        "series": {
            "income": [{"month": labels[i], "prediction": round(predicted_income[i], 2)} for i in range(months)],
            "expense": [{"month": labels[i], "prediction": round(predicted_expense[i], 2)} for i in range(months)],
        },
        "confidence": confidence,
        "stability": stability,
    }


