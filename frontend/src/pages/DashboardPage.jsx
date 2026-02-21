import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { formatDate, toMoney } from '../api.js'
import SectionHeader from '../shared/ui/SectionHeader.jsx'
import EmptyState from '../shared/ui/EmptyState.jsx'
import SkeletonBlock from '../shared/ui/SkeletonBlock.jsx'

function trendTone(value) {
  if (value > 0) return 'up'
  if (value < 0) return 'down'
  return 'flat'
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
  limitsProgress,
  systemAlerts,
  insights,
  dashboardSnapshot,
  recentTransactions,
  categoryMap,
  segments,
  loading,
  atRiskLimits,
  remainingToMonthEnd
}) {
  const rateValue = Math.max(0, Math.min(100, savingsRate))
  const burnValue = Math.max(0, Math.min(100, burnRate))

  const lineOptions = {
    responsive: true,
    plugins: {
      legend: { labels: { color: '#94a3b8' } },
      tooltip: { backgroundColor: '#0f172a', borderColor: '#334155', borderWidth: 1, padding: 12 }
    },
    elements: { line: { tension: 0.35, borderWidth: 2.5 } },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.12)' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.12)' } }
    }
  }

  const donutOptions = {
    cutout: '70%',
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0f172a' } }
  }

  return (
    <section>
      <SectionHeader title="Дашборд" subtitle="Главный центр системы" actions={<button className="ghost" onClick={onRefresh}>Обновить</button>} />

      <div className="grid-cards metrics-cards">
        <div className="card metric-card income"><span>Доходы</span><strong>{toMoney(summaryValues.income)}</strong><em className={`trend ${trendTone(trends.income)}`}>{trends.income >= 0 ? '↑' : '↓'} {Math.abs(trends.income).toFixed(1)}%</em></div>
        <div className="card metric-card expense"><span>Расходы</span><strong>{toMoney(summaryValues.expense)}</strong><em className={`trend ${trendTone(trends.expense)}`}>{trends.expense >= 0 ? '↑' : '↓'} {Math.abs(trends.expense).toFixed(1)}%</em></div>
        <div className="card metric-card balance"><span>Баланс</span><strong>{toMoney(summaryValues.balance)}</strong><em className={`trend ${trendTone(trends.balance)}`}>{trends.balance >= 0 ? '↑' : '↓'} {Math.abs(trends.balance).toFixed(1)}%</em></div>
        <div className="card metric-card savings">
          <span>Savings Rate</span>
          <strong>{savingsRate.toFixed(1)}%</strong>
          <div className="premium-progress"><div style={{ width: `${rateValue}%` }} /></div>
        </div>
        <div className="card metric-card burn">
          <span>Burn Rate</span>
          <div className="mini-donut">
            <Doughnut options={donutOptions} data={{ labels: ['Burn', 'Rest'], datasets: [{ data: [burnValue, 100 - burnValue], backgroundColor: ['#ef4444', 'rgba(148,163,184,0.24)'], borderWidth: 0 }] }} />
            <strong>{burnRate.toFixed(1)}%</strong>
          </div>
        </div>
      </div>

      <div className="grid-cards">
        <div className="card">
          <h3>Тренд по месяцам</h3>
          {loading ? <SkeletonBlock rows={6} /> : <Line options={lineOptions} data={{ labels: monthLabels, datasets: [{ label: 'Доходы', data: monthLabels.map((key) => monthMap[key]?.income || 0), borderColor: '#10b981', fill: true }, { label: 'Расходы', data: monthLabels.map((key) => monthMap[key]?.expense || 0), borderColor: '#ef4444', fill: true }] }} />}
        </div>
        <div className="card">
          <h3>Расходы по категориям</h3>
          {Object.keys(latestCategorySpend).length === 0 ? <EmptyState title="Нет данных" description="Добавьте расходы" /> : <Doughnut data={{ labels: Object.keys(latestCategorySpend), datasets: [{ data: Object.values(latestCategorySpend), backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#6366f1'] }] }} />}
        </div>
      </div>

      <div className="grid-cards">
        <div className="card">
          <h3>KPI и риски</h3>
          <p>Лимитов в зоне риска (80%+): <strong>{atRiskLimits}</strong></p>
          <p>Остаток на конец месяца: <strong>{toMoney(remainingToMonthEnd)}</strong></p>
          {dashboardSnapshot?.counts && <p className="hint">Записей: доходов {dashboardSnapshot.counts.income_records}, расходов {dashboardSnapshot.counts.expense_records}</p>}
        </div>
        <div className="card">
          <h3>Системные алерты</h3>
          {systemAlerts.length === 0 ? <p>Критичных алертов нет.</p> : <ul className="list">{systemAlerts.map((alert, index) => <li key={index}>{alert}</li>)}</ul>}
        </div>
      </div>

      <div className="grid-cards">
        <div className="card">
          <h3>Рекомендации</h3>
          {insights.length === 0 ? <EmptyState title="Пока без инсайтов" description="Добавьте больше транзакций" /> : <ul className="insight-list">{insights.map((item, index) => <li key={index}><span className={`insight-dot ${item.tone}`} />{item.text}</li>)}</ul>}
        </div>
        <div className="card">
          <h3>Лимиты по категориям</h3>
          {limitsProgress.length === 0 ? <EmptyState title="Нет лимитов" description="Создайте лимит" /> : (
            <Bar options={lineOptions} data={{ labels: limitsProgress.map((item) => item.name), datasets: [{ label: 'Потрачено', data: limitsProgress.map((item) => item.spent), backgroundColor: '#3b82f6', borderRadius: 8 }, { label: 'Лимит', data: limitsProgress.map((item) => item.limit), backgroundColor: '#10b981', borderRadius: 8 }] }} />
          )}
        </div>
      </div>

      <div className="grid-cards">
        <div className="card">
          <h3>Сегменты трат по дням недели</h3>
          {!segments?.weekday_amount ? <EmptyState title="Нет данных" description="Добавьте расходы для сегментации" /> : (
            <div className="segment-bars">
              {Object.entries(segments.weekday_amount).map(([day, value]) => {
                const max = Math.max(...Object.values(segments.weekday_amount).map(Number), 1)
                const pct = (Number(value) / max) * 100
                return (
                  <div key={day} className="bar-row">
                    <span>{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][Number(day)]}</span>
                    <div className="bar"><div style={{ width: `${pct}%` }} /></div>
                    <strong>{toMoney(value)}</strong>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Последние операции</h3>
          {recentTransactions.length === 0 ? <EmptyState title="Нет операций" description="Добавьте доходы и расходы" /> : (
            <table>
              <thead><tr><th>Дата</th><th>Тип</th><th>Категория</th><th>Сумма</th></tr></thead>
              <tbody>
                {recentTransactions.map((item) => (
                  <tr key={`${item.type}-${item.id}`}>
                    <td data-label="Дата">{formatDate(item.date)}</td>
                    <td data-label="Тип">{item.type === 'income' ? 'Доход' : 'Расход'}</td>
                    <td data-label="Категория">{categoryMap.get(item.category_id)?.name || item.category_id}</td>
                    <td data-label="Сумма" className={item.type === 'income' ? 'tone-income' : 'tone-expense'}>{toMoney(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  )
}
