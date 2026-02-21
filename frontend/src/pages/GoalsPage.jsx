import { toMoney } from '../api.js'
import SectionHeader from '../shared/ui/SectionHeader.jsx'
import EmptyState from '../shared/ui/EmptyState.jsx'
import SkeletonBlock from '../shared/ui/SkeletonBlock.jsx'

export default function GoalsPage({ goals, loading, onRefresh, onCreate, onContribute, onDelete }) {
  return (
    <section>
      <SectionHeader title="Цели" subtitle="Накопления и дедлайны" actions={<button className="ghost" onClick={onRefresh}>Обновить</button>} />
      <div className="card">
        <h3>Новая цель</h3>
        <form
          className="table-controls"
          onSubmit={(event) => {
            event.preventDefault()
            onCreate({
              name: event.target.name.value.trim(),
              target_amount: Number(event.target.target_amount.value),
              current_amount: Number(event.target.current_amount.value || 0),
              due_date: event.target.due_date.value || undefined
            })
            event.target.reset()
          }}
        >
          <label className="field compact"><span>Название</span><input name="name" required /></label>
          <label className="field compact"><span>Цель</span><input name="target_amount" type="number" step="0.01" min="0" required /></label>
          <label className="field compact"><span>Уже накоплено</span><input name="current_amount" type="number" step="0.01" min="0" /></label>
          <label className="field compact"><span>Срок</span><input name="due_date" type="date" /></label>
          <button className="primary" type="submit">Добавить</button>
        </form>
      </div>

      {loading ? <div className="card"><SkeletonBlock rows={6} /></div> : goals.length === 0 ? <EmptyState title="Целей пока нет" description="Добавьте цель и отслеживайте прогресс." /> : (
        <div className="grid-cards">
          {goals.map((goal) => {
            const pct = goal.target_amount > 0 ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) : 0
            return (
              <div key={goal.id} className="card">
                <h3>{goal.name}</h3>
                <p className="hint">Срок: {goal.due_date || 'без срока'}</p>
                <p>{toMoney(goal.current_amount)} / {toMoney(goal.target_amount)}</p>
                <div className="premium-progress"><div style={{ width: `${pct}%` }} /></div>
                <p className="hint">Выполнено: {pct.toFixed(1)}%</p>
                <form
                  className="table-controls"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const amount = Number(event.target.amount.value || 0)
                    if (amount > 0) onContribute(goal.id, amount)
                    event.target.reset()
                  }}
                >
                  <label className="field compact"><span>Пополнить</span><input name="amount" type="number" step="0.01" min="0" /></label>
                  <button className="ghost" type="submit">Добавить</button>
                  <button className="ghost danger" type="button" onClick={() => onDelete(goal.id)}>Удалить</button>
                </form>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
