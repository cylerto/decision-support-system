import SectionHeader from '../shared/ui/SectionHeader.jsx'
import EmptyState from '../shared/ui/EmptyState.jsx'

const KINDS = [
  { key: 'departments', title: 'Подразделения' },
  { key: 'projects', title: 'Проекты' }
]

function DirectoryBlock({ kind, title, rows, onCreate, onUpdate, onDelete }) {
  const inputId = `${kind}-name`

  return (
    <div className="card">
      <h3>{title}</h3>
      <form
        className="table-controls"
        onSubmit={(event) => {
          event.preventDefault()
          const value = event.currentTarget.elements[inputId]?.value?.trim()
          if (!value) return
          onCreate(kind, value)
          event.currentTarget.reset()
        }}
      >
        <label className="field compact">
          <span>Новое значение</span>
          <input name={inputId} placeholder={`Добавить: ${title}`} />
        </label>
        <button className="primary" type="submit">Добавить</button>
      </form>

      {!rows?.length ? (
        <EmptyState title="Пусто" description={`Список "${title}" пока пуст`} />
      ) : (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Название</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td data-label="Название">{row.name}</td>
                  <td data-label="Действия" className="table-actions">
                    <button
                      className="ghost"
                      type="button"
                      onClick={() => {
                        const next = window.prompt('Новое название', row.name)
                        if (!next || next.trim() === row.name) return
                        onUpdate(kind, row.id, next.trim())
                      }}
                    >
                      Редактировать
                    </button>
                    <button className="ghost danger" type="button" onClick={() => onDelete(kind, row.id)}>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function DirectoriesPage({ directories, onCreate, onUpdate, onDelete }) {
  return (
    <section>
      <SectionHeader
        title="Справочники"
        subtitle="Подразделения и проекты"
      />

      <div className="grid-cards">
        {KINDS.map((item) => (
          <DirectoryBlock
            key={item.key}
            kind={item.key}
            title={item.title}
            rows={directories?.[item.key] || []}
            onCreate={onCreate}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  )
}
