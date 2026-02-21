import Logo from '../brand/Logo.jsx'

const ICON = {
  dashboard: 'DB',
  income: 'IN',
  expense: 'EX',
  categories: 'CT',
  limit: 'LM',
  analytics: 'AN',
  data: 'DT',
  settings: 'ST'
}

export default function Sidebar({ navGroups, active, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Logo />
      </div>
      {navGroups.map((group) => (
        <div key={group.title} className="nav-group">
          <div className="nav-group-title">
            <span className="nav-group-icon">{group.icon}</span>
            <span>{group.title}</span>
          </div>
          <nav>
            {group.items.map((item) => (
              <button
                key={item.key}
                className={`nav-item ${active === item.key ? 'active' : ''}`}
                onClick={() => onNavigate(item.key)}
              >
                <span className="nav-item-icon">{ICON[item.icon] || '•'}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      ))}
    </aside>
  )
}
