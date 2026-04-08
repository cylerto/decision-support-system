## 1. Общее описание проекта
Название, обнаруженное в коде:
- `DSS / Decision Support System` (компонент `frontend/src/shared/brand/Logo.jsx`)
- `decision-support-system` (корневой `package.json`)

Назначение приложения:
- Веб-система управленческого финансового учета и аналитики малого предприятия.
- Поддерживает учет доходов/расходов, аналитику, прогноз, рекомендации, импорт/экспорт и аудит.

Основной функционал:
- Аутентификация и роли пользователей.
- CRUD операций доходов и расходов.
- CRUD справочников (статьи P&L, подразделения, проекты).
- Фильтрация/сортировка/пагинация операций.
- Аналитика: summary, monthly, categories monthly, KPI, baseline, сценарный расчет.
- Прогноз (`/api/analytics/forecast`).
- Рекомендации rule-based и AI-рекомендации.
- Импорт/экспорт CSV/XLSX.
- Журнал действий (audit).

## 2. Архитектура
Тип:
- Клиент-серверное приложение.
- Frontend: SPA на React.
- Backend: монолитный Flask API.

Взаимодействие частей:
- Frontend (`frontend/src`) обращается к REST API через `frontend/src/api.js`.
- Backend (`backend/app.py`) регистрирует blueprints и выполняет RBAC через `@app.before_request`.
- Бизнес-логика и расчеты централизованы в `backend/finance_engine.py`.
- AI-анализ:
  - `backend/recommendation_engine.py` (rule-based + внешний AI в JSON-формате)
  - `backend/ai_engine.py` (`/api/ai/recommendations`)
- Данные хранятся в PostgreSQL (по умолчанию `DATABASE_URL` в `backend/app.py`).

## 3. Фронтенд (по коду)
Технологии:
- React 19, React Router, Chart.js + react-chartjs-2, Vite.
- Файлы: `frontend/package.json`, `frontend/src/main.jsx`, `frontend/src/App.jsx`.

Страницы/компоненты, используемые в `App.jsx`:
- `AuthPage`
- `DashboardPage`
- `OperationsPage` (внутри `IncomePage`/`ExpensePage`)
- `CategoriesPage`
- `DirectoriesPage`
- `AnalyticsPage`
- `SystemHubPage`
- Layout/UI: `Sidebar`, `Topbar`, `Modal`, `SectionHeader`, `EmptyState`, `SkeletonBlock`, `AlertsStack`.

Обнаружены, но не подключены в `App.jsx`:
- `frontend/src/pages/DataPage.jsx`
- `frontend/src/pages/HistoryPage.jsx`
- `frontend/src/pages/SettingsPage.jsx`

Логика интерфейса:
- Проверка сессии через `api.health()` и `api.me()`.
- Роли и права в `ROLE_PERMISSIONS` внутри `App.jsx`.
- Навигация задается `frontend/src/config/navigation.js`.
- Включен режим `DEFENSE_MODE = true` (оставляет ограниченный набор вкладок).
- Фильтры операций санитизируются (`sanitizeOperationFilter`), есть fallback-сброс фильтров.
- AI-текст очищается от markdown (`cleanAiText`/`cleanMarkdown`), затем отображается в аналитике.

## 4. Бэкенд
Язык и фреймворк:
- Python + Flask.
- Flask-SQLAlchemy, Flask-Login, Flask-CORS.

Контроллеры (blueprints):
- `auth_bp` (`/api/auth`)
- `category_bp` (`/api/categories`)
- `income_bp` (`/api/income`)
- `expense_bp` (`/api/expense`)
- `analytics_bp` (`/api/analytics`)
- `forecast_bp` (`/api/analytics/forecast`)
- `limits_bp` (`/api/limits`)
- `budgets_bp` (`/api/budgets`)
- `settings_bp` (`/api/settings`)
- `audit_bp` (`/api/audit`)
- `import_export_bp` (`/api`)
- `directories_bp` (`/api/directories`)

Legacy-роуты в `backend/app.py`:
- `/api/health`
- `/api/health/details`
- `/api/category-limits`
- `/api/analytics/dashboard`
- `/api/recommendations`
- `/api/ai/recommendations`

Бизнес-логика:
- Центр расчетов: `backend/finance_engine.py`.
- Валидация операций: `backend/operation_rules.py`.
- Роли/доступ: `backend/authz.py`.
- Общий контур компании (scope): `backend/scope.py`.
- Рекомендации: `backend/recommendation_engine.py`.
- AI-рекомендации и прогнозный текст: `backend/ai_engine.py`.

## 5. База данных
СУБД:
- PostgreSQL (по умолчанию в `backend/app.py`).
- В проекте также обнаружен файл `backend/instance/dev.db` (SQLite), но основная конфигурация backend указывает PostgreSQL.

Таблицы из моделей (`backend/models.py`):
- `users`: `id`, `username`, `password_hash`
- `categories`: `id`, `name`, `type`, `user_id`
- `income`: `id`, `date`, `amount`, `user_id`, `category_id`
- `expense`: `id`, `date`, `amount`, `user_id`, `category_id`
- `category_limits`: `id`, `user_id`, `category_id`, `monthly_limit`
- `user_settings`: `id`, `user_id`, `base_currency`, `widgets`, `notify_channels`, `updated_at`
- `category_meta`: `id`, `category_id`, `color`, `icon`
- `transaction_meta`: `id`, `transaction_type`, `transaction_id`, `currency`, `fx_rate`, `note`, `original_amount`
- `savings_goals`: `id`, `user_id`, `name`, `target_amount`, `current_amount`, `due_date`, `created_at`
- `monthly_budgets`: `id`, `user_id`, `year`, `month`, `planned_income`, `planned_expense`
- `notifications`: `id`, `user_id`, `channel`, `message`, `status`, `created_at`
- `audit_logs`: `id`, `user_id`, `action`, `entity`, `entity_id`, `data`, `created_at`
- `departments`: `id`, `user_id`, `name`
- `projects`: `id`, `user_id`, `name`
- `operation_dimensions`: `id`, `user_id`, `transaction_type`, `transaction_id`, `department_id`, `project_id`

Связи:
- Внешние ключи `user_id` -> `users.id` во всех пользовательских сущностях.
- `income.category_id`, `expense.category_id` -> `categories.id`.
- `operation_dimensions.department_id` -> `departments.id`.
- `operation_dimensions.project_id` -> `projects.id` (nullable).
- Уникальные ограничения:
  - `category_limits(user_id, category_id)`
  - `transaction_meta(transaction_type, transaction_id)`
  - `monthly_budgets(user_id, year, month)`
  - `departments(user_id, name)`
  - `projects(user_id, name)`
  - `operation_dimensions(transaction_type, transaction_id)`

Миграции:
- не обнаружено в проекте.

## 6. Основные функции (по исходникам проекта)
Ниже перечислены функции, обнаруженные в `backend/*.py`, `backend/routes/*.py`, `backend/scripts/*.py`, `frontend/src/**/*.jsx`.

- `backend/app.py`: `create_app`, `register_legacy_routes`
- `backend/ai_engine.py`: `_prepare_monthly_data`, `_forecast_series`, `_confidence_level`, `forecast`, `_dict_to_readable_text`, `generate_recommendations`
- `backend/authz.py`: `normalize_role`, `has_any_role`, `get_user_role`, `set_user_role`, `has_access`
- `backend/finance_engine.py`: `_month_key`, `_sum_amount`, `_monthly_totals`, `get_summary`, `get_monthly`, `get_categories_monthly`, `get_balance_monthly`, `get_kpi`, `get_segments`, `get_budget_vs_actual`, `get_baseline_monthly`, `run_scenario`, `get_recommendations`, `get_dashboard`, `get_user_format_settings`, `data_quality`, `fix_uncategorized_operations`, `_simple_linear_predict`, `ai_forecast`
- `backend/models.py`: `load_user`
- `backend/operation_rules.py`: `parse_date`, `parse_amount`, `require_category`, `require_department`, `optional_project`, `validate_sorting`, `validate_pagination`
- `backend/recommendation_engine.py`: `_safe_json_loads`, `_build_prompt_payload`, `_call_openai`, `build_recommendations`
- `backend/scope.py`: `get_scope_user_id`, `set_company_owner`
- `backend/smoke_check.py`: `run`
- `backend/smoke_predefense.py`: `run`
- `backend/utils.py`: `log_action`, `ensure_user_settings`, `create_notification`, `table_exists`
- `backend/routes/auth.py`: `register`, `login`, `logout`, `me`, `list_users`, `create_user`
- `backend/routes/income.py`: `add_income`, `get_incomes`, `update_income`, `delete_income`
- `backend/routes/expense.py`: `add_expense`, `get_expenses`, `update_expense`, `delete_expense`
- `backend/routes/category.py`: `add_category`, `get_categories`, `update_category`, `delete_category`
- `backend/routes/categories.py`: `get_categories`, `add_category`
- `backend/routes/directories.py`: `list_directory`, `create_directory`, `update_directory`, `delete_directory`
- `backend/routes/analytics.py`: `summary`, `monthly`, `categories_monthly`, `balance_monthly`, `kpi`, `segments`, `budget_vs_actual`, `baseline_monthly`, `scenario`, `quality`, `quality_fix_categories`, `format_settings`
- `backend/routes/forecast.py`: `get_forecast`
- `backend/routes/budgets.py`: `get_budgets`, `upsert_budget`, `delete_budget`
- `backend/routes/limits.py`: `set_limit`, `get_limits`
- `backend/routes/settings.py`: `get_settings`, `update_settings`
- `backend/routes/audit.py`: `get_audit`
- `backend/routes/import_export.py`: `_ensure_default_category`, `_ensure_default_department`, `_serialize_rows`, `_serialize_xlsx`, `export_data`, `_parse_csv`, `_parse_xlsx`, `_resolve_department`, `_resolve_project`, `import_data`
- `backend/scripts/seed_demo_coffee.py`: `upsert_user`, `clear_user_data`, `create_lookup_rows`, `add_income_op`, `add_expense_op`, `seed_operations`, `main`
- `backend/scripts/seed_coffee_team.py`: `upsert_user`, `main`
- `backend/scripts/check_data_quality.py`: `main`
- `frontend/src/App.jsx`: `readStoredJson`, `cleanAiText`, `parseAiRecommendations`, `detectTone`, `sanitizeOperationFilter`, `hasActiveOperationFilters`, `App`
- `frontend/src/pages/AnalyticsPage.jsx`: `cleanMarkdown`, `parseRecommendationText`, `classifyRecommendation`, `AnalyticsPage`
- `frontend/src/pages/DashboardPage.jsx`: `confidenceLabel`, `toneByText`, `percentLabel`, `categoryIcon`, `withAlpha`, `DashboardPage`
- `frontend/src/pages/OperationsPage.jsx`: `OperationsPage`
- `frontend/src/pages/IncomePage.jsx`: `IncomePage`
- `frontend/src/pages/ExpensePage.jsx`: `ExpensePage`
- `frontend/src/pages/CategoriesPage.jsx`: `CategoriesPage`
- `frontend/src/pages/DirectoriesPage.jsx`: `DirectoryBlock`, `DirectoriesPage`
- `frontend/src/pages/AuthPage.jsx`: `AuthPage`
- `frontend/src/pages/SystemHubPage.jsx`: `formatEntity`, `formatAction`, `compactDetails`, `SystemHubPage`
- `frontend/src/pages/DataPage.jsx`: `DataPage`
- `frontend/src/pages/HistoryPage.jsx`: `HistoryPage`
- `frontend/src/pages/SettingsPage.jsx`: `SettingsPage`
- `frontend/src/features/alerts/AlertsStack.jsx`: `AlertsStack`
- `frontend/src/shared/layout/Sidebar.jsx`: `Sidebar`
- `frontend/src/shared/layout/Topbar.jsx`: `Topbar`
- `frontend/src/shared/brand/Logo.jsx`: `Logo`
- `frontend/src/shared/ui/Modal.jsx`: `Modal`
- `frontend/src/shared/ui/SectionHeader.jsx`: `SectionHeader`
- `frontend/src/shared/ui/EmptyState.jsx`: `EmptyState`
- `frontend/src/shared/ui/SkeletonBlock.jsx`: `SkeletonBlock`

## 7. API
Активные эндпоинты (зарегистрированные в `backend/app.py`):

- `POST /api/auth/register` — вход: `username,password`; выход: сообщение/201.
- `POST /api/auth/login` — вход: `username,password`; выход: сообщение, `role`, `username`.
- `POST /api/auth/logout` — выход: сообщение.
- `GET /api/auth/me` — выход: `id, username, role, company_owner_id`.
- `GET /api/auth/users` — список пользователей (owner only).
- `POST /api/auth/users` — создание пользователя с ролью (owner only).

- `GET /api/categories` — список статей (фильтры: `type,search,page,page_size`).
- `POST /api/categories` — создание статьи.
- `PUT /api/categories/{id}` — обновление статьи.
- `DELETE /api/categories/{id}` — удаление статьи.

- `GET /api/directories/{kind}` (`departments|projects`) — список.
- `POST /api/directories/{kind}` — создание.
- `PUT /api/directories/{kind}/{id}` — обновление.
- `DELETE /api/directories/{kind}/{id}` — удаление с проверкой использования.

- `GET /api/income` — список доходов (фильтры/сортировка/пагинация).
- `POST /api/income` — создание дохода.
- `PUT /api/income/{id}` — обновление.
- `DELETE /api/income/{id}` — удаление.

- `GET /api/expense` — список затрат (фильтры/сортировка/пагинация).
- `POST /api/expense` — создание затраты.
- `PUT /api/expense/{id}` — обновление.
- `DELETE /api/expense/{id}` — удаление.

- `GET /api/analytics/summary`
- `GET /api/analytics/monthly`
- `GET /api/analytics/categories/monthly`
- `GET /api/analytics/balance/monthly`
- `GET /api/analytics/kpi`
- `GET /api/analytics/segments`
- `GET /api/analytics/budget-vs-actual`
- `GET /api/analytics/baseline/monthly`
- `POST /api/analytics/scenario` (вход: `income_change_pct, expense_change_pct`)
- `GET /api/analytics/data-quality`
- `POST /api/analytics/data-quality/fix-categories`
- `GET /api/analytics/format`
- `GET /api/analytics/forecast?months=N`

- `GET /api/budgets`
- `POST /api/budgets`
- `DELETE /api/budgets/{id}`

- `GET /api/limits`
- `POST /api/limits`

- `GET /api/settings`
- `PUT /api/settings`

- `GET /api/audit`

- `GET /api/export/{kind}?format=csv|xlsx`
- `POST /api/import/{kind}` (multipart, файл)

Legacy-эндпоинты:
- `GET /api/health`
- `GET /api/health/details`
- `GET|POST /api/category-limits`
- `GET /api/analytics/dashboard`
- `GET /api/recommendations`
- `POST /api/ai/recommendations` (вход: financial_data JSON; выход: `{recommendations: "..."}`)

Неактивные по регистрации:
- Модуль `backend/routes/categories.py` (blueprint `categories_bp`) в `app.py` не зарегистрирован.
- `backend/routes/category_limit.py` содержит модель, эндпоинтов нет.

## 8. Сценарии работы
1. Пользователь открывает SPA, выполняется `GET /api/health`.
2. Логин через `POST /api/auth/login`.
3. После авторизации фронтенд загружает данные:
   - категории, справочники, доходы, затраты, аналитику, аудит.
4. Пользователь создает/редактирует/удаляет операцию (`/api/income` или `/api/expense`).
5. Backend валидирует поля, сохраняет запись, пишет аудит.
6. Frontend обновляет аналитику (`/api/analytics/*`), прогноз (`/api/analytics/forecast`) и рекомендации (`/api/recommendations`, `/api/ai/recommendations`).
7. При необходимости выполняется импорт/экспорт и просмотр истории действий.

## 9. Обработка ошибок
Проверки и обработка в коде:
- Валидация входных данных:
  - дата (`YYYY-MM-DD`), сумма (`>0`), обязательные поля категории и подразделения.
- Проверка существования сущностей:
  - категория/подразделение/проект/операция/бюджет.
- Проверка бизнес-условий:
  - запрет удаления категории, если используется;
  - запрет удаления справочника, если используется в операциях.
- RBAC:
  - глобальная проверка в `before_request`, возврат `403` при недостатке прав.
- Ошибки API:
  - `400` (валидация/неверные параметры),
  - `401` (неавторизован),
  - `403` (нет прав),
  - `404` (не найдено),
  - `500/502` (внешние/внутренние ошибки, например AI).
- Импорт:
  - некорректные строки пропускаются (`continue`), общий импорт не падает.
- AI:
  - при сбоях внешнего провайдера возвращается fallback (rule-based или текст о недоступности).

## 10. Заключение
В проекте реализована клиент-серверная система принятия решений для малого предприятия с:
- авторизацией и ролевой моделью;
- учетом доходов и затрат с обязательными аналитическими измерениями;
- централизованным расчетным модулем (`finance_engine`);
- аналитикой, прогнозом и рекомендациями;
- AI-интерпретацией показателей;
- импортом/экспортом данных;
- журналом действий;
- контролем качества данных и механизмом исправления проблемных записей.
