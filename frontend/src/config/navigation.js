export const NAV_GROUPS = [
  {
    title: 'Дашборд',
    icon: 'DB',
    items: [{ key: 'dashboard', label: 'Главная панель', icon: 'dashboard' }]
  },
  {
    title: 'Операции',
    icon: 'OP',
    items: [{ key: 'operations', label: 'Выручка / Затраты', icon: 'operations' }]
  },
  {
    title: 'Структура',
    icon: 'ST',
    items: [
      { key: 'categories', label: 'Статьи P&L', icon: 'categories' },
      { key: 'departments', label: 'Подразделения', icon: 'departments' },
      { key: 'projects', label: 'Проекты', icon: 'projects' },
      { key: 'counterparties', label: 'Контрагенты', icon: 'counterparties' }
    ]
  },
  {
    title: 'Бюджет и контроль',
    icon: 'BG',
    items: [{ key: 'budget_limits', label: 'Бюджеты / Лимиты', icon: 'limit' }]
  },
  {
    title: 'Аналитика',
    icon: 'AN',
    items: [
      { key: 'analytics_monthly', label: 'Динамика по месяцам', icon: 'trend' },
      { key: 'analytics_structure', label: 'Структура затрат', icon: 'structure' },
      { key: 'analytics_budget', label: 'Бюджет vs факт', icon: 'budget' }
    ]
  },
  {
    title: 'Решения',
    icon: 'AI',
    items: [
      { key: 'forecast', label: 'Прогноз', icon: 'forecast' },
      { key: 'recommendations', label: 'Рекомендации', icon: 'recommendations' }
    ]
  },
  {
    title: 'Система',
    icon: 'SYS',
    items: [
      { key: 'data', label: 'Импорт / Экспорт', icon: 'data' },
      { key: 'history', label: 'История действий', icon: 'history' },
      { key: 'settings', label: 'Настройки', icon: 'settings' }
    ]
  }
]

export const ANALYTICS_TABS = [
  { key: 'summary', label: 'Сводка' },
  { key: 'monthly', label: 'Динамика по месяцам' },
  { key: 'categories', label: 'Структура затрат' },
  { key: 'budget', label: 'Бюджет vs факт' },
  { key: 'forecast', label: 'Прогноз' },
  { key: 'recommendations', label: 'Рекомендации' }
]

export const QUICK_ACTIONS = [
  { key: 'income', label: '+ Выручка', action: { type: 'create', entity: 'income' } },
  { key: 'expense', label: '+ Затрата', action: { type: 'create', entity: 'expense' } },
  { key: 'category', label: '+ Статья P&L', action: { type: 'create', entity: 'category' } },
  { key: 'limit', label: '+ Лимит', action: { type: 'limit' } }
]

export const ROUTE_BY_KEY = {
  dashboard: '/dashboard',
  operations: '/operations',
  income: '/income',
  expense: '/expense',
  categories: '/categories',
  departments: '/departments',
  projects: '/projects',
  counterparties: '/counterparties',
  budget_limits: '/budget-limits',
  analytics_monthly: '/analytics/monthly',
  analytics_structure: '/analytics/structure',
  analytics_budget: '/analytics/budget',
  forecast: '/forecast',
  recommendations: '/recommendations',
  data: '/data',
  history: '/history',
  settings: '/settings'
}

export const KEY_BY_ROUTE = Object.fromEntries(
  Object.entries(ROUTE_BY_KEY).map(([key, path]) => [path, key])
)
