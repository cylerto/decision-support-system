import { toMoney } from '../api.js'
import SectionHeader from '../shared/ui/SectionHeader.jsx'
import EmptyState from '../shared/ui/EmptyState.jsx'
import SkeletonBlock from '../shared/ui/SkeletonBlock.jsx'

export default function BudgetsPage({ rows, loading, onRefresh, onSave, onDelete }) {
  const now = new Date()
  const defaultYear = now.getFullYear()
  const defaultMonth = now.getMonth() + 1

  return (
    <section>
      <SectionHeader title="Бюджеты" subtitle="План и факт по месяцам" actions={<button className="ghost" onClick={onRefresh}>Обновить</button>} />
      <div className="card">
        <h3>Добавить / обновить бюджет</h3>
        <form
          className="table-controls"
          onSubmit={(event) => {
            event.preventDefault()
            const payload = {
              year: Number(event.target.year.value),
              month: Number(event.target.month.value),
              planned_income: Number(event.target.planned_income.value || 0),
              planned_expense: Number(event.target.planned_expense.value || 0)
            }
            onSave(payload)
            event.target.reset()
            event.target.year.value = defaultYear
            event.target.month.value = defaultMonth
          }}
        >
          <label className="field compact"><span>Год</span><input name="year" type="number" min="2000" defaultValue={defaultYear} required /></label>
          <label className="field compact"><span>Месяц</span><input name="month" type="number" min="1" max="12" defaultValue={defaultMonth} required /></label>
          <label className="field compact"><span>План дохода</span><input name="planned_income" type="number" step="0.01" min="0" required /></label>
          <label className="field compact"><span>План расхода</span><input name="planned_expense" type="number" step="0.01" min="0" required /></label>
          <button className="primary" type="submit">Сохранить</button>
        </form>
      </div>

      {loading ? <div className="card"><SkeletonBlock rows={6} /></div> : (rows || []).length === 0 ? <EmptyState title="Нет данных бюджета" description="Создайте первый бюджет на месяц." /> : (
        <div className="card">
          <table>
            <thead><tr><th>Месяц</th><th>План дохода</th><th>План расхода</th><th>Запас</th><th /></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{String(row.month).padStart(2, '0')}.{row.year}</td>
                  <td>{toMoney(row.planned_income)}</td>
                  <td>{toMoney(row.planned_expense)}</td>
                  <td className={row.planned_income - row.planned_expense >= 0 ? 'tone-income' : 'tone-expense'}>{toMoney(row.planned_income - row.planned_expense)}</td>
                  <td><button className="ghost danger" onClick={() => onDelete(row.id)}>Удалить</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
