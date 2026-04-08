from __future__ import annotations

from werkzeug.security import generate_password_hash

from backend.app import create_app
from backend.authz import (
    ROLE_ACCOUNTANT,
    ROLE_DEPARTMENT_HEAD,
    ROLE_MANAGER,
    ROLE_OWNER,
    set_user_role,
)
from backend.extensions import db
from backend.models import User
from backend.scope import set_company_owner


TEAM = [
    ("coffee_owner", "Coffee2026!", ROLE_OWNER),
    ("coffee_manager", "Manager2026!", ROLE_MANAGER),
    ("coffee_accountant", "Accountant2026!", ROLE_ACCOUNTANT),
    ("coffee_department", "DeptHead2026!", ROLE_DEPARTMENT_HEAD),
]


def upsert_user(username: str, password: str) -> User:
    row = User.query.filter_by(username=username).first()
    if row is None:
        row = User(username=username, password_hash=generate_password_hash(password))
        db.session.add(row)
        db.session.flush()
    else:
        row.password_hash = generate_password_hash(password)
    return row


def main() -> None:
    app = create_app()
    with app.app_context():
        users = {}
        for username, password, role in TEAM:
            user = upsert_user(username, password)
            set_user_role(user.id, role)
            users[username] = user

        owner = users["coffee_owner"]
        for username, _password, _role in TEAM:
            set_company_owner(users[username].id, owner.id)

        db.session.commit()

        print("Команда кофейни настроена:")
        for username, password, role in TEAM:
            print(f"- {username} / {password} ({role})")
        print(f"Все аккаунты привязаны к owner_id={owner.id} и видят одни и те же данные.")


if __name__ == "__main__":
    main()
