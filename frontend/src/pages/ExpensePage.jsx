import { formatDate, toMoney } from '../api.js'
import SectionHeader from '../shared/ui/SectionHeader.jsx'
import EmptyState from '../shared/ui/EmptyState.jsx'
import SkeletonBlock from '../shared/ui/SkeletonBlock.jsx'

export default function ExpensePage({ loading, filter, setFilter, expense, meta, categoryMap, onOpenCreate, onOpenEdit, onRemove }) {
  const totalPages = Math.max(1, Math.ceil((meta?.total || 0) / (meta?.page_size || 10)))

  return (
    <section>
      <SectionHeader title="Расходы" subtitle="Фильтр, сортировка, пагинация" actions={<button className="primary" onClick={onOpenCreate}>Добавить</button>} />
      <div className="card table-controls sticky-filters">
        <label className="field compact"><span>С даты</span><input type="date" value={filter.dateFrom} onChange={(event) => setFilter((prev) => ({ ...prev, page: 1, dateFrom: event.target.value }))} /></label>
        <label className="field compact"><span>По дату</span><input type="date" value={filter.dateTo} onChange={(event) => setFilter((prev) => ({ ...prev, page: 1, dateTo: event.target.value }))} /></label>
        <label className="field compact"><span>Сортировка</span><select value={`${filter.sortBy}:${filter.sortDir}`} onChange={(event) => { const [sortBy, sortDir] = event.target.value.split(':'); setFilter((prev) => ({ ...prev, page: 1, sortBy, sortDir })) }}><option value="date:desc">Дата новые</option><option value="date:asc">Дата старые</option><option value="amount:desc">Сумма убыв.</option><option value="amount:asc">Сумма возр.</option></select></label>
      </div>
      {loading ? <div className="card"><SkeletonBlock rows={6} /></div> : expense.length === 0 ? <EmptyState title="Пусто" description="Нет расходов" /> : (
        <div className="card table-card">
          <table>
            <thead><tr><th>Дата</th><th>Категория</th><th>Сумма</th><th>Комментарий</th><th>Действия</th></tr></thead>
            <tbody>
              {expense.map((item) => (
                <tr key={item.id}>
                  <td data-label="Дата">{formatDate(item.date)}</td>
                  <td data-label="Категория">{categoryMap.get(item.category_id)?.name || item.category_id}</td>
                  <td data-label="Сумма" className="tone-expense">{toMoney(item.amount)}</td>
                  <td data-label="Комментарий">{item.note || '—'}</td>
                  <td data-label="Действия" className="table-actions">
                    <button className="ghost" onClick={() => onOpenEdit(item)}>Редактировать</button>
                    <button className="ghost danger" onClick={() => onRemove(item.id)}>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <button className="ghost" disabled={(meta?.page || 1) <= 1} onClick={() => setFilter((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}>Назад</button>
            <span>{meta?.page || 1} / {totalPages}</span>
            <button className="ghost" disabled={(meta?.page || 1) >= totalPages} onClick={() => setFilter((prev) => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}>Вперед</button>
          </div>
        </div>
      )}
    </section>
  )
}
