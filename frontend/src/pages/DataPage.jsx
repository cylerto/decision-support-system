import SectionHeader from '../shared/ui/SectionHeader.jsx'

export default function DataPage({ onSeedDemo, onExportCsv, onImportCsv }) {
  return (
    <section>
      <SectionHeader title="Импорт/Экспорт" subtitle="Только CSV" actions={<button className="ghost" onClick={onSeedDemo}>Загрузить демо-данные</button>} />
      <div className="grid-cards">
        <div className="card">
          <h3>Экспорт</h3>
          <button className="ghost" onClick={() => onExportCsv('income')}>Доходы CSV</button>
          <button className="ghost" onClick={() => onExportCsv('expense')}>Расходы CSV</button>
        </div>
        <div className="card">
          <h3>Импорт</h3>
          <label className="field"><span>Доходы</span><input type="file" accept=".csv" onChange={(event) => event.target.files?.[0] && onImportCsv('income', event.target.files[0])} /></label>
          <label className="field"><span>Расходы</span><input type="file" accept=".csv" onChange={(event) => event.target.files?.[0] && onImportCsv('expense', event.target.files[0])} /></label>
        </div>
      </div>
    </section>
  )
}
