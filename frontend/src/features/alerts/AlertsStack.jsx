export default function AlertsStack({ alerts, onClose }) {
  return (
    <div className="alerts">
      {alerts.map((alert) => (
        <div key={alert.id} className={`alert alert-${alert.tone}`}>
          <span>{alert.message}</span>
          <button onClick={() => onClose(alert.id)}>Закрыть</button>
        </div>
      ))}
    </div>
  )
}
