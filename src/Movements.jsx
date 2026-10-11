import { useState } from 'react'
import { cop, today, monthKey, monthLabel, shiftMonth, dayLabel } from './lib'
import { MonthNav, Empty } from './ui'
import TxRow from './TxRow'

const FILTERS = [['all', 'Todos'], ['expense', 'Gastos'], ['income', 'Ingresos'], ['transfer', 'Movidos'], ['saving', 'Ahorros']]

export default function Movements({ d }) {
  const [month, setMonth] = useState(monthKey(today()))
  const [filter, setFilter] = useState('all')

  const list = d.txs
    .filter((t) => monthKey(t.date) === month && (filter === 'all' || t.type === filter))
    .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))

  const groups = list.reduce((acc, t) => { (acc[t.date] ||= []).push(t); return acc }, {})
  const total = list.reduce((s, t) => s + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0)

  const remove = (t) => { if (confirm('¿Eliminar este movimiento? El saldo se recalcula solo.')) d.api.remove('transactions', t.id) }

  return (
    <div className="page">
      <h1>Movimientos</h1>
      <MonthNav month={month} onChange={setMonth} label={monthLabel} shift={shiftMonth} />
      <div className="chips scroll">
        {FILTERS.map(([k, l]) => <button key={k} className={'chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{l}</button>)}
      </div>
      <p className="hint">Balance del mes: <b className={total < 0 ? 'neg' : 'pos'}>{cop(total)}</b></p>
      {list.length === 0 && <Empty title="Nada por aquí" text="No hay movimientos en este mes." />}
      {Object.keys(groups).sort().reverse().map((date) => (
        <section key={date}>
          <h4>{dayLabel(date)}</h4>
          <div className="list">{groups[date].map((t) => <TxRow key={t.id} t={t} d={d} onDelete={remove} />)}</div>
        </section>
      ))}
    </div>
  )
}
