export default function SectionHeader({ title, subtitle, actions }) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <div className="section-actions">{actions}</div>
    </div>
  )
}
