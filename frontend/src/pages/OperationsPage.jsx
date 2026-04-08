import SectionHeader from '../shared/ui/SectionHeader.jsx'
import IncomePage from './IncomePage.jsx'
import ExpensePage from './ExpensePage.jsx'

export default function OperationsPage({
  activeTab,
  setActiveTab,
  canCreate = true,
  incomeProps,
  expenseProps
}) {
  const isIncomeTab = activeTab === 'income'
  const createLabel = isIncomeTab ? 'Добавить выручку' : 'Добавить затрату'
  const handleCreate = isIncomeTab ? incomeProps?.onOpenCreate : expenseProps?.onOpenCreate

  return (
    <section>
      <SectionHeader
        title="Операции"
        subtitle="Учет выручки и затрат малого предприятия"
        actions={canCreate ? <button className="primary" type="button" onClick={handleCreate}>{createLabel}</button> : null}
      />

      <div className="card analytics-tabs sticky-tabs">
        <button className={`tab-btn ${activeTab === 'income' ? 'active' : ''}`} onClick={() => setActiveTab('income')} type="button">
          Выручка
        </button>
        <button className={`tab-btn ${activeTab === 'expense' ? 'active' : ''}`} onClick={() => setActiveTab('expense')} type="button">
          Затраты
        </button>
      </div>

      {isIncomeTab ? <IncomePage {...incomeProps} embedded /> : <ExpensePage {...expenseProps} embedded />}
    </section>
  )
}
