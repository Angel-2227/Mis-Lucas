import { useState } from 'react'
import { Sheet, Field, MoneyInput } from './ui'
import { cop, today, round2 } from './lib'

// Ajusta el saldo de una cuenta al que muestra tu banco o tu billetera.
// Guarda la diferencia como "Ajuste de saldo": no cuenta como ingreso ni como gasto.
export default function ReconcileSheet({ d, acc, onClose }) {
  const options = d.accounts
  const first = acc?.id || options.find((a) => a.id === d.settings.defaultAccountId)?.id || options[0]?.id || ''
  const [accountId, setAccountId] = useState(first)
  const [real, setReal] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  const a = d.accounts.find((x) => x.id === accountId)
  const cur = d.bal[accountId] || 0
  const decimals = !!a && a.type !== 'cash'
  const realNum = decimals ? round2(Number(real)) : Math.round(Number(real) || 0)
  const has = real !== '' && real !== '-' && !Number.isNaN(realNum)
  const diff = has ? round2(realNum - cur) : 0
  const saved = d.savedByAccount[accountId] || 0

  const save = () => {
    if (!has || diff === 0) return
    d.api.add('transactions', {
      type: 'adjust', dir: diff > 0 ? 'in' : 'out', amount: Math.abs(diff), accountId, date,
      note: note.trim() || 'Ajuste de saldo', createdAt: Date.now(),
    })
    onClose()
  }

  return (
    <Sheet title="Ajustar al saldo real" onClose={onClose}>
      <Field label="Cuenta">
        <select className="input" value={accountId} onChange={(e) => { setAccountId(e.target.value); setReal('') }} disabled={!!acc}>
          {options.map((x) => <option key={x.id} value={x.id}>{x.name}{x.owner ? ` (${x.owner})` : ''}</option>)}
        </select>
      </Field>
      <p className="hint">La app tiene: <b>{cop(cur)}</b>{saved > 0 ? ` (incluye ${cop(saved)} en ahorro)` : ''}</p>
      <Field label="¿Cuánto hay realmente?">
        <MoneyInput value={real} onChange={setReal} allowDecimal={decimals} allowNegative={a?.type === 'sitp' || a?.type === 'credit'} />
      </Field>
      {has && diff !== 0 && (
        <p className="hint">Diferencia: <b className={diff > 0 ? 'pos' : 'neg'}>{diff > 0 ? '+' : '-'}{cop(Math.abs(diff))}</b>. Se registra como ajuste y {diff > 0 ? 'sube' : 'baja'} el saldo; no cuenta como ingreso ni gasto.</p>
      )}
      {has && diff === 0 && <p className="hint">El saldo ya coincide, no hay nada que ajustar.</p>}
      <Field label="Nota (opcional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: comisión del banco" /></Field>
      <Field label="Fecha"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <button className="btn primary wide" disabled={!has || diff === 0 || !accountId} onClick={save}>Guardar ajuste</button>
    </Sheet>
  )
}
