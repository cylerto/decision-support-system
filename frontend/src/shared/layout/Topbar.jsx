export default function Topbar({ title, quickActions, onQuickAction, theme, onToggleTheme, onLogout }) {
  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        <p>Горячие клавиши: i — доход, e — расход, c — категория</p>
      </div>
      <div className="topbar-actions">
        {quickActions.slice(0, 2).map((item) => (
          <button key={item.key} className="ghost" onClick={() => onQuickAction(item.action)}>{item.label}</button>
        ))}
        <button className="ghost" onClick={onToggleTheme}>{theme === 'light' ? 'Темная тема' : 'Светлая тема'}</button>
        <button className="ghost" onClick={onLogout}>Выйти</button>
      </div>
    </header>
  )
}
