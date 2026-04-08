# BACKUP_AND_RELEASE.md

## Перед днем защиты

## 1. Бэкап базы данных (PostgreSQL)
```powershell
# пример
pg_dump -h localhost -U dss_user -d decision_support -F c -f backup_decision_support_before_defense.dump
```

## 2. Бэкап `.env`
```powershell
Copy-Item .env .env.backup_before_defense
```

## 3. Фиксация стабильной версии в git
```powershell
git add .
git commit -m "pre-defense stable build"
git tag -a v1.0-predefense -m "Stable version before defense"
```

## 4. Проверка восстановления (быстрый контроль)
```powershell
# при необходимости развернуть в чистой БД
pg_restore -h localhost -U dss_user -d decision_support_restored -c backup_decision_support_before_defense.dump
```

## 5. Что взять на защиту
- SQL dump
- архив проекта
- `RUN.md`
- `DEMO_SCRIPT.md`
- `ARCHITECTURE_FOR_COMMISSION.md`
