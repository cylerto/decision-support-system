import SectionHeader from '../shared/ui/SectionHeader.jsx'
import EmptyState from '../shared/ui/EmptyState.jsx'

const KINDS = [
  { key: 'departments', title: 'Подразделения' },
  { key: 'projects', title: 'Проекты' }
]

function DirectoryBlock({ kind, title, rows, onCreate, onUpdate, onDelete, canManage, canDelete }) {
  const inputName = `${kind}_name`

  return (
    <div className="card">
      <h3>{title}</h3>
      {canManage && (
        <form
          className="table-controls"
          onSubmit={(event) => {
            event.preventDefault()
            const formData = new FormData(event.currentTarget)
            const value = String(formData.get(inputName) || '').trim()
            if (!value) return
            onCreate(kind, value)
            event.currentTarget.reset()
          }}
        >
          <label className="field compact">
            <span>Новое значение</span>
            <input name={inputName} placeholder={`Добавить: ${title}`} required />
          </label>
          <button className="primary" type="submit">Добавить</button>
        </form>
      )}

      {!rows?.length ? (
        <EmptyState title="Пусто" description={`Список "${title}" пока пуст`} />
      ) : (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Название</th>
                {(canManage || canDelete) && <th>Действия</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td data-label="Название">{row.name}</td>
                  {(canManage || canDelete) && (
                    <td data-label="Действия" className="table-actions">
                      {canManage && (
                        <button
                          className="ghost btn-secondary action-edit"
                          type="button"
                          onClick={() => {
                            const next = window.prompt('Новое название', row.name)
                            if (!next || next.trim() === row.name) return
                            onUpdate(kind, row.id, next.trim())
                          }}
                        >
                          Редактировать
                        </button>
                      )}
                      {canDelete && <button className="ghost danger btn-danger action-delete" type="button" onClick={() => onDelete(kind, row.id)}>Удалить</button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function DirectoriesPage({ directories, onCreate, onUpdate, onDelete, canManage = true, canDelete = true }) {
  return (
    <section>
      <SectionHeader title="Справочники" subtitle="Подразделения и проекты" />
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
            canManage={canManage}
            canDelete={canDelete}
          />
        ))}
      </div>
    </section>
  )
}
