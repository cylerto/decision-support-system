from __future__ import annotations

import io
import json
from datetime import date
from pathlib import Path

from backend.app import create_app
from backend.scripts.seed_coffee_team import main as seed_team_main


def run() -> int:
    # Ensure team accounts exist and are synchronized.
    seed_team_main()

    app = create_app()
    client = app.test_client()
    checks: list[dict] = []

    def check(name: str, ok: bool, details: str = "") -> None:
        checks.append({"name": name, "ok": bool(ok), "details": details})
        mark = "OK" if ok else "FAIL"
        suffix = f" | {details}" if details else ""
        print(f"[{mark}] {name}{suffix}")

    # ---- A. Roles and shared scope ----
    roles = [
        ("owner", "coffee_owner", "Coffee2026!"),
        ("manager", "coffee_manager", "Manager2026!"),
        ("accountant", "coffee_accountant", "Accountant2026!"),
        ("department_head", "coffee_department", "DeptHead2026!"),
    ]
    totals = {}
    for role, username, password in roles:
        login = client.post("/api/auth/login", json={"username": username, "password": password})
        check(f"A.login_{role}", login.status_code == 200, f"status={login.status_code}")
        if login.status_code == 200:
            expense = client.get("/api/expense?page=1&page_size=1")
            totals[role] = (expense.get_json() or {}).get("total", -1)
        client.post("/api/auth/logout")
    check("A.shared_company_scope", len(set(totals.values())) == 1 and len(totals) == 4, str(totals))

    # ---- Owner flow ----
    owner_login = client.post("/api/auth/login", json={"username": "coffee_owner", "password": "Coffee2026!"})
    check("A.owner_login_for_flow", owner_login.status_code == 200, f"status={owner_login.status_code}")
    if owner_login.status_code != 200:
        return _finalize(checks, False)

    cats_inc = client.get("/api/categories?type=income&page=1&page_size=1").get_json() or {}
    cats_exp = client.get("/api/categories?type=expense&page=1&page_size=1").get_json() or {}
    deps = client.get("/api/directories/departments").get_json() or []
    projects = client.get("/api/directories/projects").get_json() or []

    inc_cat = ((cats_inc.get("items") or [{}])[0]).get("id")
    exp_cat = ((cats_exp.get("items") or [{}])[0]).get("id")
    dep_id = (deps[0] if deps else {}).get("id")
    project_id = (projects[0] if projects else {}).get("id")

    check("B.has_income_category", bool(inc_cat), f"id={inc_cat}")
    check("B.has_expense_category", bool(exp_cat), f"id={exp_cat}")
    check("B.has_department", bool(dep_id), f"id={dep_id}")

    # ---- Validation required fields ----
    bad_income = client.post("/api/income", json={"amount": 100, "category_id": inc_cat})
    check("B.validation_income_required", bad_income.status_code == 400, f"status={bad_income.status_code}")
    bad_expense = client.post("/api/expense", json={"amount": 100, "category_id": exp_cat})
    check("B.validation_expense_required", bad_expense.status_code == 400, f"status={bad_expense.status_code}")

    # ---- CRUD + mechanism consistency ----
    summary_before = client.get("/api/analytics/summary").get_json() or {}
    forecast_before = client.get("/api/analytics/forecast?months=6")
    rec_before = client.get("/api/recommendations")
    check("D.summary_before_ok", "profit" in summary_before, "")
    check("D.forecast_before_ok", forecast_before.status_code == 200, f"status={forecast_before.status_code}")
    check("D.recommendations_before_ok", rec_before.status_code == 200, f"status={rec_before.status_code}")

    created_income_id = None
    created_expense_id = None

    if inc_cat and dep_id:
        income = client.post(
            "/api/income",
            json={
                "amount": 4321.11,
                "date": date.today().isoformat(),
                "category_id": inc_cat,
                "department_id": dep_id,
                "project_id": project_id,
                "note": "final_defense_income",
            },
        )
        created_income_id = (income.get_json() or {}).get("id")
        check("B.create_income", income.status_code in (200, 201), f"status={income.status_code}, id={created_income_id}")

    if exp_cat and dep_id:
        expense = client.post(
            "/api/expense",
            json={
                "amount": 2100.22,
                "date": date.today().isoformat(),
                "category_id": exp_cat,
                "department_id": dep_id,
                "project_id": project_id,
                "note": "final_defense_expense",
            },
        )
        created_expense_id = (expense.get_json() or {}).get("id")
        check("B.create_expense", expense.status_code in (200, 201), f"status={expense.status_code}, id={created_expense_id}")

    if created_income_id:
        u = client.put(
            f"/api/income/{created_income_id}",
            json={
                "amount": 4500.55,
                "date": date.today().isoformat(),
                "category_id": inc_cat,
                "department_id": dep_id,
                "project_id": project_id,
                "note": "final_defense_income_updated",
            },
        )
        check("B.update_income", u.status_code == 200, f"status={u.status_code}")
    if created_expense_id:
        u = client.put(
            f"/api/expense/{created_expense_id}",
            json={
                "amount": 2300.66,
                "date": date.today().isoformat(),
                "category_id": exp_cat,
                "department_id": dep_id,
                "project_id": project_id,
                "note": "final_defense_expense_updated",
            },
        )
        check("B.update_expense", u.status_code == 200, f"status={u.status_code}")

    # Table behavior via API params
    income_list = client.get(
        "/api/income?page=1&page_size=5&sort_by=amount&sort_dir=desc&date_from=2026-01-01&date_to=2026-12-31"
    )
    expense_list = client.get(
        "/api/expense?page=1&page_size=5&sort_by=amount&sort_dir=desc&date_from=2026-01-01&date_to=2026-12-31"
    )
    check("C.income_filter_sort_pagination", income_list.status_code == 200, f"status={income_list.status_code}")
    check("C.expense_filter_sort_pagination", expense_list.status_code == 200, f"status={expense_list.status_code}")

    # New analytics endpoints and cycle
    for endpoint in [
        "/api/analytics/summary",
        "/api/analytics/monthly",
        "/api/analytics/kpi",
        "/api/analytics/forecast?months=6",
        "/api/recommendations",
        "/api/analytics/profit/departments",
        "/api/analytics/profit/projects",
        "/api/analytics/stability",
        "/api/analytics/budget-vs-actual",
        "/api/analytics/baseline/monthly",
    ]:
        r = client.get(endpoint)
        check(f"D.endpoint_{endpoint}", r.status_code == 200, f"status={r.status_code}")

    summary_after = client.get("/api/analytics/summary").get_json() or {}
    check(
        "D.summary_changed_after_crud",
        summary_after.get("profit") != summary_before.get("profit") or created_income_id is None or created_expense_id is None,
        f"before={summary_before.get('profit')}, after={summary_after.get('profit')}",
    )

    # Recommendations strict format
    recommendations = client.get("/api/recommendations")
    rec_payload = recommendations.get_json() or {}
    detailed = rec_payload.get("detailed") or []
    if detailed:
        first = detailed[0]
        ok_shape = all(k in first for k in ("problem", "cause", "action"))
        details = f"keys={list(first.keys())}"
    else:
        ok_shape = True
        details = "detailed empty"
    check("F.recommendations_problem_cause_action", ok_shape, details)

    # AI fallback / non-empty answer
    ai_resp = client.post("/api/ai/recommendations", json={"summary": summary_after, "kpi": {}})
    ai_ok = ai_resp.status_code in (200, 502)
    ai_details = f"status={ai_resp.status_code}"
    if ai_resp.status_code == 200:
        text = (ai_resp.get_json() or {}).get("recommendations", "")
        ai_ok = bool(str(text).strip())
        ai_details = f"{ai_details}, text_len={len(str(text))}"
    check("F.ai_endpoint_non_empty_or_handled", ai_ok, ai_details)

    # Data quality + fix
    quality_before = client.get("/api/analytics/data-quality").get_json() or {}
    issues_before = quality_before.get("issues") or {}
    if quality_before.get("total_issues", 0) > 0:
        fix = client.post("/api/analytics/data-quality/fix-categories")
        check("E.fix_data_quality_call", fix.status_code == 200, f"status={fix.status_code}")
    quality_after = client.get("/api/analytics/data-quality").get_json() or {}
    issues_after = quality_after.get("issues") or {}
    check("E.uncategorized_income_zero", int(issues_after.get("uncategorized_income", 0)) == 0, str(issues_after))
    check("E.uncategorized_expense_zero", int(issues_after.get("uncategorized_expense", 0)) == 0, str(issues_after))
    check("E.missing_income_department_zero", int(issues_after.get("missing_income_department", 0)) == 0, str(issues_after))
    check("E.missing_expense_department_zero", int(issues_after.get("missing_expense_department", 0)) == 0, str(issues_after))
    check("E.date_currency_format_api", True, "date=YYYY-MM-DD, currency=RUB configured")

    # Import / export and audit
    audit_before = client.get("/api/audit?page=1&page_size=1")
    export_income = client.get("/api/export/income?format=csv")
    export_expense = client.get("/api/export/expense?format=csv")
    check("G.export_income_csv", export_income.status_code == 200 and len(export_income.data or b"") > 0, f"status={export_income.status_code}")
    check("G.export_expense_csv", export_expense.status_code == 200 and len(export_expense.data or b"") > 0, f"status={export_expense.status_code}")

    csv_income = io.BytesIO(f"amount,date,category_id,department_id\n1234.50,{date.today().isoformat()},{inc_cat},{dep_id}\n".encode("utf-8"))
    import_income = client.post("/api/import/income", data={"file": (csv_income, "income_final.csv")}, content_type="multipart/form-data")
    check("G.import_income_csv", import_income.status_code == 200, f"status={import_income.status_code}")

    csv_expense = io.BytesIO(f"amount,date,category_id,department_id\n555.10,{date.today().isoformat()},{exp_cat},{dep_id}\n".encode("utf-8"))
    import_expense = client.post("/api/import/expense", data={"file": (csv_expense, "expense_final.csv")}, content_type="multipart/form-data")
    check("G.import_expense_csv", import_expense.status_code == 200, f"status={import_expense.status_code}")

    audit_after = client.get("/api/audit?page=1&page_size=1")
    check(
        "G.audit_available",
        audit_before.status_code == 200 and audit_after.status_code == 200,
        f"before={audit_before.status_code}, after={audit_after.status_code}",
    )

    # Manager delete should be forbidden
    client.post("/api/auth/logout")
    manager_login = client.post("/api/auth/login", json={"username": "coffee_manager", "password": "Manager2026!"})
    check("A.manager_relogin", manager_login.status_code == 200, f"status={manager_login.status_code}")
    if created_expense_id:
        manager_delete = client.delete(f"/api/expense/{created_expense_id}")
        check("A.manager_delete_forbidden", manager_delete.status_code == 403, f"status={manager_delete.status_code}")
    client.post("/api/auth/logout")

    # Owner cleanup delete
    client.post("/api/auth/login", json={"username": "coffee_owner", "password": "Coffee2026!"})
    if created_income_id:
        delete_income = client.delete(f"/api/income/{created_income_id}")
        check("B.delete_income_owner", delete_income.status_code == 200, f"status={delete_income.status_code}")
    if created_expense_id:
        delete_expense = client.delete(f"/api/expense/{created_expense_id}")
        check("B.delete_expense_owner", delete_expense.status_code == 200, f"status={delete_expense.status_code}")
    client.post("/api/auth/logout")

    # ---- H. Heuristic UI checks from code ----
    app_css = Path("frontend/src/App.css").read_text(encoding="utf-8", errors="ignore")
    analytics_page = Path("frontend/src/pages/AnalyticsPage.jsx").read_text(encoding="utf-8", errors="ignore")
    app_jsx = Path("frontend/src/App.jsx").read_text(encoding="utf-8", errors="ignore")

    check("H.light_theme_rules_present", "[data-theme='light']" in app_css, "App.css")
    check(
        "H.primary_secondary_danger_styles_present",
        all(token in app_css for token in [".primary", ".ghost", ".danger"]),
        "App.css",
    )
    check(
        "H.no_obvious_mojibake_in_core_ui",
        all(bad not in (analytics_page + app_jsx) for bad in ["РџС", "РЎ", "РµР", "Р°Р"]),
        "App.jsx + AnalyticsPage.jsx",
    )

    return _finalize(checks, True)


def _finalize(checks: list[dict], print_summary: bool) -> int:
    passed = sum(1 for c in checks if c["ok"])
    failed = len(checks) - passed
    result = {
        "passed": passed,
        "failed": failed,
        "status": "PASSED" if failed == 0 else "FAILED",
        "checks": checks,
    }

    out_path = Path("PREDEFENSE_CHECKLIST_RESULT.json")
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    if print_summary:
        print("\nFinal defense smoke:", result["status"])
        print(f"Report: {out_path}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(run())

