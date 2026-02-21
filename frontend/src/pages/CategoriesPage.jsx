import SectionHeader from '../shared/ui/SectionHeader.jsx'
import EmptyState from '../shared/ui/EmptyState.jsx'
import SkeletonBlock from '../shared/ui/SkeletonBlock.jsx'

export default function CategoriesPage({ loading, filter, setFilter, categories, meta, onOpenCreate, onOpenEdit, onRemove }) {
  const totalPages = Math.max(1, Math.ceil((meta?.total || 0) / (meta?.page_size || 10)))

  return (
    <section>
      <SectionHeader title="Категории" subtitle="Поиск, фильтр, редактирование" actions={<button className="primary" onClick={onOpenCreate}>Добавить</button>} />
      <div className="card table-controls sticky-filters">
        <label className="field compact">
          <span>Поиск</span>
          <input value={filter.search} onChange={(event) => setFilter((prev) => ({ ...prev, page: 1, search: event.target.value }))} />
        </label>
        <label className="field compact">
          <span>Тип</span>
          <select value={filter.type} onChange={(event) => setFilter((prev) => ({ ...prev, page: 1, type: event.target.value }))}>
            <option value="">Все</option>
            <option value="income">Доход</option>
            <option value="expense">Расход</option>
          </select>
        </label>
      </div>
      {loading ? <div className="card"><SkeletonBlock rows={6} /></div> : categories.length === 0 ? <EmptyState title="Пусто" description="Нет категорий" /> : (
        <div className="card table-card">
          <table>
            <thead><tr><th>Название</th><th>Тип</th><th>Действия</th></tr></thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td data-label="Название">{category.name}</td>
                  <td data-label="Тип">{category.type === 'income' ? 'Доход' : 'Расход'}</td>
                  <td data-label="Действия" className="table-actions">
                    <button className="ghost" onClick={() => onOpenEdit(category)}>Редактировать</button>
                    <button className="ghost danger" onClick={() => onRemove(category.id)}>Удалить</button>
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
