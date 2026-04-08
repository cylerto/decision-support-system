import Logo from '../shared/brand/Logo.jsx'

export default function AuthPage({ authMode, setAuthMode, profile, setProfile, onSubmit }) {
  return (
    <div className="auth-layout">
      <div className="auth-panel">
        <div className="brand">
          <Logo />
        </div>
        <form className="card" onSubmit={onSubmit}>
          <h2>{authMode === 'login' ? 'Вход' : 'Регистрация'}</h2>
          <label className="field">
            <span>Логин</span>
            <input
              value={profile.username}
              onChange={(event) => setProfile((prev) => ({ ...prev, username: event.target.value }))}
              required
            />
          </label>
          <label className="field">
            <span>Пароль</span>
            <input
              type="password"
              value={profile.password}
              onChange={(event) => setProfile((prev) => ({ ...prev, password: event.target.value }))}
              required
            />
          </label>
          <button className="primary" type="submit">{authMode === 'login' ? 'Войти' : 'Зарегистрироваться'}</button>
          <button className="ghost" type="button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
            {authMode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
          </button>
        </form>
      </div>
    </div>
  )
}
