import { useEffect, useMemo, useState } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import { toMoney } from '../api.js'
import SectionHeader from '../shared/ui/SectionHeader.jsx'
import EmptyState from '../shared/ui/EmptyState.jsx'

const formatCompactMoney = (value) => new Intl.NumberFormat('ru-RU', {
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1
}).format(Number(value || 0))

function cleanMarkdown(text) {
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

function parseRecommendationText(text) {
  if (!text) return []
  return cleanMarkdown(text)
    .split(/\n{2,}/)
    .map((block) => block.replace(/\n/g, ' ').trim())
    .filter(Boolean)
}

function classifyRecommendation(text) {
  const value = String(text || '').toLowerCase()
  if (/(риск|убыт|крит|сниж|дефицит|перерасход|паден)/.test(value)) return { key: 'risk', label: 'Риск' }
  if (/(рост|возможн|усил|увелич|потенциал|масштаб)/.test(value)) return { key: 'opportunity', label: 'Возможность' }
  return { key: 'action', label: 'Действие' }
}

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
  const [scenarioInput, setScenarioInput] = useState({ income_change_pct: 0, expense_change_pct: 10 })
  const [scenarioResult, setScenarioResult] = useState(null)
  const [scenarioLoading, setScenarioLoading] = useState(false)

  const forecastIncome = forecast?.series?.income || []
  const forecastExpense = forecast?.series?.expense || []
  const nextIncome = forecastIncome[0]?.prediction || 0
  const nextExpense = forecastExpense[0]?.prediction || 0
  const nextProfit = nextIncome - nextExpense

  const baseRecommendations = (recommendations?.recommendations || []).map(cleanMarkdown).filter(Boolean)
  const aiPoints = useMemo(() => parseRecommendationText(aiRecommendationsText), [aiRecommendationsText])
  const recommendationItems = (aiPoints.length ? aiPoints : baseRecommendations)
    .map((text) => ({ text, kind: classifyRecommendation(text) }))
    .slice(0, 8)

  const monthlyRows = useMemo(() => (
    monthLabels.map((month) => {
      const income = Number(monthMap[month]?.income || 0)
      const expense = Number(monthMap[month]?.expense || 0)
      return { month, income, expense, profit: income - expense }
    })
  ), [monthLabels, monthMap])

  const bestProfit = useMemo(() => monthlyRows.reduce((best, row) => (best === null || row.profit > best.profit ? row : best), null), [monthlyRows])
  const worstProfit = useMemo(() => monthlyRows.reduce((worst, row) => (worst === null || row.profit < worst.profit ? row : worst), null), [monthlyRows])

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
    elements: { line: { tension: 0.35, borderWidth: 3.5 }, point: { radius: 3.2, hoverRadius: 6 } },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.08)' } },
      y: {
        ticks: { color: '#94a3b8', callback: (value) => formatCompactMoney(value) },
        grid: { color: 'rgba(148,163,184,0.08)' }
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
        subtitle="Финансовая динамика, прогноз, AI-рекомендации и сценарный анализ"
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
        <article className="insights-kpi insights-kpi-main"><span>Прибыль</span><strong>{toMoney(summaryValues.balance)}</strong></article>
        <article className="insights-kpi"><span>Рентабельность / Темп затрат</span><strong>{savingsRate.toFixed(1)}% / {burnRate.toFixed(1)}%</strong></article>
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
            {monthLabels.length === 0 ? <EmptyState title="Нет данных" description="Добавьте операции для построения графика" /> : (
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

          <div className="card table-card">
            <h3>Базовые метрики по месяцам</h3>
            {!(baselineMonthly || []).length ? <EmptyState title="Нет baseline-данных" description="Появятся после добавления операций" /> : (
              <table>
                <thead><tr><th>Месяц</th><th>Рентабельность</th><th>Темп расходов</th><th>Отклонение бюджета</th></tr></thead>
                <tbody>
                  {baselineMonthly.map((row) => (
                    <tr key={row.month}>
                      <td data-label="Месяц">{row.month}</td>
                      <td data-label="Рентабельность">{row.profit_margin_pct}%</td>
                      <td data-label="Темп расходов">{row.burn_rate_pct}%</td>
                      <td data-label="Отклонение бюджета">{toMoney(row.budget_deviation)} ({row.budget_deviation_pct}%)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'monthly' && (
        <div className="card">
          {monthLabels.length === 0 ? <EmptyState title="Нет данных" description="Добавьте операции для построения графика" /> : (
            <>
              <div className="monthly-controls">
                <div className="mode-switch">
                  <button className={`ghost ${monthlyMode === 'line' ? 'active' : ''}`} onClick={() => setMonthlyMode('line')}>Линия</button>
                  <button className={`ghost ${monthlyMode === 'bar' ? 'active' : ''}`} onClick={() => setMonthlyMode('bar')}>Столбцы</button>
                </div>
                <label className="check-pill"><input type="checkbox" checked={showProfit} onChange={(e) => setShowProfit(e.target.checked)} />Показывать прибыль</label>
              </div>
              <div className="monthly-highlights">
                <div className="highlight-item"><span>Лучший месяц</span><strong>{bestProfit ? `${bestProfit.month} - ${toMoney(bestProfit.profit)}` : '—'}</strong></div>
                <div className="highlight-item"><span>Худший месяц</span><strong>{worstProfit ? `${worstProfit.month} - ${toMoney(worstProfit.profit)}` : '—'}</strong></div>
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

      {activeTab === 'insights' && (
        <div className="grid-cards insights-summary-grid">
          <div className="card forecast-layout">
            <div className="forecast-head">
              <h3>Прогноз и управленческие сценарии</h3>
              <span className="hint">Уверенность модели: {forecast?.confidence || 'нет данных'}</span>
            </div>

            {forecast?.series ? (
              <div className="forecast-kpis">
                <article className="forecast-kpi income"><span>Ожидаемая выручка (след. месяц)</span><strong>{toMoney(nextIncome)}</strong></article>
                <article className="forecast-kpi expense"><span>Ожидаемые затраты (след. месяц)</span><strong>{toMoney(nextExpense)}</strong></article>
                <article className="forecast-kpi profit"><span>Ожидаемая прибыль</span><strong>{toMoney(nextProfit)}</strong></article>
              </div>
            ) : (
              <EmptyState title="Недостаточно данных для прогноза" description={forecast?.message || 'Добавьте операции минимум в двух разных месяцах'} />
            )}

            <div className="scenario-box">
              <h4>Управленческий сценарий</h4>
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
              {scenarioLoading ? <p className="hint">Расчет сценария...</p> : scenarioResult ? (
                <div className="scenario-results">
                  <div><span>Базовая прибыль</span><strong>{toMoney(scenarioResult.base.profit)}</strong></div>
                  <div><span>Прибыль по сценарию</span><strong>{toMoney(scenarioResult.scenario.profit)}</strong></div>
                  <div><span>Изменение прибыли</span><strong className={Number(scenarioResult.delta.profit) >= 0 ? 'tone-income' : 'tone-expense'}>{toMoney(scenarioResult.delta.profit)}</strong></div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="card">
            <div className="recommendations-head">
              <h3>Рекомендации и анализ</h3>
              <button className="primary" onClick={onGenerateAiRecommendations} disabled={aiRecommendationsLoading}>
                {aiRecommendationsLoading ? 'Генерация...' : 'Обновить AI-рекомендации'}
              </button>
            </div>
            {recommendationItems.length === 0 ? <EmptyState title="Рекомендаций пока нет" description="Добавьте больше операций и сгенерируйте AI-анализ" /> : (
              <div className="recommendation-grid">
                {recommendationItems.map((item, index) => (
                  <article key={`${item.text}-${index}`} className={`recommendation-card recommendation-${item.kind.key}`}>
                    <span className="recommendation-index">{String(index + 1).padStart(2, '0')}</span>
                    <div className="recommendation-content">
                      <span className={`recommendation-kind recommendation-kind-${item.kind.key}`}>{item.kind.label}</span>
                      <p>{item.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
