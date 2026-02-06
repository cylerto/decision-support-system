import './App.css'
import { useEffect, useMemo, useState } from 'react'
import { api, formatDate, toMoney } from './api.js'

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Дашборд' },
  { key: 'categories', label: 'Категории' },
  { key: 'income', label: 'Доходы' },
  { key: 'expense', label: 'Расходы' },
  { key: 'limits', label: 'Лимиты' },
  { key: 'analytics', label: 'Аналитика' },
  { key: 'forecast', label: 'Прогноз' },
  { key: 'recommendations', label: 'Рекомендации' }
]

function Modal({ open, title, onClose, children }) {
  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{title}</h3>
            <p>Заполните поля и подтвердите действие.</p>
          </div>
          <button className="ghost" onClick={onClose}>Закрыть</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

function SectionHeader({ title, subtitle, actions }) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <div className="section-actions">{actions}</div>
    </div>
  )
}

function EmptyState({ title, description }) {
  return (
    <div className="empty-state">
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
  )
}

export default function App() {
  const [active, setActive] = useState('dashboard')
  const [authed, setAuthed] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [loading, setLoading] = useState({})
  const [errors, setErrors] = useState({})
  const [alerts, setAlerts] = useState([])

  const [profile, setProfile] = useState({ username: '', password: '' })
  const [modal, setModal] = useState(null)

  const [categories, setCategories] = useState([])
  const [income, setIncome] = useState([])
  const [expense, setExpense] = useState([])
  const [limits, setLimits] = useState([])

  const [summary, setSummary] = useState(null)
  const [monthly, setMonthly] = useState(null)
  const [categoriesMonthly, setCategoriesMonthly] = useState(null)
  const [balanceMonthly, setBalanceMonthly] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [recommendations, setRecommendations] = useState(null)
  const [incomeFilter, setIncomeFilter] = useState({
    dateFrom: '',
    dateTo: '',
    categoryId: '',
    sortBy: 'date',
    sortDir: 'desc',
    page: 1,
    pageSize: 10
  })
  const [expenseFilter, setExpenseFilter] = useState({
    dateFrom: '',
    dateTo: '',
    categoryId: '',
    sortBy: 'date',
    sortDir: 'desc',
    page: 1,
    pageSize: 10
  })

  const categoryMap = useMemo(() => {
    const map = new Map()
    categories.forEach((cat) => {
      map.set(cat.id, cat)
    })
    return map
  }, [categories])

  const incomeCategories = categories.filter((cat) => cat.type === 'income')
  const expenseCategories = categories.filter((cat) => cat.type === 'expense')

  const setBusy = (key, value) => {
    setLoading((prev) => ({ ...prev, [key]: value }))
  }

  const setError = (key, value) => {
    setErrors((prev) => ({ ...prev, [key]: value }))
  }

  const addAlert = (message, tone = 'warning') => {
    setAlerts((prev) => [...prev, { id: Date.now() + Math.random(), message, tone }])
  }

  const clearAlert = (id) => {
    setAlerts((prev) => prev.filter((item) => item.id !== id))
  }

  const guard = async (key, action) => {
    setBusy(key, true)
    setError(key, '')
    try {
      await action()
    } catch (error) {
      if (error.status === 401) {
        setAuthed(false)
        addAlert('Сессия истекла. Войдите снова.', 'danger')
      }
      setError(key, error.message)
    } finally {
      setBusy(key, false)
    }
  }

  const refreshCategories = () => guard('categories', async () => {
    const data = await api.getCategories()
    setCategories(data)
  })

  const refreshIncome = () => guard('income', async () => {
    const data = await api.getIncome()
    setIncome(data)
  })

  const refreshExpense = () => guard('expense', async () => {
    const data = await api.getExpense()
    setExpense(data)
  })

  const refreshLimits = () => guard('limits', async () => {
    const data = await api.getLimits()
    setLimits(data)
  })

  const refreshSummary = () => guard('summary', async () => {
    const data = await api.getSummary()
    setSummary(data)
  })

  const refreshMonthly = () => guard('monthly', async () => {
    const data = await api.getMonthly()
    setMonthly(data)
  })

  const refreshCategoriesMonthly = () => guard('categoriesMonthly', async () => {
    const data = await api.getCategoriesMonthly()
    setCategoriesMonthly(data)
  })

  const refreshBalanceMonthly = () => guard('balanceMonthly', async () => {
    const data = await api.getBalanceMonthly()
    setBalanceMonthly(data)
  })

  const refreshForecast = () => guard('forecast', async () => {
    const data = await api.getForecast()
    setForecast(data)
  })

  const refreshDashboard = () => guard('dashboard', async () => {
    const data = await api.getDashboard()
    setDashboard(data)
  })

  const refreshRecommendations = () => guard('recommendations', async () => {
    const data = await api.getRecommendations()
    setRecommendations(data)
  })

  const refreshAllLists = async () => {
    await Promise.all([
      refreshCategories(),
      refreshIncome(),
      refreshExpense(),
      refreshLimits()
    ])
  }

  useEffect(() => {
    const probe = async () => {
      try {
        const health = await api.health()
        setAuthed(Boolean(health?.authenticated))
      } catch (error) {
        setAuthed(false)
      }
    }

    probe()
  }, [])

  useEffect(() => {
    if (!authed) return

    refreshAllLists()
    refreshSummary()
    refreshMonthly()
    refreshCategoriesMonthly()
    refreshBalanceMonthly()
    refreshForecast()
    refreshDashboard()
    refreshRecommendations()
  }, [authed])

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setError('auth', '')

    try {
      if (authMode === 'register') {
        await api.register(profile)
        addAlert('Аккаунт создан. Теперь войдите.', 'success')
        setAuthMode('login')
      } else {
        await api.login(profile)
        const health = await api.health()
        if (!health?.authenticated) {
          setError('auth', 'Не удалось создать сессию. Проверьте настройки прокси или CORS.')
          return
        }
        setAuthed(true)
        addAlert('Вы вошли в систему.', 'success')
      }
    } catch (error) {
      setError('auth', error.message)
    }
  }

  const handleLogout = async () => {
    await guard('auth', async () => {
      await api.logout()
      setAuthed(false)
    })
  }

  const handleCreateCategory = async (event) => {
    event.preventDefault()
    const payload = {
      name: event.target.name.value.trim(),
      type: event.target.type.value
    }

    await guard('categories', async () => {
      await api.addCategory(payload)
      await refreshCategories()
      setModal(null)
    })
  }

  const handleCreateIncome = async (event) => {
    event.preventDefault()
    const payload = {
      amount: Number(event.target.amount.value),
      category_id: Number(event.target.category_id.value),
      date: event.target.date.value || undefined
    }

    await guard('income', async () => {
      await api.addIncome(payload)
      await refreshIncome()
      setModal(null)
    })
  }

  const handleCreateExpense = async (event) => {
    event.preventDefault()
    const payload = {
      amount: Number(event.target.amount.value),
      category_id: Number(event.target.category_id.value),
      date: event.target.date.value || undefined
    }

    await guard('expense', async () => {
      await api.addExpense(payload)
      await refreshExpense()
      setModal(null)
    })
  }

  const handleSaveLimit = async (event) => {
    event.preventDefault()
    const payload = {
      category_id: Number(event.target.category_id.value),
      monthly_limit: Number(event.target.monthly_limit.value)
    }

    await guard('limits', async () => {
      await api.saveLimit(payload)
      await refreshLimits()
      setModal(null)
    })
  }

  const normalizeDate = (value) => {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return date
  }

  const applyFilters = (items, filter) => {
    const from = normalizeDate(filter.dateFrom)
    const to = normalizeDate(filter.dateTo)
    const categoryId = filter.categoryId ? Number(filter.categoryId) : null

    const filtered = items.filter((item) => {
      const itemDate = normalizeDate(item.date)
      if (from && itemDate && itemDate < from) return false
      if (to && itemDate && itemDate > to) return false
      if (categoryId && Number(item.category_id) !== categoryId) return false
      return true
    })

    const sorted = [...filtered].sort((a, b) => {
      const dir = filter.sortDir === 'asc' ? 1 : -1
      switch (filter.sortBy) {
        case 'amount':
          return dir * (Number(a.amount) - Number(b.amount))
        case 'category': {
          const aName = categoryMap.get(a.category_id)?.name ?? ''
          const bName = categoryMap.get(b.category_id)?.name ?? ''
          return dir * aName.localeCompare(bName, 'ru')
        }
        case 'date':
        default: {
          const aDate = normalizeDate(a.date) ?? new Date(0)
          const bDate = normalizeDate(b.date) ?? new Date(0)
          return dir * (aDate - bDate)
        }
      }
    })

    const total = sorted.length
    const pageSize = Number(filter.pageSize) || 10
    const pages = Math.max(1, Math.ceil(total / pageSize))
    const page = Math.min(filter.page, pages)
    const start = (page - 1) * pageSize
    const end = start + pageSize

    return {
      rows: sorted.slice(start, end),
      total,
      pages,
      page,
      pageSize
    }
  }

  const renderTableControls = (filter, setFilter, categoriesList) => (
    <div className="table-controls">
      <label className="field compact">
        <span>С даты</span>
        <input
          type="date"
          value={filter.dateFrom}
          onChange={(event) => setFilter({ ...filter, dateFrom: event.target.value, page: 1 })}
        />
      </label>
      <label className="field compact">
        <span>По дату</span>
        <input
          type="date"
          value={filter.dateTo}
          onChange={(event) => setFilter({ ...filter, dateTo: event.target.value, page: 1 })}
        />
      </label>
      <label className="field compact">
        <span>Категория</span>
        <select
          value={filter.categoryId}
          onChange={(event) => setFilter({ ...filter, categoryId: event.target.value, page: 1 })}
        >
          <option value="">Все</option>
          {categoriesList.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </label>
      <label className="field compact">
        <span>Сортировка</span>
        <select
          value={`${filter.sortBy}:${filter.sortDir}`}
          onChange={(event) => {
            const [sortBy, sortDir] = event.target.value.split(':')
            setFilter({ ...filter, sortBy, sortDir, page: 1 })
          }}
        >
          <option value="date:desc">Дата ↓</option>
          <option value="date:asc">Дата ↑</option>
          <option value="amount:desc">Сумма ↓</option>
          <option value="amount:asc">Сумма ↑</option>
          <option value="category:asc">Категория A→Я</option>
          <option value="category:desc">Категория Я→A</option>
        </select>
      </label>
      <label className="field compact">
        <span>На странице</span>
        <select
          value={filter.pageSize}
          onChange={(event) => setFilter({ ...filter, pageSize: Number(event.target.value), page: 1 })}
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </label>
      <button
        className="ghost"
        type="button"
        onClick={() => setFilter({
          ...filter,
          dateFrom: '',
          dateTo: '',
          categoryId: '',
          sortBy: 'date',
          sortDir: 'desc',
          page: 1
        })}
      >
        Сбросить
      </button>
    </div>
  )

  const renderPagination = (meta, setFilter) => (
    <div className="pagination">
      <button
        className="ghost"
        type="button"
        onClick={() => setFilter((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
        disabled={meta.page <= 1}
      >
        Назад
      </button>
      <span>Стр. {meta.page} из {meta.pages}</span>
      <button
        className="ghost"
        type="button"
        onClick={() => setFilter((prev) => ({ ...prev, page: Math.min(meta.pages, prev.page + 1) }))}
        disabled={meta.page >= meta.pages}
      >
        Вперед
      </button>
    </div>
  )

  const renderAuth = () => (
    <div className="auth-layout">
      <div className="auth-panel">
        <div className="brand">
          <div className="logo-mark">DSS</div>
          <div>
            <h1>Decision Support System</h1>
            <p>Единый интерфейс управления доходами, расходами и аналитикой.</p>
          </div>
        </div>

        <form className="card" onSubmit={handleAuthSubmit}>
          <h2>{authMode === 'login' ? 'Вход' : 'Регистрация'}</h2>
          <p>Авторизация использует сессионные куки Flask-Login.</p>
          <label className="field">
            <span>Логин</span>
            <input
              type="text"
              name="username"
              value={profile.username}
              onChange={(event) => setProfile({ ...profile, username: event.target.value })}
              required
            />
          </label>
          <label className="field">
            <span>Пароль</span>
            <input
              type="password"
              name="password"
              value={profile.password}
              onChange={(event) => setProfile({ ...profile, password: event.target.value })}
              required
            />
          </label>

          {errors.auth && <p className="form-error">{errors.auth}</p>}

          <button className="primary" type="submit" disabled={loading.auth}>
            {authMode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>

          <button
            className="ghost"
            type="button"
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
          >
            {authMode === 'login'
              ? 'Нет аккаунта? Регистрация'
              : 'Уже есть аккаунт? Войти'}
          </button>
        </form>
      </div>
    </div>
  )

  const renderTopbar = () => (
    <header className="topbar">
      <div>
        <h1>Decision Support System</h1>
        <p>Полное покрытие всех backend-эндпоинтов.</p>
      </div>
      <div className="topbar-actions">
        <button className="ghost" onClick={refreshAllLists}>Обновить данные</button>
        <button className="primary" onClick={handleLogout}>Выйти</button>
      </div>
    </header>
  )

  const renderSidebar = () => (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-mark">DSS</div>
        <div>
          <strong>Навигация</strong>
          <p>Выберите раздел</p>
        </div>
      </div>
      <nav>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={active === item.key ? 'nav-item active' : 'nav-item'}
            onClick={() => setActive(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <p>Бэкенд работает на Flask + PostgreSQL.</p>
      </div>
    </aside>
  )

  const renderDashboard = () => (
    <section>
      <SectionHeader
        title="Дашборд"
        subtitle="Общая картина по ключевым метрикам"
        actions={<button className="ghost" onClick={refreshDashboard}>Обновить</button>}
      />

      {errors.dashboard && <p className="form-error">{errors.dashboard}</p>}
      {!dashboard && !errors.dashboard && (
        <EmptyState
          title="Данные не загружены"
          description="Нажмите «Обновить», чтобы получить информацию." 
        />
      )}

      {dashboard && (
        <div className="grid-cards">
          <div className="card">
            <h3>Сводка</h3>
            <div className="metric">
              <span>Доходы</span>
              <strong>{toMoney(dashboard.summary?.income)}</strong>
            </div>
            <div className="metric">
              <span>Расходы</span>
              <strong>{toMoney(dashboard.summary?.expense)}</strong>
            </div>
            <div className="metric">
              <span>Баланс</span>
              <strong>{toMoney(dashboard.summary?.balance)}</strong>
            </div>
          </div>

          <div className="card">
            <h3>Записи</h3>
            <div className="metric">
              <span>Доходов</span>
              <strong>{dashboard.counts?.income_records ?? '—'}</strong>
            </div>
            <div className="metric">
              <span>Расходов</span>
              <strong>{dashboard.counts?.expense_records ?? '—'}</strong>
            </div>
          </div>

          <div className="card">
            <h3>Расходы по категориям</h3>
            {dashboard.expenses_by_category && Object.keys(dashboard.expenses_by_category).length > 0 ? (
              <ul className="list">
                {Object.entries(dashboard.expenses_by_category).map(([name, value]) => (
                  <li key={name}>
                    <span>{name}</span>
                    <strong>{toMoney(value)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Нет данных по категориям.</p>
            )}
          </div>
        </div>
      )}
    </section>
  )

  const renderCategories = () => (
    <section>
      <SectionHeader
        title="Категории"
        subtitle="Создавайте и управляйте справочником категорий"
        actions={
          <>
            <button className="ghost" onClick={refreshCategories}>Обновить</button>
            <button className="primary" onClick={() => setModal('category')}>Добавить</button>
          </>
        }
      />

      <div className="info-banner">
        В backend нет эндпоинтов для редактирования или удаления категорий.
      </div>

      {errors.categories && <p className="form-error">{errors.categories}</p>}
      {categories.length === 0 ? (
        <EmptyState
          title="Категорий пока нет"
          description="Добавьте категорию дохода или расхода." 
        />
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Название</th>
                <th>Тип</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id}>
                  <td>{cat.id}</td>
                  <td>{cat.name}</td>
                  <td>{cat.type === 'income' ? 'Доход' : 'Расход'}</td>
                  <td>
                    <button className="ghost" disabled>Редактировать</button>
                    <button className="ghost" disabled>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">В backend нет эндпоинтов для редактирования или удаления категорий.</p>
        </div>
      )}
    </section>
  )

  const renderIncome = () => (
    <section>
      <SectionHeader
        title="Доходы"
        subtitle="Учёт поступлений и истории"
        actions={
          <>
            <button className="ghost" onClick={refreshIncome}>Обновить</button>
            <button className="primary" onClick={() => setModal('income')}>Добавить</button>
          </>
        }
      />

      {errors.income && <p className="form-error">{errors.income}</p>}
      {income.length === 0 ? (
        <EmptyState
          title="Доходов пока нет"
          description="Добавьте первую запись дохода." 
        />
      ) : (
        <div className="card">
          {renderTableControls(incomeFilter, setIncomeFilter, incomeCategories)}
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Сумма</th>
                <th>Дата</th>
                <th>Категория</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {applyFilters(income, incomeFilter).rows.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{toMoney(item.amount)}</td>
                  <td>{formatDate(item.date)}</td>
                  <td>{categoryMap.get(item.category_id)?.name ?? '—'}</td>
                  <td>
                    <button className="ghost" disabled>Редактировать</button>
                    <button className="ghost" disabled>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {renderPagination(applyFilters(income, incomeFilter), setIncomeFilter)}
          <p className="hint">Backend предоставляет только добавление и список доходов.</p>
        </div>
      )}
    </section>
  )

  const renderExpense = () => (
    <section>
      <SectionHeader
        title="Расходы"
        subtitle="Учёт трат и история операций"
        actions={
          <>
            <button className="ghost" onClick={refreshExpense}>Обновить</button>
            <button className="primary" onClick={() => setModal('expense')}>Добавить</button>
          </>
        }
      />

      {errors.expense && <p className="form-error">{errors.expense}</p>}
      {expense.length === 0 ? (
        <EmptyState
          title="Расходов пока нет"
          description="Добавьте первую запись расхода." 
        />
      ) : (
        <div className="card">
          {renderTableControls(expenseFilter, setExpenseFilter, expenseCategories)}
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Сумма</th>
                <th>Дата</th>
                <th>Категория</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {applyFilters(expense, expenseFilter).rows.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{toMoney(item.amount)}</td>
                  <td>{formatDate(item.date)}</td>
                  <td>{categoryMap.get(item.category_id)?.name ?? '—'}</td>
                  <td>
                    <button className="ghost" disabled>Редактировать</button>
                    <button className="ghost" disabled>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {renderPagination(applyFilters(expense, expenseFilter), setExpenseFilter)}
          <p className="hint">Backend предоставляет только добавление и список расходов.</p>
        </div>
      )}
    </section>
  )

  const renderLimits = () => (
    <section>
      <SectionHeader
        title="Лимиты"
        subtitle="Ограничения бюджета по категориям"
        actions={
          <>
            <button className="ghost" onClick={refreshLimits}>Обновить</button>
            <button className="primary" onClick={() => setModal('limit')}>Установить лимит</button>
          </>
        }
      />

      {errors.limits && <p className="form-error">{errors.limits}</p>}
      {limits.length === 0 ? (
        <EmptyState
          title="Лимиты не настроены"
          description="Добавьте лимиты, чтобы контролировать траты." 
        />
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Категория</th>
                <th>Лимит</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {limits.map((item) => (
                <tr key={item.category_id}>
                  <td>{categoryMap.get(item.category_id)?.name ?? `Категория #${item.category_id}`}</td>
                  <td>{toMoney(item.monthly_limit)}</td>
                  <td>
                    <button className="ghost" onClick={() => setModal('limit')}>Изменить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )

  const renderAnalytics = () => (
    <section>
      <SectionHeader
        title="Аналитика"
        subtitle="Сводка, динамика и баланс по месяцам"
        actions={
          <>
            <button className="ghost" onClick={() => {
              refreshSummary()
              refreshMonthly()
              refreshCategoriesMonthly()
              refreshBalanceMonthly()
            }}>Обновить</button>
          </>
        }
      />

      {errors.summary && <p className="form-error">{errors.summary}</p>}
      {summary && (
        <div className="grid-cards">
          <div className="card">
            <h3>Сводка</h3>
            <div className="metric">
              <span>Доходы</span>
              <strong>{toMoney(summary.total_income)}</strong>
            </div>
            <div className="metric">
              <span>Расходы</span>
              <strong>{toMoney(summary.total_expense)}</strong>
            </div>
            <div className="metric">
              <span>Профит</span>
              <strong>{toMoney(summary.profit)}</strong>
            </div>
            <Badge tone={summary.status === 'plus' ? 'success' : 'danger'}>
              {summary.status === 'plus' ? 'Плюс' : 'Минус'}
            </Badge>
          </div>

          <div className="card">
            <h3>Доходы и расходы по месяцам</h3>
            {monthly ? (
              <div className="list">
                {monthly.income.map((row) => (
                  <div key={`i-${row.year}-${row.month}`} className="bar-row">
                    <span>{row.year}-{String(row.month).padStart(2, '0')}</span>
                    <div className="bar">
                      <div style={{ width: `${Math.min(100, row.total)}%` }} />
                    </div>
                    <strong>{toMoney(row.total)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p>Нет данных.</p>
            )}
          </div>

          <div className="card">
            <h3>Баланс по месяцам</h3>
            {balanceMonthly ? (
              <table>
                <thead>
                  <tr>
                    <th>Месяц</th>
                    <th>Доходы</th>
                    <th>Расходы</th>
                    <th>Профит</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {balanceMonthly.map((row) => (
                    <tr key={row.month}>
                      <td>{row.month}</td>
                      <td>{toMoney(row.income)}</td>
                      <td>{toMoney(row.expense)}</td>
                      <td>{toMoney(row.profit)}</td>
                      <td>
                        <Badge tone={row.status === 'plus' ? 'success' : row.status === 'risk' ? 'warning' : 'danger'}>
                          {row.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>Нет данных.</p>
            )}
          </div>

          <div className="card">
            <h3>Категории по месяцам</h3>
            {categoriesMonthly ? (
              <table>
                <thead>
                  <tr>
                    <th>Месяц</th>
                    <th>Категории</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(categoriesMonthly).map(([month, values]) => (
                    <tr key={month}>
                      <td>{month}</td>
                      <td>
                        <ul className="list">
                          {Object.entries(values).map(([name, value]) => (
                            <li key={name}>
                              <span>{name}</span>
                              <strong>{toMoney(value)}</strong>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>Нет данных.</p>
            )}
          </div>
        </div>
      )}
    </section>
  )

  const renderForecast = () => (
    <section>
      <SectionHeader
        title="Прогноз"
        subtitle="Модель LinearRegression и тренды"
        actions={<button className="ghost" onClick={refreshForecast}>Обновить</button>}
      />

      {errors.forecast && <p className="form-error">{errors.forecast}</p>}
      {forecast ? (
        <div className="grid-cards">
          <div className="card">
            <h3>Следующий месяц</h3>
            <div className="metric">
              <span>Прогноз дохода</span>
              <strong>{toMoney(forecast.predicted_income)}</strong>
            </div>
            <div className="metric">
              <span>Прогноз расхода</span>
              <strong>{toMoney(forecast.predicted_expense)}</strong>
            </div>
            <div className="metric">
              <span>Прогноз прибыли</span>
              <strong>{toMoney(forecast.predicted_profit)}</strong>
            </div>
          </div>
          <div className="card">
            <h3>Тренды и уверенность</h3>
            <div className="metric">
              <span>Тренд доходов</span>
              <strong>{forecast.trend?.income}</strong>
            </div>
            <div className="metric">
              <span>Тренд расходов</span>
              <strong>{forecast.trend?.expense}</strong>
            </div>
            <Badge tone={forecast.confidence === 'high' ? 'success' : forecast.confidence === 'medium' ? 'warning' : 'danger'}>
              Уверенность: {forecast.confidence}
            </Badge>
          </div>
        </div>
      ) : (
        <EmptyState
          title="Нет прогноза"
          description="Нужно минимум 2 месяца данных для построения прогноза." 
        />
      )}
    </section>
  )

  const renderRecommendations = () => (
    <section>
      <SectionHeader
        title="Рекомендации"
        subtitle="Уведомления и советы на основе баланса"
        actions={<button className="ghost" onClick={refreshRecommendations}>Обновить</button>}
      />

      {errors.recommendations && <p className="form-error">{errors.recommendations}</p>}
      {recommendations ? (
        <div className="grid-cards">
          <div className="card">
            <h3>Предупреждения</h3>
            {recommendations.alerts?.length ? (
              <ul className="list">
                {recommendations.alerts.map((item, index) => (
                  <li key={`${item}-${index}`}>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Нет предупреждений.</p>
            )}
          </div>
          <div className="card">
            <h3>Советы</h3>
            {recommendations.recommendations?.length ? (
              <ul className="list">
                {recommendations.recommendations.map((item, index) => (
                  <li key={`${item}-${index}`}>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Нет рекомендаций.</p>
            )}
          </div>
        </div>
      ) : (
        <EmptyState
          title="Рекомендации не загружены"
          description="Нажмите «Обновить», чтобы получить данные." 
        />
      )}
    </section>
  )

  const renderContent = () => {
    switch (active) {
      case 'dashboard':
        return renderDashboard()
      case 'categories':
        return renderCategories()
      case 'income':
        return renderIncome()
      case 'expense':
        return renderExpense()
      case 'limits':
        return renderLimits()
      case 'analytics':
        return renderAnalytics()
      case 'forecast':
        return renderForecast()
      case 'recommendations':
        return renderRecommendations()
      default:
        return null
    }
  }

  if (!authed) {
    return renderAuth()
  }

  return (
    <div className="layout">
      {renderSidebar()}
      <div className="main">
        {renderTopbar()}
        <div className="alerts">
          {alerts.map((alert) => (
            <div key={alert.id} className={`alert alert-${alert.tone}`}>
              <span>{alert.message}</span>
              <button onClick={() => clearAlert(alert.id)}>Закрыть</button>
            </div>
          ))}
        </div>
        <div className="content">
          {renderContent()}
        </div>
      </div>

      <Modal
        open={modal === 'category'}
        title="Новая категория"
        onClose={() => setModal(null)}
      >
        <form className="modal-form" onSubmit={handleCreateCategory}>
          <label className="field">
            <span>Название</span>
            <input name="name" type="text" required />
          </label>
          <label className="field">
            <span>Тип</span>
            <select name="type" defaultValue="expense">
              <option value="income">Доход</option>
              <option value="expense">Расход</option>
            </select>
          </label>
          <button className="primary" type="submit">Сохранить</button>
        </form>
      </Modal>

      <Modal
        open={modal === 'income'}
        title="Добавить доход"
        onClose={() => setModal(null)}
      >
        <form className="modal-form" onSubmit={handleCreateIncome}>
          <label className="field">
            <span>Сумма</span>
            <input name="amount" type="number" step="0.01" min="0" required />
          </label>
          <label className="field">
            <span>Категория</span>
            <select name="category_id" required>
              {incomeCategories.length === 0 && (
                <option value="">Нет категорий дохода</option>
              )}
              {incomeCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Дата</span>
            <input name="date" type="date" />
          </label>
          <button className="primary" type="submit" disabled={incomeCategories.length === 0}>Сохранить</button>
        </form>
      </Modal>

      <Modal
        open={modal === 'expense'}
        title="Добавить расход"
        onClose={() => setModal(null)}
      >
        <form className="modal-form" onSubmit={handleCreateExpense}>
          <label className="field">
            <span>Сумма</span>
            <input name="amount" type="number" step="0.01" min="0" required />
          </label>
          <label className="field">
            <span>Категория</span>
            <select name="category_id" required>
              {expenseCategories.length === 0 && (
                <option value="">Нет категорий расхода</option>
              )}
              {expenseCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Дата</span>
            <input name="date" type="date" />
          </label>
          <button className="primary" type="submit" disabled={expenseCategories.length === 0}>Сохранить</button>
        </form>
      </Modal>

      <Modal
        open={modal === 'limit'}
        title="Установить лимит"
        onClose={() => setModal(null)}
      >
        <form className="modal-form" onSubmit={handleSaveLimit}>
          <label className="field">
            <span>Категория</span>
            <select name="category_id" required>
              {expenseCategories.length === 0 && (
                <option value="">Нет категорий расхода</option>
              )}
              {expenseCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Лимит на месяц</span>
            <input name="monthly_limit" type="number" step="0.01" min="0" required />
          </label>
          <button className="primary" type="submit" disabled={expenseCategories.length === 0}>Сохранить</button>
        </form>
      </Modal>
    </div>
  )
}

