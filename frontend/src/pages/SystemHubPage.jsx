import { useMemo, useState } from 'react'
import EmptyState from '../shared/ui/EmptyState.jsx'
import SkeletonBlock from '../shared/ui/SkeletonBlock.jsx'

const TABS = [
  { key: 'data', label: 'Импорт / Экспорт' },
  { key: 'history', label: 'История действий' }
]

function formatEntity(value) {
  const map = {
    income: 'Выручка',
    expense: 'Затраты',
    category: 'Статья P&L',
    user: 'Пользователь'
  }
  return map[value] || value
}

function formatAction(value) {
  const map = {
    create: 'Создание',
    update: 'Изменение',
    delete: 'Удаление',
    import: 'Импорт',
    export: 'Экспорт',
    login: 'Вход',
    logout: 'Выход'
  }
  return map[value] || value
}

function compactDetails(data) {
  if (!data) return '—'
  const text = JSON.stringify(data)
  return text.length > 120 ? `${text.slice(0, 117)}...` : text
}

export default function SystemHubPage({
  onExportCsv,
  onImportCsv,
  rows,
  historyLoading,
  onRefreshHistory
}) {
  const [activeTab, setActiveTab] = useState('data')
  const actionCount = rows?.length || 0
  const historyRows = useMemo(() => rows || [], [rows])

  return (
    <section>
      <div className="card system-hub-intro">
        <h3>Система</h3>
        <p className="hint">Импорт, экспорт и журнал действий.</p>
      </div>

      <div className="system-hub-head card">
        <div className="system-hub-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="system-hub-meta">
          <span className="system-pill">Записей в истории: {actionCount}</span>
        </div>
      </div>

      {activeTab === 'data' && (
        <div className="grid-cards system-grid">
          <div className="card">
            <h3>Экспорт данных</h3>
            <p className="hint">Скачивание операций в CSV.</p>
            <div className="table-actions">
              <button className="ghost" onClick={() => onExportCsv('income')}>Экспорт выручки</button>
              <button className="ghost" onClick={() => onExportCsv('expense')}>Экспорт затрат</button>
            </div>
          </div>

          <div className="card">
            <h3>Импорт данных</h3>
            <p className="hint">Загрузка CSV в систему.</p>
            <label className="field">
              <span>Выручка (CSV)</span>
              <input
                type="file"
                accept=".csv"
                onChange={(event) => event.target.files?.[0] && onImportCsv('income', event.target.files[0])}
              />
            </label>
            <label className="field">
              <span>Затраты (CSV)</span>
              <input
                type="file"
                accept=".csv"
                onChange={(event) => event.target.files?.[0] && onImportCsv('expense', event.target.files[0])}
              />
            </label>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card table-card">
          <div className="system-section-head">
            <h3>Журнал действий</h3>
            <button className="ghost" onClick={onRefreshHistory}>Обновить</button>
          </div>
          {historyLoading ? <SkeletonBlock rows={8} /> : historyRows.length === 0 ? (
            <EmptyState title="История пока пустая" description="События будут появляться автоматически." />
          ) : (
            <table>
              <thead><tr><th>Дата</th><th>Сущность</th><th>Действие</th><th>Детали</th></tr></thead>
              <tbody>
                {historyRows.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Дата">{new Date(item.created_at).toLocaleString('ru-RU')}</td>
                    <td data-label="Сущность"><span className="status-badge neutral">{formatEntity(item.entity)}</span></td>
                    <td data-label="Действие">{formatAction(item.action)}</td>
                    <td data-label="Детали">{compactDetails(item.data)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  )
}
