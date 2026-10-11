import { useState } from 'react'
import { Pin, Settings as Cog, Banknote, Lock, Wifi } from 'lucide-react'
import { cop, today, monthKey, BRANDS } from './lib'
import { Empty } from './ui'
import { useGate, CardNumber } from './Vault'
import TxRow from './TxRow'
import Mascot from './Mascot'

const TYPE_LABEL = { debit: 'débito', credit: 'crédito', savings: 'ahorros', sitp: 'transporte', cash: '' }

function Network({ n }) {
  if (n === 'mastercard') return <span className="mc"><i /><i /></span>
  if (n === 'visa') return <b className="visa">VISA</b>
  return null
}

function AccountCard({ a, balance, fare, onFare, pinned, onPin, run }) {
  const b = BRANDS[a.brand || (a.type === 'cash' ? 'cash' : '')]
  const isCash = a.type === 'cash'
  const showName = b && a.name.trim().toLowerCase() !== b.label.toLowerCase()
  return (
    <div className={'bcard ' + (b ? b.cls : 'b-custom')} style={b ? undefined : { '--c': a.color || '#13241B' }}>
      {isCash && <Banknote className="watermark" size={120} />}
      <div className="bcard-top">
        <div><span className="wordmark">{b ? b.label : a.name}</span>{showName && <small className="bname">{a.name}</small>}</div>
        <div className="bcard-icons">
          {a.locked && <Lock size={14} />}
          <button className="pin" onClick={onPin} aria-label={pinned ? 'Quitar de inicio' : 'Fijar en inicio'}><Pin size={16} fill={pinned ? 'currentColor' : 'none'} /></button>
        </div>
      </div>
      <div className="bcard-mid">
        <small>{a.type === 'credit' ? 'Deuda actual' : 'Disponible'}</small>
        <div className="bcard-bal">{cop(balance)}</div>
        {a.type === 'sitp' && fare > 0 ? (
          <div className="fare-line">
            <span>{Math.max(0, Math.floor(balance / fare))} pasajes de {cop(fare)}</span>
            <button className="btn small" onClick={onFare}>Usar pasaje</button>
          </div>
        ) : !isCash && <div className="chip-row"><i className="chip-ic" /><Wifi size={18} className="nfc" /></div>}
      </div>
      <div className="bcard-bot">
        <div>
          <CardNumber a={a} run={run} />
          {a.owner && <span className="owner">{a.owner}</span>}
        </div>
        <div className="bcard-right">
          {TYPE_LABEL[a.type] && <small>{TYPE_LABEL[a.type]}</small>}
          <Network n={a.network} />
        </div>
      </div>
    </div>
  )
}

export default function Home({ d, go, openAdd }) {
  const { accounts, txs, settings, api } = d
  const [showAll, setShowAll] = useState(false)
  const [run, gate] = useGate(d)
  const defaultIds = [...accounts].sort((a, b) => d.bal[b.id] - d.bal[a.id]).slice(0, 2).map((a) => a.id)
  const pinnedIds = settings.pinned ?? defaultIds
  const visible = showAll ? accounts : accounts.filter((a) => pinnedIds.includes(a.id))
  const togglePin = (id) => api.saveSettings({ pinned: pinnedIds.includes(id) ? pinnedIds.filter((x) => x !== id) : [...pinnedIds, id] })
  const cur = monthKey(today())
  const month = txs.filter((t) => monthKey(t.date) === cur)
  const inc = month.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const exp = month.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const sav = month.filter((t) => t.type === 'saving').reduce((s, t) => s + t.amount, 0)
  const monthNum = Number(cur.slice(5))

  const pending = settings.recurring.filter((r) =>
    !r.skipMonths.includes(monthNum) &&
    !settings.skipped.includes(`${r.id}-${cur}`) &&
    !txs.some((t) => t.recurringId === r.id && monthKey(t.date) === cur))

  const register = (r) => {
    const accountId = r.accountId || accounts[0]?.id
    if (!accountId) return alert('Crea una cuenta en Ajustes primero.')
    api.add('transactions', { type: 'income', amount: r.amount, accountId, date: today(), note: r.name, recurringId: r.id, createdAt: Date.now() })
  }
  const skip = (r) => api.saveSettings({ skipped: [...settings.skipped, `${r.id}-${cur}`] })

  const recent = [...txs].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).slice(0, 5)

  const hour = new Date().getHours()
  const hi = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
  const first = d.user.displayName?.split(' ')[0] || ''
  const spentToday = txs.some((t) => t.date === today() && t.type === 'expense')
  const lowSitp = settings.fare > 0
    ? accounts.filter((a) => a.type === 'sitp').map((a) => ({ a, n: Math.floor(d.bal[a.id] / settings.fare) })).find((x) => x.n <= 2)
    : null
  const focus = [...d.goals].filter((g) => !g.done).sort((x, y) => (x.order ?? 0) - (y.order ?? 0))[0]
  const pct = focus ? Math.round(((d.savedByGoal[focus.id] || 0) / focus.target) * 100) : 0
  let tip = 'Todo al día. Sigue así.'
  let pose = 'hola'
  if (pending.length) tip = `Ya puedes registrar tu ${pending[0].name} de este mes.`
  else if (lowSitp) {
    const n = Math.max(0, lowSitp.n)
    tip = `A ${lowSitp.a.name} le ${n === 1 ? 'queda 1 pasaje' : `quedan ${n} pasajes`}. ¿La recargamos?`
    pose = 'alerta'
  } else if (!spentToday) tip = 'Hoy no has anotado gastos. Si gastaste algo, anótalo para no olvidarlo.'
  else if (focus) { tip = `Tu meta "${focus.name}" va en ${pct}%.`; pose = pct >= 100 ? 'feliz' : 'hola' }

  return (
    <div className="page">
      {gate}
      <header className="top">
        <div><small>Hola, {d.user.displayName?.split(' ')[0] || 'bienvenido'}</small><h1>Tu bolsillo</h1></div>
        <button className="icon-btn round" onClick={() => go('settings')} aria-label="Ajustes"><Cog size={20} /></button>
      </header>

      <section className="greet">
        <Mascot pose={pose} size={84} />
        <div><strong>{hi}{first ? `, ${first}` : ''}</strong><p>{tip}</p></div>
      </section>

      <div className="home-grid">
      <div className="col">
      <section className="hero">
        <small>Disponible para gastar</small>
        <div className="hero-num">{cop(d.available)}</div>
        <div className="hero-split">
          <div><small>Físico</small><b>{cop(d.physical)}</b></div>
          <div><small>Virtual</small><b>{cop(d.virtual)}</b></div>
          <div><small>En metas</small><b>{cop(d.reserved)}</b></div>
        </div>
      </section>

      {accounts.length === 0 ? (
        <Empty title="Aún no tienes cuentas" text="Agrega efectivo, tu tarjeta débito o tu tarjeta SITP."
          action={<button className="btn primary" onClick={() => go('settings')}>Ir a Ajustes</button>} />
      ) : (
        <>
          <div className="cards-head">
            <h2>Tarjetas</h2>
            <div>
              {settings.pinned && <button className="link" onClick={() => api.saveSettings({ pinned: null })}>Restablecer</button>}
              {(showAll || visible.length < accounts.length) && (
                <button className="link" onClick={() => setShowAll(!showAll)}>{showAll ? 'Solo fijadas' : `Ver todas (${accounts.length})`}</button>
              )}
            </div>
          </div>
          {visible.length === 0 ? <p className="hint">No hay tarjetas fijadas. Toca "Ver todas" y fija las que quieras con el alfiler.</p> : (
            <div className={'cards-scroll' + (showAll ? ' all' : '')}>
              {visible.map((a) => (
                <AccountCard key={a.id} a={a} run={run} balance={d.bal[a.id]} fare={settings.fare}
                  pinned={pinnedIds.includes(a.id)} onPin={() => togglePin(a.id)}
                  onFare={() => openAdd({ type: 'fare', accountId: a.id })} />
              ))}
            </div>
          )}
        </>
      )}

      </div>
      <div className="col">
      {pending.map((r) => (
        <div className="pending" key={r.id}>
          <div><strong>{r.name} de este mes</strong><small>{cop(r.amount)} sin registrar</small></div>
          <button className="btn small" onClick={() => skip(r)}>Omitir</button>
          <button className="btn small primary" onClick={() => register(r)}>Registrar</button>
        </div>
      ))}

      <section className="stats3">
        <div><small>Ingresos</small><b className="pos">{cop(inc)}</b></div>
        <div><small>Gastos</small><b className="neg">{cop(exp)}</b></div>
        <div><small>Ahorrado</small><b>{cop(sav)}</b></div>
      </section>

      <h2>Últimos movimientos</h2>
      <div className="list">
        {recent.length === 0 ? <Empty title="Sin movimientos" text="Toca el botón + para registrar el primero." />
          : recent.map((t) => <TxRow key={t.id} t={t} d={d} />)}
      </div>
      </div>
      </div>
    </div>
  )
}
