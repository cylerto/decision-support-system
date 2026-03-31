export default function Modal({ open, title, onClose, children }) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}
