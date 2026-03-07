import { useEffect, useMemo, useState } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import { toMoney } from '../api.js'
import SectionHeader from '../shared/ui/SectionHeader.jsx'
import EmptyState from '../shared/ui/EmptyState.jsx'

function budgetStatus(row) {
  const plan = Number(row?.planned_expense || 0)
  const fact = Number(row?.actual_expense || 0)
  if (plan <= 0) return { label: 'нет плана', tone: 'neutral' }
  const ratio = fact / plan
  if (ratio <= 1) return { label: 'в рамках', tone: 'safe' }
  if (ratio <= 1.15) return { label: 'риск', tone: 'warning' }
  return { label: 'перерасход', tone: 'danger' }
}

const formatCompactMoney = (value) => new Intl.NumberFormat('ru-RU', {
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1
}).format(Number(value || 0))

export default function AnalyticsPage({
  tabs,
  activeTab,
  setActiveTab,
  analyticsWindow,
  setAnalyticsWindow,
  onRefresh,
  summaryValues,
  savingsRate,
  burnRate,
  monthLabels,
  monthMap,
  latestCategorySpend,
  budgetVsActual,
  forecast,
  recommendations,
  baselineMonthly,
  dataQuality,
  aiRecommendationsText,
  aiRecommendationsLoading,
  onFixDataQuality,
  onGenerateAiRecommendations,
  runScenario
}) {
  const [monthlyMode, setMonthlyMode] = useState('line')
  const [showProfit, setShowProfit] = useState(true)
  const [showBudget, setShowBudget] = useState(false)

  const [scenarioInput, setScenarioInput] = useState({ income_change_pct: 0, expense_change_pct: 10 })
  const [scenarioResult, setScenarioResult] = useState(null)
  const [scenarioLoading, setScenarioLoading] = useState(false)

  const forecastIncome = forecast?.series?.income || []
  const forecastExpense = forecast?.series?.expense || []
  const nextIncome = forecastIncome[0]?.prediction || 0
  const nextExpense = forecastExpense[0]?.prediction || 0
  const nextProfit = nextIncome - nextExpense

  const recommendationItems = recommendations?.recommendations || []

  const budgetMap = useMemo(() => {
    const map = new Map()
    ;(budgetVsActual || []).forEach((row) => map.set(row.month, row))
    return map
  }, [budgetVsActual])

  const monthlyRows = useMemo(() => {
    return monthLabels.map((month) => {
      const income = Number(monthMap[month]?.income || 0)
      const expense = Number(monthMap[month]?.expense || 0)
      const profit = income - expense
      const budget = budgetMap.get(month)
      return {
        month,
        income,
        expense,
        profit,
        plannedIncome: Number(budget?.planned_income || 0),
        plannedExpense: Number(budget?.planned_expense || 0)
      }
    })
  }, [monthLabels, monthMap, budgetMap])

  const topSpend = useMemo(() => (
    Object.entries(latestCategorySpend || {})
      .map(([name, value]) => ({ name, value: Number(value || 0) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  ), [latestCategorySpend])

  const maxSpend = topSpend[0]?.value || 1

  const bestProfit = useMemo(() => {
    if (!monthlyRows.length) return null
    return monthlyRows.reduce((best, row) => (best === null || row.profit > best.profit ? row : best), null)
  }, [monthlyRows])

  const worstProfit = useMemo(() => {
    if (!monthlyRows.length) return null
    return monthlyRows.reduce((worst, row) => (worst === null || row.profit < worst.profit ? row : worst), null)
  }, [monthlyRows])

  const baseChartOptions = {
    maintainAspectRatio: false,
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', labels: { color: '#cbd5e1', boxWidth: 18, boxHeight: 6, usePointStyle: true } },
      tooltip: {
        backgroundColor: '#0b1220',
        borderColor: 'rgba(148,163,184,0.35)',
        borderWidth: 1,
        padding: 12,
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${toMoney(ctx.raw)}` }
      }
    },
    elements: { line: { tension: 0.35, borderWidth: 3 }, point: { radius: 3, hoverRadius: 5 } },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
      y: {
        ticks: { color: '#94a3b8', callback: (value) => formatCompactMoney(value) },
        grid: { color: 'rgba(148,163,184,0.1)' }
      }
    }
  }

  const barOptions = {
    ...baseChartOptions,
    elements: { ...baseChartOptions.elements, bar: { borderRadius: 8, maxBarThickness: 34 } }
  }

  const monthlyDatasets = [
    { label: 'Выручка', data: monthlyRows.map((row) => row.income), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.28)', fill: monthlyMode === 'line' },
    { label: 'Затраты', data: monthlyRows.map((row) => row.expense), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.28)', fill: monthlyMode === 'line' }
  ]

  if (showProfit) {
    monthlyDatasets.push({
      label: 'Прибыль',
      data: monthlyRows.map((row) => row.profit),
      borderColor: '#60a5fa',
      backgroundColor: 'rgba(96,165,250,0.22)',
      borderDash: monthlyMode === 'line' ? [7, 5] : undefined,
      fill: false
    })
  }

  if (showBudget) {
    monthlyDatasets.push(
      { label: 'План дохода', data: monthlyRows.map((row) => row.plannedIncome), borderColor: '#86efac', backgroundColor: 'rgba(134,239,172,0.2)', borderDash: monthlyMode === 'line' ? [4, 4] : undefined, fill: false },
      { label: 'План расхода', data: monthlyRows.map((row) => row.plannedExpense), borderColor: '#fda4af', backgroundColor: 'rgba(253,164,175,0.2)', borderDash: monthlyMode === 'line' ? [4, 4] : undefined, fill: false }
    )
  }

  useEffect(() => {
    let alive = true
    const load = async () => {
      if (!runScenario) return
      setScenarioLoading(true)
      try {
        const res = await runScenario(scenarioInput)
        if (alive) setScenarioResult(res)
      } finally {
        if (alive) setScenarioLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [runScenario, scenarioInput])

  return (
    <section>
      <SectionHeader
        title="Аналитика и решения"
        subtitle="Единый центр: динамика, бюджет, прогноз, сценарии и контроль качества данных"
        actions={
          <div className="section-actions">
            <select value={analyticsWindow} onChange={(event) => setAnalyticsWindow(event.target.value)}>
              <option value="3">3 месяца</option>
              <option value="6">6 месяцев</option>
              <option value="12">12 месяцев</option>
              <option value="all">Все</option>
            </select>
            <button className="ghost" onClick={onRefresh}>Обновить</button>
          </div>
        }
      />

      <div className="insights-hero">
        <article className="insights-kpi"><span>Выручка</span><strong className="tone-income">{toMoney(summaryValues.income)}</strong></article>
        <article className="insights-kpi"><span>Затраты</span><strong className="tone-expense">{toMoney(summaryValues.expense)}</strong></article>
        <article className="insights-kpi"><span>Прибыль</span><strong>{toMoney(summaryValues.balance)}</strong></article>
        <article className="insights-kpi"><span>Savings / Burn</span><strong>{savingsRate.toFixed(1)}% / {burnRate.toFixed(1)}%</strong></article>
      </div>

      <div className="analytics-tabs sticky-tabs">
        {tabs.map((tab) => (
          <button key={tab.key} className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div className="grid-cards insights-summary-grid">
          <div className="card">
            <h3>Финансовый баланс</h3>
            {monthLabels.length === 0 ? (
              <EmptyState title="Нет данных" description="Добавьте операции для построения графика" />
            ) : (
              <div className="chart-wrap chart-md">
                <Line options={baseChartOptions} data={{ labels: monthLabels, datasets: [
                  { label: 'Выручка', data: monthLabels.map((key) => monthMap[key]?.income || 0), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.12)', fill: true },
                  { label: 'Затраты', data: monthLabels.map((key) => monthMap[key]?.expense || 0), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.12)', fill: true }
                ] }} />
              </div>
            )}
          </div>
          <div className="card">
            <h3>Качество данных</h3>
            <p>Доходы без категории: <strong>{dataQuality?.issues?.uncategorized_income ?? 0}</strong></p>
            <p>Затраты без категории: <strong>{dataQuality?.issues?.uncategorized_expense ?? 0}</strong></p>
            <p>Доходы без подразделения: <strong>{dataQuality?.issues?.missing_income_department ?? 0}</strong></p>
            <p>Затраты без подразделения: <strong>{dataQuality?.issues?.missing_expense_department ?? 0}</strong></p>
            <p>Всего проблем: <strong>{dataQuality?.total_issues ?? 0}</strong></p>
            <button className="ghost" onClick={onFixDataQuality}>Исправить автоматически</button>
          </div>
        </div>
      )}

      {activeTab === 'monthly' && (
        <div className="card">
          {monthLabels.length === 0 ? (
            <EmptyState title="Нет данных" description="Добавьте операции для построения графика" />
          ) : (
            <>
              <div className="monthly-controls">
                <div className="mode-switch">
                  <button className={`ghost ${monthlyMode === 'line' ? 'active' : ''}`} onClick={() => setMonthlyMode('line')}>Линия</button>
                  <button className={`ghost ${monthlyMode === 'bar' ? 'active' : ''}`} onClick={() => setMonthlyMode('bar')}>Столбцы</button>
                </div>
                <label className="check-pill"><input type="checkbox" checked={showProfit} onChange={(e) => setShowProfit(e.target.checked)} />Показывать прибыль</label>
                <label className="check-pill"><input type="checkbox" checked={showBudget} onChange={(e) => setShowBudget(e.target.checked)} />Показывать план/факт</label>
              </div>

              <div className="monthly-highlights">
                <div className="highlight-item"><span>Макс прибыль</span><strong>{bestProfit ? `${bestProfit.month} · ${toMoney(bestProfit.profit)}` : '—'}</strong></div>
                <div className="highlight-item"><span>Мин прибыль</span><strong>{worstProfit ? `${worstProfit.month} · ${toMoney(worstProfit.profit)}` : '—'}</strong></div>
              </div>

              <div className="chart-wrap chart-lg">
                {monthlyMode === 'line'
                  ? <Line options={baseChartOptions} data={{ labels: monthLabels, datasets: monthlyDatasets }} />
                  : <Bar options={barOptions} data={{ labels: monthLabels, datasets: monthlyDatasets }} />}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'budget' && (
        <div className="grid-cards insights-summary-grid">
          <div className="card table-card">
            {(budgetVsActual || []).length === 0 ? <EmptyState title="Нет данных бюджета" description="Сравнение появится после заполнения бюджета" /> : (
              <table>
                <thead><tr><th>Месяц</th><th>План дохода</th><th>Факт дохода</th><th>План расхода</th><th>Факт расхода</th><th>Статус</th></tr></thead>
                <tbody>
                  {budgetVsActual.map((row) => {
                    const status = budgetStatus(row)
                    return (
                      <tr key={row.month}>
                        <td data-label="Месяц">{row.month}</td>
                        <td data-label="План дохода">{toMoney(row.planned_income)}</td>
                        <td data-label="Факт дохода">{toMoney(row.actual_income)}</td>
                        <td data-label="План расхода">{toMoney(row.planned_expense)}</td>
                        <td data-label="Факт расхода">{toMoney(row.actual_expense)}</td>
                        <td data-label="Статус"><span className={`status-badge ${status.tone}`}>{status.label}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="card table-card">
            <h3>Baseline-метрики по месяцам</h3>
            {!(baselineMonthly || []).length ? <EmptyState title="Нет baseline" description="Появится после данных операций" /> : (
              <table>
                <thead><tr><th>Месяц</th><th>Margin</th><th>Burn</th><th>Откл. бюджета</th></tr></thead>
                <tbody>
                  {baselineMonthly.map((row) => (
                    <tr key={row.month}>
                      <td data-label="Месяц">{row.month}</td>
                      <td data-label="Margin">{row.profit_margin_pct}%</td>
                      <td data-label="Burn">{row.burn_rate_pct}%</td>
                      <td data-label="Откл. бюджета">{toMoney(row.budget_deviation)} ({row.budget_deviation_pct}%)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="grid-cards insights-summary-grid">
          <div className="card">
            <h3>Прогноз и управленческие выводы</h3>
            {forecast?.series ? (
              <>
                <p>Ожидаемая выручка (след. месяц): <strong className="tone-income">{toMoney(nextIncome)}</strong></p>
                <p>Ожидаемые затраты (след. месяц): <strong className="tone-expense">{toMoney(nextExpense)}</strong></p>
                <p>Ожидаемая прибыль: <strong>{toMoney(nextProfit)}</strong></p>
                <p className="hint">Уверенность модели: {forecast?.confidence || 'unknown'}</p>
              </>
            ) : (
              <EmptyState title="Недостаточно данных для прогноза" description={forecast?.message || 'Добавьте операции минимум в двух разных месяцах'} />
            )}

            <h3>Управленческий сценарий</h3>
            <div className="table-controls">
              <label className="field compact">
                <span>Изменение доходов, %</span>
                <input type="number" value={scenarioInput.income_change_pct} onChange={(e) => setScenarioInput((p) => ({ ...p, income_change_pct: Number(e.target.value) }))} />
              </label>
              <label className="field compact">
                <span>Изменение затрат, %</span>
                <input type="number" value={scenarioInput.expense_change_pct} onChange={(e) => setScenarioInput((p) => ({ ...p, expense_change_pct: Number(e.target.value) }))} />
              </label>
            </div>
            {scenarioLoading ? <p className="hint">Расчёт сценария...</p> : scenarioResult ? (
              <>
                <p>Базовая прибыль: <strong>{toMoney(scenarioResult.base.profit)}</strong></p>
                <p>Прибыль по сценарию: <strong>{toMoney(scenarioResult.scenario.profit)}</strong></p>
                <p>Изменение прибыли: <strong>{toMoney(scenarioResult.delta.profit)}</strong></p>
              </>
            ) : null}
          </div>

          <div className="card">
            <h3>Рекомендации</h3>
            {recommendationItems.length === 0 ? (
              <EmptyState title="Нет рекомендаций" description="Добавьте данные по операциям и бюджетам" />
            ) : (
              <div className="recommendation-grid">
                {recommendationItems.map((item, index) => (
                  <article key={`${item}-${index}`} className="recommendation-card">
                    <span className="recommendation-index">{String(index + 1).padStart(2, '0')}</span>
                    <p>{item}</p>
                  </article>
                ))}
              </div>
            )}

            <h3>Топ затрат</h3>
            {topSpend.length === 0 ? (
              <p className="hint">Нет данных по расходам</p>
            ) : (
              <div className="spend-bars">
                {topSpend.map((item) => (
                  <div key={item.name} className="spend-row">
                    <div className="spend-row-head"><span>{item.name}</span><strong>{toMoney(item.value)}</strong></div>
                    <div className="spend-progress"><div style={{ width: `${Math.max(6, (item.value / maxSpend) * 100)}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'ai_recommendations' && (
        <div className="grid-cards insights-summary-grid">
          <div className="card">
            <h3>AI-анализ и рекомендации руководителю</h3>
            <p className="hint">Модель анализирует уже рассчитанные показатели и формирует управленческие выводы.</p>
            <button className="primary" onClick={onGenerateAiRecommendations} disabled={aiRecommendationsLoading}>
              {aiRecommendationsLoading ? 'Генерация...' : 'Сгенерировать AI-рекомендации'}
            </button>
          </div>
          <div className="card">
            <h3>Результат</h3>
            {!aiRecommendationsText ? (
              <EmptyState title="Нет результата" description="Нажмите кнопку генерации, чтобы получить текст от модели" />
            ) : (
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                {aiRecommendationsText}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
