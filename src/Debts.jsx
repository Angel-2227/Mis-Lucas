import { useState } from 'react'
import { Sheet, Field, MoneyInput, Progress } from './ui'
import { cop, today, round2 } from './lib'

// Campos para marcar un gasto como deuda (se usan al crear y al editar).
export function DebtFields({ v, set, d, locked }) {
  const persons = [...new Set(d.txs.map((t) => t.debtPerson).filter(Boolean))]
  return (
    <>
      <Field label="¿Es una deuda?">
        <div className="seg">
          {[['', 'No'], ['owed', 'Me deben'], ['owe', 'Yo debo']].map(([k, l]) => (
            <button key={k} type="button" disabled={locked} className={v.debtKind === k ? 'on' : ''} onClick={() => set('debtKind', k)}>{l}</button>
          ))}
        </div>
      </Field>
      {locked && <p className="hint">Esta deuda ya tiene pagos registrados, por eso no se puede cambiar. Borra los pagos si necesitas modificarla.</p>}
      {v.debtKind && (
        <>
          <Field label={v.debtKind === 'owed' ? '¿Quién te debe?' : '¿A quién le debes?'}>
            <input className="input" list="debt-persons" value={v.debtPerson} disabled={locked} onChange={(e) => set('debtPerson', e.target.value)} placeholder="Nombre" />
            <datalist id="debt-persons">{persons.map((p) => <option key={p} value={p} />)}</datalist>
          </Field>
          {v.debtKind === 'owed' && (
            <Field label="¿Cuánto te deben? (vacío = todo el gasto)">
              <MoneyInput value={v.debtAmount} onChange={(x) => set('debtAmount', x)} allowDecimal />
            </Field>
          )}
          {v.debtKind === 'owe' && <p className="hint">La plata la prestó esa persona, así que no sale de tus cuentas. Cuando le pagues, registra el pago y ahí sí sale.</p>}
        </>
      )}
    </>
  )
}

// Cuenta donde queda guardado un ahorro.
export function SavingAccountField({ d, value, onChange }) {
  const eligible = d.accounts.filter((a) => a.type !== 'sitp' && a.type !== 'credit')
  return (
    <Field label="Guardado en">
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sin tarjeta (apartado general)</option>
        {eligible.map((a) => <option key={a.id} value={a.id}>{a.name}{a.owner ? ` (${a.owner})` : ''}</option>)}
      </select>
      <p className="hint">El dinero sigue en la tarjeta, pero queda "en ahorro" y no cuenta como disponible.</p>
    </Field>
  )
}

// Registrar un pago (me pagaron / yo pagué) de una deuda.
export function SettleSheet({ d, debt, onClose }) {
  const owed = debt.kind === 'owed'
  const accs = d.accounts.filter((a) => a.type !== 'sitp')
  const [amount, setAmount] = useState(String(debt.left))
  const [accountId, setAccountId] = useState(accs[0]?.id || '')
  const [date, setDate] = useState(today())
  const num = round2(Number(amount))
  const valid = num > 0 && num <= debt.left + 0.001 && accountId
  const save = () => {
    if (!valid) return
    d.api.add('transactions', {
      type: 'settle', debtId: debt.id, dir: owed ? 'in' : 'out', amount: num, accountId, date,
      person: debt.person, createdAt: Date.now(),
    })
    onClose()
  }
  return (
    <Sheet title={owed ? 'Me pagaron' : 'Registrar mi pago'} onClose={onClose}>
      <p className="hint">{owed ? `${debt.person} te debe` : `Le debes a ${debt.person}`} <b>{cop(debt.left)}</b> de {cop(debt.total)}.</p>
      <Field label="Monto del pago"><MoneyInput value={amount} onChange={setAmount} allowDecimal /></Field>
      {num > debt.left + 0.001 && <p className="hint neg">El pago no puede ser mayor a lo que falta.</p>}
      <Field label={owed ? 'Entra a' : 'Sale de'}>
        <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accs.map((a) => <option key={a.id} value={a.id}>{a.name}{a.owner ? ` (${a.owner})` : ''} - {cop(d.bal[a.id])}</option>)}
        </select>
      </Field>
      <Field label="Fecha"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <button className="btn primary wide" disabled={!valid} onClick={save}>Guardar pago</button>
    </Sheet>
  )
}

// Vista de deudas agrupadas por persona.
export function DebtsPanel({ d, onOpen, onSettle }) {
  const [showDone, setShowDone] = useState(false)
  const list = d.debts.filter((x) => showDone ? x.left <= 0 : x.left > 0)
  const groups = {}
  list.forEach((x) => { (groups[x.person.toLowerCase()] ||= { person: x.person, items: [] }).items.push(x) })
  const people = Object.values(groups).sort((a, b) => a.person.localeCompare(b.person))
  const net = (g) => g.items.reduce((s, x) => s + (x.kind === 'owed' ? x.left : -x.left), 0)

  return (
    <div>
      <section className="debt-sum">
        <div><small>Te deben</small><b className="pos">{cop(d.owedToMe)}</b></div>
        <div><small>Debes</small><b className="neg">{cop(d.iOwe)}</b></div>
      </section>
      <div className="chips">
        <button className={'chip' + (!showDone ? ' on' : '')} onClick={() => setShowDone(false)}>Pendientes</button>
        <button className={'chip' + (showDone ? ' on' : '')} onClick={() => setShowDone(true)}>Saldadas</button>
      </div>
      {people.length === 0 && (
        <div className="empty"><strong>{showDone ? 'Aún no hay deudas saldadas' : 'Sin deudas pendientes'}</strong>
          <p>{showDone ? 'Cuando una deuda se pague completa, aparece aquí.' : 'Al crear un gasto puedes marcarlo como "Me deben" o "Yo debo".'}</p></div>
      )}
      {people.map((g) => {
        const n = net(g)
        return (
          <section key={g.person}>
            <h4 className="debt-person">{g.person}
              {!showDone && <span className={n >= 0 ? 'pos' : 'neg'}>{n >= 0 ? `Te debe ${cop(n)}` : `Le debes ${cop(-n)}`}</span>}
            </h4>
            <div className="list">
              {g.items.map((x) => (
                <div key={x.id} className="debt-item">
                  <button className="debt-open" onClick={() => onOpen(x.id)}>
                    <strong>{x.tx.note || x.tx.category || 'Gasto'}</strong>
                    <small>{x.kind === 'owed' ? 'Me deben' : 'Yo debo'} · {x.tx.date}</small>
                    <Progress value={x.paid} max={x.total} />
                    <small>{showDone ? `Pagada: ${cop(x.total)}` : `Falta ${cop(x.left)} de ${cop(x.total)}`}</small>
                  </button>
                  {!showDone && <button className="btn small primary" onClick={() => onSettle(x)}>{x.kind === 'owed' ? 'Me pagaron' : 'Pagué'}</button>}
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
