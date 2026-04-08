import { useMemo, useState } from 'react'
import { Doughnut, Line } from 'react-chartjs-2'
import { toMoney } from '../api.js'
import SectionHeader from '../shared/ui/SectionHeader.jsx'
import EmptyState from '../shared/ui/EmptyState.jsx'

const formatCompactMoney = (value) => new Intl.NumberFormat('ru-RU', {
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1
}).format(Number(value || 0))

function confidenceLabel(value) {
  const raw = String(value || '').toLowerCase()
  if (raw === 'high' || raw === 'высокая') return 'высокая'
  if (raw === 'medium' || raw === 'средняя') return 'средняя'
  if (raw === 'low' || raw === 'низкая') return 'низкая'
  return 'нет данных'
}

function toneByText(value) {
  const text = String(value || '').toLowerCase()
  if (/(риск|крит|убыт|дефицит|перерасход|паден)/.test(text)) return 'danger'
  if (/(контрол|оптимиз|провер|следите|огранич)/.test(text)) return 'warning'
  return 'safe'
}

function percentLabel(value) {
  const v = Number(value || 0)
  if (!Number.isFinite(v) || v <= 0) return '0%'
  if (v < 1) return '<1%'
  return `${Math.round(v)}%`
}

function categoryIcon(name) {
  const lower = String(name || '').toLowerCase()
  if (/(зарплат|сотрудник|оклад)/.test(lower)) return 'ЗП'
  if (/(аренд|офис|помещ)/.test(lower)) return 'АР'
  if (/(маркет|реклам)/.test(lower)) return 'МР'
  if (/(налог|эквайр)/.test(lower)) return 'НЛ'
  return 'КТ'
}

function withAlpha(hex, alpha) {
  if (!hex || !hex.startsWith('#')) return `rgba(148,163,184,${alpha})`
  const source = hex.replace('#', '')
  const full = source.length === 3 ? source.split('').map((x) => x + x).join('') : source
  const int = parseInt(full, 16)
  const r = (int >> 16) & 255
  const g = (int >> 8) & 255
  const b = int & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
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
  insights,
  forecast,
  remainingToMonthEnd
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const [chartMode, setChartMode] = useState('donut')

  const forecastIncome = Number(forecast?.series?.income?.[0]?.prediction || 0)
  const forecastExpense = Number(forecast?.series?.expense?.[0]?.prediction || 0)
  const forecastProfit = forecastIncome - forecastExpense

  const monthDatasets = {
    labels: monthLabels,
    datasets: [
      {
        label: 'Выручка',
        data: monthLabels.map((key) => Number(monthMap[key]?.income || 0)),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.14)',
        fill: true,
        tension: 0.35,
        borderWidth: 3
      },
      {
        label: 'Затраты',
        data: monthLabels.map((key) => Number(monthMap[key]?.expense || 0)),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.10)',
        fill: true,
        tension: 0.35,
        borderWidth: 3
      }
    ]
  }

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
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.12)' } },
      y: {
        ticks: { color: '#94a3b8', callback: (value) => formatCompactMoney(value) },
        grid: { color: 'rgba(148,163,184,0.12)' }
      }
    }
  }

  const categories = useMemo(() => (
    Object.entries(latestCategorySpend || {})
      .map(([name, amount]) => ({ name, amount: Number(amount || 0) }))
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  ), [latestCategorySpend])

  const categoryTotal = categories.reduce((sum, item) => sum + item.amount, 0)
  const categoryRows = categories.map((item, idx) => ({
    ...item,
    idx,
    share: categoryTotal > 0 ? (item.amount / categoryTotal) * 100 : 0
  }))

  const dominantShare = categoryRows[0]?.share || 0
  const dominant = dominantShare >= 90
  const baseColors = ['#34d399', '#38bdf8', '#f59e0b', '#a78bfa', '#f472b6', '#22d3ee', '#f97316']
  const colors = categoryRows.map((item) => (dominant && item.idx === 0 ? 'rgba(148,163,184,0.52)' : baseColors[item.idx % baseColors.length]))
  const interactive = categoryRows.map((item, idx) => {
    if (hoveredIdx === null) return colors[idx]
    return hoveredIdx === idx ? withAlpha(baseColors[item.idx % baseColors.length], 1) : withAlpha(baseColors[item.idx % baseColors.length], 0.18)
  })

  const donutData = {
    labels: categoryRows.map((item) => item.name),
    datasets: [{
      data: categoryRows.map((item) => item.amount),
      backgroundColor: interactive,
      borderColor: 'rgba(15,23,42,0.5)',
      borderWidth: 1,
      hoverOffset: 6
    }]
  }

  const donutOptions = {
    maintainAspectRatio: false,
    cutout: '82%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        callbacks: {
          label: (ctx) => {
            const row = categoryRows[ctx.dataIndex]
            return `${ctx.label}: ${toMoney(ctx.raw)} (${percentLabel(row?.share)})`
          }
        }
      }
    }
  }

  const topActions = (insights || []).slice(0, 3).map((item, idx) => {
    const text = String(item?.text || '').trim().replace(/\s+/g, ' ')
    return {
      id: `${idx}-${text}`,
      text: text || 'Добавьте больше операций для анализа.',
      tone: toneByText(text)
    }
  })

  return (
    <section>
      <SectionHeader title="Дашборд" subtitle="Единый цикл: операции -> аналитика -> прогноз -> решения" actions={<button className="ghost" onClick={onRefresh}>Обновить</button>} />

      <div className="card dashboard-hero">
        <div>
          <span className="dashboard-hero-label">Главный KPI</span>
          <h3>Текущая прибыль</h3>
          <strong className={summaryValues.balance >= 0 ? 'tone-income' : 'tone-expense'}>{toMoney(summaryValues.balance)}</strong>
          <p className="hint">Остаток текущего месяца: {toMoney(remainingToMonthEnd)}</p>
        </div>
        <div className="dashboard-hero-meta">
          <span className={`status-badge ${summaryValues.balance >= 0 ? 'safe' : 'danger'}`}>
            {summaryValues.balance >= 0 ? 'Положительный результат' : 'Отрицательный результат'}
          </span>
          <p className="hint">Прогноз прибыли (след. месяц): {toMoney(forecastProfit)}</p>
          <p className="hint">Уверенность прогноза: {confidenceLabel(forecast?.confidence)}</p>
        </div>
      </div>

      <div className="grid-cards metrics-cards">
        <div className="card metric-card income"><span>Выручка</span><strong>{toMoney(summaryValues.income)}</strong><em>{Number(trends?.income || 0).toFixed(1)}%</em></div>
        <div className="card metric-card expense"><span>Затраты</span><strong>{toMoney(summaryValues.expense)}</strong><em>{Number(trends?.expense || 0).toFixed(1)}%</em></div>
        <div className="card metric-card balance"><span>Прибыль</span><strong>{toMoney(summaryValues.balance)}</strong><em>{Number(trends?.balance || 0).toFixed(1)}%</em></div>
        <div className="card metric-card savings"><span>Рентабельность</span><strong>{Number(savingsRate || 0).toFixed(1)}%</strong></div>
        <div className="card metric-card burn"><span>Темп затрат</span><strong>{Number(burnRate || 0).toFixed(1)}%</strong></div>
      </div>

      <div className="grid-cards">
        <div className="card">
          <h3>Динамика по месяцам</h3>
          {monthLabels.length === 0 ? <EmptyState title="Нет данных" description="Добавьте операции" /> : (
            <div className="chart-wrap chart-md">
              <Line options={lineOptions} data={monthDatasets} />
            </div>
          )}
        </div>

        <div className="card expense-structure-card">
          <div className="expense-structure-header">
            <h3>Структура затрат</h3>
            <p className="hint">Всего затрат: <strong>{toMoney(categoryTotal)}</strong></p>
          </div>

          {categoryRows.length === 0 ? (
            <EmptyState title="Нет данных" description="Добавьте затраты" />
          ) : (
            <div className="expense-structure-grid premium">
              <div className="expense-chart-zone">
                {dominant && (
                  <div className="expense-chart-mode">
                    <button className={`tab-btn ${chartMode === 'bar' ? 'active' : ''}`} onClick={() => setChartMode('bar')}>Breakdown</button>
                    <button className={`tab-btn ${chartMode === 'donut' ? 'active' : ''}`} onClick={() => setChartMode('donut')}>Donut</button>
                  </div>
                )}

                {chartMode === 'bar' || dominant ? (
                  <div className="expense-breakdown primary">
                    <p className="hint">Доминирующий сегмент: {percentLabel(dominantShare)}</p>
                    <div className="expense-breakdown-bar">
                      {categoryRows.map((row, idx) => (
                        <div key={`${row.name}-${idx}`} title={`${row.name}: ${percentLabel(row.share)}`} style={{ width: `${Math.max(row.share, 1)}%`, background: interactive[idx] }} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="chart-wrap chart-md expense-donut-wrap">
                    <div className="expense-donut-shell">
                      <Doughnut options={donutOptions} data={donutData} />
                      <div className="expense-donut-center">
                        <strong>{toMoney(categoryTotal)}</strong>
                        <span>Всего затрат</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="expense-structure-list premium">
                {categoryRows.map((row, idx) => (
                  <article key={`${row.name}-${idx}`} className={`expense-structure-row premium ${hoveredIdx === idx ? 'active' : ''}`} onMouseEnter={() => setHoveredIdx(idx)} onMouseLeave={() => setHoveredIdx(null)}>
                    <div className="expense-row-main">
                      <span className="expense-icon">{categoryIcon(row.name)}</span>
                      <div>
                        <p>{row.name}</p>
                        <small>{percentLabel(row.share)}</small>
                      </div>
                    </div>
                    <strong>{toMoney(row.amount)}</strong>
                    <span className="expense-row-dot" style={{ background: colors[idx] }} />
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
          {topActions.length === 0 ? (
            <EmptyState title="Рекомендаций пока нет" description="Сгенерируйте AI-анализ" />
          ) : (
            <div className="action-cards">
              {topActions.map((item) => (
                <article key={item.id} className={`action-card ${item.tone}`}>
                  <p>{item.text}</p>
                  <span className={`status-badge ${item.tone}`}>{item.tone === 'danger' ? 'Высокий приоритет' : item.tone === 'warning' ? 'Средний приоритет' : 'Плановый'}</span>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
