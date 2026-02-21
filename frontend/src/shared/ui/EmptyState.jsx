export default function EmptyState({ title, description }) {
  return (
    <div className="empty-state">
      <div className="empty-illustration" aria-hidden>◌</div>
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
  )
}
