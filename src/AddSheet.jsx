import { useState } from 'react'
import { Sheet, Field, MoneyInput } from './ui'
import { today, cop } from './lib'

const TYPES = [['expense', 'Gasto'], ['income', 'Ingreso'], ['transfer', 'Mover'], ['saving', 'Ahorro'], ['fare', 'Pasaje']]

export default function AddSheet({ d, initial = {}, onClose }) {
  const { accounts, goals, settings, api } = d
  const activeGoals = goals.filter((g) => !g.done)
  const sitp = accounts.filter((a) => a.type === 'sitp')
  const fare = Number(settings.fare) || 0
  const [type, setType] = useState(initial.type || 'expense')
  const [amount, setAmount] = useState('')
  const [qty, setQty] = useState(2)
  const [accountId, setAccountId] = useState(initial.accountId || (initial.type === 'fare' ? sitp[0]?.id : accounts[0]?.id) || '')
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id || '')
  const [category, setCategory] = useState(settings.categories[0]?.name || '')
  const [goalId, setGoalId] = useState(initial.goalId || activeGoals[0]?.id || '')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())

  const pickType = (k) => {
    setType(k)
    if (k === 'fare' && !sitp.some((a) => a.id === accountId)) setAccountId(sitp[0]?.id || '')
    if (k !== 'fare' && sitp.some((a) => a.id === accountId) && k !== 'transfer') setAccountId(accounts[0]?.id || '')
  }
  const needsAccount = type !== 'saving'
  const isFare = type === 'fare'
  const total = qty * fare
  const left = Math.floor(((d.bal[accountId] || 0) - total) / (fare || 1))
  const valid = isFare ? (fare > 0 && qty > 0 && accountId) : Number(amount) > 0 &&
    (!needsAccount || accountId) &&
    (type !== 'transfer' || (toAccountId && toAccountId !== accountId)) &&
    (type !== 'saving' || goalId)

  const save = () => {
    if (!valid) return
    if (isFare) {
      api.add('transactions', { type: 'expense', amount: total, qty, category: 'Transporte', date, note: note.trim() || undefined, accountId, createdAt: Date.now() })
      return onClose()
    }
    api.add('transactions', {
      type, amount: Number(amount), date, note: note.trim() || undefined, createdAt: Date.now(),
      accountId: needsAccount ? accountId : undefined,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      category: type === 'expense' ? category : undefined,
      goalId: type === 'saving' ? goalId : undefined,
    })
    onClose()
  }

  const accountOptions = accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.owner ? ` (${a.owner})` : ''} - {cop(d.bal[a.id])}</option>)

  return (
    <Sheet title="Nuevo movimiento" onClose={onClose}>
      <div className="seg">
        {TYPES.map(([k, l]) => <button key={k} className={type === k ? 'on' : ''} onClick={() => pickType(k)}>{l}</button>)}
      </div>
      {!isFare && <Field label="Monto"><MoneyInput value={amount} onChange={setAmount} /></Field>}

      {accounts.length === 0 && type !== 'saving' && <p className="hint">Primero crea una cuenta en Ajustes.</p>}

      {isFare ? (
        <>
          <Field label="Tarjeta SITP">
            <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {sitp.map((a) => <option key={a.id} value={a.id}>{a.name}{a.owner ? ` (${a.owner})` : ''} - {Math.max(0, Math.floor((d.bal[a.id] || 0) / (fare || 1)))} pasajes</option>)}
            </select>
          </Field>
          {sitp.length === 0 && <p className="hint">Crea una tarjeta SITP en Ajustes.</p>}
          {fare <= 0 && <p className="hint">Define el valor del pasaje en Ajustes.</p>}
          <Field label="Pasajes usados">
            <div className="stepper">
              <button type="button" onClick={() => setQty(Math.max(1, qty - 1))}>-</button>
              <b>{qty}</b>
              <button type="button" onClick={() => setQty(qty + 1)}>+</button>
            </div>
          </Field>
          <p className="hint">Total: <b>{cop(total)}</b>. {left >= 0 ? `Te quedarán ${left} pasajes.` : `El saldo quedará en ${cop((d.bal[accountId] || 0) - total)}.`}</p>
        </>
      ) : type === 'transfer' ? (
        <>
          <Field label="Desde"><select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>{accountOptions}</select></Field>
          <Field label="Hacia"><select className="input" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>{accountOptions}</select></Field>
        </>
      ) : type === 'saving' ? (
        <>
          <Field label="Meta">
            <select className="input" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
              {activeGoals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
          {activeGoals.length === 0 && <p className="hint">Crea una meta primero.</p>}
          <p className="hint">El ahorro aparta dinero de tu disponible sin moverlo de cuenta.</p>
        </>
      ) : (
        <Field label={type === 'income' ? 'Entra a' : 'Sale de'}>
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>{accountOptions}</select>
        </Field>
      )}

      {type === 'expense' && (
        <Field label="Categoría">
          <div className="chips">
            {settings.categories.map((c) => (
              <button key={c.name} className={'chip' + (category === c.name ? ' on' : '')}
                style={category === c.name ? { background: c.color, borderColor: c.color } : {}}
                onClick={() => setCategory(c.name)}>{c.name}</button>
            ))}
          </div>
        </Field>
      )}

      <Field label="Nota (opcional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <Field label="Fecha"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <button className="btn primary wide" disabled={!valid} onClick={save}>Guardar</button>
    </Sheet>
  )
}
