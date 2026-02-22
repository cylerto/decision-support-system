import Logo from '../brand/Logo.jsx'

const ICON = {
  dashboard: 'DB',
  operations: 'OP',
  income: 'IN',
  expense: 'EX',
  categories: 'PL',
  departments: 'DP',
  projects: 'PR',
  counterparties: 'CT',
  limit: 'LM',
  analytics: 'AN',
  trend: 'TR',
  structure: 'ST',
  budget: 'BV',
  forecast: 'FC',
  recommendations: 'RC',
  data: 'IM',
  history: 'HS',
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
