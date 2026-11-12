import { useState } from 'react'
import { cop, today, monthKey, monthLabel, shiftMonth, MONTHS_SHORT } from './lib'
import { MonthNav, Empty } from './ui'

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

  // Deudas pendientes por persona (no dependen del mes: es lo que falta hoy)
  const byPerson = (kind) => {
    const g = {}
    d.debts.filter((x) => x.kind === kind && x.left > 0).forEach((x) => {
      const k = x.person.toLowerCase()
      g[k] ||= { person: x.person, left: 0, n: 0 }
      g[k].left += x.left; g[k].n += 1
    })
    return Object.values(g).sort((a, b) => b.left - a.left)
  }
  const owedList = byPerson('owed')
  const oweList = byPerson('owe')
  const DebtList = ({ title, list, total, cls }) => (
    <>
      <h2>{title}</h2>
      <div className="list pad">
        <div className="bar-top"><span>Total pendiente</span><b className={cls}>{cop(total)}</b></div>
        {list.map((p) => (
          <div className="bar-row" key={p.person}>
            <div className="bar-top"><span>{p.person} <small>({p.n} {p.n === 1 ? 'deuda' : 'deudas'})</small></span><b>{cop(p.left)}</b></div>
            <div className="progress"><i style={{ width: (p.left / list[0].left) * 100 + '%', background: cls === 'pos' ? 'var(--green)' : 'var(--red)' }} /></div>
          </div>
        ))}
      </div>
    </>
  )

  return (
    <div className="page">
      <h1>Análisis</h1>
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

      <h2>Quién te debe</h2>
      {owedList.length === 0 ? <Empty title="Nadie te debe" text="Marca un gasto como &quot;Me deben&quot; y aparece aquí." /> : (
        <div className="list pad">
          <div className="bar-top"><span>Total pendiente</span><b className="pos">{cop(d.owedToMe)}</b></div>
          {owedList.map((p) => (
            <div className="bar-row" key={p.person}>
              <div className="bar-top"><span>{p.person} <small>({p.n} {p.n === 1 ? 'deuda' : 'deudas'})</small></span><b>{cop(p.left)}</b></div>
              <div className="progress"><i style={{ width: (p.left / owedList[0].left) * 100 + '%', background: 'var(--green)' }} /></div>
            </div>
          ))}
        </div>
      )}
      {oweList.length > 0 && <DebtList title="Lo que debes" list={oweList} total={d.iOwe} cls="neg" />}

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
