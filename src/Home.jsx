import { useState } from 'react'
import { Pin, Settings as Cog, Banknote, Lock, Wifi, PiggyBank, Bus, Smartphone, Landmark, Star, Sparkles } from 'lucide-react'
import { cop, today, monthKey, monthLabel, shiftMonth, BRANDS, navHint, expensesOf } from './lib'
import { monthStats } from './insights'
import { Empty } from './ui'
import { useGate, CardNumber } from './Vault'
import TxRow from './TxRow'
import TxDetail from './TxDetail'
import ReconcileSheet from './Reconcile'

const TYPE_LABEL = { debit: 'débito', credit: 'crédito', savings: 'ahorros', sitp: 'transporte', cash: '' }

function Network({ n }) {
  if (n === 'mastercard') return <span className="mc"><i /><i /></span>
  if (n === 'visa') return <b className="visa">VISA</b>
  return null
}

const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
// Si la cuenta no tiene marca elegida, se deduce del nombre para que tome su diseño.
function brandKey(a) {
  if (a.brand && BRANDS[a.brand]) return a.brand
  const n = norm(a.name)
  if (n.includes('daviplata')) return 'daviplata'
  if (n.includes('davivienda') || /\bdavi\b/.test(n)) return 'davivienda'
  if (n.includes('nequi')) return 'nequi'
  if (n.includes('tullave')) return 'tullave'
  if (/\bnu\b/.test(n)) return 'nu'
  if (a.type === 'cash') return 'cash'
  return ''
}
const BRAND_CLS = { nu: 'b-nu', davivienda: 'b-davi', daviplata: 'b-daviplata', nequi: 'b-nequi', tullave: 'b-tullave', cash: 'b-cash', sitp: 'b-sitp' }

// Logo: usa /logos/<marca>.svg o .png si existe; si no, un ícono sencillo.
function BrandLogo({ brand, type }) {
  const [i, setI] = useState(0)
  const exts = ['png', 'svg']
  if (brand && i < exts.length) return <img className="blogo" src={`/logos/${brand}.${exts[i]}`} alt="" onError={() => setI(i + 1)} />
  if (brand === 'nu') return <span className="blogo-text">nu</span>
  const Icon = brand === 'cash' ? Banknote : brand === 'daviplata' ? Smartphone : type === 'sitp' ? Bus : brand === 'davivienda' ? Landmark : null
  return Icon ? <span className="blogo-ic"><Icon size={17} /></span> : null
}

function AccountCard({ a, balance, saved, isDefault, fare, onFare, pinned, onPin, run }) {
  const key = a.type === 'sitp' && !brandKey(a) ? 'sitp' : brandKey(a)
  const label = key === 'sitp' ? 'SITP' : BRANDS[key]?.label
  const sub = label && !norm(a.name).includes(norm(label)) ? label : ''
  const isCash = a.type === 'cash'
  const WM = isCash ? Banknote : a.type === 'sitp' ? Bus : null
  return (
    <div className={'bcard ' + (BRAND_CLS[key] || 'b-custom')} style={BRAND_CLS[key] ? undefined : { '--c': a.color || '#13241B' }}>
      {WM && <WM className="watermark" size={110} />}
      <div className="bcard-top">
        <div className="bcard-title"><strong>{a.name}</strong>{sub && <small>{sub}</small>}</div>
        <BrandLogo brand={key === 'sitp' ? 'tullave' : key} type={a.type} />
      </div>
      <div className="bcard-mid">
        <small>{a.type === 'credit' ? 'Deuda actual' : 'Disponible'}</small>
        <div className="bcard-bal">{cop(balance - saved)}</div>
        {saved > 0 && <div className="bcard-saved"><PiggyBank size={13} /><span>En ahorro {cop(saved)}</span><span className="hide-sm">· Total {cop(balance)}</span></div>}
        {a.type === 'sitp' && fare > 0 ? (
          <div className="fare-line">
            <span>{Math.max(0, Math.floor(balance / fare))} pasajes de {cop(fare)}</span>
            <button className="btn small" onClick={onFare}>Usar pasaje</button>
          </div>
        ) : !isCash && a.type !== 'sitp' && <div className="chip-row"><i className="chip-ic" /><Wifi size={18} className="nfc" /></div>}
      </div>
      <div className="bcard-bot">
        <div className="bcard-id">
          <CardNumber a={a} run={run} />
          {a.owner && <span className="owner">{a.owner}</span>}
        </div>
        <div className="bcard-right">
          {a.locked && <Lock size={13} />}
          {isDefault && <Star size={12} fill="currentColor" aria-label="Predeterminada" />}
          {TYPE_LABEL[a.type] && <small>{TYPE_LABEL[a.type]}</small>}
          <Network n={a.network} />
          <button className="pin" onClick={onPin} aria-label={pinned ? 'Quitar de inicio' : 'Fijar en inicio'}><Pin size={16} fill={pinned ? 'currentColor' : 'none'} /></button>
        </div>
      </div>
    </div>
  )
}

export default function Home({ d, go, openAdd }) {
  const { accounts, txs, settings, api } = d
  const [showAll, setShowAll] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [reconciling, setReconciling] = useState(false)
  const [run, gate] = useGate(d)
  const defaultIds = [...accounts].sort((a, b) => d.bal[b.id] - d.bal[a.id]).slice(0, 2).map((a) => a.id)
  const pinnedIds = settings.pinned ?? defaultIds
  // De la que más plata tiene a la que menos (disponible, sin lo que está en ahorro). Las de crédito van al final según su deuda.
  const worth = (a) => (a.type === 'credit' ? -d.bal[a.id] : d.bal[a.id] - (d.savedByAccount[a.id] || 0))
  const sorted = [...accounts].sort((a, b) => worth(b) - worth(a))
  const visible = showAll ? sorted : sorted.filter((a) => pinnedIds.includes(a.id))
  const togglePin = (id) => api.saveSettings({ pinned: pinnedIds.includes(id) ? pinnedIds.filter((x) => x !== id) : [...pinnedIds, id] })
  const cur = monthKey(today())
  const month = txs.filter((t) => monthKey(t.date) === cur)
  const inc = month.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const exp = expensesOf(txs, cur).reduce((s, e) => s + e.amount, 0)
  const sav = month.filter((t) => t.type === 'saving').reduce((s, t) => s + t.amount, 0) - month.filter((t) => t.type === 'withdraw').reduce((s, t) => s + t.amount, 0)
  const monthNum = Number(cur.slice(5))

  const dayNow = new Date().getDate()
  const pending = settings.recurring.filter((r) =>
    !r.skipMonths.includes(monthNum) &&
    // Los gastos fijos avisan desde 3 días antes de su día de pago
    (r.kind !== 'expense' || !r.day || dayNow >= r.day - 3) &&
    !settings.skipped.includes(`${r.id}-${cur}`) &&
    !txs.some((t) => t.recurringId === r.id && monthKey(t.date) === cur))

  const defAccId = accounts.find((a) => a.id === settings.defaultAccountId && a.type !== 'sitp')?.id || accounts.find((a) => a.type !== 'sitp')?.id || accounts[0]?.id
  const register = (r) => {
    const accountId = r.accountId || defAccId
    if (!accountId) return alert('Crea una cuenta en Ajustes primero.')
    if (r.kind === 'expense') {
      api.add('transactions', { type: 'expense', amount: r.amount, accountId, category: r.category || 'Otros', date: today(), note: r.name, recurringId: r.id, createdAt: Date.now() })
    } else {
      api.add('transactions', { type: 'income', amount: r.amount, accountId, date: today(), note: r.name, recurringId: r.id, createdAt: Date.now() })
    }
  }
  const skip = (r) => api.saveSettings({ skipped: [...settings.skipped, `${r.id}-${cur}`] })

  const lastKey = shiftMonth(cur, -1)
  const summaryReady = !(d.summaries || []).some((s) => s.id === lastKey) && monthStats(txs, lastKey).count > 0

  const recent = [...txs].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).slice(0, 5)

  return (
    <div className="page">
      {gate}
      <header className="top">
        <div><small>Hola, {d.user.displayName?.split(' ')[0] || 'bienvenido'}</small><h1>Tu bolsillo</h1></div>
        <div className="top-btns">
          <button className="icon-btn round" onClick={() => go('assistant')} aria-label="Asistente"><Sparkles size={20} /></button>
          <button className="icon-btn round" onClick={() => go('settings')} aria-label="Ajustes"><Cog size={20} /></button>
        </div>
      </header>

      <div className="home-grid">
      <section className="hero h-hero">
        <small>Disponible para gastar</small>
        <div className="hero-num">{cop(d.available)}</div>
        <div className="hero-split">
          <div><small>Físico</small><b>{cop(d.physical)}</b></div>
          <div><small>Virtual</small><b>{cop(d.virtual)}</b></div>
          <div><small>En ahorro</small><b>{cop(d.reserved)}</b></div>
        </div>
      </section>

      <div className="h-cards">
      {accounts.length === 0 ? (
        <Empty title="Aún no tienes cuentas" text="Agrega efectivo, tu tarjeta débito o tu tarjeta SITP."
          action={<button className="btn primary" onClick={() => go('settings')}>Ir a Ajustes</button>} />
      ) : (
        <>
          <div className="cards-head">
            <h2>Tarjetas</h2>
            <div>
              <button className="link" onClick={() => setReconciling(true)}>Ajustar saldo</button>
              {settings.pinned && <button className="link" onClick={() => api.saveSettings({ pinned: null })}>Restablecer</button>}
              {(showAll || visible.length < accounts.length) && (
                <button className="link" onClick={() => setShowAll(!showAll)}>{showAll ? 'Solo fijadas' : `Ver todas (${accounts.length})`}</button>
              )}
            </div>
          </div>
          {visible.length === 0 ? <p className="hint">No hay tarjetas fijadas. Toca "Ver todas" y fija las que quieras con el alfiler.</p> : (
            <div className={'cards-scroll' + (showAll ? ' all' : '') + (visible.length === 1 ? ' one' : '')}>
              {visible.map((a) => (
                <AccountCard key={a.id} a={a} run={run} balance={d.bal[a.id]} isDefault={settings.defaultAccountId === a.id} saved={d.savedByAccount[a.id] || 0} fare={settings.fare}
                  pinned={pinnedIds.includes(a.id)} onPin={() => togglePin(a.id)}
                  onFare={() => openAdd({ type: 'fare', accountId: a.id })} />
              ))}
            </div>
          )}
        </>
      )}
      </div>

      <div className="h-side">
      {summaryReady && (
        <div className="pending">
          <div><strong>Resumen de {monthLabel(lastKey).split(' ')[0]} listo</strong><small>Compáralo con el mes anterior</small></div>
          <button className="btn small primary" onClick={() => go('assistant')}>Ver</button>
        </div>
      )}
      {pending.map((r) => (
        <div className={'pending' + (r.kind === 'expense' ? ' expense' : '')} key={r.id}>
          {r.kind === 'expense' ? (
            <div><strong>{r.name}</strong><small>{cop(r.amount)} · {!r.day ? 'por pagar este mes' : dayNow > r.day ? `venció el día ${r.day}` : dayNow === r.day ? 'vence hoy' : `vence el día ${r.day}`}</small></div>
          ) : (
            <div><strong>{r.name} de este mes</strong><small>{cop(r.amount)} sin registrar</small></div>
          )}
          <button className="btn small" onClick={() => skip(r)}>Omitir</button>
          <button className="btn small primary" onClick={() => register(r)}>{r.kind === 'expense' ? 'Pagar' : 'Registrar'}</button>
        </div>
      ))}

      <section className="stats3">
        <div><small>Ingresos</small><b className="pos">{cop(inc)}</b></div>
        <div><small>Gastos</small><b className="neg">{cop(exp)}</b></div>
        <div><small>Ahorrado</small><b>{cop(sav)}</b></div>
      </section>

      {(d.owedToMe > 0 || d.iOwe > 0) && (
        <button className="debt-sum home" onClick={() => { navHint.filter = 'debts'; go('moves') }}>
          <div><small>Te deben</small><b className="pos">{cop(d.owedToMe)}</b></div>
          <div><small>Debes</small><b className="neg">{cop(d.iOwe)}</b></div>
        </button>
      )}

      </div>

      <div className="h-recent">
      <h2>Últimos movimientos</h2>
      <div className="list">
        {recent.length === 0 ? <Empty title="Sin movimientos" text="Toca el botón + para registrar el primero." />
          : recent.map((t) => <TxRow key={t.id} t={t} d={d} onOpen={setOpenId} />)}
      </div>
      {reconciling && <ReconcileSheet d={d} onClose={() => setReconciling(false)} />}
      {openId && <TxDetail key={openId} id={openId} d={d} onClose={() => setOpenId(null)} />}
      </div>
      </div>
    </div>
  )
}
