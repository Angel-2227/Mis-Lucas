import { useState } from 'react'
import { Pin, Settings as Cog, Wallet, Banknote, CreditCard, Bus, Lock, PiggyBank } from 'lucide-react'
import { cop, today, monthKey } from './lib'
import { CopyId, Empty } from './ui'
import TxRow from './TxRow'

const ICONS = { cash: Banknote, debit: Wallet, savings: PiggyBank, credit: CreditCard, sitp: Bus }

function AccountCard({ a, balance, fare, onFare, pinned, onPin }) {
  const Icon = ICONS[a.type] || Wallet
  return (
    <div className="acard" style={{ background: a.color || '#13241B' }}>
      <div className="acard-top">
        <Icon size={20} />
        <span>{a.name}</span>
        {a.locked && <Lock size={14} />}
        <button className="pin" onClick={onPin} aria-label={pinned ? 'Quitar de inicio' : 'Fijar en inicio'}><Pin size={16} fill={pinned ? 'currentColor' : 'none'} /></button>
      </div>
      <div className="acard-bal">{cop(balance)}</div>
      {a.type === 'sitp' && fare > 0 && (
        <div className="fare-line">
          <span>{Math.max(0, Math.floor(balance / fare))} pasajes de {cop(fare)}</span>
          <button className="btn small" onClick={onFare}>Usar pasaje</button>
        </div>
      )}
      <div className="acard-bot">
        <span>{a.owner || (a.type === 'credit' ? 'Deuda actual' : '')}</span>
        {a.number && <CopyId text={a.number} />}
      </div>
    </div>
  )
}

export default function Home({ d, go, openAdd }) {
  const { accounts, txs, settings, api } = d
  const [showAll, setShowAll] = useState(false)
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

  return (
    <div className="page">
      <header className="top">
        <div><small>Hola, {d.user.displayName?.split(' ')[0] || 'bienvenido'}</small><h1>Tu bolsillo</h1></div>
        <button className="icon-btn round" onClick={() => go('settings')} aria-label="Ajustes"><Cog size={20} /></button>
      </header>

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
                <AccountCard key={a.id} a={a} balance={d.bal[a.id]} fare={settings.fare}
                  pinned={pinnedIds.includes(a.id)} onPin={() => togglePin(a.id)}
                  onFare={() => openAdd({ type: 'fare', accountId: a.id })} />
              ))}
            </div>
          )}
        </>
      )}

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
  )
}
