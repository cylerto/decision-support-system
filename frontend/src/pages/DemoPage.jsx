import SectionHeader from '../shared/ui/SectionHeader.jsx'

export default function DemoPage({ onSeedDemo }) {
  return (
    <section>
      <SectionHeader title="Демо-данные" subtitle="Заполнение системы" />
      <div className="card">
        <button className="primary" onClick={onSeedDemo}>Загрузить демо-данные</button>
      </div>
    </section>
  )
}
