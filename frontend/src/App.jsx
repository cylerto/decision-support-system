import './App.css'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js'
import { api } from './api.js'
import { ANALYTICS_TABS, KEY_BY_ROUTE, NAV_GROUPS, QUICK_ACTIONS, ROUTE_BY_KEY } from './config/navigation.js'
import Modal from './shared/ui/Modal.jsx'
import Sidebar from './shared/layout/Sidebar.jsx'
import Topbar from './shared/layout/Topbar.jsx'
import AlertsStack from './features/alerts/AlertsStack.jsx'
import AuthPage from './pages/AuthPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import CategoriesPage from './pages/CategoriesPage.jsx'
import IncomePage from './pages/IncomePage.jsx'
import ExpensePage from './pages/ExpensePage.jsx'
import LimitsPage from './pages/LimitsPage.jsx'
import AnalyticsPage from './pages/AnalyticsPage.jsx'
import DataPage from './pages/DataPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend)

function readStoredJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch {
    return fallback
  }
}

function confirmDanger(text) {
  return window.confirm(text)
}

async function safeForecastLoad(months) {
  try {
    return await api.getForecastSeries(months)
  } catch (error) {
    if (error?.status === 400) return { message: error.message, series: null }
    throw error
  }
}

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()

  const [active, setActive] = useState('dashboard')
  const [analyticsTab, setAnalyticsTab] = useState('summary')
  const [analyticsWindow, setAnalyticsWindow] = useState('6')
  const [authed, setAuthed] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [profile, setProfile] = useState({ username: '', password: '' })
  const [modal, setModal] = useState(null)
  const [theme, setTheme] = useState('dark')
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState({})

  const [settings, setSettings] = useState({ base_currency: 'RUB', notify_channels: ['in_app'] })
  const [categories, setCategories] = useState([])
  const [allCategories, setAllCategories] = useState([])
  const [income, setIncome] = useState([])
  const [expense, setExpense] = useState([])
  const [limits, setLimits] = useState([])
  const [, setAudit] = useState([])

  const [categoriesMeta, setCategoriesMeta] = useState({ total: 0, page: 1, page_size: 10 })
  const [incomeMeta, setIncomeMeta] = useState({ total: 0, page: 1, page_size: 10 })
  const [expenseMeta, setExpenseMeta] = useState({ total: 0, page: 1, page_size: 10 })

  const [summary, setSummary] = useState(null)
  const [monthly, setMonthly] = useState(null)
  const [categoriesMonthly, setCategoriesMonthly] = useState(null)
  const [budgetVsActual, setBudgetVsActual] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [recommendations, setRecommendations] = useState(null)
  const [kpi, setKpi] = useState(null)
  const [segments, setSegments] = useState(null)
  const [dashboardSnapshot, setDashboardSnapshot] = useState(null)

  const [categoryFilter, setCategoryFilter] = useState(() => readStoredJson('dss.categoryFilter', { search: '', type: '', page: 1, pageSize: 10 }))
  const [incomeFilter, setIncomeFilter] = useState(() => readStoredJson('dss.incomeFilter', { dateFrom: '', dateTo: '', sortBy: 'date', sortDir: 'desc', page: 1, pageSize: 10 }))
  const [expenseFilter, setExpenseFilter] = useState(() => readStoredJson('dss.expenseFilter', { dateFrom: '', dateTo: '', sortBy: 'date', sortDir: 'desc', page: 1, pageSize: 10 }))

  const categoryMap = useMemo(() => new Map(allCategories.map((item) => [item.id, item])), [allCategories])
  const incomeCategories = allCategories.filter((item) => item.type === 'income')
  const expenseCategories = allCategories.filter((item) => item.type === 'expense')

  const refreshCategoryCatalog = () => guard('categoryCatalog', async () => {
    const data = await api.getCategories({ page: 1, page_size: 500 })
    setAllCategories(data.items ?? data)
  })

  const setBusy = (key, value) => setLoading((prev) => ({ ...prev, [key]: value }))
  const addAlert = (message, tone = 'warning') => setAlerts((prev) => [...prev, { id: Date.now() + Math.random(), message, tone }])

  const guard = async (key, action) => {
    setBusy(key, true)
    try {
      await action()
    } catch (error) {
      if (error.status === 401) {
        setAuthed(false)
        addAlert('Сессия истекла. Войдите снова.', 'danger')
      } else {
        addAlert(error.message || 'Ошибка', 'danger')
      }
    } finally {
      setBusy(key, false)
    }
  }

  const refreshCategories = () => guard('categories', async () => {
    const data = await api.getCategories({
      search: categoryFilter.search || undefined,
      type: categoryFilter.type || undefined,
      page: categoryFilter.page,
      page_size: categoryFilter.pageSize
    })
    const items = data.items ?? data
    const total = data.total ?? (data.items?.length ?? data.length ?? 0)
    if ((items?.length ?? 0) === 0 && total > 0 && categoryFilter.page > 1) {
      setCategoryFilter((prev) => ({ ...prev, page: 1 }))
      return
    }
    setCategories(items)
    setCategoriesMeta({
      total,
      page: data.page ?? categoryFilter.page,
      page_size: data.page_size ?? categoryFilter.pageSize
    })
  })

  const refreshIncome = () => guard('income', async () => {
    const data = await api.getIncome({
      date_from: incomeFilter.dateFrom || undefined,
      date_to: incomeFilter.dateTo || undefined,
      sort_by: incomeFilter.sortBy,
      sort_dir: incomeFilter.sortDir,
      page: incomeFilter.page,
      page_size: incomeFilter.pageSize
    })
    const items = data.items ?? data
    const total = data.total ?? (data.items?.length ?? data.length ?? 0)
    if ((items?.length ?? 0) === 0 && total > 0 && incomeFilter.page > 1) {
      setIncomeFilter((prev) => ({ ...prev, page: 1 }))
      return
    }
    setIncome(items)
    setIncomeMeta({
      total,
      page: data.page ?? incomeFilter.page,
      page_size: data.page_size ?? incomeFilter.pageSize
    })
  })

  const refreshExpense = () => guard('expense', async () => {
    const data = await api.getExpense({
      date_from: expenseFilter.dateFrom || undefined,
      date_to: expenseFilter.dateTo || undefined,
      sort_by: expenseFilter.sortBy,
      sort_dir: expenseFilter.sortDir,
      page: expenseFilter.page,
      page_size: expenseFilter.pageSize
    })
    const items = data.items ?? data
    const total = data.total ?? (data.items?.length ?? data.length ?? 0)
    if ((items?.length ?? 0) === 0 && total > 0 && expenseFilter.page > 1) {
      setExpenseFilter((prev) => ({ ...prev, page: 1 }))
      return
    }
    setExpense(items)
    setExpenseMeta({
      total,
      page: data.page ?? expenseFilter.page,
      page_size: data.page_size ?? expenseFilter.pageSize
    })
  })

  const refreshCore = () => guard('core', async () => {
    const [limitsData, summaryData, monthlyData, categoriesMonthlyData, budgetData, recommendationsData, forecastData, kpiData, segmentsData, dashboardData] = await Promise.all([
      api.getLimits(),
      api.getSummary(),
      api.getMonthly(),
      api.getCategoriesMonthly(),
      api.getBudgetVsActual(),
      api.getRecommendations(),
      safeForecastLoad(6),
      api.getKpi(),
      api.getSegments(),
      api.getDashboard()
    ])
    setLimits(limitsData)
    setSummary(summaryData)
    setMonthly(monthlyData)
    setCategoriesMonthly(categoriesMonthlyData)
    setBudgetVsActual(budgetData)
    setRecommendations(recommendationsData)
    setForecast(forecastData)
    setKpi(kpiData)
    setSegments(segmentsData)
    setDashboardSnapshot(dashboardData)
  })

  const refreshSettings = () => guard('settings', async () => {
    const value = await api.getSettings()
    setSettings({ base_currency: value.base_currency, notify_channels: value.notify_channels ?? ['in_app'] })
  })

  const refreshAudit = () => guard('audit', async () => {
    const data = await api.getAudit({ page: 1, page_size: 10 })
    setAudit(data || [])
  })

  const refreshAll = async () => {
    await Promise.all([
      refreshCategories(),
      refreshCategoryCatalog(),
      refreshIncome(),
      refreshExpense(),
      refreshCore(),
      refreshSettings(),
      refreshAudit()
    ])
  }

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const next = saved || 'dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
  }, [])

  useEffect(() => {
    const key = KEY_BY_ROUTE[location.pathname]
    if (key) {
      setActive(key)
      return
    }
    if (location.pathname === '/' || location.pathname === '') {
      setActive('dashboard')
      return
    }
    if (authed) navigate(ROUTE_BY_KEY.dashboard, { replace: true })
  }, [location.pathname, authed, navigate])

  useEffect(() => localStorage.setItem('dss.categoryFilter', JSON.stringify(categoryFilter)), [categoryFilter])
  useEffect(() => localStorage.setItem('dss.incomeFilter', JSON.stringify(incomeFilter)), [incomeFilter])
  useEffect(() => localStorage.setItem('dss.expenseFilter', JSON.stringify(expenseFilter)), [expenseFilter])

  useEffect(() => {
    api.health().then((h) => setAuthed(Boolean(h?.authenticated))).catch(() => setAuthed(false))
  }, [])

  useEffect(() => {
    if (!authed) return
    refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (authed) refreshCategories() }, [authed, categoryFilter])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (authed) refreshIncome() }, [authed, incomeFilter])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (authed) refreshExpense() }, [authed, expenseFilter])

  useEffect(() => {
    const handler = (event) => {
      if (!authed) return
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT') return
      if (event.key.toLowerCase() === 'i') setModal({ type: 'create', entity: 'income' })
      if (event.key.toLowerCase() === 'e') setModal({ type: 'create', entity: 'expense' })
      if (event.key.toLowerCase() === 'c') setModal({ type: 'create', entity: 'category' })
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [authed])

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    if (authMode === 'register') {
      await api.register(profile)
      setAuthMode('login')
      addAlert('Аккаунт создан', 'success')
      return
    }
    await api.login(profile)
    setAuthed(true)
    navigate(ROUTE_BY_KEY.dashboard, { replace: true })
    addAlert('Вы вошли в систему', 'success')
  }

  const handleLogout = async () => {
    await guard('auth', async () => {
      await api.logout()
      setAuthed(false)
      navigate('/', { replace: true })
    })
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    const entity = event.target.entity.value

    if (entity === 'category') {
      await guard('categories', async () => {
        await api.addCategory({
          name: event.target.name.value.trim(),
          type: event.target.type.value,
          color: event.target.color.value || undefined,
          icon: event.target.icon.value || undefined
        })
        await refreshCategories()
        await refreshCategoryCatalog()
        await refreshAudit()
        setModal(null)
        addAlert('Категория добавлена', 'success')
      })
      return
    }

    const payload = {
      amount: Number(event.target.amount.value),
      category_id: Number(event.target.category_id.value),
      date: event.target.date.value || undefined,
      currency: event.target.currency.value || undefined,
      note: event.target.note.value || undefined
    }

    const createFn = entity === 'income' ? api.addIncome : api.addExpense
    const refreshFn = entity === 'income' ? refreshIncome : refreshExpense

    await guard(entity, async () => {
      await createFn(payload)
      await refreshFn()
      await refreshCore()
      await refreshAudit()
      setModal(null)
      addAlert(entity === 'income' ? 'Доход добавлен' : 'Расход добавлен', 'success')
    })
  }

  const handleUpdateCategory = async (event) => {
    event.preventDefault()
    const id = Number(event.target.category_id.value)
    await guard('categories', async () => {
      await api.updateCategory(id, {
        name: event.target.name.value.trim(),
        type: event.target.type.value,
        color: event.target.color.value || undefined,
        icon: event.target.icon.value || undefined
      })
      await refreshCategories()
      await refreshCategoryCatalog()
      await refreshAudit()
      setModal(null)
      addAlert('Категория обновлена', 'success')
    })
  }

  const handleUpdateIncome = async (event) => {
    event.preventDefault()
    const id = Number(event.target.income_id.value)
    await guard('income', async () => {
      await api.updateIncome(id, {
        amount: Number(event.target.amount.value),
        category_id: Number(event.target.category_id.value),
        date: event.target.date.value || undefined,
        currency: event.target.currency.value || undefined,
        note: event.target.note.value || undefined
      })
      await refreshIncome()
      await refreshCore()
      await refreshAudit()
      setModal(null)
      addAlert('Доход обновлен', 'success')
    })
  }

  const handleUpdateExpense = async (event) => {
    event.preventDefault()
    const id = Number(event.target.expense_id.value)
    await guard('expense', async () => {
      await api.updateExpense(id, {
        amount: Number(event.target.amount.value),
        category_id: Number(event.target.category_id.value),
        date: event.target.date.value || undefined,
        currency: event.target.currency.value || undefined,
        note: event.target.note.value || undefined
      })
      await refreshExpense()
      await refreshCore()
      await refreshAudit()
      setModal(null)
      addAlert('Расход обновлен', 'success')
    })
  }

  const saveLimit = async (event) => {
    event.preventDefault()
    await guard('limits', async () => {
      await api.saveLimit({
        category_id: Number(event.target.category_id.value),
        monthly_limit: Number(event.target.monthly_limit.value)
      })
      await refreshCore()
      await refreshAudit()
      setModal(null)
      addAlert('Лимит сохранен', 'success')
    })
  }

  const saveSettingsInline = async (payload) => {
    await guard('settings', async () => {
      await api.updateSettings({
        base_currency: payload.base_currency,
        widgets: {},
        notify_channels: settings.notify_channels
      })
      await refreshSettings()
      addAlert('Настройки обновлены', 'success')
    })
  }

  const seedDemo = async () => {
    await guard('demo', async () => {
      await api.seedDemo()
      await refreshAll()
      addAlert('Демо-данные загружены', 'success')
    })
  }

  const importCsv = async (kind, file) => {
    await guard('import', async () => {
      await api.importData(kind, file)
      await refreshAll()
      addAlert('Импорт завершен', 'success')
    })
  }

  const exportCsv = async (kind) => {
    await guard('export', async () => {
      const blob = await api.exportData(kind, 'csv')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${kind}.csv`
      a.click()
      URL.revokeObjectURL(url)
      addAlert('Экспорт завершен', 'success')
    })
  }

  const removeCategory = (id) => guard('categories', async () => {
    if (!confirmDanger('Удалить категорию?')) return
    await api.deleteCategory(id)
    await refreshCategories()
    await refreshCategoryCatalog()
    await refreshAudit()
    addAlert('Категория удалена', 'success')
  })

  const removeIncome = (id) => guard('income', async () => {
    if (!confirmDanger('Удалить доход?')) return
    await api.deleteIncome(id)
    await refreshIncome()
    await refreshCore()
    await refreshAudit()
    addAlert('Доход удален', 'success')
  })

  const removeExpense = (id) => guard('expense', async () => {
    if (!confirmDanger('Удалить расход?')) return
    await api.deleteExpense(id)
    await refreshExpense()
    await refreshCore()
    await refreshAudit()
    addAlert('Расход удален', 'success')
  })

  const latestMonthKey = useMemo(() => {
    const keys = Object.keys(categoriesMonthly || {})
    return keys.length ? keys.sort().at(-1) : null
  }, [categoriesMonthly])

  const summaryValues = {
    income: Number(kpi?.total_income ?? summary?.total_income ?? 0),
    expense: Number(kpi?.total_expense ?? summary?.total_expense ?? 0),
    balance: Number(kpi?.savings ?? summary?.profit ?? 0)
  }

  const savingsRate = summaryValues.income > 0 ? (summaryValues.balance / summaryValues.income) * 100 : 0
  const burnRate = Number((kpi?.burn_rate ?? (summaryValues.income ? summaryValues.expense / summaryValues.income : 0)) * 100)

  const monthMap = useMemo(() => {
    const map = {}
    ;(monthly?.income || []).forEach((row) => {
      const key = `${row.year}-${String(row.month).padStart(2, '0')}`
      map[key] = { ...(map[key] || {}), income: Number(row.total || 0) }
    })
    ;(monthly?.expense || []).forEach((row) => {
      const key = `${row.year}-${String(row.month).padStart(2, '0')}`
      map[key] = { ...(map[key] || {}), expense: Number(row.total || 0) }
    })
    return map
  }, [monthly])

  const monthLabels = Object.keys(monthMap).sort()
  const periodCount = analyticsWindow === 'all' ? monthLabels.length : Number(analyticsWindow)
  const scopedMonthLabels = periodCount > 0 ? monthLabels.slice(-periodCount) : monthLabels

  const scopedCategorySpend = useMemo(() => {
    const keys = new Set(scopedMonthLabels)
    const aggregate = {}
    Object.entries(categoriesMonthly || {}).forEach(([month, categoriesByMonth]) => {
      if (!keys.has(month)) return
      Object.entries(categoriesByMonth || {}).forEach(([name, amount]) => {
        aggregate[name] = (aggregate[name] || 0) + Number(amount || 0)
      })
    })
    return aggregate
  }, [categoriesMonthly, scopedMonthLabels])

  const scopedBudgetVsActual = useMemo(() => {
    if (!Array.isArray(budgetVsActual)) return []
    const keys = new Set(scopedMonthLabels)
    return budgetVsActual.filter((row) => keys.has(row.month))
  }, [budgetVsActual, scopedMonthLabels])

  const latestCategorySpend = categoriesMonthly?.[latestMonthKey] || {}

  const limitsProgress = limits.map((item) => {
    const name = categoryMap.get(item.category_id)?.name || `ID ${item.category_id}`
    const spent = Number(latestCategorySpend[name] || 0)
    const limit = Number(item.monthly_limit || 0)
    const pct = limit > 0 ? (spent / limit) * 100 : 0
    return { ...item, name, spent, limit, pct }
  }).sort((a, b) => b.pct - a.pct)

  const atRiskLimits = limitsProgress.filter((item) => item.pct >= 80).length
  const systemAlerts = [
    ...(summaryValues.balance < 0 ? ['Отрицательный баланс.'] : []),
    ...limitsProgress.filter((item) => item.pct > 100).map((item) => `Лимит превышен: ${item.name}`)
  ]

  const remainingToMonthEnd = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7)
    const current = monthMap[currentMonth]
    if (!current) return 0
    return Number((current.income || 0) - (current.expense || 0))
  }, [monthMap])

  const recentTransactions = useMemo(() => {
    const list = [
      ...income.map((item) => ({ ...item, type: 'income' })),
      ...expense.map((item) => ({ ...item, type: 'expense' }))
    ]
    return list.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8)
  }, [income, expense])

  const monthStats = useMemo(() => {
    const keys = Object.keys(monthMap).sort()
    const current = keys.at(-1)
    const previous = keys.at(-2)
    if (!current || !previous) return { income: 0, expense: 0, balance: 0 }
    const cIncome = monthMap[current]?.income || 0
    const pIncome = monthMap[previous]?.income || 0
    const cExpense = monthMap[current]?.expense || 0
    const pExpense = monthMap[previous]?.expense || 0
    const cBalance = cIncome - cExpense
    const pBalance = pIncome - pExpense
    const ratio = (curr, prev) => (prev ? ((curr - prev) / prev) * 100 : 0)
    return { income: ratio(cIncome, pIncome), expense: ratio(cExpense, pExpense), balance: ratio(cBalance, pBalance) }
  }, [monthMap])

  const aiInsights = useMemo(() => {
    const list = []
    if (savingsRate >= 20) list.push({ tone: 'success', text: 'Отличный месяц для накоплений' })
    const limitAlert = limitsProgress.find((item) => item.pct > 100)
    if (limitAlert) list.push({ tone: 'danger', text: `Вы превысили лимит по категории "${limitAlert.name}"` })
    if (savingsRate < 20 && summaryValues.income > 0) {
      const deficit = Math.max(0, 20 - savingsRate)
      list.push({ tone: 'warning', text: `Стоит сократить расходы на ${deficit.toFixed(1)}% для цели по savings rate` })
    }
    return list
  }, [limitsProgress, savingsRate, summaryValues.income])

  const contentByKey = {
    dashboard: (
      <DashboardPage
        summaryValues={summaryValues}
        savingsRate={savingsRate}
        burnRate={burnRate}
        trends={monthStats}
        onRefresh={refreshCore}
        monthLabels={scopedMonthLabels}
        monthMap={monthMap}
        latestCategorySpend={scopedCategorySpend}
        limitsProgress={limitsProgress}
        systemAlerts={systemAlerts}
        insights={aiInsights}
        dashboardSnapshot={dashboardSnapshot}
        recentTransactions={recentTransactions}
        categoryMap={categoryMap}
        segments={segments}
        loading={loading.core}
        atRiskLimits={atRiskLimits}
        remainingToMonthEnd={remainingToMonthEnd}
      />
    ),
    categories: (
      <CategoriesPage
        loading={loading.categories}
        filter={categoryFilter}
        setFilter={setCategoryFilter}
        categories={categories}
        meta={categoriesMeta}
        onOpenCreate={() => setModal({ type: 'create', entity: 'category' })}
        onOpenEdit={(item) => setModal({ type: 'category-edit', data: item })}
        onRemove={removeCategory}
      />
    ),
    income: (
      <IncomePage
        loading={loading.income}
        filter={incomeFilter}
        setFilter={setIncomeFilter}
        income={income}
        meta={incomeMeta}
        categoryMap={categoryMap}
        onOpenCreate={() => setModal({ type: 'create', entity: 'income' })}
        onOpenEdit={(item) => setModal({ type: 'income-edit', data: item })}
        onRemove={removeIncome}
      />
    ),
    expense: (
      <ExpensePage
        loading={loading.expense}
        filter={expenseFilter}
        setFilter={setExpenseFilter}
        expense={expense}
        meta={expenseMeta}
        categoryMap={categoryMap}
        onOpenCreate={() => setModal({ type: 'create', entity: 'expense' })}
        onOpenEdit={(item) => setModal({ type: 'expense-edit', data: item })}
        onRemove={removeExpense}
      />
    ),
    limits: <LimitsPage limitsProgress={limitsProgress} onOpenLimit={() => setModal({ type: 'limit' })} />,
    analytics: (
      <AnalyticsPage
        tabs={ANALYTICS_TABS}
        activeTab={analyticsTab}
        setActiveTab={setAnalyticsTab}
        analyticsWindow={analyticsWindow}
        setAnalyticsWindow={setAnalyticsWindow}
        onRefresh={refreshCore}
        summaryValues={summaryValues}
        savingsRate={savingsRate}
        burnRate={burnRate}
        monthLabels={scopedMonthLabels}
        monthMap={monthMap}
        latestCategorySpend={scopedCategorySpend}
        budgetVsActual={scopedBudgetVsActual}
        forecast={forecast}
        recommendations={recommendations}
      />
    ),
    data: <DataPage onSeedDemo={seedDemo} onExportCsv={exportCsv} onImportCsv={importCsv} />,
    settings: (
      <SettingsPage
        settings={settings}
        theme={theme}
        onThemeChange={(next) => {
          setTheme(next)
          localStorage.setItem('theme', next)
          document.documentElement.dataset.theme = next
        }}
        onSave={saveSettingsInline}
      />
    )
  }

  if (!authed) {
    return <AuthPage authMode={authMode} setAuthMode={setAuthMode} profile={profile} setProfile={setProfile} onSubmit={handleAuthSubmit} />
  }

  const createEntity = modal?.entity || 'income'
  const createCategories = createEntity === 'income' ? incomeCategories : expenseCategories
  const pageTitle = NAV_GROUPS.flatMap((group) => group.items).find((item) => item.key === active)?.label || 'Панель'

  return (
    <div className="layout">
      <Sidebar navGroups={NAV_GROUPS} active={active} onNavigate={(key) => navigate(ROUTE_BY_KEY[key])} />
      <div className="main">
        <Topbar
          title={pageTitle}
          quickActions={QUICK_ACTIONS}
          onQuickAction={setModal}
          theme={theme}
          onToggleTheme={() => {
            const next = theme === 'light' ? 'dark' : 'light'
            setTheme(next)
            localStorage.setItem('theme', next)
            document.documentElement.dataset.theme = next
          }}
          onLogout={handleLogout}
        />
        <AlertsStack alerts={alerts} onClose={(id) => setAlerts((prev) => prev.filter((item) => item.id !== id))} />
        <div className="content">{contentByKey[active] || null}</div>
      </div>

      <Modal open={modal?.type === 'create'} title="Добавить" onClose={() => setModal(null)}>
        <form className="modal-form" onSubmit={handleCreate}>
          <label className="field">
            <span>Тип</span>
            <select name="entity" value={createEntity} onChange={(event) => setModal((prev) => ({ ...prev, entity: event.target.value }))}>
              <option value="income">Доход</option>
              <option value="expense">Расход</option>
              <option value="category">Категория</option>
            </select>
          </label>
          {createEntity === 'category' ? (
            <>
              <label className="field"><span>Название</span><input name="name" required /></label>
              <label className="field"><span>Тип</span><select name="type"><option value="income">Доход</option><option value="expense">Расход</option></select></label>
              <label className="field"><span>Цвет</span><input name="color" /></label>
              <label className="field"><span>Иконка</span><input name="icon" /></label>
            </>
          ) : (
            <>
              <label className="field"><span>Сумма</span><input name="amount" type="number" step="0.01" min="0" required /></label>
              <label className="field"><span>Категория</span><select name="category_id" required>{createCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="field"><span>Дата</span><input name="date" type="date" /></label>
              <label className="field"><span>Валюта</span><input name="currency" defaultValue={settings.base_currency} /></label>
              <label className="field"><span>Комментарий</span><input name="note" /></label>
            </>
          )}
          <button className="primary" type="submit">Сохранить</button>
        </form>
      </Modal>

      <Modal open={modal?.type === 'category-edit'} title="Редактировать категорию" onClose={() => setModal(null)}>
        <form className="modal-form" onSubmit={handleUpdateCategory}>
          <input type="hidden" name="category_id" value={modal?.data?.id || ''} />
          <label className="field"><span>Название</span><input name="name" required defaultValue={modal?.data?.name || ''} /></label>
          <label className="field"><span>Тип</span><select name="type" defaultValue={modal?.data?.type || 'expense'}><option value="income">Доход</option><option value="expense">Расход</option></select></label>
          <label className="field"><span>Цвет</span><input name="color" defaultValue={modal?.data?.color || ''} /></label>
          <label className="field"><span>Иконка</span><input name="icon" defaultValue={modal?.data?.icon || ''} /></label>
          <button className="primary" type="submit">Сохранить</button>
        </form>
      </Modal>

      <Modal open={modal?.type === 'income-edit'} title="Редактировать доход" onClose={() => setModal(null)}>
        <form className="modal-form" onSubmit={handleUpdateIncome}>
          <input type="hidden" name="income_id" value={modal?.data?.id || ''} />
          <label className="field"><span>Сумма</span><input name="amount" type="number" step="0.01" min="0" defaultValue={modal?.data?.amount || ''} required /></label>
          <label className="field"><span>Категория</span><select name="category_id" defaultValue={modal?.data?.category_id || ''}>{incomeCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="field"><span>Дата</span><input name="date" type="date" defaultValue={modal?.data?.date || ''} /></label>
          <label className="field"><span>Валюта</span><input name="currency" defaultValue={modal?.data?.currency || settings.base_currency} /></label>
          <label className="field"><span>Комментарий</span><input name="note" defaultValue={modal?.data?.note || ''} /></label>
          <button className="primary" type="submit">Сохранить</button>
        </form>
      </Modal>

      <Modal open={modal?.type === 'expense-edit'} title="Редактировать расход" onClose={() => setModal(null)}>
        <form className="modal-form" onSubmit={handleUpdateExpense}>
          <input type="hidden" name="expense_id" value={modal?.data?.id || ''} />
          <label className="field"><span>Сумма</span><input name="amount" type="number" step="0.01" min="0" defaultValue={modal?.data?.amount || ''} required /></label>
          <label className="field"><span>Категория</span><select name="category_id" defaultValue={modal?.data?.category_id || ''}>{expenseCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="field"><span>Дата</span><input name="date" type="date" defaultValue={modal?.data?.date || ''} /></label>
          <label className="field"><span>Валюта</span><input name="currency" defaultValue={modal?.data?.currency || settings.base_currency} /></label>
          <label className="field"><span>Комментарий</span><input name="note" defaultValue={modal?.data?.note || ''} /></label>
          <button className="primary" type="submit">Сохранить</button>
        </form>
      </Modal>

      <Modal open={modal?.type === 'limit'} title="Лимит" onClose={() => setModal(null)}>
        <form className="modal-form" onSubmit={saveLimit}>
          <label className="field"><span>Категория</span><select name="category_id" required>{expenseCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="field"><span>Лимит на месяц</span><input name="monthly_limit" type="number" step="0.01" min="0" required /></label>
          <button className="primary" type="submit">Сохранить</button>
        </form>
      </Modal>
    </div>
  )
}
