import { Line, Doughnut } from 'react-chartjs-2'
import { toMoney } from '../api.js'
import SectionHeader from '../shared/ui/SectionHeader.jsx'
import EmptyState from '../shared/ui/EmptyState.jsx'

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
  recommendations
}) {
  return (
    <section>
      <SectionHeader
        title="Аналитика"
        subtitle="Все показатели в одной странице с вкладками"
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
      <div className="analytics-tabs sticky-tabs">{tabs.map((tab) => <button key={tab.key} className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>)}</div>

      {activeTab === 'summary' && (
        <div className="card">
          <p>Доход: {toMoney(summaryValues.income)}</p>
          <p>Расход: {toMoney(summaryValues.expense)}</p>
          <p>Баланс: {toMoney(summaryValues.balance)}</p>
          <p>Savings rate: {savingsRate.toFixed(1)}%</p>
          <p>Burn rate: {burnRate.toFixed(1)}%</p>
        </div>
      )}

      {activeTab === 'monthly' && (
        <div className="card">
          {monthLabels.length === 0
            ? <EmptyState title="Нет данных" description="Добавьте операции для построения графика" />
            : <Line data={{ labels: monthLabels, datasets: [{ label: 'Доходы', data: monthLabels.map((key) => monthMap[key]?.income || 0), borderColor: '#1e9f54' }, { label: 'Расходы', data: monthLabels.map((key) => monthMap[key]?.expense || 0), borderColor: '#d94848' }] }} />
          }
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="card">
          {Object.keys(latestCategorySpend).length === 0
            ? <EmptyState title="Нет данных" description="Добавьте расходы" />
            : <Doughnut data={{ labels: Object.keys(latestCategorySpend), datasets: [{ data: Object.values(latestCategorySpend) }] }} />
          }
        </div>
      )}

      {activeTab === 'budget' && (
        <div className="card table-card">
          {(budgetVsActual || []).length === 0 ? <EmptyState title="Нет данных бюджета" description="Сравнение появится после заполнения бюджета" /> : (
            <table>
              <thead><tr><th>Месяц</th><th>План дохода</th><th>Факт дохода</th><th>План расхода</th><th>Факт расхода</th></tr></thead>
              <tbody>
                {budgetVsActual.map((row) => (
                  <tr key={row.month}>
                    <td data-label="Месяц">{row.month}</td>
                    <td data-label="План дохода">{toMoney(row.planned_income)}</td>
                    <td data-label="Факт дохода">{toMoney(row.actual_income)}</td>
                    <td data-label="План расхода">{toMoney(row.planned_expense)}</td>
                    <td data-label="Факт расхода">{toMoney(row.actual_expense)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'forecast' && (
        <div className="card">
          {forecast?.series ? (
            <>
              <p className="hint">Уверенность модели: {forecast?.confidence || 'unknown'}</p>
              <Line data={{ labels: forecast.series.income.map((point) => `+${point.month_offset}`), datasets: [{ label: 'Доход', data: forecast.series.income.map((point) => point.prediction), borderColor: '#1e9f54' }, { label: 'Расход', data: forecast.series.expense.map((point) => point.prediction), borderColor: '#d94848' }] }} />
            </>
          ) : (
            <EmptyState title="Недостаточно данных для прогноза" description={forecast?.message || 'Добавьте операции минимум в двух разных месяцах или загрузите демо-данные'} />
          )}
        </div>
      )}

      {activeTab === 'recommendations' && (
        <div className="card">
          {(recommendations?.recommendations || []).length === 0 ? <EmptyState title="Нет рекомендаций" description="Добавьте данные" /> : <ul className="list">{recommendations.recommendations.map((item, index) => <li key={index}>{item}</li>)}</ul>}
        </div>
      )}
    </section>
  )
}
