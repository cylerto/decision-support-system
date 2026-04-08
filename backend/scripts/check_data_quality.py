from __future__ import annotations

import argparse

from backend.app import create_app
from backend.finance_engine import data_quality
from backend.models import User
from backend.scope import get_scope_user_id


def main() -> int:
    parser = argparse.ArgumentParser(description='Check data quality issues by user scope.')
    parser.add_argument('--username', default='coffee_owner', help='Username to check (default: coffee_owner)')
    parser.add_argument('--all', action='store_true', help='Check all users')
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        if args.all:
            users = User.query.order_by(User.id.asc()).all()
        else:
            user = User.query.filter_by(username=args.username).first()
            users = [user] if user else []

        if not users:
            print(f'Пользователь не найден: {args.username}')
            return 1

        has_issues = False
        for user in users:
            scope_id = get_scope_user_id(user.id)
            report = data_quality(scope_id)
            total = int(report.get('total_issues') or 0)
            issues = report.get('issues') or {}
            print(f"{user.username} (scope={scope_id}): total_issues={total}, details={issues}")
            if total > 0:
                has_issues = True

        if has_issues:
            print('Обнаружены проблемы качества данных.')
            return 1

        print('Проверка качества данных: PASSED')
        return 0


if __name__ == '__main__':
    raise SystemExit(main())
