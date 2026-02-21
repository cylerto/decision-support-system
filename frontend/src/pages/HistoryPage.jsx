import SectionHeader from '../shared/ui/SectionHeader.jsx'
import EmptyState from '../shared/ui/EmptyState.jsx'
import SkeletonBlock from '../shared/ui/SkeletonBlock.jsx'

export default function HistoryPage({ rows, loading, onRefresh }) {
  return (
    <section>
      <SectionHeader title="История" subtitle="Журнал действий и изменений" actions={<button className="ghost" onClick={onRefresh}>Обновить</button>} />
      {loading ? <div className="card"><SkeletonBlock rows={6} /></div> : rows.length === 0 ? <EmptyState title="История пока пустая" description="Действия появятся автоматически." /> : (
        <div className="card">
          <table>
            <thead><tr><th>Дата</th><th>Сущность</th><th>Действие</th><th>Детали</th></tr></thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.created_at).toLocaleString('ru-RU')}</td>
                  <td>{item.entity}</td>
                  <td>{item.action}</td>
                  <td>{item.data ? JSON.stringify(item.data) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
