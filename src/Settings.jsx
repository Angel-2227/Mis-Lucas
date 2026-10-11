import { useState } from 'react'
import { ChevronLeft, Plus, Trash2, LogOut } from 'lucide-react'
import { ACCOUNT_TYPES, ACCOUNT_COLORS, MONTHS_SHORT, cop } from './lib'
import { Sheet, Field, MoneyInput, CatDot } from './ui'

function AccountForm({ acc, onSave, onDelete, onClose }) {
  const [f, setF] = useState({ type: 'debit', name: '', number: '', owner: '', locked: false, color: ACCOUNT_COLORS[0], ...acc, initial: String(acc?.initial ?? '') })
  const hasNumber = f.type === 'sitp' || f.type === 'debit' || f.type === 'credit'
  return (
    <Sheet title={acc ? 'Editar cuenta' : 'Nueva cuenta'} onClose={onClose}>
      <Field label="Tipo">
        <div className="seg">{Object.entries(ACCOUNT_TYPES).map(([k, l]) => <button key={k} className={f.type === k ? 'on' : ''} onClick={() => set('type', k)}>{l}</button>)}</div>
      </Field>
      <Field label="Nombre"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder={f.type === 'sitp' ? 'SITP mía' : 'Cuenta de ahorros'} /></Field>
      <Field label={f.type === 'credit' ? 'Deuda inicial (0 si no debes)' : 'Saldo actual'}><MoneyInput value={f.initial} onChange={(v) => set('initial', v)} /></Field>
      {hasNumber && <Field label={f.type === 'sitp' ? 'Número de la tarjeta (para recargar)' : 'Últimos 4 dígitos (opcional)'}><input className="input" inputMode="numeric" value={f.number} onChange={(e) => set('number', e.target.value)} /></Field>}
      {(f.type === 'sitp' || f.type === 'credit' || f.type === 'debit') && <Field label="Propietario (opcional)"><input className="input" value={f.owner} onChange={(e) => set('owner', e.target.value)} placeholder="Ej: Mi prima" /></Field>}
      <Field label="Color"><div className="swatches">{ACCOUNT_COLORS.map((c) => <button key={c} className={f.color === c ? 'on' : ''} style={{ background: c }} onClick={() => set('color', c)} />)}</div></Field>
      <label className="check"><input type="checkbox" checked={!!f.locked} onChange={(e) => set('locked', e.target.checked)} /> Dinero apartado: no cuenta como disponible</label>
      <button className="btn primary wide" disabled={!f.name.trim()} onClick={() => { onSave({ type: f.type, name: f.name.trim(), initial: Number(f.initial) || 0, number: f.number || undefined, owner: f.owner || undefined, color: f.color, locked: !!f.locked }); onClose() }}>Guardar</button>
      {acc && <button className="btn wide danger" onClick={() => { if (confirm('¿Eliminar cuenta? Sus movimientos quedarán sin cuenta.')) { onDelete(); onClose() } }}>Eliminar cuenta</button>}
    </Sheet>
  )
}

function RecurringForm({ r, d, onSave, onDelete, onClose }) {
  const [f, setF] = useState({ name: '', accountId: '', skipMonths: [], ...r, amount: String(r?.amount ?? '') })
  const toggle = (m) => setF((p) => ({ ...p, skipMonths: p.skipMonths.includes(m) ? p.skipMonths.filter((x) => x !== m) : [...p.skipMonths, m] }))
  return (
    <Sheet title="Ingreso recurrente" onClose={onClose}>
      <Field label="Nombre"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Beca, apoyo familiar, trabajo" /></Field>
      <Field label="Monto mensual"><MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} /></Field>
      <Field label="Llega a">
        <select className="input" value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })}>
          <option value="">Primera cuenta</option>
          {d.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <Field label="Meses en que NO llega">
        <div className="chips">{MONTHS_SHORT.map((m, i) => <button key={m} className={'chip' + (f.skipMonths.includes(i + 1) ? ' on' : '')} onClick={() => toggle(i + 1)}>{m}</button>)}</div>
      </Field>
      <button className="btn primary wide" disabled={!f.name.trim() || !Number(f.amount)} onClick={() => { onSave({ id: f.id || 'r' + Date.now(), name: f.name.trim(), amount: Number(f.amount), accountId: f.accountId, skipMonths: f.skipMonths }); onClose() }}>Guardar</button>
      {r && <button className="btn wide danger" onClick={() => { onDelete(); onClose() }}>Eliminar</button>}
    </Sheet>
  )
}

export default function Settings({ d, back }) {
  const { api, settings } = d
  const [accForm, setAccForm] = useState(null)   // {} nuevo | cuenta
  const [recForm, setRecForm] = useState(null)
  const [catName, setCatName] = useState('')
  const [catColor, setCatColor] = useState('#2F80ED')

  const saveRec = (r) => {
    const exists = settings.recurring.some((x) => x.id === r.id)
    api.saveSettings({ recurring: exists ? settings.recurring.map((x) => (x.id === r.id ? r : x)) : [...settings.recurring, r] })
  }
  const addCat = () => {
    const n = catName.trim()
    if (!n || settings.categories.some((c) => c.name.toLowerCase() === n.toLowerCase())) return
    api.saveSettings({ categories: [...settings.categories, { name: n, color: catColor }] }); setCatName('')
  }

  return (
    <div className="page">
      <header className="top"><button className="icon-btn round" onClick={back}><ChevronLeft size={20} /></button><h1>Ajustes</h1><span /></header>

      <div className="sec-head"><h2>Cuentas y tarjetas</h2><button className="btn small primary" onClick={() => setAccForm({})}><Plus size={16} /> Agregar</button></div>
      <div className="list">
        {d.accounts.length === 0 && <p className="hint pad">Agrega efectivo, débito, crédito o SITP.</p>}
        {d.accounts.map((a) => (
          <button className="row btn-row" key={a.id} onClick={() => setAccForm(a)}>
            <span className="swatch" style={{ background: a.color }} />
            <div className="row-main"><strong>{a.name}</strong><small>{ACCOUNT_TYPES[a.type]}{a.owner ? ` - ${a.owner}` : ''}{a.locked ? ' - apartada' : ''}</small></div>
            <b className="amt">{cop(d.bal[a.id])}</b>
          </button>
        ))}
      </div>

      <div className="sec-head"><h2>Ingresos recurrentes</h2><button className="btn small primary" onClick={() => setRecForm({})}><Plus size={16} /> Agregar</button></div>
      <div className="list">
        {settings.recurring.map((r) => (
          <button className="row btn-row" key={r.id} onClick={() => setRecForm(r)}>
            <div className="row-main"><strong>{r.name}</strong><small>{r.skipMonths.length ? 'No llega en: ' + r.skipMonths.map((m) => MONTHS_SHORT[m - 1]).join(', ') : 'Todos los meses'}</small></div>
            <b className="amt">{cop(r.amount)}</b>
          </button>
        ))}
      </div>

      <h2>Categorías de gasto</h2>
      <div className="list">
        {settings.categories.map((c) => (
          <div className="row" key={c.name}>
            <CatDot name={c.name} color={c.color} size={34} />
            <div className="row-main"><strong>{c.name}</strong></div>
            <button className="icon-btn ghost" onClick={() => api.saveSettings({ categories: settings.categories.filter((x) => x.name !== c.name) })}><Trash2 size={16} /></button>
          </div>
        ))}
        <div className="row">
          <input type="color" className="color" value={catColor} onChange={(e) => setCatColor(e.target.value)} />
          <input className="input" placeholder="Nueva categoría" value={catName} onChange={(e) => setCatName(e.target.value)} />
          <button className="btn small primary" onClick={addCat}>Añadir</button>
        </div>
      </div>

      <button className="btn wide" onClick={api.logout}><LogOut size={16} /> Cerrar sesión</button>

      {accForm && <AccountForm acc={accForm.id ? accForm : null} onClose={() => setAccForm(null)}
        onSave={(data) => (accForm.id ? api.update('accounts', accForm.id, data) : api.add('accounts', data))}
        onDelete={() => api.remove('accounts', accForm.id)} />}
      {recForm && <RecurringForm r={recForm.id ? recForm : null} d={d} onClose={() => setRecForm(null)} onSave={saveRec}
        onDelete={() => api.saveSettings({ recurring: settings.recurring.filter((x) => x.id !== recForm.id) })} />}
    </div>
  )
}
