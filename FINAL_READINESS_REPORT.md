# FINAL_READINESS_REPORT

??????: **PASSED**
????????: 50
???????: 50
??????: 0

## ???????????
- [PASS] A.login_owner | status=200
- [PASS] A.login_manager | status=200
- [PASS] A.login_accountant | status=200
- [PASS] A.login_department_head | status=200
- [PASS] A.shared_company_scope | {'owner': 169, 'manager': 169, 'accountant': 169, 'department_head': 169}
- [PASS] A.owner_login_for_flow | status=200
- [PASS] B.has_income_category | id=107
- [PASS] B.has_expense_category | id=115
- [PASS] B.has_department | id=37
- [PASS] B.validation_income_required | status=400
- [PASS] B.validation_expense_required | status=400
- [PASS] D.summary_before_ok
- [PASS] D.forecast_before_ok | status=200
- [PASS] D.recommendations_before_ok | status=200
- [PASS] B.create_income | status=201, id=422
- [PASS] B.create_expense | status=201, id=645
- [PASS] B.update_income | status=200
- [PASS] B.update_expense | status=200
- [PASS] C.income_filter_sort_pagination | status=200
- [PASS] C.expense_filter_sort_pagination | status=200
- [PASS] D.endpoint_/api/analytics/summary | status=200
- [PASS] D.endpoint_/api/analytics/monthly | status=200
- [PASS] D.endpoint_/api/analytics/kpi | status=200
- [PASS] D.endpoint_/api/analytics/forecast?months=6 | status=200
- [PASS] D.endpoint_/api/recommendations | status=200
- [PASS] D.endpoint_/api/analytics/profit/departments | status=200
- [PASS] D.endpoint_/api/analytics/profit/projects | status=200
- [PASS] D.endpoint_/api/analytics/stability | status=200
- [PASS] D.endpoint_/api/analytics/budget-vs-actual | status=200
- [PASS] D.endpoint_/api/analytics/baseline/monthly | status=200
- [PASS] D.summary_changed_after_crud | before=-1089738.0, after=-1087538.1100000003
- [PASS] F.recommendations_problem_cause_action | keys=['action', 'cause', 'message', 'priority', 'problem', 'reason', 'type']
- [PASS] F.ai_endpoint_non_empty_or_handled | status=200, text_len=477
- [PASS] E.uncategorized_income_zero | {'empty_name_categories': 0, 'missing_expense_department': 0, 'missing_income_department': 0, 'uncategorized_expense': 0, 'uncategorized_income': 0}
- [PASS] E.uncategorized_expense_zero | {'empty_name_categories': 0, 'missing_expense_department': 0, 'missing_income_department': 0, 'uncategorized_expense': 0, 'uncategorized_income': 0}
- [PASS] E.missing_income_department_zero | {'empty_name_categories': 0, 'missing_expense_department': 0, 'missing_income_department': 0, 'uncategorized_expense': 0, 'uncategorized_income': 0}
- [PASS] E.missing_expense_department_zero | {'empty_name_categories': 0, 'missing_expense_department': 0, 'missing_income_department': 0, 'uncategorized_expense': 0, 'uncategorized_income': 0}
- [PASS] E.date_currency_format_api | date=YYYY-MM-DD, currency=RUB configured
- [PASS] G.export_income_csv | status=200
- [PASS] G.export_expense_csv | status=200
- [PASS] G.import_income_csv | status=200
- [PASS] G.import_expense_csv | status=200
- [PASS] G.audit_available | before=200, after=200
- [PASS] A.manager_relogin | status=200
- [PASS] A.manager_delete_forbidden | status=403
- [PASS] B.delete_income_owner | status=200
- [PASS] B.delete_expense_owner | status=200
- [PASS] H.light_theme_rules_present | App.css
- [PASS] H.primary_secondary_danger_styles_present | App.css
- [PASS] H.no_obvious_mojibake_in_core_ui | App.jsx + AnalyticsPage.jsx

## ?????
- ?????????? ?????? ? ???????????? ? ?????? ?? ???????? ????????.
- ???????? ???????? ???????????: ???????? -> ????????? -> KPI -> ??????? -> ????????????.