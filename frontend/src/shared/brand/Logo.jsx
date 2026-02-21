export default function Logo({ compact = false }) {
  return (
    <div className={`brand-logo ${compact ? 'compact' : ''}`}>
      <svg viewBox="0 0 64 64" role="img" aria-label="DSS logo">
        <defs>
          <linearGradient id="dss-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#dss-gradient)" />
        <path d="M16 42L26 32L34 38L46 22" fill="none" stroke="#f8fafc" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 20H23" stroke="#f8fafc" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M19 16V24" stroke="#f8fafc" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
      {!compact && (
        <div className="brand-text">
          <strong>DSS</strong>
          <span>Decision Support System</span>
        </div>
      )}
    </div>
  )
}
