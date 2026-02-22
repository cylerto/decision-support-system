import { formatDate, toMoney } from '../api.js'
import SectionHeader from '../shared/ui/SectionHeader.jsx'
import EmptyState from '../shared/ui/EmptyState.jsx'
import SkeletonBlock from '../shared/ui/SkeletonBlock.jsx'

export default function IncomePage({
  loading,
  filter,
  setFilter,
  income,
  meta,
  categoryMap,
  directories,
  directoriesMap,
  onOpenCreate,
  onOpenEdit,
  onRemove,
  embedded = false
}) {
  const totalPages = Math.max(1, Math.ceil((meta?.total || 0) / (meta?.page_size || 10)))

  return (
    <section>
      {!embedded && (
        <SectionHeader
          title="Выручка"
          subtitle="Фильтрация, сортировка и пагинация операций"
          actions={<button className="primary" onClick={onOpenCreate}>Добавить выручку</button>}
        />
      )}
      <div className="card table-controls sticky-filters">
        <label className="field compact">
          <span>С даты</span>
          <input type="date" value={filter.dateFrom || ''} onChange={(event) => setFilter((prev) => ({ ...prev, page: 1, dateFrom: event.target.value }))} />
        </label>
        <label className="field compact">
          <span>По дату</span>
          <input type="date" value={filter.dateTo || ''} onChange={(event) => setFilter((prev) => ({ ...prev, page: 1, dateTo: event.target.value }))} />
        </label>
        <label className="field compact">
          <span>Подразделение</span>
          <select value={filter.departmentId || ''} onChange={(event) => setFilter((prev) => ({ ...prev, page: 1, departmentId: event.target.value }))}>
            <option value="">Все</option>
            {(directories?.departments || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="field compact">
          <span>Проект</span>
          <select value={filter.projectId || ''} onChange={(event) => setFilter((prev) => ({ ...prev, page: 1, projectId: event.target.value }))}>
            <option value="">Все</option>
            {(directories?.projects || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="field compact">
          <span>Сортировка</span>
          <select
            value={`${filter.sortBy || 'date'}:${filter.sortDir || 'desc'}`}
            onChange={(event) => {
              const [sortBy, sortDir] = event.target.value.split(':')
              setFilter((prev) => ({ ...prev, page: 1, sortBy, sortDir }))
            }}
          >
            <option value="date:desc">Дата: новые</option>
            <option value="date:asc">Дата: старые</option>
            <option value="amount:desc">Сумма: по убыванию</option>
            <option value="amount:asc">Сумма: по возрастанию</option>
            <option value="department:asc">Подразделение: A-Z</option>
            <option value="project:asc">Проект: A-Z</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="card"><SkeletonBlock rows={6} /></div>
      ) : income.length === 0 ? (
        <EmptyState title="Нет записей выручки" description="Добавьте первую операцию или импортируйте CSV" />
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Статья P&L</th>
                <th>Подразделение</th>
                <th>Проект</th>
                <th>Контрагент</th>
                <th>Сумма</th>
                <th>Комментарий</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {income.map((item) => (
                <tr key={item.id}>
                  <td data-label="Дата">{formatDate(item.date)}</td>
                  <td data-label="Статья P&L">{categoryMap.get(item.category_id)?.name || 'Без категории'}</td>
                  <td data-label="Подразделение">{directoriesMap.departments.get(item.department_id)?.name || '—'}</td>
                  <td data-label="Проект">{directoriesMap.projects.get(item.project_id)?.name || '—'}</td>
                  <td data-label="Контрагент">{directoriesMap.counterparties.get(item.counterparty_id)?.name || '—'}</td>
                  <td data-label="Сумма" className="tone-income">{toMoney(item.amount)}</td>
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
            <span>Страница {meta?.page || 1} из {totalPages}</span>
            <button className="ghost" disabled={(meta?.page || 1) >= totalPages} onClick={() => setFilter((prev) => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}>Вперед</button>
          </div>
        </div>
      )}
    </section>
  )
}
