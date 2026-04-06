from __future__ import annotations

from datetime import date
from random import Random

from werkzeug.security import generate_password_hash

from backend.app import create_app
from backend.extensions import db
from backend.models import (
    AuditLog,
    Category,
    CategoryLimit,
    CategoryMeta,
    Department,
    Expense,
    Income,
    MonthlyBudget,
    Notification,
    OperationDimension,
    Project,
    SavingsGoal,
    TransactionMeta,
    User,
    UserSettings,
)


USERNAME = "coffee_owner"
PASSWORD = "Coffee2026!"


DEPARTMENTS = [
    "Зал продаж",
    "Кухня",
    "Доставка",
    "Администрация",
    "Склад",
    "Онлайн-продажи",
    "Маркетинг",
    "Закупки",
]


PROJECTS = [
    "Весенняя акция",
    "Корпоративные заказы",
    "Новый сайт",
    "Летнее меню",
    "Программа лояльности",
    "Праздничные наборы",
    "Оптимизация доставки",
    "Партнерство с офисами",
    "Соцсети и контент",
    "Без проекта",
]


INCOME_CATEGORIES = [
    "Продажи в зале",
    "Онлайн-заказы десертов",
    "Корпоративные заказы",
    "Кофе навынос",
    "Подписка на десерты",
    "Доп. продажи (мерч)",
    "Проведение мастер-классов",
    "Прочие доходы",
]


EXPENSE_CATEGORIES = [
    "Закупка зерна",
    "Закупка молока и сливок",
    "Закупка ингредиентов для десертов",
    "Упаковка и расходники",
    "Зарплата персонала",
    "Аренда помещения",
    "Коммунальные услуги",
    "Маркетинг и реклама",
    "Доставка и логистика",
    "Обслуживание оборудования",
    "Налоги и эквайринг",
    "Прочие операционные расходы",
]


def upsert_user(username: str, password: str) -> User:
    user = User.query.filter_by(username=username).first()
    if user is None:
        user = User(username=username, password_hash=generate_password_hash(password))
        db.session.add(user)
        db.session.flush()
    else:
        user.password_hash = generate_password_hash(password)
    return user


def clear_user_data(user_id: int) -> None:
    income_ids = [row.id for row in Income.query.filter_by(user_id=user_id).all()]
    expense_ids = [row.id for row in Expense.query.filter_by(user_id=user_id).all()]

    if income_ids:
        TransactionMeta.query.filter(
            TransactionMeta.transaction_type == "income",
            TransactionMeta.transaction_id.in_(income_ids),
        ).delete(synchronize_session=False)
    if expense_ids:
        TransactionMeta.query.filter(
            TransactionMeta.transaction_type == "expense",
            TransactionMeta.transaction_id.in_(expense_ids),
        ).delete(synchronize_session=False)

    OperationDimension.query.filter_by(user_id=user_id).delete(synchronize_session=False)
    Income.query.filter_by(user_id=user_id).delete(synchronize_session=False)
    Expense.query.filter_by(user_id=user_id).delete(synchronize_session=False)
    CategoryLimit.query.filter_by(user_id=user_id).delete(synchronize_session=False)
    MonthlyBudget.query.filter_by(user_id=user_id).delete(synchronize_session=False)
    Notification.query.filter_by(user_id=user_id).delete(synchronize_session=False)
    SavingsGoal.query.filter_by(user_id=user_id).delete(synchronize_session=False)
    AuditLog.query.filter_by(user_id=user_id).delete(synchronize_session=False)

    category_ids = [row.id for row in Category.query.filter_by(user_id=user_id).all()]
    if category_ids:
        CategoryMeta.query.filter(CategoryMeta.category_id.in_(category_ids)).delete(synchronize_session=False)

    Category.query.filter_by(user_id=user_id).delete(synchronize_session=False)
    Department.query.filter_by(user_id=user_id).delete(synchronize_session=False)
    Project.query.filter_by(user_id=user_id).delete(synchronize_session=False)
    UserSettings.query.filter_by(user_id=user_id).delete(synchronize_session=False)


def create_lookup_rows(user_id: int):
    departments = {}
    projects = {}
    categories = {}

    for name in DEPARTMENTS:
        row = Department(user_id=user_id, name=name)
        db.session.add(row)
        db.session.flush()
        departments[name] = row.id

    for name in PROJECTS:
        row = Project(user_id=user_id, name=name)
        db.session.add(row)
        db.session.flush()
        projects[name] = row.id

    for name in INCOME_CATEGORIES:
        row = Category(user_id=user_id, name=name, type="income")
        db.session.add(row)
        db.session.flush()
        categories[("income", name)] = row.id

    for name in EXPENSE_CATEGORIES:
        row = Category(user_id=user_id, name=name, type="expense")
        db.session.add(row)
        db.session.flush()
        categories[("expense", name)] = row.id

    return departments, projects, categories


def add_income_op(
    user_id: int,
    dt: date,
    amount: float,
    category_id: int,
    department_id: int,
    project_id: int | None,
    note: str,
) -> None:
    row = Income(user_id=user_id, date=dt, amount=amount, category_id=category_id)
    db.session.add(row)
    db.session.flush()
    db.session.add(
        OperationDimension(
            user_id=user_id,
            transaction_type="income",
            transaction_id=row.id,
            department_id=department_id,
            project_id=project_id,
        )
    )
    db.session.add(
        TransactionMeta(
            transaction_type="income",
            transaction_id=row.id,
            currency="RUB",
            note=note,
        )
    )


def add_expense_op(
    user_id: int,
    dt: date,
    amount: float,
    category_id: int,
    department_id: int,
    project_id: int | None,
    note: str,
) -> None:
    row = Expense(user_id=user_id, date=dt, amount=amount, category_id=category_id)
    db.session.add(row)
    db.session.flush()
    db.session.add(
        OperationDimension(
            user_id=user_id,
            transaction_type="expense",
            transaction_id=row.id,
            department_id=department_id,
            project_id=project_id,
        )
    )
    db.session.add(
        TransactionMeta(
            transaction_type="expense",
            transaction_id=row.id,
            currency="RUB",
            note=note,
        )
    )


def seed_operations(user_id: int, departments: dict[str, int], projects: dict[str, int], categories: dict[tuple[str, str], int]) -> None:
    rnd = Random(2026)
    months = [(2026, 1), (2026, 2), (2026, 3), (2026, 4)]

    for year, month in months:
        add_expense_op(
            user_id,
            date(year, month, 1),
            185_000 + rnd.randint(-10_000, 10_000),
            categories[("expense", "Аренда помещения")],
            departments["Администрация"],
            None,
            "Аренда помещения",
        )
        add_expense_op(
            user_id,
            date(year, month, 5),
            52_000 + rnd.randint(-6_000, 6_000),
            categories[("expense", "Коммунальные услуги")],
            departments["Администрация"],
            None,
            "Коммунальные платежи",
        )
        add_expense_op(
            user_id,
            date(year, month, 25),
            490_000 + rnd.randint(-40_000, 40_000),
            categories[("expense", "Зарплата персонала")],
            departments["Администрация"],
            None,
            "Выплата зарплаты",
        )
        add_expense_op(
            user_id,
            date(year, month, 28),
            125_000 + rnd.randint(-15_000, 15_000),
            categories[("expense", "Налоги и эквайринг")],
            departments["Администрация"],
            None,
            "Налоги и комиссии",
        )

        for day in (2, 6, 10, 14, 18, 22, 26):
            add_income_op(
                user_id,
                date(year, month, day),
                95_000 + rnd.randint(-20_000, 25_000),
                categories[("income", "Продажи в зале")],
                departments["Зал продаж"],
                None,
                "Продажи в кофейне",
            )
            add_income_op(
                user_id,
                date(year, month, day),
                38_000 + rnd.randint(-10_000, 12_000),
                categories[("income", "Кофе навынос")],
                departments["Зал продаж"],
                None,
                "Продажи coffee-to-go",
            )
            add_income_op(
                user_id,
                date(year, month, day),
                57_000 + rnd.randint(-12_000, 18_000),
                categories[("income", "Онлайн-заказы десертов")],
                departments["Онлайн-продажи"],
                projects["Новый сайт"] if month >= 2 else None,
                "Онлайн-заказы на десерты",
            )

            add_expense_op(
                user_id,
                date(year, month, day),
                31_000 + rnd.randint(-6_000, 8_000),
                categories[("expense", "Закупка зерна")],
                departments["Закупки"],
                None,
                "Закупка кофейного зерна",
            )
            add_expense_op(
                user_id,
                date(year, month, day),
                24_000 + rnd.randint(-5_000, 7_000),
                categories[("expense", "Закупка молока и сливок")],
                departments["Закупки"],
                None,
                "Закупка молочной продукции",
            )
            add_expense_op(
                user_id,
                date(year, month, day),
                42_000 + rnd.randint(-8_000, 10_000),
                categories[("expense", "Закупка ингредиентов для десертов")],
                departments["Кухня"],
                None,
                "Ингредиенты для десертов",
            )
            add_expense_op(
                user_id,
                date(year, month, day),
                14_000 + rnd.randint(-3_000, 4_000),
                categories[("expense", "Упаковка и расходники")],
                departments["Склад"],
                None,
                "Упаковка и расходные материалы",
            )
            add_expense_op(
                user_id,
                date(year, month, day),
                18_000 + rnd.randint(-4_000, 5_000),
                categories[("expense", "Доставка и логистика")],
                departments["Доставка"],
                projects["Оптимизация доставки"] if month in (3, 4) else None,
                "Курьерские расходы",
            )

        add_income_op(
            user_id,
            date(year, month, 12),
            180_000 + rnd.randint(-40_000, 55_000),
            categories[("income", "Корпоративные заказы")],
            departments["Онлайн-продажи"],
            projects["Корпоративные заказы"],
            "Оптовый корпоративный заказ",
        )
        add_income_op(
            user_id,
            date(year, month, 20),
            27_000 + rnd.randint(-7_000, 9_000),
            categories[("income", "Доп. продажи (мерч)")],
            departments["Зал продаж"],
            projects["Программа лояльности"],
            "Продажа фирменного мерча",
        )
        add_income_op(
            user_id,
            date(year, month, 24),
            33_000 + rnd.randint(-8_000, 11_000),
            categories[("income", "Подписка на десерты")],
            departments["Онлайн-продажи"],
            projects["Программа лояльности"],
            "Оплата подписки",
        )

        if month in (2, 4):
            add_income_op(
                user_id,
                date(year, month, 16),
                48_000 + rnd.randint(-10_000, 12_000),
                categories[("income", "Проведение мастер-классов")],
                departments["Кухня"],
                projects["Весенняя акция"] if month == 2 else projects["Летнее меню"],
                "Мастер-класс по десертам",
            )

        add_expense_op(
            user_id,
            date(year, month, 8),
            76_000 + rnd.randint(-12_000, 15_000),
            categories[("expense", "Маркетинг и реклама")],
            departments["Маркетинг"],
            projects["Соцсети и контент"],
            "Реклама в соцсетях",
        )
        add_expense_op(
            user_id,
            date(year, month, 17),
            39_000 + rnd.randint(-8_000, 10_000),
            categories[("expense", "Обслуживание оборудования")],
            departments["Кухня"],
            None,
            "Сервис оборудования",
        )
        add_expense_op(
            user_id,
            date(year, month, 23),
            22_000 + rnd.randint(-6_000, 8_000),
            categories[("expense", "Прочие операционные расходы")],
            departments["Администрация"],
            projects["Без проекта"],
            "Прочие расходы месяца",
        )


def main() -> None:
    app = create_app()
    with app.app_context():
        user = upsert_user(USERNAME, PASSWORD)
        clear_user_data(user.id)
        departments, projects, categories = create_lookup_rows(user.id)
        seed_operations(user.id, departments, projects, categories)
        db.session.commit()

        income_count = Income.query.filter_by(user_id=user.id).count()
        expense_count = Expense.query.filter_by(user_id=user.id).count()
        category_count = Category.query.filter_by(user_id=user.id).count()
        department_count = Department.query.filter_by(user_id=user.id).count()
        project_count = Project.query.filter_by(user_id=user.id).count()

        print("Demo-аккаунт готов.")
        print(f"Логин: {USERNAME}")
        print(f"Пароль: {PASSWORD}")
        print(
            f"Создано: подразделений={department_count}, проектов={project_count}, "
            f"категорий P&L={category_count}, доходов={income_count}, расходов={expense_count}"
        )


if __name__ == "__main__":
    main()
