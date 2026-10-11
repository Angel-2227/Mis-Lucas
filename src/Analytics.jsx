import { useState } from 'react'
import { cop, today, monthKey, monthLabel, shiftMonth, MONTHS_SHORT } from './lib'
import { MonthNav, Empty } from './ui'
import { auth } from './firebase'
import { buildSummary } from './ai'
import Mascot from './Mascot'

function AdviceCard({ d }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ask = async () => {
    setBusy(true); setErr('')
    try {
      const token = await auth.currentUser.getIdToken()
      const r = await fetch('/api/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ summary: buildSummary(d) }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `Error ${r.status}`)
      if (!j.text) throw new Error('La IA solo funciona en la versión publicada.')
      setText(j.text)
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }
  return (
    <section className="advice-card">
      <div className="advice-head">
        <Mascot pose={busy ? 'pensando' : text ? 'feliz' : 'hola'} size={72} />
        <div><strong>Consejos de ahorro</strong><small>Según tus movimientos de este mes</small></div>
      </div>
      {text && <div className="advice">{text.replace(/\*\*/g, '')}</div>}
      {err && <p className="err">{err}</p>}
      <button className="btn primary wide" disabled={busy} onClick={ask}>{busy ? 'Pensando...' : text ? 'Pedir otro consejo' : 'Pedir consejo'}</button>
      <small className="muted">Se envía un resumen de montos, categorías y nombres de metas. Nunca números de tarjeta.</small>
    </section>
  )
}

export default function Analytics({ d }) {
  const [month, setMonth] = useState(monthKey(today()))
  const sum = (key, type) => d.txs.filter((t) => t.type === type && monthKey(t.date) === key).reduce((s, t) => s + t.amount, 0)

  const exp = d.txs.filter((t) => t.type === 'expense' && monthKey(t.date) === month)
  const total = exp.reduce((s, t) => s + t.amount, 0)
  const byCat = Object.entries(exp.reduce((a, t) => { const k = t.category || 'Otros'; a[k] = (a[k] || 0) + t.amount; return a }, {}))
    .sort((a, b) => b[1] - a[1])
  const colorOf = (n) => d.settings.categories.find((c) => c.name === n)?.color || '#7F8C8D'

  const isCurrent = month === monthKey(today())
  const days = isCurrent ? new Date().getDate() : new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()

  const series = Array.from({ length: 6 }, (_, i) => {
    const k = shiftMonth(month, i - 5)
    return { k, inc: sum(k, 'income'), exp: sum(k, 'expense') }
  })
  const max = Math.max(1, ...series.flatMap((s) => [s.inc, s.exp]))

  return (
    <div className="page">
      <h1>Análisis</h1>
      <AdviceCard d={d} />
      <MonthNav month={month} onChange={setMonth} label={monthLabel} shift={shiftMonth} />

      <div className="stats-grid">
      <div>
      <section className="hero light">
        <small>Gastado en el mes</small>
        <div className="hero-num">{cop(total)}</div>
        <small>Promedio diario: <b>{cop(total / days)}</b></small>
      </section>

      <h2>Por categoría</h2>
      {byCat.length === 0 ? <Empty title="Sin gastos" text="No hay gastos registrados en este mes." /> : (
        <div className="list pad">
          {byCat.map(([name, v]) => (
            <div className="bar-row" key={name}>
              <div className="bar-top"><span>{name}</span><b>{cop(v)} <small>({Math.round((v / total) * 100)}%)</small></b></div>
              <div className="progress"><i style={{ width: (v / byCat[0][1]) * 100 + '%', background: colorOf(name) }} /></div>
            </div>
          ))}
        </div>
      )}

      </div>
      <div>
      <h2>Últimos 6 meses</h2>
      <div className="list pad">
        <div className="legend"><span><i className="dot pos-bg" />Ingresos</span><span><i className="dot neg-bg" />Gastos</span></div>
        <div className="chart">
          {series.map((s) => (
            <div className="chart-col" key={s.k}>
              <div className="chart-bars">
                <i className="pos-bg" style={{ height: (s.inc / max) * 100 + '%' }} title={cop(s.inc)} />
                <i className="neg-bg" style={{ height: (s.exp / max) * 100 + '%' }} title={cop(s.exp)} />
              </div>
              <small>{MONTHS_SHORT[Number(s.k.slice(5)) - 1]}</small>
            </div>
          ))}
        </div>
      </div>
      </div>
      </div>
    </div>
  )
}
