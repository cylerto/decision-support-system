# RUN.md

## 1. Требования
- Python 3.13+
- Node.js 20+
- PostgreSQL 15+
- Доступ к базе `decision_support`

## 2. Настройка `.env`
Создайте/проверьте файл `.env` в корне проекта:

```env
SECRET_KEY=change_me
DATABASE_URL=postgresql+psycopg://dss_user:1234@localhost/decision_support
AUTO_CREATE_DB=0

AI_PROVIDER=openrouter
OPENROUTER_API_KEY=YOUR_KEY
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
OPENROUTER_HTTP_REFERER=http://localhost:5173
OPENROUTER_APP_NAME=Decision Support System
```

## 3. Установка зависимостей
```powershell
# backend
c:\decision-support-system\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt

# frontend
npm install
npm --prefix frontend install
```

## 4. Наполнение тестовыми данными (кофейня)
```powershell
# 1) справочники + 20 статей P&L + операции за 4 месяца
c:\decision-support-system\.venv\Scripts\python.exe -m backend.scripts.seed_demo_coffee

# 2) 4 аккаунта и общая компания (общие данные)
c:\decision-support-system\.venv\Scripts\python.exe -m backend.scripts.seed_coffee_team
```

## 5. Запуск приложения
```powershell
npm run dev
```

Ожидаемо:
- Frontend: `http://localhost:5173`
- Backend: `http://127.0.0.1:5000`

## 6. Проверка health
```powershell
curl.exe http://127.0.0.1:5000/api/health
curl.exe http://127.0.0.1:5000/api/health/details
```

Ожидаемый ответ `/api/health`: `{"status":"ok", ...}`

## 7. Тестовые аккаунты
- `coffee_owner / Coffee2026!`
- `coffee_manager / Manager2026!`
- `coffee_accountant / Accountant2026!`
- `coffee_department / DeptHead2026!`

## 8. Smoke-проверка перед показом
```powershell
c:\decision-support-system\.venv\Scripts\python.exe -m backend.smoke_predefense
```

Ожидаемо: `Predefense smoke: PASSED`

## 9. Типовые проблемы
- `401 /api/auth/login`: неверный логин/пароль или другой пользователь без данных.
- `ECONNREFUSED /api/health` в Vite: backend еще не поднялся.
- `429` для AI: лимит бесплатной модели; сработает fallback-текст.
- нет данных в таблице: сбросьте фильтры на экране операций.

## 10. Предзащитный режим интерфейса
В rontend/src/config/navigation.js установлен флаг:
- DEFENSE_MODE = true -> показываются только ключевые вкладки: Дашборд, Операции, Аналитика, Система.
- чтобы вернуть полный интерфейс, переключите DEFENSE_MODE = false.
