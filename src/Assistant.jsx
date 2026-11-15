import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cop, today, monthKey, monthLabel, shiftMonth } from './lib'
import { MonthNav, Empty, Progress } from './ui'
import { monthStats, compareMonths, notes } from './insights'

function Delta({ r }) {
  if (r.prev === 0 && r.cur === 0) return <span className="delta flat">-</span>
  if (r.pct === null) return <span className="delta flat">nuevo</span>
  const rounded = Math.round(r.pct)
  if (rounded === 0) return <span className="delta flat">igual</span>
  const good = r.good ? (r.good === 'up') === (r.diff > 0) : null
  return <span className={'delta ' + (good === null ? 'flat' : good ? 'good' : 'bad')}>{r.diff > 0 ? '+' : ''}{rounded}%</span>
}

export default function Assistant({ d, back }) {
  const cur = monthKey(today())
  const [month, setMonth] = useState(shiftMonth(cur, -1)) // por defecto, el último mes cerrado
  const prevKey = shiftMonth(month, -1)
  const stats = monthStats(d.txs, month)
  const prev = monthStats(d.txs, prevKey)
  const { totals, cats } = compareMonths(stats, prev)
  const list = notes(stats, prev)
  const closed = month < cur
  const colorOf = (n) => d.settings.categories.find((c) => c.name === n)?.color || '#7F8C8D'
  const activeGoals = [...d.goals].filter((g) => !g.done).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  // Al ver un mes cerrado con movimientos, se guarda su resumen. Inicio deja de avisar de ese mes.
  const known = d.summaries.some((s) => s.id === month)
  useEffect(() => {
    if (!closed || stats.count === 0 || known) return
    d.api.saveSummary(month, {
      month, income: stats.income, expense: stats.expense, saved: stats.saved, balance: stats.balance,
      byCat: stats.byCat, savedAt: Date.now(),
    })
  }, [month, closed, stats.count, known])

  return (
    <div className="page">
      <header className="top">
        <button className="icon-btn round" onClick={back} aria-label="Volver"><ChevronLeft size={20} /></button>
        <h1>Asistente</h1><span />
      </header>

      <div className="seg">
        <button className="on">Resumen</button>
        <button disabled>Chat</button>
        <button disabled>Plan</button>
      </div>

      <MonthNav month={month} onChange={setMonth} label={monthLabel} shift={shiftMonth} />
      {!closed && <p className="hint">Este mes aún no termina: los números son parciales.</p>}

      {stats.count === 0 && prev.count === 0 ? (
        <Empty title="Sin datos" text="No hay movimientos en este mes ni en el anterior." />
      ) : (
        <div className="stats-grid">
          <div>
            <section className="hero light">
              <small>Balance de {monthLabel(month).split(' ')[0]}</small>
              <div className="hero-num">{cop(stats.balance)}</div>
              <small>Ingresos {cop(stats.income)} · Gastos {cop(stats.expense)}</small>
            </section>

            <h2>Lo más notable</h2>
            {list.length === 0 ? <p className="hint">Aún no hay suficiente información para comparar.</p> : (
              <ul className="notes list pad">
                {list.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            )}

            <h2>Contra {monthLabel(prevKey).split(' ')[0]}</h2>
            <div className="list pad">
              {totals.map((r) => (
                <div className="cmp-row" key={r.name}>
                  <div><span>{r.name}</span><small className="cmp-prev">antes {cop(r.prev)}</small></div>
                  <b>{cop(r.cur)}</b>
                  <Delta r={r} />
                </div>
              ))}
              <div className="cmp-row">
                <div><span>Promedio por día con gastos</span><small className="cmp-prev">antes {cop(prev.expenseDays ? prev.expense / prev.expenseDays : 0)}</small></div>
                <b>{cop(stats.expenseDays ? stats.expense / stats.expenseDays : 0)}</b><span />
              </div>
            </div>
          </div>

          <div>
            <h2>Gasto por categoría</h2>
            {cats.length === 0 ? <Empty title="Sin gastos" text="No hay gastos en estos meses." /> : (
              <div className="list pad">
                {cats.map((r) => (
                  <div className="bar-row" key={r.name}>
                    <div className="cmp-row flush">
                      <div><span>{r.name}</span><small className="cmp-prev">antes {cop(r.prev)}</small></div>
                      <b>{cop(r.cur)}</b>
                      <Delta r={{ ...r, good: 'down' }} />
                    </div>
                    <div className="progress"><i style={{ width: (r.cur / (cats[0].cur || 1)) * 100 + '%', background: colorOf(r.name) }} /></div>
                  </div>
                ))}
              </div>
            )}

            <h2>Metas hoy</h2>
            {activeGoals.length === 0 ? <Empty title="Sin metas activas" text="Crea una meta en la pestaña Metas." /> : (
              <div className="list pad">
                {activeGoals.map((g) => {
                  const s = d.savedByGoal[g.id] || 0
                  return (
                    <div className="bar-row" key={g.id}>
                      <div className="bar-top"><span>{g.name}</span><b>{Math.round((s / g.target) * 100) || 0}%</b></div>
                      <Progress value={s} max={g.target} />
                      <small className="muted">{cop(s)} de {cop(g.target)}</small>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
      <p className="hint">Son cálculos de tus propios movimientos. Más adelante la IA agregará aquí su interpretación.</p>
    </div>
  )
}
