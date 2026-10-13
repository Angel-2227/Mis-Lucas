import { useEffect, useState } from 'react'
import { ChevronLeft, Plus, Trash2, LogOut } from 'lucide-react'
import { deleteField } from 'firebase/firestore'
import { ACCOUNT_TYPES, ACCOUNT_COLORS, MONTHS_SHORT, BRANDS, NETWORKS, cop, round2 } from './lib'
import { useGate, useUnlocked } from './Vault'
import * as V from './vault'
import { bioSupported, bioEnabled, bioEnable, bioDisable } from './biometric'
import { Sheet, Field, MoneyInput, CatDot } from './ui'

function AccountForm({ d, acc, onSave, onDelete, onClose }) {
  const [f, setF] = useState({ type: 'debit', name: '', owner: '', locked: false, color: ACCOUNT_COLORS[0], brand: '', network: '', ...acc, initial: String(acc?.initial ?? '') })
  const [editNum, setEditNum] = useState(false)
  const [numInput, setNumInput] = useState('')
  const [run, gate] = useGate(d)
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const last4 = acc?.last4 || (acc?.number ? String(acc.number).slice(-4) : '')
  const isCard = f.type !== 'cash'

  const save = async () => {
    const data = { type: f.type, name: f.name.trim(), initial: f.type === 'cash' ? Math.round(Number(f.initial) || 0) : round2(f.initial), owner: f.owner || '', color: f.color, locked: !!f.locked, brand: f.brand || '', network: isCard ? f.network || '' : '' }
    if (editNum) {
      const digits = numInput.replace(/\D/g, '')
      if (digits && digits.length < 4) return alert('El número debe tener al menos 4 dígitos.')
      try {
        data.numberEnc = digits ? await V.encryptText(digits) : ''
        data.last4 = digits.slice(-4)
      } catch { return alert('La sesión de seguridad expiró. Desbloquea de nuevo.') }
    }
    onSave(data)
    onClose()
  }

  return (
    <Sheet title={acc ? 'Editar cuenta' : 'Nueva cuenta'} onClose={onClose}>
      {gate}
      <Field label="Tipo">
        <div className="seg">{Object.entries(ACCOUNT_TYPES).map(([k, l]) => <button key={k} className={f.type === k ? 'on' : ''} onClick={() => set('type', k)}>{l}</button>)}</div>
      </Field>
      <Field label="Nombre"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder={f.type === 'sitp' ? 'TuLlave mía' : f.type === 'savings' ? 'Nequi' : 'Cuenta'} /></Field>
      <Field label="Estilo de tarjeta">
        <div className="chips">
          {[['', 'Otro'], ...Object.entries(BRANDS).map(([k, v]) => [k, v.label])].map(([k, l]) => (
            <button key={k} className={'chip' + (f.brand === k ? ' on' : '')} onClick={() => set('brand', k)}>{l}</button>
          ))}
        </div>
      </Field>
      {!f.brand && f.type !== 'cash' && (
        <Field label="Color"><div className="swatches">{ACCOUNT_COLORS.map((c) => <button key={c} className={f.color === c ? 'on' : ''} style={{ background: c }} onClick={() => set('color', c)} />)}</div></Field>
      )}
      <Field label={f.type === 'credit' ? 'Deuda inicial (0 si no debes)' : 'Saldo actual'}>
        <MoneyInput value={f.initial} onChange={(v) => set('initial', v)} allowNegative={f.type === 'sitp'} allowDecimal={f.type !== 'cash'} />
      </Field>
      {f.type === 'sitp' && <label className="check"><input type="checkbox" checked={String(f.initial).startsWith('-')} onChange={(e) => set('initial', (e.target.checked ? '-' : '') + String(f.initial).replace(/^-/, ''))} /> Saldo negativo</label>}
      {isCard && (
        <>
          <Field label={f.type === 'sitp' ? 'Número de la tarjeta (para recargar)' : 'Número de tarjeta'}>
            {editNum ? (
              <input className="input" inputMode="numeric" autoFocus placeholder="Número completo" value={numInput} onChange={(e) => setNumInput(e.target.value)} />
            ) : (
              <div className="numline">
                <span>{last4 ? `•••• ${last4}` : 'Sin número'}</span>
                <button type="button" className="btn small" onClick={() => run(() => setEditNum(true))}>{last4 ? 'Cambiar' : 'Agregar'}</button>
              </div>
            )}
          </Field>
          <p className="hint">Se guarda cifrado y se muestra completo solo al desbloquear con tu clave.</p>
          <Field label="Propietario (opcional)"><input className="input" value={f.owner} onChange={(e) => set('owner', e.target.value)} placeholder="Ej: Mi prima" /></Field>
          <Field label="Red">
            <div className="seg">{Object.entries(NETWORKS).map(([k, l]) => <button key={k} className={(f.network || '') === k ? 'on' : ''} onClick={() => set('network', k)}>{l}</button>)}</div>
          </Field>
        </>
      )}
      <label className="check"><input type="checkbox" checked={!!f.locked} onChange={(e) => set('locked', e.target.checked)} /> Dinero apartado: no cuenta como disponible</label>
      <button className="btn primary wide" disabled={!f.name.trim()} onClick={save}>Guardar</button>
      {acc && <button className="btn wide danger" onClick={() => { if (confirm('¿Eliminar cuenta? Sus movimientos quedarán sin cuenta.')) { onDelete(); onClose() } }}>Eliminar cuenta</button>}
    </Sheet>
  )
}

function BiometricRow({ d }) {
  const uid = d.user.uid
  const [avail, setAvail] = useState(false)
  const [on, setOn] = useState(bioEnabled(uid))
  const [msg, setMsg] = useState('')
  useEffect(() => { bioSupported().then(setAvail) }, [])
  if (!d.settings.vault || !avail) return null
  const toggle = async () => {
    setMsg('')
    if (on) { bioDisable(uid); return setOn(false) }
    try {
      await bioEnable(d.user)
      setOn(true)
      setMsg('Listo: en este dispositivo puedes abrir la app con huella o rostro. Para ver números completos se sigue pidiendo la clave.')
    } catch {
      setMsg('No se pudo activar. Revisa que el dispositivo tenga huella, rostro o bloqueo de pantalla configurado.')
    }
  }
  return (
    <>
      <button className="btn wide" onClick={toggle}>{on ? 'Desactivar huella en este dispositivo' : 'Activar huella o rostro en este dispositivo'}</button>
      {msg && <p className="hint">{msg}</p>}
    </>
  )
}

function SecurityCard({ d }) {
  const unlocked = useUnlocked()
  const [run, gate] = useGate(d)
  const has = !!d.settings.vault
  return (
    <>
      <h2>Seguridad</h2>
      <div className="list pad">
        {gate}
        <p className="hint" style={{ marginTop: 0 }}>
          {has
            ? 'La app pide tu clave cada vez que se abre. Con ella también se ven los números completos de tus tarjetas, por 10 minutos o hasta cerrar la app.'
            : 'Crea una clave para proteger la app y cifrar los números de tus tarjetas. Después se pedirá cada vez que abras la app.'}
        </p>
        {unlocked
          ? <button className="btn wide" onClick={V.lock}>Bloquear números ahora</button>
          : <button className="btn wide" onClick={() => run(() => {})}>{has ? 'Desbloquear números' : 'Crear clave de seguridad'}</button>}
        <BiometricRow d={d} />
      </div>
    </>
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

function InstallCard() {
  const [ready, setReady] = useState(!!window.__installPrompt)
  useEffect(() => {
    const on = () => setReady(true)
    window.addEventListener('install-ready', on)
    return () => window.removeEventListener('install-ready', on)
  }, [])
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return null
  const install = async () => {
    const p = window.__installPrompt
    if (!p) return
    p.prompt(); await p.userChoice
    window.__installPrompt = null; setReady(false)
  }
  return (
    <>
      <h2>Instalar app</h2>
      <div className="list pad">
        {ready && <button className="btn primary wide" style={{ marginTop: 0 }} onClick={install}>Instalar en este dispositivo</button>}
        <p className="hint">Android o PC (Chrome): menú del navegador > Instalar app. iPhone o iPad (Safari): botón Compartir > Añadir a pantalla de inicio.</p>
      </div>
    </>
  )
}

export default function Settings({ d, back }) {
  const { api, settings } = d
  const [accForm, setAccForm] = useState(null)   // {} nuevo | cuenta
  const [recForm, setRecForm] = useState(null)
  const [fare, setFare] = useState(String(settings.fare ?? 3550))
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

      <div className="settings-grid">
      <div className="blk">
      <div className="sec-head"><h2>Cuentas y tarjetas</h2><button className="btn small primary" onClick={() => setAccForm({})}><Plus size={16} /> Agregar</button></div>
      <div className="list">
        {d.accounts.length === 0 && <p className="hint pad">Agrega efectivo, débito, crédito o SITP.</p>}
        {d.accounts.map((a) => (
          <button className="row btn-row" key={a.id} onClick={() => setAccForm(a)}>
            <span className={'swatch ' + (BRANDS[a.brand || (a.type === 'cash' ? 'cash' : '')]?.cls || '')} style={BRANDS[a.brand || (a.type === 'cash' ? 'cash' : '')] ? undefined : { background: a.color }} />
            <div className="row-main"><strong>{a.name}</strong><small>{ACCOUNT_TYPES[a.type]}{a.owner ? ` - ${a.owner}` : ''}{a.locked ? ' - apartada' : ''}</small></div>
            <b className="amt">{cop(d.bal[a.id])}</b>
          </button>
        ))}
      </div>

      </div>
      <div className="blk">
      <h2>Pasaje de transporte</h2>
      <div className="list"><div className="row">
        <div className="row-main"><strong>Valor del pasaje</strong><small>Se usa para contar pasajes en tus tarjetas SITP</small></div>
        <div style={{ width: 120 }}><MoneyInput value={fare} onChange={setFare} /></div>
        <button className="btn small primary" disabled={!Number(fare)} onClick={() => api.saveSettings({ fare: Number(fare) })}>Guardar</button>
      </div></div>

      </div>
      <div className="blk">
      <div className="sec-head"><h2>Ingresos recurrentes</h2><button className="btn small primary" onClick={() => setRecForm({})}><Plus size={16} /> Agregar</button></div>
      <div className="list">
        {settings.recurring.map((r) => (
          <button className="row btn-row" key={r.id} onClick={() => setRecForm(r)}>
            <div className="row-main"><strong>{r.name}</strong><small>{r.skipMonths.length ? 'No llega en: ' + r.skipMonths.map((m) => MONTHS_SHORT[m - 1]).join(', ') : 'Todos los meses'}</small></div>
            <b className="amt">{cop(r.amount)}</b>
          </button>
        ))}
      </div>

      </div>
      <div className="blk">
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

      </div>
      <div className="blk"><SecurityCard d={d} /><InstallCard /></div>
      </div>

      <button className="btn wide" onClick={api.logout}><LogOut size={16} /> Cerrar sesión</button>

      {accForm && <AccountForm d={d} acc={accForm.id ? accForm : null} onClose={() => setAccForm(null)}
        onSave={(data) => (accForm.id ? api.update('accounts', accForm.id, 'numberEnc' in data ? { ...data, number: deleteField() } : data) : api.add('accounts', data))}
        onDelete={() => api.remove('accounts', accForm.id)} />}
      {recForm && <RecurringForm r={recForm.id ? recForm : null} d={d} onClose={() => setRecForm(null)} onSave={saveRec}
        onDelete={() => api.saveSettings({ recurring: settings.recurring.filter((x) => x.id !== recForm.id) })} />}
    </div>
  )
}
