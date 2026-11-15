import { useRef, useState } from 'react'
import { ArrowUp, ArrowDown, Trash2, Plus, Check, Pencil, ExternalLink, History, Undo2 } from 'lucide-react'
import { cop, today, round2 } from './lib'
import { normalizeUrl, hostOf, findImage } from './preview'
import { Sheet, Field, MoneyInput, Progress, Empty } from './ui'
import TxRow from './TxRow'
import TxDetail from './TxDetail'

function GoalForm({ goal, onSave, onClose }) {
  const [name, setName] = useState(goal?.name || '')
  const [target, setTarget] = useState(String(goal?.target ?? ''))
  const [deadline, setDeadline] = useState(goal?.deadline || '')
  const [url, setUrl] = useState(goal?.url || '')
  const [img, setImg] = useState(goal?.image || '')
  const [manual, setManual] = useState(false)
  const [status, setStatus] = useState(goal?.image ? 'ok' : '') // '' | buscando | ok | no | bad
  const [busy, setBusy] = useState(false)
  const link = normalizeUrl(url)
  const lookupRef = useRef({ link: goal?.image ? goal.url : '', promise: Promise.resolve(goal?.image || '') })

  // Busca la imagen una sola vez por enlace (el servicio gratuito tiene límite diario).
  const lookup = (l) => {
    if (lookupRef.current.link === l) return lookupRef.current.promise
    setImg(''); setStatus('buscando')
    const p = findImage(l).then((found) => {
      if (lookupRef.current.link === l) { setImg(found); setStatus(found ? 'ok' : 'no') }
      return found
    })
    lookupRef.current = { link: l, promise: p }
    return p
  }
  const onUrlBlur = () => {
    if (manual) return
    if (link) lookup(link)
    else { setImg(''); setStatus(''); lookupRef.current = { link: '', promise: null } }
  }

  const save = async () => {
    setBusy(true)
    let image = img
    if (!manual) image = link ? (await lookup(link)) || '' : ''
    onSave({
      name: name.trim(), target: Number(target), deadline: deadline || '',
      url: link, image: /^https?:\/\//i.test(image) ? image : '',
    })
    onClose()
  }

  return (
    <Sheet title={goal ? 'Editar meta' : 'Nueva meta'} onClose={onClose}>
      <Field label="¿Qué quieres comprar?"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tableta gráfica" /></Field>
      <Field label="Precio estimado"><MoneyInput value={target} onChange={setTarget} /></Field>
      <Field label="Fecha límite (opcional)"><input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
      <Field label="Enlace del producto (opcional)">
        <input className="input" type="url" inputMode="url" placeholder="https://tienda.com/producto" value={url} onChange={(e) => setUrl(e.target.value)} onBlur={onUrlBlur} />
      </Field>
      {link && status === 'buscando' && <p className="hint">Buscando la imagen del producto...</p>}
      {img && status !== 'bad' && (
        <img className="goal-img preview" src={img} alt="" referrerPolicy="no-referrer" onError={() => setStatus('bad')} />
      )}
      {link && (status === 'no' || status === 'bad' || manual) && (
        <Field label="Enlace de la imagen (opcional)">
          <input className="input" type="url" inputMode="url" placeholder="https://.../foto.jpg"
            value={manual ? img : ''} onChange={(e) => { setManual(true); setImg(e.target.value.trim()); setStatus('ok') }} />
          {!manual && <p className="hint">{status === 'bad' ? 'La imagen encontrada no se pudo cargar.' : 'No encontré una imagen automática.'} Si quieres, pega aquí la dirección de una imagen (clic derecho en la foto > copiar dirección de imagen).</p>}
        </Field>
      )}
      <button className="btn primary wide" disabled={busy || !name.trim() || !Number(target)} onClick={save}>{busy ? 'Guardando...' : goal ? 'Guardar' : 'Crear meta'}</button>
    </Sheet>
  )
}

function BuySheet({ d, g, onClose }) {
  const [price, setPrice] = useState(String(g.target))
  const [accountId, setAccountId] = useState(d.accounts[0]?.id || '')
  const acc = d.accounts.find((a) => a.id === accountId)
  const decimals = !!acc && acc.type !== 'cash'
  const amount = decimals ? round2(Number(price)) : Math.round(Number(price) || 0)
  const buy = () => {
    d.api.add('transactions', { type: 'expense', amount, accountId, category: 'Metas', note: g.name, date: today(), createdAt: Date.now() })
    d.api.update('goals', g.id, { done: true })
    onClose()
  }
  return (
    <Sheet title={`Comprar: ${g.name}`} onClose={onClose}>
      <Field label="Precio final"><MoneyInput value={price} onChange={setPrice} allowDecimal={decimals} /></Field>
      <Field label="Pagado desde">
        <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {d.accounts.map((a) => <option key={a.id} value={a.id}>{a.name} - {cop(d.bal[a.id])}</option>)}
        </select>
      </Field>
      <p className="hint">Se registra un gasto y la meta pasa a compradas. El dinero ahorrado deja de estar apartado.</p>
      <button className="btn primary wide" disabled={!(amount > 0) || !accountId} onClick={buy}>Registrar compra</button>
    </Sheet>
  )
}

// Dinero de la meta repartido por cuenta ('' = apartado general): aportes menos retiros.
function goalBuckets(d, g) {
  const b = {}
  d.txs.filter((t) => t.goalId === g.id && (t.type === 'saving' || t.type === 'withdraw')).forEach((t) => {
    const k = t.accountId || ''
    b[k] = round2((b[k] || 0) + (t.type === 'saving' ? t.amount : -t.amount))
  })
  return Object.entries(b).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1])
}

function WithdrawSheet({ d, g, onClose }) {
  const buckets = goalBuckets(d, g)
  const total = round2(buckets.reduce((s, [, v]) => s + v, 0))
  const [key, setKey] = useState(buckets[0]?.[0] ?? '')
  const max = buckets.find(([k]) => k === key)?.[1] || 0
  const [amount, setAmount] = useState(String(buckets[0]?.[1] ?? ''))
  const [note, setNote] = useState('')
  const num = round2(Number(amount))
  const accLabel = (k) => (k ? d.accounts.find((a) => a.id === k)?.name || 'Cuenta eliminada' : 'Sin tarjeta (apartado general)')
  const mk = (k, v) => ({ type: 'withdraw', goalId: g.id, amount: v, accountId: k || undefined, date: today(), note: note.trim() || undefined, createdAt: Date.now() })
  const withdraw = () => { d.api.add('transactions', mk(key, num)); onClose() }
  const withdrawAll = () => { buckets.forEach(([k, v]) => d.api.add('transactions', mk(k, v))); onClose() }
  return (
    <Sheet title={`Retirar de: ${g.name}`} onClose={onClose}>
      <p className="hint">Ahorrado en esta meta: <b>{cop(total)}</b>. El dinero sigue en tu cuenta y vuelve a quedar disponible.</p>
      {buckets.length > 1 && (
        <Field label="Retirar de">
          <select className="input" value={key} onChange={(e) => { setKey(e.target.value); setAmount(String(buckets.find(([k]) => k === e.target.value)?.[1] ?? '')) }}>
            {buckets.map(([k, v]) => <option key={k || 'none'} value={k}>{accLabel(k)} - {cop(v)}</option>)}
          </select>
        </Field>
      )}
      {buckets.length === 1 && <p className="hint">Está guardado en: {accLabel(key)}.</p>}
      <Field label="Monto a retirar"><MoneyInput value={amount} onChange={setAmount} allowDecimal /></Field>
      {num > max + 0.001 && <p className="hint neg">No puedes retirar más de {cop(max)} de ahí.</p>}
      <Field label="Nota (opcional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: ya no la voy a comprar" /></Field>
      <button className="btn primary wide" disabled={!(num > 0) || num > max + 0.001} onClick={withdraw}>Retirar {num > 0 ? cop(num) : ''}</button>
      <button className="btn wide" onClick={withdrawAll}>Retirar todo ({cop(total)})</button>
    </Sheet>
  )
}

function GoalDetail({ d, g, openAdd, onWithdraw, onOpenTx, onClose }) {
  const saved = d.savedByGoal[g.id] || 0
  const list = d.txs.filter((t) => t.goalId === g.id && (t.type === 'saving' || t.type === 'withdraw'))
    .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))
  const put = round2(list.filter((t) => t.type === 'saving').reduce((s, t) => s + t.amount, 0))
  const out = round2(list.filter((t) => t.type === 'withdraw').reduce((s, t) => s + t.amount, 0))
  return (
    <Sheet title={g.name} onClose={onClose}>
      <Progress value={saved} max={g.target} />
      <div className="goal-nums"><span>{cop(saved)} de {cop(g.target)}</span><b>{Math.round((saved / g.target) * 100) || 0}%</b></div>
      <small className="muted">Aportado {cop(put)}{out > 0 ? ` · Retirado ${cop(out)}` : ''}</small>
      {!g.done && (
        <div className="goal-btns">
          <button className="btn small primary" onClick={() => { onClose(); openAdd({ type: 'saving', goalId: g.id }) }}>Aportar</button>
          <button className="btn small" disabled={saved <= 0} onClick={onWithdraw}><Undo2 size={14} /> Retirar dinero</button>
        </div>
      )}
      <h2>Historial</h2>
      {list.length === 0 ? <Empty title="Sin aportes todavía" text="Cuando aportes a esta meta, cada movimiento aparece aquí." />
        : <div className="list">{list.map((t) => <TxRow key={t.id} t={t} d={d} onOpen={onOpenTx} />)}</div>}
    </Sheet>
  )
}

// Si la imagen no carga, no se muestra nada y la tarjeta queda como siempre.
function GoalImage({ src }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return null
  return <img className="goal-img" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
}

export default function Goals({ d, openAdd }) {
  const [form, setForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [buying, setBuying] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [withdrawing, setWithdrawing] = useState(null)
  const [txId, setTxId] = useState(null)
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
    if (confirm(`¿Eliminar la meta "${g.name}"? ${(d.savedByGoal[g.id] || 0) > 0 && !g.done ? 'Lo ahorrado vuelve a quedar disponible. ' : ''}Sus aportes quedarán sin meta.`)) d.api.remove('goals', g.id)
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
            <GoalImage src={g.image} />
            <div className="goal-head">
              <div><strong>{g.name}</strong>{i === 0 && <em className="tag">En foco</em>}</div>
              <div className="goal-actions">
                <button className="icon-btn ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir prioridad"><ArrowUp size={16} /></button>
                <button className="icon-btn ghost" disabled={i === active.length - 1} onClick={() => move(i, 1)} aria-label="Bajar prioridad"><ArrowDown size={16} /></button>
                <button className="icon-btn ghost" onClick={() => setEditing(g)} aria-label="Editar meta"><Pencil size={16} /></button>
                <button className="icon-btn ghost" onClick={() => remove(g)} aria-label="Eliminar meta"><Trash2 size={16} /></button>
              </div>
            </div>
            <Progress value={saved} max={g.target} />
            <div className="goal-nums"><span>{cop(saved)} de {cop(g.target)}</span><b>{Math.round((saved / g.target) * 100) || 0}%</b></div>
            <small className="muted">Faltan {cop(left)}{perMonth ? ` - ahorra ${cop(perMonth)} al mes para llegar a tiempo` : ''}</small>
            {g.url && <a className="goal-link" href={g.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> {hostOf(g.url)}</a>}
            <div className="goal-btns">
              <button className="btn small primary" onClick={() => openAdd({ type: 'saving', goalId: g.id })}>Aportar</button>
              <button className="btn small" onClick={() => setDetailId(g.id)}><History size={14} /> Historial</button>
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
            <button className="icon-btn ghost" onClick={() => setDetailId(g.id)} aria-label="Historial"><History size={16} /></button>
            <button className="icon-btn ghost" onClick={() => remove(g)}><Trash2 size={16} /></button></div>
        ))}</div>
      </>}
      {form && <GoalForm onClose={() => setForm(false)} onSave={(g) => d.api.add('goals', { ...g, order: active.length, done: false })} />}
      {editing && <GoalForm goal={editing} onClose={() => setEditing(null)} onSave={(g) => d.api.update('goals', editing.id, g)} />}
      {buying && <BuySheet d={d} g={buying} onClose={() => setBuying(null)} />}
      {detailId && d.goals.find((x) => x.id === detailId) && (
        <GoalDetail d={d} g={d.goals.find((x) => x.id === detailId)} openAdd={openAdd} onClose={() => setDetailId(null)}
          onWithdraw={() => setWithdrawing(d.goals.find((x) => x.id === detailId))} onOpenTx={setTxId} />
      )}
      {withdrawing && <WithdrawSheet d={d} g={withdrawing} onClose={() => setWithdrawing(null)} />}
      {txId && <TxDetail key={txId} id={txId} d={d} onClose={() => setTxId(null)} />}
    </div>
  )
}
