from __future__ import annotations

from datetime import date

from backend.app import create_app


def run() -> int:
    app = create_app()
    client = app.test_client()
    checks: list[bool] = []

    def check(name: str, ok: bool, details: str = "") -> None:
        checks.append(ok)
        mark = "OK" if ok else "FAIL"
        suffix = f" | {details}" if details else ""
        print(f"[{mark}] {name}{suffix}")

    owner_login = client.post("/api/auth/login", json={"username": "coffee_owner", "password": "Coffee2026!"})
    check("owner login", owner_login.status_code == 200, f"status={owner_login.status_code}")

    owner_expense_before = client.get("/api/expense?page=1&page_size=1")
    owner_total_before = (owner_expense_before.get_json() or {}).get("total", 0)
    check("owner expense list not empty", owner_total_before > 0, f"total={owner_total_before}")

    categories = client.get("/api/categories?type=expense&page=1&page_size=1").get_json() or {}
    category_id = ((categories.get("items") or [{}])[0]).get("id")
    departments = client.get("/api/directories/departments").get_json() or []
    department_id = (departments[0] if departments else {}).get("id")
    check("have expense category", bool(category_id))
    check("have department", bool(department_id))

    created_id = None
    if category_id and department_id:
        created = client.post(
            "/api/expense",
            json={
                "amount": 1234.56,
                "date": date.today().isoformat(),
                "category_id": category_id,
                "department_id": department_id,
                "note": "predefense smoke expense",
            },
        )
        payload = created.get_json() or {}
        created_id = payload.get("id")
        check("create expense", created.status_code in (200, 201), f"status={created.status_code}")
    else:
        check("create expense", False, "missing category/department")

    owner_expense_after = client.get("/api/expense?page=1&page_size=1")
    owner_total_after = (owner_expense_after.get_json() or {}).get("total", 0)
    check("owner expense total incremented", owner_total_after >= owner_total_before + 1, f"before={owner_total_before}, after={owner_total_after}")
    client.post("/api/auth/logout")

    manager_login = client.post("/api/auth/login", json={"username": "coffee_manager", "password": "Manager2026!"})
    check("manager login", manager_login.status_code == 200, f"status={manager_login.status_code}")
    manager_expense = client.get("/api/expense?page=1&page_size=1")
    manager_total = (manager_expense.get_json() or {}).get("total", 0)
    check("manager sees same expenses", manager_total == owner_total_after, f"owner={owner_total_after}, manager={manager_total}")
    manager_delete = client.delete(f"/api/expense/{created_id or 1}")
    check("manager cannot delete", manager_delete.status_code == 403, f"status={manager_delete.status_code}")
    client.post("/api/auth/logout")

    owner_login_2 = client.post("/api/auth/login", json={"username": "coffee_owner", "password": "Coffee2026!"})
    check("owner relogin", owner_login_2.status_code == 200, f"status={owner_login_2.status_code}")
    if created_id:
        deleted = client.delete(f"/api/expense/{created_id}")
        check("owner delete smoke expense", deleted.status_code == 200, f"status={deleted.status_code}")

    summary = client.get("/api/analytics/summary")
    check("analytics summary", summary.status_code == 200, f"status={summary.status_code}")
    recommendations = client.get("/api/recommendations")
    check("recommendations", recommendations.status_code == 200, f"status={recommendations.status_code}")

    passed = all(checks)
    print("\nPredefense smoke:", "PASSED" if passed else "FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(run())
