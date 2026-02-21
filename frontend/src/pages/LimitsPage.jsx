import { toMoney } from '../api.js'
import SectionHeader from '../shared/ui/SectionHeader.jsx'
import EmptyState from '../shared/ui/EmptyState.jsx'

export default function LimitsPage({ limitsProgress, onOpenLimit }) {
  return (
    <section>
      <SectionHeader title="Лимиты" subtitle="Категории отсортированы по риску превышения" actions={<button className="primary" onClick={onOpenLimit}>Установить лимит</button>} />
      {limitsProgress.length === 0 ? <EmptyState title="Нет лимитов" description="Добавьте лимит" /> : (
        <div className="card table-card">
          <table>
            <thead><tr><th>Категория</th><th>Лимит</th><th>Потрачено</th><th>Прогресс</th></tr></thead>
            <tbody>
              {limitsProgress.map((item) => (
                <tr key={item.category_id}>
                  <td data-label="Категория">{item.name}</td>
                  <td data-label="Лимит">{toMoney(item.limit)}</td>
                  <td data-label="Потрачено">{toMoney(item.spent)}</td>
                  <td data-label="Прогресс">
                    <div className="limit-progress">
                      <div className={`limit-progress-fill ${item.pct > 100 ? 'danger' : item.pct >= 80 ? 'warning' : 'safe'}`} style={{ width: `${Math.min(100, Math.max(0, item.pct))}%` }} />
                    </div>
                    <span className="hint">{item.pct.toFixed(1)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
