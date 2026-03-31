import { useEffect, useMemo, useState } from 'react'
import { Doughnut, Line } from 'react-chartjs-2'
import { toMoney } from '../api.js'
import SectionHeader from '../shared/ui/SectionHeader.jsx'
import EmptyState from '../shared/ui/EmptyState.jsx'
import SkeletonBlock from '../shared/ui/SkeletonBlock.jsx'

function trendTone(value) {
  if (value > 0) return 'up'
  if (value < 0) return 'down'
  return 'flat'
}

const formatCompactMoney = (value) => new Intl.NumberFormat('ru-RU', {
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1
}).format(Number(value || 0))

function normalizeForecastConfidence(value) {
  const raw = String(value || '').toLowerCase()
  if (raw === 'high') return 'высокая'
  if (raw === 'medium') return 'средняя'
  if (raw === 'low') return 'низкая'
  return 'нет данных'
}

function formatPercent(value) {
  if (!Number.isFinite(value) || value <= 0) return '0%'
  if (value < 1) return '<1%'
  return `${Math.round(value)}%`
}

function iconForCategory(name) {
  const lower = String(name || '').toLowerCase()
  if (/(зарплат|оклад|сотрудник)/.test(lower)) return 'ЗП'
  if (/(аренд|площад|офис|жил\.площ)/.test(lower)) return 'АР'
  if (/(маркет|реклам|продвиж)/.test(lower)) return 'МК'
  if (/(налог|взнос)/.test(lower)) return 'НЛ'
  return 'КТ'
}

function applyAlpha(color, alpha) {
  if (!color) return `rgba(148,163,184,${alpha})`
  if (color.startsWith('#')) {
    const hex = color.replace('#', '')
    const source = hex.length === 3 ? hex.split('').map((ch) => ch + ch).join('') : hex
    const int = parseInt(source, 16)
    const r = (int >> 16) & 255
    const g = (int >> 8) & 255
    const b = int & 255
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`)
  }
  if (color.startsWith('rgba(')) {
    return color.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/, `rgba($1, $2, $3, ${alpha})`)
  }
  return color
}

export default function DashboardPage({
  summaryValues,
  savingsRate,
  burnRate,
  trends,
  onRefresh,
  monthLabels,
  monthMap,
  latestCategorySpend,
  systemAlerts,
  insights,
  forecast,
  loading,
  remainingToMonthEnd
}) {
  const [hoveredCategory, setHoveredCategory] = useState(null)
  const [chartMode, setChartMode] = useState('donut')

  const rateValue = Math.max(0, Math.min(100, savingsRate))
  const burnValue = Math.max(0, Math.min(100, burnRate))

  const forecastIncome = Number(forecast?.series?.income?.[0]?.prediction || 0)
  const forecastExpense = Number(forecast?.series?.expense?.[0]?.prediction || 0)
  const forecastProfit = forecastIncome - forecastExpense
  const forecastConfidence = normalizeForecastConfidence(forecast?.confidence)

  const lineOptions = {
    maintainAspectRatio: false,
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: '#cbd5e1', usePointStyle: true, boxWidth: 10 } },
      tooltip: {
        backgroundColor: '#0b1220',
        borderColor: 'rgba(148,163,184,0.35)',
        borderWidth: 1,
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${toMoney(ctx.raw)}` }
      }
    },
    elements: { line: { tension: 0.35, borderWidth: 3 }, point: { radius: 3, hoverRadius: 5 } },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.12)' } },
      y: {
        ticks: { color: '#94a3b8', callback: (value) => formatCompactMoney(value) },
        grid: { color: 'rgba(148,163,184,0.12)' }
      }
    }
  }

  const donutOptions = {
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#0f172a', callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw.toFixed(1)}%` } }
    }
  }

  const categoryRows = useMemo(() => (
    Object.entries(latestCategorySpend || {})
      .map(([name, amount]) => ({ name, amount: Number(amount || 0) }))
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  ), [latestCategorySpend])

  const categoryTotal = categoryRows.reduce((sum, item) => sum + item.amount, 0)
  const categoryWithShare = categoryRows.map((item, index) => ({
    ...item,
    index,
    share: categoryTotal > 0 ? (item.amount / categoryTotal) * 100 : 0
  }))

  const dominantShare = categoryWithShare[0]?.share || 0
  const isDominant = dominantShare >= 90

  useEffect(() => {
    setChartMode(isDominant ? 'bar' : 'donut')
  }, [isDominant])

  const baseColors = ['#34d399', '#38bdf8', '#f59e0b', '#f472b6', '#818cf8', '#22d3ee', '#f97316']
  const resolvedColors = categoryWithShare.map((item) => (
    isDominant && item.index === 0
      ? 'rgba(148,163,184,0.5)'
      : baseColors[item.index % baseColors.length]
  ))

  const interactiveColors = categoryWithShare.map((_, index) => {
    const base = resolvedColors[index]
    if (hoveredCategory === null) return base
    return index === hoveredCategory ? applyAlpha(base, 1) : applyAlpha(base, 0.22)
  })

  const pieOptions = {
    maintainAspectRatio: false,
    cutout: '82%',
    animation: { duration: 200, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        callbacks: {
          label: (ctx) => {
            const item = categoryWithShare[ctx.dataIndex]
            return `${ctx.label}: ${toMoney(ctx.raw)} (${formatPercent(item?.share || 0)})`
          }
        }
      }
    }
  }

  const riskState = (() => {
    if (systemAlerts.length > 0 || remainingToMonthEnd < 0) return { tone: 'danger', label: 'Требует внимания' }
    if (burnRate >= 75) return { tone: 'warning', label: 'Зона риска' }
    return { tone: 'safe', label: 'Стабильно' }
  })()

  const actionItems = (insights || []).slice(0, 3).map((item, index) => {
    const text = String(item?.text || '').replace(/\s+/g, ' ').trim()
    const sentence = text.split(/[.!?]/).find(Boolean) || text
    const actionLabel = item?.tone === 'danger' ? 'Приоритет: высокий' : item?.tone === 'warning' ? 'Приоритет: средний' : 'Приоритет: плановый'
    return { id: `${index}-${sentence}`, title: sentence, action: actionLabel }
  })

  return (
    <section>
      <SectionHeader title="Дашборд" subtitle="Единый управленческий цикл" actions={<button className="ghost" onClick={onRefresh}>Обновить</button>} />

      <div className="grid-cards metrics-cards">
        <div className="card metric-card income"><span>Доходы</span><strong>{toMoney(summaryValues.income)}</strong><em className={`trend ${trendTone(trends.income)}`}>{trends.income >= 0 ? '^' : 'v'} {Math.abs(trends.income).toFixed(1)}%</em></div>
        <div className="card metric-card expense"><span>Расходы</span><strong>{toMoney(summaryValues.expense)}</strong><em className={`trend ${trendTone(trends.expense)}`}>{trends.expense >= 0 ? '^' : 'v'} {Math.abs(trends.expense).toFixed(1)}%</em></div>
        <div className="card metric-card balance"><span>Прибыль</span><strong>{toMoney(summaryValues.balance)}</strong><em className={`trend ${trendTone(trends.balance)}`}>{trends.balance >= 0 ? '^' : 'v'} {Math.abs(trends.balance).toFixed(1)}%</em></div>
        <div className="card metric-card savings">
          <span>Рентабельность</span>
          <strong>{savingsRate.toFixed(1)}%</strong>
          <div className="premium-progress"><div style={{ width: `${rateValue}%` }} /></div>
        </div>
        <div className="card metric-card burn">
          <span>Темп затрат</span>
          <div className="mini-donut">
            <Doughnut options={donutOptions} data={{ labels: ['Затраты', 'Резерв'], datasets: [{ data: [burnValue, 100 - burnValue], backgroundColor: ['#ef4444', 'rgba(148,163,184,0.24)'], borderWidth: 0 }] }} />
            <strong>{burnRate.toFixed(1)}%</strong>
          </div>
        </div>
      </div>

      <div className="cycle-flow-grid">
        <article className="card cycle-card">
          <span className="cycle-step">Шаг 1</span>
          <h3>Операции</h3>
          <p>Остаток текущего месяца: <strong>{toMoney(remainingToMonthEnd)}</strong></p>
          <p className="hint">Изменения операций сразу попадают в расчеты.</p>
        </article>
        <article className="card cycle-card">
          <span className="cycle-step">Шаг 2</span>
          <h3>Аналитика</h3>
          <p>Рентабельность: <strong>{savingsRate.toFixed(1)}%</strong></p>
          <p>Состояние: <span className={`status-badge ${riskState.tone}`}>{riskState.label}</span></p>
        </article>
        <article className="card cycle-card">
          <span className="cycle-step">Шаг 3</span>
          <h3>Прогноз</h3>
          <p>Прибыль (след. месяц): <strong>{toMoney(forecastProfit)}</strong></p>
          <p className="hint">Уверенность модели: {forecastConfidence}</p>
        </article>
        <article className="card cycle-card">
          <span className="cycle-step">Шаг 4</span>
          <h3>Рекомендации</h3>
          <p>{actionItems[0]?.title || 'Добавьте больше операций для точных рекомендаций.'}</p>
          <p className="hint">{actionItems[0]?.action || 'Приоритет появится после расчета рекомендаций.'}</p>
        </article>
      </div>

      <div className="grid-cards">
        <div className="card">
          <h3>Динамика по месяцам</h3>
          {loading ? <SkeletonBlock rows={6} /> : (
            <div className="chart-wrap chart-md">
              <Line options={lineOptions} data={{ labels: monthLabels, datasets: [{ label: 'Доходы', data: monthLabels.map((key) => monthMap[key]?.income || 0), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.12)', fill: true }, { label: 'Расходы', data: monthLabels.map((key) => monthMap[key]?.expense || 0), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.12)', fill: true }] }} />
            </div>
          )}
        </div>

        <div className="card expense-structure-card">
          <div className="expense-structure-header">
            <h3>Структура затрат</h3>
            <p className="hint">Всего затрат: <strong>{toMoney(categoryTotal)}</strong></p>
          </div>

          {categoryWithShare.length === 0 ? (
            <EmptyState title="Нет данных" description="Добавьте расходы" />
          ) : (
            <div className="expense-structure-grid premium">
              <div className="expense-chart-zone">
                {isDominant && (
                  <div className="expense-chart-mode">
                    <button className={`tab-btn ${chartMode === 'bar' ? 'active' : ''}`} onClick={() => setChartMode('bar')}>Breakdown</button>
                    <button className={`tab-btn ${chartMode === 'donut' ? 'active' : ''}`} onClick={() => setChartMode('donut')}>Donut</button>
                  </div>
                )}

                {chartMode === 'bar' ? (
                  <div className="expense-breakdown primary">
                    <p className="hint">Доминирующий сегмент: {formatPercent(dominantShare)}</p>
                    <div className="expense-breakdown-bar">
                      {categoryWithShare.map((item, index) => (
                        <div
                          key={`${item.name}-bar`}
                          title={`${item.name}: ${formatPercent(item.share)}`}
                          style={{ width: `${Math.max(item.share, 1)}%`, background: interactiveColors[index] }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="chart-wrap chart-md expense-donut-wrap">
                    <div className="expense-donut-shell">
                      <Doughnut
                        options={pieOptions}
                        data={{
                          labels: categoryWithShare.map((item) => item.name),
                          datasets: [{
                            data: categoryWithShare.map((item) => item.amount),
                            backgroundColor: interactiveColors,
                            borderWidth: categoryWithShare.map((_, index) => (hoveredCategory === index ? 2 : 1)),
                            borderColor: categoryWithShare.map((_, index) => (hoveredCategory === index ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.45)')),
                            hoverOffset: 7
                          }]
                        }}
                      />
                      <div className="expense-donut-center">
                        <strong>{toMoney(categoryTotal)}</strong>
                        <span>Всего затрат</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="expense-structure-list premium">
                {categoryWithShare.map((item, index) => (
                  <article
                    key={item.name}
                    className={`expense-structure-row premium ${hoveredCategory === index ? 'active' : ''}`}
                    onMouseEnter={() => setHoveredCategory(index)}
                    onMouseLeave={() => setHoveredCategory(null)}
                  >
                    <div className="expense-row-main">
                      <span className="expense-icon">{iconForCategory(item.name)}</span>
                      <div>
                        <p>{item.name}</p>
                        <small>{formatPercent(item.share)}</small>
                      </div>
                    </div>
                    <strong>{toMoney(item.amount)}</strong>
                    <span className="expense-row-dot" style={{ background: resolvedColors[index] }} />
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid-cards">
        <div className="card">
          <h3>Ключевые действия</h3>
          {actionItems.length === 0 ? (
            <EmptyState title="Пока без рекомендаций" description="Добавьте больше операций" />
          ) : (
            <div className="action-cards">
              {actionItems.map((item) => (
                <article key={item.id} className="action-card">
                  <p>{item.title}</p>
                  <span>{item.action}</span>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
