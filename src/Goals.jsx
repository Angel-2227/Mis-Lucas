import { useState } from 'react'
import { ArrowUp, ArrowDown, Trash2, Plus, Check } from 'lucide-react'
import { cop, today } from './lib'
import { Sheet, Field, MoneyInput, Progress, Empty } from './ui'

function GoalForm({ onSave, onClose }) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  return (
    <Sheet title="Nueva meta" onClose={onClose}>
      <Field label="¿Qué quieres comprar?"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tableta gráfica" /></Field>
      <Field label="Precio estimado"><MoneyInput value={target} onChange={setTarget} /></Field>
      <Field label="Fecha límite (opcional)"><input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
      <button className="btn primary wide" disabled={!name.trim() || !Number(target)} onClick={() => { onSave({ name: name.trim(), target: Number(target), deadline: deadline || undefined }); onClose() }}>Crear meta</button>
    </Sheet>
  )
}

function BuySheet({ d, g, onClose }) {
  const [price, setPrice] = useState(String(g.target))
  const [accountId, setAccountId] = useState(d.accounts[0]?.id || '')
  const buy = () => {
    d.api.add('transactions', { type: 'expense', amount: Number(price), accountId, category: 'Metas', note: g.name, date: today(), createdAt: Date.now() })
    d.api.update('goals', g.id, { done: true })
    onClose()
  }
  return (
    <Sheet title={`Comprar: ${g.name}`} onClose={onClose}>
      <Field label="Precio final"><MoneyInput value={price} onChange={setPrice} /></Field>
      <Field label="Pagado desde">
        <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {d.accounts.map((a) => <option key={a.id} value={a.id}>{a.name} - {cop(d.bal[a.id])}</option>)}
        </select>
      </Field>
      <p className="hint">Se registra un gasto y la meta pasa a compradas. El dinero ahorrado deja de estar apartado.</p>
      <button className="btn primary wide" disabled={!Number(price) || !accountId} onClick={buy}>Registrar compra</button>
    </Sheet>
  )
}

export default function Goals({ d, openAdd }) {
  const [form, setForm] = useState(false)
  const [buying, setBuying] = useState(null)
  const sorted = [...d.goals].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const active = sorted.filter((g) => !g.done)
  const done = sorted.filter((g) => g.done)

  const move = (i, dir) => {
    const a = active[i], b = active[i + dir]
    if (!b) return
    d.api.update('goals', a.id, { order: i + dir })
    d.api.update('goals', b.id, { order: i })
    active.forEach((g, k) => { if (k !== i && k !== i + dir && g.order !== k) d.api.update('goals', g.id, { order: k }) })
  }
  const remove = (g) => {
    if (confirm(`¿Eliminar la meta "${g.name}"?`)) d.api.remove('goals', g.id)
  }

  return (
    <div className="page">
      <header className="top"><h1>Metas</h1><button className="btn small primary" onClick={() => setForm(true)}><Plus size={16} /> Meta</button></header>
      {active.length === 0 && <Empty title="Sin metas activas" text="Agrega lo que quieres comprar y ordénalo por prioridad." />}
      <div className="goals-grid">
      {active.map((g, i) => {
        const saved = d.savedByGoal[g.id] || 0
        const left = Math.max(0, g.target - saved)
        let perMonth = null
        if (g.deadline && left > 0) {
          const months = Math.max(1, Math.ceil((new Date(g.deadline) - new Date()) / (1000 * 60 * 60 * 24 * 30)))
          perMonth = Math.ceil(left / months)
        }
        return (
          <div className={'goal' + (i === 0 ? ' focus' : '')} key={g.id}>
            <div className="goal-head">
              <div><strong>{g.name}</strong>{i === 0 && <em className="tag">En foco</em>}</div>
              <div className="goal-actions">
                <button className="icon-btn ghost" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} /></button>
                <button className="icon-btn ghost" disabled={i === active.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} /></button>
                <button className="icon-btn ghost" onClick={() => remove(g)}><Trash2 size={16} /></button>
              </div>
            </div>
            <Progress value={saved} max={g.target} />
            <div className="goal-nums"><span>{cop(saved)} de {cop(g.target)}</span><b>{Math.round((saved / g.target) * 100) || 0}%</b></div>
            <small className="muted">Faltan {cop(left)}{perMonth ? ` - ahorra ${cop(perMonth)} al mes para llegar a tiempo` : ''}</small>
            <div className="goal-btns">
              <button className="btn small primary" onClick={() => openAdd({ type: 'saving', goalId: g.id })}>Aportar</button>
              <button className="btn small" onClick={() => setBuying(g)}><Check size={14} /> Comprada</button>
            </div>
          </div>
        )
      })}
      </div>
      {done.length > 0 && <>
        <h2>Compradas</h2>
        <div className="list">{done.map((g) => (
          <div className="row" key={g.id}><div className="row-main"><strong>{g.name}</strong><small>{cop(g.target)}</small></div>
            <button className="icon-btn ghost" onClick={() => remove(g)}><Trash2 size={16} /></button></div>
        ))}</div>
      </>}
      {form && <GoalForm onClose={() => setForm(false)} onSave={(g) => d.api.add('goals', { ...g, order: active.length, done: false })} />}
      {buying && <BuySheet d={d} g={buying} onClose={() => setBuying(null)} />}
    </div>
  )
}
