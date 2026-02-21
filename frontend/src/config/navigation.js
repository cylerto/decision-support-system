export const NAV_GROUPS = [
  {
    title: 'Финансы',
    icon: 'FIN',
    items: [
      { key: 'categories', label: 'Категории', icon: 'categories' },
      { key: 'income', label: 'Доходы', icon: 'income' },
      { key: 'expense', label: 'Расходы', icon: 'expense' },
      { key: 'limits', label: 'Лимиты', icon: 'limit' }
    ]
  },
  {
    title: 'Аналитика',
    icon: 'ANA',
    items: [
      { key: 'dashboard', label: 'Дашборд', icon: 'dashboard' },
      { key: 'analytics', label: 'Аналитика', icon: 'analytics' }
    ]
  },
  {
    title: 'Система',
    icon: 'SYS',
    items: [
      { key: 'data', label: 'Импорт/Экспорт', icon: 'data' },
      { key: 'settings', label: 'Настройки', icon: 'settings' }
    ]
  }
]

export const ANALYTICS_TABS = [
  { key: 'summary', label: 'Сводка' },
  { key: 'monthly', label: 'Месяцы' },
  { key: 'categories', label: 'Категории' },
  { key: 'budget', label: 'План vs факт' },
  { key: 'forecast', label: 'Прогноз' },
  { key: 'recommendations', label: 'Рекомендации' }
]

export const QUICK_ACTIONS = [
  { key: 'income', label: '+ Доход', action: { type: 'create', entity: 'income' } },
  { key: 'expense', label: '+ Расход', action: { type: 'create', entity: 'expense' } },
  { key: 'category', label: '+ Категория', action: { type: 'create', entity: 'category' } },
  { key: 'limit', label: '+ Лимит', action: { type: 'limit' } }
]

export const ROUTE_BY_KEY = {
  dashboard: '/dashboard',
  categories: '/categories',
  income: '/income',
  expense: '/expense',
  limits: '/limits',
  analytics: '/analytics',
  data: '/data',
  settings: '/settings'
}

export const KEY_BY_ROUTE = Object.fromEntries(
  Object.entries(ROUTE_BY_KEY).map(([key, path]) => [path, key])
)
