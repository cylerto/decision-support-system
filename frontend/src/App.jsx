import './App.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { api, configureFormatting } from './api.js'
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
import OperationsPage from './pages/OperationsPage.jsx'
import AnalyticsPage from './pages/AnalyticsPage.jsx'
import DirectoriesPage from './pages/DirectoriesPage.jsx'
import SystemHubPage from './pages/SystemHubPage.jsx'

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

async function safeForecastLoad(months) {
  try {
    return await api.getForecastSeries(months)
  } catch (error) {
    if (error?.status === 400) return { message: error.message, series: null }
    throw error
  }
}

function cleanAiText(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`/g, '')
    .replace(/[*_~]/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function parseAiRecommendations(text) {
  if (!text) return []
  return cleanAiText(text)
    .split(/\n{2,}/)
    .map((item) => item.replace(/\n/g, ' ').trim())
    .filter(Boolean)
}

function detectTone(text) {
  const lower = String(text || '').toLowerCase()
  if (/(крит|убыт|дефицит|риск|паден|перерасход|сниж|просроч)/.test(lower)) return 'danger'
  if (/(контрол|оптимиз|огранич|пересмотр|внимани|монитор)/.test(lower)) return 'warning'
  return 'success'
}

const defaultOperationFilter = {
  dateFrom: '',
  dateTo: '',
  departmentId: '',
  projectId: '',
  sortBy: 'date',
  sortDir: 'desc',
  page: 1,
  pageSize: 10
}

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()

  const [active, setActive] = useState('dashboard')
  const [operationsTab, setOperationsTab] = useState(() => localStorage.getItem('dss.operationsTab') || 'income')
  const [analyticsTab, setAnalyticsTab] = useState('summary')
  const [analyticsWindow, setAnalyticsWindow] = useState('6')
  const [authed, setAuthed] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [profile, setProfile] = useState({ username: '', password: '' })
  const [modal, setModal] = useState(null)
  const [theme, setTheme] = useState('dark')
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState({})

  const [categories, setCategories] = useState([])
  const [allCategories, setAllCategories] = useState([])
  const [directories, setDirectories] = useState({ departments: [], projects: [] })
  const [income, setIncome] = useState([])
  const [expense, setExpense] = useState([])
  const [audit, setAudit] = useState([])

  const [categoriesMeta, setCategoriesMeta] = useState({ total: 0, page: 1, page_size: 10 })
  const [incomeMeta, setIncomeMeta] = useState({ total: 0, page: 1, page_size: 10 })
  const [expenseMeta, setExpenseMeta] = useState({ total: 0, page: 1, page_size: 10 })

  const [summary, setSummary] = useState(null)
  const [monthly, setMonthly] = useState(null)
  const [categoriesMonthly, setCategoriesMonthly] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [recommendations, setRecommendations] = useState(null)
  const [baselineMonthly, setBaselineMonthly] = useState([])
  const [dataQuality, setDataQuality] = useState(null)
  const [kpi, setKpi] = useState(null)
  const [aiRecommendationsText, setAiRecommendationsText] = useState('')
  const [aiRecommendationsLoading, setAiRecommendationsLoading] = useState(false)
  const [lastAiSignature, setLastAiSignature] = useState('')

  const [categoryFilter, setCategoryFilter] = useState(() => readStoredJson('dss.categoryFilter', { search: '', type: '', page: 1, pageSize: 10 }))
  const [incomeFilter, setIncomeFilter] = useState(() => ({ ...defaultOperationFilter, ...readStoredJson('dss.incomeFilter', {}) }))
  const [expenseFilter, setExpenseFilter] = useState(() => ({ ...defaultOperationFilter, ...readStoredJson('dss.expenseFilter', {}) }))

  const categoryMap = useMemo(() => new Map(allCategories.map((item) => [item.id, item])), [allCategories])
  const directoriesMap = useMemo(() => ({
    departments: new Map((directories.departments || []).map((item) => [item.id, item])),
    projects: new Map((directories.projects || []).map((item) => [item.id, item]))
  }), [directories])
  const incomeCategories = allCategories.filter((item) => item.type === 'income')
  const expenseCategories = allCategories.filter((item) => item.type === 'expense')

  const refreshCategoryCatalog = () => guard('categoryCatalog', async () => {
    const data = await api.getCategories({ page: 1, page_size: 500 })
    setAllCategories(data.items ?? data)
  })

  const refreshDirectories = () => guard('directories', async () => {
    const [departments, projects] = await Promise.all([
      api.getDirectories('departments'),
      api.getDirectories('projects')
    ])
    setDirectories({ departments, projects })
  })

  const setBusy = useCallback((key, value) => {
    setLoading((prev) => ({ ...prev, [key]: value }))
  }, [])

  const addAlert = useCallback((message, tone = 'warning') => {
    setAlerts((prev) => [...prev, { id: Date.now() + Math.random(), message, tone }])
  }, [])

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
      department_id: incomeFilter.departmentId || undefined,
      project_id: incomeFilter.projectId || undefined,
      sort_by: incomeFilter.sortBy || 'date',
      sort_dir: incomeFilter.sortDir || 'desc',
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
      department_id: expenseFilter.departmentId || undefined,
      project_id: expenseFilter.projectId || undefined,
      sort_by: expenseFilter.sortBy || 'date',
      sort_dir: expenseFilter.sortDir || 'desc',
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
    const [summaryData, monthlyData, categoriesMonthlyData, recommendationsData, forecastData, baselineData, qualityData, kpiData, formatData] = await Promise.all([
      api.getSummary(),
      api.getMonthly(),
      api.getCategoriesMonthly(),
      api.getRecommendations(),
      safeForecastLoad(6),
      api.getBaselineMonthly(),
      api.getDataQuality(),
      api.getKpi(),
      api.getFormatSettings()
    ])
    setSummary(summaryData)
    setMonthly(monthlyData)
    setCategoriesMonthly(categoriesMonthlyData)
    setRecommendations(recommendationsData)
    setForecast(forecastData)
    setBaselineMonthly(baselineData || [])
    setDataQuality(qualityData || null)
    setKpi(kpiData)
    configureFormatting(formatData || {})
  })

  const refreshAudit = () => guard('audit', async () => {
    const data = await api.getAudit({ page: 1, page_size: 10 })
    setAudit(data || [])
  })

  const refreshAll = async () => {
    await Promise.all([
      refreshCategories(),
      refreshCategoryCatalog(),
      refreshDirectories(),
      refreshIncome(),
      refreshExpense(),
      refreshCore(),
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
      if (key === 'income' || key === 'expense') {
        setOperationsTab(key)
        setActive('operations')
        return
      }
      if (key === 'categories' || key === 'departments' || key === 'projects') {
        setActive('structure')
        return
      }
      if (key === 'system' || key === 'data' || key === 'history' || key === 'settings') {
        setActive('system')
        return
      }
      if (key === 'analytics_monthly' || key === 'analytics_structure' || key === 'forecast' || key === 'recommendations') {
        setActive('analytics')
        return
      }
      setActive(key)
      return
    }
    if (location.pathname === '/' || location.pathname === '') {
      setActive('dashboard')
      return
    }
    if (authed) navigate(ROUTE_BY_KEY.dashboard, { replace: true })
  }, [location.pathname, authed, navigate])

  useEffect(() => {
    const tabBySection = {
      analytics: 'summary',
      analytics_monthly: 'monthly',
      analytics_structure: 'insights',
      forecast: 'insights',
      recommendations: 'insights'
    }
    const nextTab = tabBySection[active]
    if (nextTab) setAnalyticsTab(nextTab)
  }, [active])

  useEffect(() => localStorage.setItem('dss.categoryFilter', JSON.stringify(categoryFilter)), [categoryFilter])
  useEffect(() => localStorage.setItem('dss.incomeFilter', JSON.stringify(incomeFilter)), [incomeFilter])
  useEffect(() => localStorage.setItem('dss.expenseFilter', JSON.stringify(expenseFilter)), [expenseFilter])
  useEffect(() => localStorage.setItem('dss.operationsTab', operationsTab), [operationsTab])

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
          type: event.target.type.value
        })
        await refreshCategories()
        await refreshCategoryCatalog()
        await refreshAudit()
        setModal(null)
        addAlert('Категория добавлена', 'success')
      })
      return
    }

    const department_id = await ensureDirectoryId('departments', event.target.department_name?.value)
    const project_id = await ensureDirectoryId('projects', event.target.project_name?.value)
    if (!department_id) {
      addAlert('Подразделение обязательно', 'danger')
      return
    }
    if (!event.target.date.value) {
      addAlert('Дата обязательна', 'danger')
      return
    }
    const payload = {
      amount: Number(event.target.amount.value),
      category_id: Number(event.target.category_id.value),
      date: event.target.date.value,
      note: event.target.note.value || undefined,
      department_id,
      project_id
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
        type: event.target.type.value
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
    const department_id = await ensureDirectoryId('departments', event.target.department_name?.value)
    const project_id = await ensureDirectoryId('projects', event.target.project_name?.value)
    if (!department_id) {
      addAlert('Подразделение обязательно', 'danger')
      return
    }
    if (!event.target.date.value) {
      addAlert('Дата обязательна', 'danger')
      return
    }
    await guard('income', async () => {
      await api.updateIncome(id, {
        amount: Number(event.target.amount.value),
        category_id: Number(event.target.category_id.value),
        date: event.target.date.value,
        note: event.target.note.value || undefined,
        department_id,
        project_id
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
    const department_id = await ensureDirectoryId('departments', event.target.department_name?.value)
    const project_id = await ensureDirectoryId('projects', event.target.project_name?.value)
    if (!department_id) {
      addAlert('Подразделение обязательно', 'danger')
      return
    }
    if (!event.target.date.value) {
      addAlert('Дата обязательна', 'danger')
      return
    }
    await guard('expense', async () => {
      await api.updateExpense(id, {
        amount: Number(event.target.amount.value),
        category_id: Number(event.target.category_id.value),
        date: event.target.date.value,
        note: event.target.note.value || undefined,
        department_id,
        project_id
      })
      await refreshExpense()
      await refreshCore()
      await refreshAudit()
      setModal(null)
      addAlert('Расход обновлен', 'success')
    })
  }

  const askDeleteConfirm = (message) => (
    new Promise((resolve) => {
      setModal({
        type: 'confirm-delete',
        title: 'Подтвердите удаление',
        message,
        resolve
      })
    })
  )

  const closeDeleteConfirm = (confirmed) => {
    if (modal?.type === 'confirm-delete' && typeof modal.resolve === 'function') {
      modal.resolve(Boolean(confirmed))
    }
    setModal(null)
  }

  const createDirectory = (kind, name) => guard('directories', async () => {
    await api.addDirectory(kind, { name })
    await refreshDirectories()
    await refreshAudit()
    addAlert('Справочник обновлен', 'success')
  })

  const normalizeName = (value) => (value || '').trim().toLowerCase()

  const ensureDirectoryId = async (kind, rawValue) => {
    const value = (rawValue || '').trim()
    if (!value) return undefined

    const existing = (directories[kind] || []).find((item) => normalizeName(item.name) === normalizeName(value))
    if (existing) return existing.id

    try {
      const created = await api.addDirectory(kind, { name: value })
      await refreshDirectories()
      await refreshAudit()
      addAlert(`Элемент справочника добавлен: ${value}`, 'success')
      return created?.id
    } catch (error) {
      await refreshDirectories()
      const retry = (directories[kind] || []).find((item) => normalizeName(item.name) === normalizeName(value))
      if (retry) return retry.id
      throw error
    }
  }

  const updateDirectory = (kind, id, name) => guard('directories', async () => {
    await api.updateDirectory(kind, id, { name })
    await refreshDirectories()
    await refreshAudit()
    addAlert('Справочник обновлен', 'success')
  })

  const deleteDirectory = (kind, id) => guard('directories', async () => {
    const confirmed = await askDeleteConfirm('Удалить элемент справочника?')
    if (!confirmed) return
    try {
      await api.deleteDirectory(kind, id)
    } catch (error) {
      if (error?.payload?.code === 'DIRECTORY_IN_USE') {
        const usage = error?.payload?.details?.usage || {}
        const incomeCount = Number(usage.income || 0)
        const expenseCount = Number(usage.expense || 0)
        const total = Number(error?.payload?.details?.total_operations || (incomeCount + expenseCount))
        addAlert(
          `Удаление невозможно: элемент используется в ${total} операциях (доходы: ${incomeCount}, расходы: ${expenseCount}).`,
          'danger'
        )
        return
      }
      throw error
    }
    await refreshDirectories()
    await refreshAudit()
    addAlert('Элемент удален', 'success')
  })

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
    const confirmed = await askDeleteConfirm('Удалить статью P&L?')
    if (!confirmed) return
    await api.deleteCategory(id)
    await refreshCategories()
    await refreshCategoryCatalog()
    await refreshAudit()
    addAlert('Категория удалена', 'success')
  })

  const removeIncome = (id) => guard('income', async () => {
    const confirmed = await askDeleteConfirm('Удалить операцию выручки?')
    if (!confirmed) return
    await api.deleteIncome(id)
    await refreshIncome()
    await refreshCore()
    await refreshAudit()
    addAlert('Доход удален', 'success')
  })

  const removeExpense = (id) => guard('expense', async () => {
    const confirmed = await askDeleteConfirm('Удалить операцию затрат?')
    if (!confirmed) return
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

  const latestCategorySpend = categoriesMonthly?.[latestMonthKey] || {}
  const systemAlerts = [...(recommendations?.alerts || [])]

  const remainingToMonthEnd = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7)
    const current = monthMap[currentMonth]
    if (!current) return 0
    return Number((current.income || 0) - (current.expense || 0))
  }, [monthMap])

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

  const aiPayload = useMemo(() => ({
    summary: summaryValues,
    kpi: { savingsRate, burnRate },
    monthly: scopedMonthLabels.map((month) => ({
      month,
      income: Number(monthMap[month]?.income || 0),
      expense: Number(monthMap[month]?.expense || 0),
      profit: Number((monthMap[month]?.income || 0) - (monthMap[month]?.expense || 0))
    })),
    baseline: baselineMonthly,
    forecast: forecast || {},
    existing_recommendations: recommendations || {}
  }), [summaryValues, savingsRate, burnRate, scopedMonthLabels, monthMap, baselineMonthly, forecast, recommendations])

  const requestAiRecommendations = useCallback(async ({ silent = false } = {}) => {
    if (!authed || aiRecommendationsLoading) return
    if (!aiPayload.monthly.length) return

    const signature = JSON.stringify(aiPayload)
    if (silent && signature === lastAiSignature) return

    setAiRecommendationsLoading(true)
    try {
      const result = await api.getAiRecommendations(aiPayload)
      setAiRecommendationsText(result?.recommendations || '')
      setLastAiSignature(signature)
      if (!silent) addAlert('AI-рекомендации обновлены', 'success')
    } catch (error) {
      if (silent) setLastAiSignature(signature)
      if (!silent) addAlert(error.message || 'Ошибка при получении AI-рекомендаций', 'danger')
    } finally {
      setAiRecommendationsLoading(false)
    }
  }, [authed, aiRecommendationsLoading, aiPayload, lastAiSignature, addAlert])

  useEffect(() => {
    if (!authed) return
    if (!aiPayload.monthly.length) return
    const timer = setTimeout(() => {
      requestAiRecommendations({ silent: true })
    }, 700)
    return () => clearTimeout(timer)
  }, [authed, aiPayload, requestAiRecommendations])

  const aiInsights = useMemo(() => {
    const aiPoints = parseAiRecommendations(aiRecommendationsText)
    if (aiPoints.length) {
      return aiPoints.slice(0, 4).map((text) => ({ tone: detectTone(text), text }))
    }

    const detailed = recommendations?.detailed || []
    if (detailed.length) {
      return detailed.map((item) => ({
        tone: item.type === 'alert' ? 'danger' : (item.priority === 'low' ? 'success' : 'warning'),
        text: item.message
      }))
    }
    return (recommendations?.recommendations || []).map((text) => ({ tone: 'warning', text }))
  }, [aiRecommendationsText, recommendations])

  const analyticsView = (
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
      forecast={forecast}
      recommendations={recommendations}
      baselineMonthly={baselineMonthly}
      dataQuality={dataQuality}
      aiRecommendationsText={aiRecommendationsText}
      aiRecommendationsLoading={aiRecommendationsLoading}
      onFixDataQuality={async () => {
        await api.fixDataQualityCategories()
        await refreshCore()
        await refreshIncome()
        await refreshExpense()
        addAlert('Категории и подразделения операций восстановлены', 'success')
      }}
      onGenerateAiRecommendations={() => requestAiRecommendations({ silent: false })}
      runScenario={api.runScenario}
    />
  )

  const incomePageProps = {
    loading: loading.income,
    filter: incomeFilter,
    setFilter: setIncomeFilter,
    income,
    meta: incomeMeta,
    categoryMap,
    directories,
    directoriesMap,
    onOpenCreate: () => setModal({ type: 'create', entity: 'income' }),
    onOpenEdit: (item) => setModal({ type: 'income-edit', data: item }),
    onRemove: removeIncome
  }

  const expensePageProps = {
    loading: loading.expense,
    filter: expenseFilter,
    setFilter: setExpenseFilter,
    expense,
    meta: expenseMeta,
    categoryMap,
    directories,
    directoriesMap,
    onOpenCreate: () => setModal({ type: 'create', entity: 'expense' }),
    onOpenEdit: (item) => setModal({ type: 'expense-edit', data: item }),
    onRemove: removeExpense
  }

  const systemView = (
    <SystemHubPage
      onExportCsv={exportCsv}
      onImportCsv={importCsv}
      rows={audit}
      historyLoading={loading.audit}
      onRefreshHistory={refreshAudit}
    />
  )

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
        systemAlerts={systemAlerts}
        insights={aiInsights}
        forecast={forecast}
        loading={loading.core}
        remainingToMonthEnd={remainingToMonthEnd}
      />
    ),
    operations: (
      <OperationsPage
        activeTab={operationsTab}
        setActiveTab={setOperationsTab}
        incomeProps={incomePageProps}
        expenseProps={expensePageProps}
      />
    ),
    structure: (
      <>
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
        <DirectoriesPage directories={directories} onCreate={createDirectory} onUpdate={updateDirectory} onDelete={deleteDirectory} />
      </>
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
    income: <IncomePage {...incomePageProps} />,
    expense: <ExpensePage {...expensePageProps} />,
    departments: <DirectoriesPage directories={directories} onCreate={createDirectory} onUpdate={updateDirectory} onDelete={deleteDirectory} />,
    projects: <DirectoriesPage directories={directories} onCreate={createDirectory} onUpdate={updateDirectory} onDelete={deleteDirectory} />,
    analytics: analyticsView,
    analytics_monthly: analyticsView,
    analytics_structure: analyticsView,
    forecast: analyticsView,
    recommendations: analyticsView,
    system: systemView,
    data: systemView,
    history: systemView,
    settings: systemView
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

      <Modal open={modal?.type === 'create'} title="Добавить операцию" onClose={() => setModal(null)}>
        <form className="modal-form" onSubmit={handleCreate}>
          <label className="field">
            <span>Тип</span>
            <select name="entity" value={createEntity} onChange={(event) => setModal((prev) => ({ ...prev, entity: event.target.value }))}>
              <option value="income">Выручка</option>
              <option value="expense">Затрата</option>
              <option value="category">Статья P&L</option>
            </select>
          </label>
          {createEntity === 'category' ? (
            <>
              <label className="field"><span>Название</span><input name="name" required /></label>
              <label className="field"><span>Тип</span><select name="type"><option value="income">Выручка</option><option value="expense">Затраты</option></select></label>
            </>
          ) : (
            <>
              <label className="field"><span>Сумма</span><input name="amount" type="number" step="0.01" min="0" required /></label>
              <label className="field"><span>Статья P&L</span><select name="category_id" required>{createCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="field"><span>Подразделение</span><input name="department_name" list="departments-list" placeholder="Введите или выберите" required /></label>
              <label className="field"><span>Проект (опц.)</span><input name="project_name" list="projects-list" placeholder="Введите или выберите" /></label>
              <label className="field"><span>Дата</span><input name="date" type="date" required /></label>
              <label className="field"><span>Комментарий</span><input name="note" /></label>
            </>
          )}
          <button className="primary" type="submit">Сохранить</button>
        </form>
      </Modal>

      <Modal open={modal?.type === 'category-edit'} title="Редактировать статью P&L" onClose={() => setModal(null)}>
        <form className="modal-form" onSubmit={handleUpdateCategory}>
          <input type="hidden" name="category_id" value={modal?.data?.id || ''} />
          <label className="field"><span>Название</span><input name="name" required defaultValue={modal?.data?.name || ''} /></label>
          <label className="field"><span>Тип</span><select name="type" defaultValue={modal?.data?.type || 'expense'}><option value="income">Выручка</option><option value="expense">Затраты</option></select></label>
          <button className="primary" type="submit">Сохранить</button>
        </form>
      </Modal>

      <Modal open={modal?.type === 'income-edit'} title="Редактировать выручку" onClose={() => setModal(null)}>
        <form className="modal-form" onSubmit={handleUpdateIncome}>
          <input type="hidden" name="income_id" value={modal?.data?.id || ''} />
          <label className="field"><span>Сумма</span><input name="amount" type="number" step="0.01" min="0" defaultValue={modal?.data?.amount || ''} required /></label>
          <label className="field"><span>Статья P&L</span><select name="category_id" required defaultValue={modal?.data?.category_id || ''}>{incomeCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="field"><span>Подразделение</span><input name="department_name" list="departments-list" defaultValue={directoriesMap.departments.get(modal?.data?.department_id)?.name || ""} placeholder="Введите или выберите" required /></label>
          <label className="field"><span>Проект (опц.)</span><input name="project_name" list="projects-list" defaultValue={directoriesMap.projects.get(modal?.data?.project_id)?.name || ""} placeholder="Введите или выберите" /></label>
          <label className="field"><span>Дата</span><input name="date" type="date" defaultValue={modal?.data?.date || ''} required /></label>
          <label className="field"><span>Комментарий</span><input name="note" defaultValue={modal?.data?.note || ''} /></label>
          <button className="primary" type="submit">Сохранить</button>
        </form>
      </Modal>

      <Modal open={modal?.type === 'expense-edit'} title="Редактировать затраты" onClose={() => setModal(null)}>
        <form className="modal-form" onSubmit={handleUpdateExpense}>
          <input type="hidden" name="expense_id" value={modal?.data?.id || ''} />
          <label className="field"><span>Сумма</span><input name="amount" type="number" step="0.01" min="0" defaultValue={modal?.data?.amount || ''} required /></label>
          <label className="field"><span>Статья P&L</span><select name="category_id" required defaultValue={modal?.data?.category_id || ''}>{expenseCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="field"><span>Подразделение</span><input name="department_name" list="departments-list" defaultValue={directoriesMap.departments.get(modal?.data?.department_id)?.name || ""} placeholder="Введите или выберите" required /></label>
          <label className="field"><span>Проект (опц.)</span><input name="project_name" list="projects-list" defaultValue={directoriesMap.projects.get(modal?.data?.project_id)?.name || ""} placeholder="Введите или выберите" /></label>
          <label className="field"><span>Дата</span><input name="date" type="date" defaultValue={modal?.data?.date || ''} required /></label>
          <label className="field"><span>Комментарий</span><input name="note" defaultValue={modal?.data?.note || ''} /></label>
          <button className="primary" type="submit">Сохранить</button>
        </form>
      </Modal>

      <datalist id="departments-list">{directories.departments.map((item) => <option key={item.id} value={item.name} />)}</datalist>
      <datalist id="projects-list">{directories.projects.map((item) => <option key={item.id} value={item.name} />)}</datalist>

      <Modal open={modal?.type === 'confirm-delete'} title={modal?.title || 'Подтверждение'} onClose={() => closeDeleteConfirm(false)}>
        <div className="confirm-delete">
          <p>{modal?.message || 'Подтвердите действие'}</p>
          <div className="confirm-delete-actions">
            <button className="ghost" type="button" onClick={() => closeDeleteConfirm(false)}>Отмена</button>
            <button className="ghost danger" type="button" onClick={() => closeDeleteConfirm(true)}>Удалить</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

