import { Settings as Cog, Wallet, Banknote, CreditCard, Bus, Lock, PiggyBank } from 'lucide-react'
import { cop, today, monthKey } from './lib'
import { CopyId, Empty } from './ui'
import TxRow from './TxRow'

const ICONS = { cash: Banknote, debit: Wallet, savings: PiggyBank, credit: CreditCard, sitp: Bus }

function AccountCard({ a, balance }) {
  const Icon = ICONS[a.type] || Wallet
  return (
    <div className="acard" style={{ background: a.color || '#13241B' }}>
      <div className="acard-top">
        <Icon size={20} />
        <span>{a.name}</span>
        {a.locked && <Lock size={14} />}
      </div>
      <div className="acard-bal">{cop(balance)}</div>
      <div className="acard-bot">
        <span>{a.owner || (a.type === 'credit' ? 'Deuda actual' : '')}</span>
        {a.number && <CopyId text={a.number} />}
      </div>
    </div>
  )
}

export default function Home({ d, go, openAdd }) {
  const { accounts, txs, settings, api } = d
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
        <div className="cards-scroll">
          {accounts.map((a) => <AccountCard key={a.id} a={a} balance={d.bal[a.id]} />)}
        </div>
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
