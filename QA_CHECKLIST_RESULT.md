# QA CHECKLIST RESULT (финальный прогон)

Дата прогона: `2026-04-09`  
Окружение: `c:\decision-support-system`

## A. Аутентификация и роли
- [x] Вход owner: PASS
- [x] Вход manager: PASS
- [x] Вход accountant: PASS
- [x] Вход department_head: PASS
- [x] Проверка прав: manager не может удалять операции (403): PASS
- [x] Все 4 роли видят общий контур данных компании: PASS

## B. CRUD операций
- [x] Добавление выручки: PASS
- [x] Добавление затраты: PASS
- [x] Редактирование выручки: PASS
- [x] Редактирование затраты: PASS
- [x] Удаление owner/accountant: PASS (owner)
- [x] Валидация обязательных полей (дата, сумма, категория, подразделение): PASS

## C. Таблица операций
- [ ] Фильтр по дате: MANUAL
- [ ] Фильтр по подразделению: MANUAL
- [ ] Фильтр по проекту: MANUAL
- [ ] Сортировка по дате/сумме: MANUAL
- [ ] Пагинация корректна: MANUAL
- [ ] Доходы и затраты ведут себя одинаково по фильтрам/сортировке: MANUAL

## D. Единый механизм данных
- [x] После CRUD обновляется summary: PASS
- [x] После CRUD обновляется monthly динамика: PASS
- [x] После CRUD обновляются KPI: PASS
- [x] После CRUD обновляется forecast: PASS
- [x] После CRUD обновляются recommendations: PASS

## E. Качество данных
- [ ] `uncategorized_income = 0`: MANUAL (зависит от текущей БД пользователя)
- [ ] `uncategorized_expense = 0`: MANUAL (зависит от текущей БД пользователя)
- [ ] операции без подразделения = 0: MANUAL (зависит от текущей БД пользователя)
- [x] единый формат дат (YYYY-MM-DD): PASS
- [x] единая валюта отображения (RUB): PASS

## F. AI и рекомендации
- [x] `POST /api/ai/recommendations` возвращает текст: PASS
- [x] markdown-мусор (`###`, `**`) очищается на фронте: PASS
- [x] при 429/timeout показывается fallback, а не пустой блок: PASS
- [x] рекомендации отражают текущие метрики: PASS

## G. Импорт/экспорт и аудит
- [ ] экспорт доходов в CSV: MANUAL
- [ ] экспорт затрат в CSV: MANUAL
- [ ] импорт доходов из CSV: MANUAL
- [ ] импорт затрат из CSV: MANUAL
- [ ] записи аудита создаются (create/update/delete/import): MANUAL

## H. UI (темная/светлая)
- [ ] читаемость текста и контраст: MANUAL
- [ ] кнопки primary/secondary/danger консистентны: MANUAL
- [ ] таблицы и формы без визуальных артефактов: MANUAL
- [ ] нет битой кодировки в основных экранах: MANUAL

## I. Финальный smoke
- [x] `python -m backend.smoke_predefense` -> PASSED
- [ ] демо-сценарий из `DEMO_SCRIPT.md` пройден целиком: MANUAL

## Автотест-итог
- Backend smoke: `PASSED`
- Frontend build: `PASSED`
- Py compile checks: `PASSED`
- Расширенный API прогон (включая `/api/analytics/profit/departments`, `/api/analytics/profit/projects`, `/api/analytics/stability`): `PASSED`
