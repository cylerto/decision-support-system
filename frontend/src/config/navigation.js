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
    items: [{ key: 'structure', label: 'Статьи / Подразделения (опц.) / Проекты (опц.)', icon: 'structure' }]
  },
  {
    title: 'Бюджет',
    icon: 'BG',
    items: [{ key: 'budget_limits', label: 'Бюджеты / Лимиты', icon: 'limit' }]
  },
  {
    title: 'Аналитика',
    icon: 'AI',
    items: [{ key: 'analytics', label: 'Аналитика и решения', icon: 'analytics' }]
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
  { key: 'budget', label: 'Бюджет vs факт' },
  { key: 'insights', label: 'Прогноз и рекомендации' },
  { key: 'ai_recommendations', label: 'AI-рекомендации' }
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
  structure: '/structure',
  analytics: '/analytics',
  budget_limits: '/budget-limits',
  data: '/data',
  history: '/history',
  settings: '/settings',

  // legacy routes for backward compatibility
  income: '/income',
  expense: '/expense',
  categories: '/categories',
  departments: '/departments',
  projects: '/projects',
  analytics_monthly: '/analytics/monthly',
  analytics_structure: '/analytics/structure',
  analytics_budget: '/analytics/budget',
  forecast: '/forecast',
  recommendations: '/recommendations'
}

export const KEY_BY_ROUTE = Object.fromEntries(
  Object.entries(ROUTE_BY_KEY).map(([key, path]) => [path, key])
)
