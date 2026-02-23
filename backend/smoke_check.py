import uuid
import io

from backend.app import create_app


def run() -> int:
    app = create_app()
    client = app.test_client()

    username = f"smoke_{uuid.uuid4().hex[:10]}"
    password = "smoke_pass_123"

    results = []

    def check(name: str, condition: bool, details: str = ""):
        status = "OK" if condition else "FAIL"
        suffix = f" | {details}" if details else ""
        print(f"[{status}] {name}{suffix}")
        results.append(condition)

    # Public health endpoints
    health = client.get("/api/health")
    check("GET /api/health", health.status_code == 200, f"status={health.status_code}")

    health_details = client.get("/api/health/details")
    check(
        "GET /api/health/details",
        health_details.status_code in (200, 503),
        f"status={health_details.status_code}",
    )

    # Register + login
    registered = client.post("/api/auth/register", json={"username": username, "password": password})
    check("POST /api/auth/register", registered.status_code in (201, 400), f"status={registered.status_code}")

    logged_in = client.post("/api/auth/login", json={"username": username, "password": password})
    check("POST /api/auth/login", logged_in.status_code == 200, f"status={logged_in.status_code}")

    # Core authenticated flow
    category = client.post("/api/categories", json={"name": "Salary", "type": "income"})
    check("POST /api/categories (income)", category.status_code in (200, 201), f"status={category.status_code}")
    category_income_id = (category.get_json() or {}).get("id")

    category2 = client.post("/api/categories", json={"name": "Food", "type": "expense"})
    check("POST /api/categories (expense)", category2.status_code in (200, 201), f"status={category2.status_code}")
    category_expense_id = (category2.get_json() or {}).get("id")
    department = client.post("/api/directories/departments", json={"name": "Main"})
    check("POST /api/directories/departments", department.status_code in (200, 201), f"status={department.status_code}")
    department_id = (department.get_json() or {}).get("id")

    income_id = None
    expense_id = None

    if category_income_id and department_id:
        income = client.post("/api/income", json={"amount": 1000, "category_id": category_income_id, "date": "2026-01-01", "department_id": department_id})
        check("POST /api/income", income.status_code in (200, 201), f"status={income.status_code}")
        income_id = (income.get_json() or {}).get("id")
    else:
        check("POST /api/income", False, "category or department id is missing")

    if category_expense_id and department_id:
        expense = client.post("/api/expense", json={"amount": 250, "category_id": category_expense_id, "date": "2026-01-01", "department_id": department_id})
        check("POST /api/expense", expense.status_code in (200, 201), f"status={expense.status_code}")
        expense_id = (expense.get_json() or {}).get("id")
        limit = client.post("/api/limits", json={"category_id": category_expense_id, "monthly_limit": 500})
        check("POST /api/limits", limit.status_code in (200, 201), f"status={limit.status_code}")
    else:
        check("POST /api/expense", False, "category or department id is missing")
        check("POST /api/limits", False, "category id is missing")

    if category_income_id:
        update_category = client.put(f"/api/categories/{category_income_id}", json={"name": "Salary Updated", "type": "income"})
        check("PUT /api/categories/:id", update_category.status_code == 200, f"status={update_category.status_code}")
    else:
        check("PUT /api/categories/:id", False, "category id is missing")

    if income_id:
        update_income = client.put(
            f"/api/income/{income_id}",
            json={"amount": 1200, "category_id": category_income_id, "date": "2026-01-02", "department_id": department_id},
        )
        check("PUT /api/income/:id", update_income.status_code == 200, f"status={update_income.status_code}")
    else:
        check("PUT /api/income/:id", False, "income id is missing")

    if expense_id:
        update_expense = client.put(
            f"/api/expense/{expense_id}",
            json={"amount": 260, "category_id": category_expense_id, "date": "2026-01-02", "department_id": department_id},
        )
        check("PUT /api/expense/:id", update_expense.status_code == 200, f"status={update_expense.status_code}")
    else:
        check("PUT /api/expense/:id", False, "expense id is missing")

    for endpoint in [
        "/api/categories",
        "/api/income",
        "/api/expense",
        "/api/limits",
        "/api/analytics/summary",
        "/api/analytics/monthly",
        "/api/analytics/categories/monthly",
        "/api/analytics/dashboard",
        "/api/analytics/forecast",
        "/api/recommendations",
    ]:
        response = client.get(endpoint)
        check(f"GET {endpoint}", response.status_code == 200, f"status={response.status_code}")

    exported_income = client.get("/api/export/income?format=csv")
    check("GET /api/export/income?format=csv", exported_income.status_code == 200, f"status={exported_income.status_code}")

    exported_expense = client.get("/api/export/expense?format=csv")
    check("GET /api/export/expense?format=csv", exported_expense.status_code == 200, f"status={exported_expense.status_code}")

    csv_bytes = io.BytesIO(b"amount,date,category_id\n777,2026-01-01,\n")
    imported_income = client.post(
        "/api/import/income",
        data={"file": (csv_bytes, "income.csv")},
        content_type="multipart/form-data",
    )
    check("POST /api/import/income (csv)", imported_income.status_code == 200, f"status={imported_income.status_code}")

    csv_bytes_2 = io.BytesIO(b"amount,date,category_id\n333,2026-01-01,\n")
    imported_expense = client.post(
        "/api/import/expense",
        data={"file": (csv_bytes_2, "expense.csv")},
        content_type="multipart/form-data",
    )
    check("POST /api/import/expense (csv)", imported_expense.status_code == 200, f"status={imported_expense.status_code}")

    if income_id:
        deleted_income = client.delete(f"/api/income/{income_id}")
        check("DELETE /api/income/:id", deleted_income.status_code == 200, f"status={deleted_income.status_code}")
    else:
        check("DELETE /api/income/:id", False, "income id is missing")

    if expense_id:
        deleted_expense = client.delete(f"/api/expense/{expense_id}")
        check("DELETE /api/expense/:id", deleted_expense.status_code == 200, f"status={deleted_expense.status_code}")
    else:
        check("DELETE /api/expense/:id", False, "expense id is missing")

    if category_expense_id:
        deleted_category = client.delete(f"/api/categories/{category_expense_id}")
        check("DELETE /api/categories/:id", deleted_category.status_code == 200, f"status={deleted_category.status_code}")
    else:
        check("DELETE /api/categories/:id", False, "category id is missing")

    passed = all(results)
    print("\nSmoke result:", "PASSED" if passed else "FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(run())
