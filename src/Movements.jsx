import { useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { cop, today, monthKey, monthLabel, shiftMonth, dayLabel, navHint } from './lib'
import { MonthNav, Empty } from './ui'
import TxRow from './TxRow'
import TxDetail from './TxDetail'
import { DebtsPanel, SettleSheet } from './Debts'

const FILTERS = [['all', 'Todos'], ['expense', 'Gastos'], ['income', 'Ingresos'], ['transfer', 'Movidos'], ['saving', 'Ahorros'], ['debts', 'Deudas']]

export default function Movements({ d }) {
  const [month, setMonth] = useState(monthKey(today()))
  const [filter, setFilter] = useState(() => { const f = navHint.filter; navHint.filter = null; return f || 'all' })
  const [openId, setOpenId] = useState(null)
  const [settling, setSettling] = useState(null)

  const [q, setQ] = useState('')
  const [showF, setShowF] = useState(false)
  const [fAcc, setFAcc] = useState('')
  const [fCat, setFCat] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const norm = (x) => String(x ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const TYPE_WORDS = { expense: 'gasto', income: 'ingreso', transfer: 'transferencia', saving: 'ahorro aporte', withdraw: 'retiro meta ahorro', settle: 'pago deuda', adjust: 'ajuste saldo desfase' }
  const accName = (id) => d.accounts.find((a) => a.id === id)?.name
  const haystack = (t) => norm([
    TYPE_WORDS[t.type], t.category, t.note, t.debtPerson, t.person, accName(t.accountId), accName(t.toAccountId),
    d.goals.find((g) => g.id === t.goalId)?.name, t.date, String(t.amount), cop(t.amount),
    t.debtKind === 'owed' ? 'me deben deuda' : t.debtKind === 'owe' ? 'yo debo deuda' : '',
  ].filter(Boolean).join(' '))
  const tokens = norm(q).split(/\s+/).filter(Boolean)
  const searching = !!(tokens.length || fAcc || fCat || from || to)
  const typeOk = (t) => filter === 'all' || t.type === filter || (filter === 'saving' && t.type === 'withdraw')
  const matches = (t) => (
    (!fAcc || t.accountId === fAcc || t.toAccountId === fAcc) &&
    (!fCat || t.category === fCat) && (!from || t.date >= from) && (!to || t.date <= to) &&
    tokens.every((k) => haystack(t).includes(k))
  )
  const clear = () => { setQ(''); setFAcc(''); setFCat(''); setFrom(''); setTo('') }

  const list = d.txs
    .filter((t) => typeOk(t) && (searching ? matches(t) : monthKey(t.date) === month))
    .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))
  const sumIn = list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const sumOut = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const groups = list.reduce((acc, t) => { (acc[t.date] ||= []).push(t); return acc }, {})
  const total = list.reduce((s, t) => s + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0)

  const remove = (t) => {
    const debt = d.debtMap[t.id]
    if (debt && debt.paid > 0) return alert('Esta deuda tiene pagos registrados. Borra primero esos pagos.')
    if (confirm('¿Eliminar este movimiento? El saldo se recalcula solo.')) d.api.remove('transactions', t.id)
  }

  return (
    <div className="page">
      <h1>Movimientos</h1>
      <div className="chips scroll">
        {FILTERS.map(([k, l]) => <button key={k} className={'chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{l}</button>)}
      </div>
      {filter === 'debts' ? (
        <DebtsPanel d={d} onOpen={setOpenId} onSettle={setSettling} />
      ) : (
        <>
          <div className="searchbar">
            <Search size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: nota, categoría, persona, monto..." enterKeyHint="search" />
            {searching && <button className="icon-btn ghost" onClick={clear} aria-label="Limpiar búsqueda"><X size={16} /></button>}
            <button className={'icon-btn ghost' + (showF || fAcc || fCat || from || to ? ' on' : '')} onClick={() => setShowF(!showF)} aria-label="Filtros"><SlidersHorizontal size={16} /></button>
          </div>
          {showF && (
            <div className="filters">
              <select className="input" value={fAcc} onChange={(e) => setFAcc(e.target.value)}>
                <option value="">Todas las cuentas</option>
                {d.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select className="input" value={fCat} onChange={(e) => setFCat(e.target.value)}>
                <option value="">Todas las categorías</option>
                {d.settings.categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
              <label><small>Desde</small><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
              <label><small>Hasta</small><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            </div>
          )}
          {searching ? (
            <p className="hint">{list.length} {list.length === 1 ? 'resultado' : 'resultados'} en todos los meses{sumIn > 0 ? <> · Ingresos <b className="pos">{cop(sumIn)}</b></> : null}{sumOut > 0 ? <> · Gastos <b className="neg">{cop(sumOut)}</b></> : null}</p>
          ) : (
            <>
              <MonthNav month={month} onChange={setMonth} label={monthLabel} shift={shiftMonth} />
              <p className="hint">Balance del mes: <b className={total < 0 ? 'neg' : 'pos'}>{cop(total)}</b></p>
            </>
          )}
          {list.length === 0 && <Empty title="Nada por aquí" text={searching ? 'No encontré movimientos con esa búsqueda.' : 'No hay movimientos en este mes.'} />}
          <div className="days">
            {Object.keys(groups).sort().reverse().map((date) => (
              <section key={date}>
                <h4>{dayLabel(date)}</h4>
                <div className="list">{groups[date].map((t) => <TxRow key={t.id} t={t} d={d} onDelete={remove} onOpen={setOpenId} />)}</div>
              </section>
            ))}
          </div>
        </>
      )}
      {openId && <TxDetail key={openId} id={openId} d={d} onClose={() => setOpenId(null)} />}
      {settling && <SettleSheet d={d} debt={settling} onClose={() => setSettling(null)} />}
    </div>
  )
}
