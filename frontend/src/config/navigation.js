export const DEFENSE_MODE = true
export const DEFENSE_VISIBLE_KEYS = ['dashboard', 'operations', 'analytics', 'system']

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
    title: 'Аналитика',
    icon: 'AI',
    items: [{ key: 'analytics', label: 'Аналитика и решения', icon: 'analytics' }]
  },
  {
    title: 'Система',
    icon: 'SYS',
    items: [{ key: 'system', label: 'Система', icon: 'settings' }]
  }
]

export const ANALYTICS_TABS = [
  { key: 'summary', label: 'Сводка' },
  { key: 'monthly', label: 'Динамика по месяцам' },
  { key: 'budget', label: 'Бюджет и контроль' },
  { key: 'insights', label: 'Рекомендации и анализ' }
]

export const QUICK_ACTIONS = [
  { key: 'income', label: '+ Выручка', action: { type: 'create', entity: 'income' } },
  { key: 'expense', label: '+ Затрата', action: { type: 'create', entity: 'expense' } },
  { key: 'category', label: '+ Статья P&L', action: { type: 'create', entity: 'category' } }
]

export const ROUTE_BY_KEY = {
  dashboard: '/dashboard',
  operations: '/operations',
  structure: '/structure',
  analytics: '/analytics',
  system: '/system',

  // legacy routes for backward compatibility
  data: '/data',
  history: '/history',
  settings: '/settings',
  income: '/income',
  expense: '/expense',
  categories: '/categories',
  departments: '/departments',
  projects: '/projects',
  analytics_monthly: '/analytics/monthly',
  analytics_structure: '/analytics/structure',
  forecast: '/forecast',
  recommendations: '/recommendations'
}

export const KEY_BY_ROUTE = Object.fromEntries(
  Object.entries(ROUTE_BY_KEY).map(([key, path]) => [path, key])
)
