import SectionHeader from '../shared/ui/SectionHeader.jsx'

export default function SettingsPage({ settings, theme, onThemeChange, onSave }) {
  return (
    <section>
      <SectionHeader title="Настройки" subtitle="Валюта и темы" />
      <form
        className="card settings-form"
        onSubmit={(event) => {
          event.preventDefault()
          const baseCurrency = event.currentTarget.base_currency.value
          onSave({ base_currency: baseCurrency })
        }}
      >
        <label className="field">
          <span>Базовая валюта</span>
          <input name="base_currency" defaultValue={settings.base_currency} />
        </label>
        <label className="field">
          <span>Тема</span>
          <select value={theme} onChange={(event) => onThemeChange(event.target.value)}>
            <option value="light">Светлая</option>
            <option value="dark">Темная</option>
          </select>
        </label>
        <button className="primary" type="submit">Сохранить</button>
      </form>
    </section>
  )
}
