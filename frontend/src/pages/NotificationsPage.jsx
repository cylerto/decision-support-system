import SectionHeader from '../shared/ui/SectionHeader.jsx'
import EmptyState from '../shared/ui/EmptyState.jsx'
import SkeletonBlock from '../shared/ui/SkeletonBlock.jsx'

export default function NotificationsPage({ items, loading, onRefresh, onMarkRead }) {
  return (
    <section>
      <SectionHeader title="Уведомления" subtitle="Важные события системы" actions={<button className="ghost" onClick={onRefresh}>Обновить</button>} />
      {loading ? <div className="card"><SkeletonBlock rows={6} /></div> : items.length === 0 ? <EmptyState title="Нет новых уведомлений" description="Список пуст." /> : (
        <div className="card">
          <table>
            <thead><tr><th>Дата</th><th>Сообщение</th><th>Статус</th><th /></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.created_at).toLocaleString('ru-RU')}</td>
                  <td>{item.message}</td>
                  <td>{item.status}</td>
                  <td>{item.status !== 'read' ? <button className="ghost" onClick={() => onMarkRead(item.id)}>Прочитано</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
