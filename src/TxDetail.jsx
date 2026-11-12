import { useState } from 'react'
import { deleteField } from 'firebase/firestore'
import { Pencil, Trash2 } from 'lucide-react'
import { Sheet, Field, MoneyInput, Progress } from './ui'
import { cop, round2, computeBalances } from './lib'
import { DebtFields, SavingAccountField, SettleSheet } from './Debts'

const TYPE_NAME = { expense: 'Gasto', income: 'Ingreso', transfer: 'Transferencia', saving: 'Ahorro', settle: 'Pago de deuda' }
const init = (t) => ({
  amount: String(t.amount ?? ''), accountId: t.accountId || '', toAccountId: t.toAccountId || '', category: t.category || '',
  goalId: t.goalId || '', note: t.note || '', date: t.date || '', debtKind: t.debtKind || '', debtPerson: t.debtPerson || '',
  debtAmount: t.debtAmount !== undefined ? String(t.debtAmount) : '',
})

function Line({ k, v }) {
  return <div className="ticket-line"><span>{k}</span><b>{v}</b></div>
}

export default function TxDetail({ id, d, onClose }) {
  const t = d.txs.find((x) => x.id === id)
  const [mode, setMode] = useState('view') // view | edit | c1 | c2
  const [f, setF] = useState(() => (t ? init(t) : {}))
  const [settling, setSettling] = useState(false)
  if (!t) return null
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))

  const accName = (x) => (x ? d.accounts.find((a) => a.id === x)?.name || 'Cuenta eliminada' : 'Ninguna')
  const goalName = (x) => d.goals.find((g) => g.id === x)?.name || '—'
  const debt = d.debtMap[t.id]
  const sign = t.type === 'expense' ? '-' : t.type === 'income' ? '+' : ''
  const cls = t.type === 'expense' ? 'neg' : t.type === 'income' ? 'pos' : ''
  const isCash = (x) => d.accounts.find((a) => a.id === x)?.type === 'cash'
  const owe = t.type === 'expense' && f.debtKind === 'owe'
  const decimals = t.type === 'saving' ? true : t.type === 'transfer' ? !(isCash(f.accountId) || isCash(f.toAccountId)) : owe ? true : !isCash(f.accountId)
  const amountNum = decimals ? round2(Number(f.amount)) : Math.round(Number(f.amount) || 0)
  const needsAccount = t.type !== 'saving' && !owe
  const valid = amountNum > 0 && f.date && (!needsAccount || f.accountId) &&
    (t.type !== 'transfer' || (f.toAccountId && f.toAccountId !== f.accountId)) &&
    (t.type !== 'saving' || f.goalId) && (!f.debtKind || f.debtPerson.trim())

  // Valores nuevos (undefined = campo vacío / se quita del movimiento)
  const build = () => {
    const n = { amount: amountNum, date: f.date, note: f.note.trim() || undefined }
    if (t.type === 'expense') {
      n.accountId = owe ? undefined : f.accountId
      n.category = f.category
      n.debtKind = f.debtKind || undefined
      n.debtPerson = f.debtKind ? f.debtPerson.trim() : undefined
      const da = round2(Number(f.debtAmount))
      n.debtAmount = f.debtKind === 'owed' && da > 0 && da < amountNum ? da : undefined
    }
    if (t.type === 'income' || t.type === 'settle') n.accountId = f.accountId
    if (t.type === 'transfer') { n.accountId = f.accountId; n.toAccountId = f.toAccountId }
    if (t.type === 'saving') { n.goalId = f.goalId; n.accountId = f.accountId || undefined }
    return n
  }
  const n = mode === 'view' ? {} : build()
  const LABEL = { amount: 'Monto', accountId: t.type === 'income' || t.type === 'settle' && t.dir === 'in' ? 'Entra a' : t.type === 'saving' ? 'Guardado en' : 'Sale de', toAccountId: 'Hacia', category: 'Categoría', goalId: 'Meta', note: 'Nota', date: 'Fecha', debtKind: 'Deuda', debtPerson: 'Persona', debtAmount: 'Valor de la deuda' }
  const SHOW = {
    amount: cop, accountId: accName, toAccountId: accName, goalId: goalName, note: (v) => v || '—', date: (v) => v, category: (v) => v || '—',
    debtKind: (v) => (v === 'owed' ? 'Me deben' : v === 'owe' ? 'Yo debo' : 'Sin deuda'), debtPerson: (v) => v || '—',
    debtAmount: (v) => (v !== undefined ? cop(v) : 'Todo el gasto'),
  }
  const changedKeys = Object.keys(n).filter((k) => (n[k] ?? undefined) !== (t[k] ?? undefined))
  const changes = changedKeys.map((k) => [LABEL[k], SHOW[k](t[k]), SHOW[k](n[k])])

  const newBal = mode === 'c2' ? computeBalances(d.accounts, d.txs.map((x) => (x.id === t.id ? { ...x, ...n } : x))) : {}
  const impact = mode === 'c2' ? d.accounts.filter((a) => newBal[a.id] !== d.bal[a.id]).map((a) => [a.name, d.bal[a.id], newBal[a.id]]) : []

  const save = async () => {
    const patch = { editedAt: Date.now() }
    changedKeys.forEach((k) => { patch[k] = n[k] === undefined ? deleteField() : n[k] })
    await d.api.update('transactions', t.id, patch)
    setMode('view')
  }
  const remove = () => {
    if (debt && debt.paid > 0) return alert('Esta deuda tiene pagos registrados. Borra primero esos pagos.')
    if (confirm('¿Eliminar este movimiento? El saldo se recalcula solo.')) { d.api.remove('transactions', t.id); onClose() }
  }

  const accountOptions = d.accounts.filter((a) => a.type !== 'sitp' || t.type === 'expense' || t.type === 'transfer')
    .map((a) => <option key={a.id} value={a.id}>{a.name}{a.owner ? ` (${a.owner})` : ''} - {cop(d.bal[a.id])}</option>)

  // ---------- Confirmaciones ----------
  if (mode === 'c1' || mode === 'c2') {
    return (
      <Sheet title={mode === 'c1' ? 'Confirmar cambios (1 de 2)' : 'Confirmación final (2 de 2)'} onClose={onClose}>
        <div className="ticket">
          {mode === 'c1' ? (
            <>
              <p className="hint">Estás cambiando un movimiento ya registrado:</p>
              {changes.map(([k, a, b]) => (
                <div className="diff" key={k}><span>{k}</span><s>{a}</s><b>{b}</b></div>
              ))}
            </>
          ) : (
            <>
              <p className="hint">Así quedarían tus saldos:</p>
              {impact.length === 0 && <p className="hint">Los saldos no cambian.</p>}
              {impact.map(([name, a, b]) => <div className="diff" key={name}><span>{name}</span><s>{cop(a)}</s><b>{cop(b)}</b></div>)}
              <p className="hint"><b>Última confirmación:</b> se va a modificar un movimiento que ya existía.</p>
            </>
          )}
        </div>
        <button className="btn primary wide" onClick={mode === 'c1' ? () => setMode('c2') : save}>{mode === 'c1' ? 'Continuar' : 'Sí, guardar los cambios'}</button>
        <button className="btn wide" onClick={() => setMode('edit')}>Volver a editar</button>
      </Sheet>
    )
  }

  // ---------- Edición ----------
  if (mode === 'edit') {
    return (
      <Sheet title={'Editar ' + TYPE_NAME[t.type].toLowerCase()} onClose={onClose}>
        <Field label="Monto"><MoneyInput value={f.amount} onChange={(v) => set('amount', v)} allowDecimal={decimals} /></Field>
        {t.type === 'transfer' ? (
          <>
            <Field label="Desde"><select className="input" value={f.accountId} onChange={(e) => set('accountId', e.target.value)}>{accountOptions}</select></Field>
            <Field label="Hacia"><select className="input" value={f.toAccountId} onChange={(e) => set('toAccountId', e.target.value)}>{accountOptions}</select></Field>
          </>
        ) : t.type === 'saving' ? (
          <>
            <Field label="Meta">
              <select className="input" value={f.goalId} onChange={(e) => set('goalId', e.target.value)}>
                {d.goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
            <SavingAccountField d={d} value={f.accountId} onChange={(v) => set('accountId', v)} />
          </>
        ) : needsAccount ? (
          <Field label={t.type === 'expense' ? 'Sale de' : t.type === 'settle' && t.dir === 'out' ? 'Sale de' : 'Entra a'}>
            <select className="input" value={f.accountId} onChange={(e) => set('accountId', e.target.value)}>
              {f.accountId === '' && <option value="">Elige una cuenta</option>}{accountOptions}
            </select>
          </Field>
        ) : <p className="hint">Este gasto no sale de tus cuentas porque es una deuda tuya.</p>}
        {t.type === 'expense' && (
          <Field label="Categoría">
            <div className="chips">
              {d.settings.categories.map((c) => (
                <button key={c.name} type="button" className={'chip' + (f.category === c.name ? ' on' : '')}
                  style={f.category === c.name ? { background: c.color, borderColor: c.color } : {}} onClick={() => set('category', c.name)}>{c.name}</button>
              ))}
            </div>
          </Field>
        )}
        <Field label="Nota"><input className="input" value={f.note} onChange={(e) => set('note', e.target.value)} /></Field>
        <Field label="Fecha"><input className="input" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
        {t.type === 'expense' && !t.qty && <DebtFields v={f} set={set} d={d} locked={!!debt && debt.paid > 0} />}
        <button className="btn primary wide" disabled={!valid || changes.length === 0} onClick={() => setMode('c1')}>Revisar cambios</button>
        <button className="btn wide" onClick={() => { setF(init(t)); setMode('view') }}>Cancelar</button>
      </Sheet>
    )
  }

  // ---------- Ticket ----------
  const when = t.createdAt ? new Date(t.createdAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : null
  return (
    <Sheet title="Detalle del movimiento" onClose={onClose}>
      <div className="ticket">
        <div className="ticket-head">
          <small>{TYPE_NAME[t.type]}</small>
          <div className={'ticket-amt ' + cls}>{sign}{cop(t.amount)}</div>
        </div>
        <div className="ticket-lines">
          <Line k="Fecha" v={t.date} />
          {t.type === 'transfer' ? (<><Line k="Desde" v={accName(t.accountId)} /><Line k="Hacia" v={accName(t.toAccountId)} /></>)
            : t.type === 'saving' ? (<><Line k="Meta" v={goalName(t.goalId)} /><Line k="Guardado en" v={t.accountId ? accName(t.accountId) : 'Apartado general'} /></>)
            : t.accountId ? <Line k={t.type === 'income' || (t.type === 'settle' && t.dir === 'in') ? 'Entra a' : 'Sale de'} v={accName(t.accountId)} />
            : <Line k="Cuenta" v="Plata prestada (no sale de tus cuentas)" />}
          {t.type === 'expense' && <Line k="Categoría" v={t.category || '—'} />}
          {t.qty ? <Line k="Pasajes" v={t.qty} /> : null}
          {t.type === 'settle' && <Line k="Persona" v={t.person || '—'} />}
          {t.note && <Line k="Nota" v={t.note} />}
        </div>
        {debt && (
          <div className="ticket-debt">
            <b>{debt.kind === 'owed' ? `${debt.person} te debe` : `Le debes a ${debt.person}`}</b>
            <Progress value={debt.paid} max={debt.total} />
            <small>{debt.left > 0 ? `Falta ${cop(debt.left)} de ${cop(debt.total)}` : `Saldada (${cop(debt.total)})`}</small>
            {debt.left > 0 && <button className="btn small primary" onClick={() => setSettling(true)}>{debt.kind === 'owed' ? 'Me pagaron' : 'Registrar mi pago'}</button>}
          </div>
        )}
        <div className="ticket-foot">
          {when && <span>Registrado: {when}</span>}
          {t.editedAt && <span>Editado: {new Date(t.editedAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</span>}
          <span>Ref. {t.id.slice(0, 8)}</span>
        </div>
      </div>
      <div className="ticket-actions">
        <button className="btn primary" onClick={() => { setF(init(t)); setMode('edit') }}><Pencil size={16} /> Editar</button>
        <button className="btn danger" onClick={remove}><Trash2 size={16} /> Eliminar</button>
      </div>
      {settling && <SettleSheet d={d} debt={debt} onClose={() => setSettling(false)} />}
    </Sheet>
  )
}
