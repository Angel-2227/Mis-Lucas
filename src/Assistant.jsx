import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cop, today, monthKey, monthLabel, shiftMonth } from './lib'
import { MonthNav, Empty, Progress } from './ui'
import { monthStats, compareMonths, notes } from './insights'
import { askAdvice, buildPayload, parseAdvice } from './ai'
import Chat from './Chat'

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
  const [tab, setTab] = useState('summary')
  const [chat, setChat] = useState([]) // la conversación vive mientras la app esté abierta
  const [month, setMonth] = useState(shiftMonth(cur, -1)) // por defecto, el último mes cerrado
  const prevKey = shiftMonth(month, -1)
  const stats = monthStats(d.txs, month)
  const prev = monthStats(d.txs, prevKey)
  const { totals, cats } = compareMonths(stats, prev)
  const list = notes(stats, prev)
  const closed = month < cur
  const colorOf = (n) => d.settings.categories.find((c) => c.name === n)?.color || '#7F8C8D'
  const pend = (kind) => Object.values(d.debts.filter((x) => x.kind === kind && x.left > 0).reduce((g, x) => {
    const k = x.person.toLowerCase(); g[k] ||= { person: x.person, left: 0, n: 0 }; g[k].left += x.left; g[k].n += 1; return g
  }, {})).sort((a, b) => b.left - a.left)
  const owedList = pend('owed')
  const oweList = pend('owe')
  const activeGoals = [...d.goals].filter((g) => !g.done).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const snapshot = () => ({
    month, income: stats.income, expense: stats.expense, saved: stats.saved, balance: stats.balance,
    byCat: stats.byCat, savedAt: Date.now(),
  })

  // Al ver un mes cerrado con movimientos, se guarda su resumen. Inicio deja de avisar de ese mes.
  const known = d.summaries.some((s) => s.id === month)
  useEffect(() => {
    if (!closed || stats.count === 0 || known) return
    d.api.saveSummary(month, snapshot())
  }, [month, closed, stats.count, known])

  // Texto de la IA: en meses cerrados se guarda en Firestore; en el mes en curso solo vive en pantalla.
  const [local, setLocal] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { setErr('') }, [month])
  const stored = d.summaries.find((s) => s.id === month)?.ai
  const aiText = stored?.text || local[month]
  const adv = aiText ? parseAdvice(aiText) : null

  const generate = async () => {
    setBusy(true); setErr('')
    try {
      const text = await askAdvice(d.user, 'summary', buildPayload(d, month, stats, prev, closed))
      if (closed) await d.api.saveSummary(month, { ...snapshot(), ai: { text, at: Date.now() } })
      else setLocal((p) => ({ ...p, [month]: text }))
    } catch (e) { setErr(e.message || 'No se pudo generar el análisis.') }
    setBusy(false)
  }

  return (
    <div className="page">
      <header className="top">
        <button className="icon-btn round" onClick={back} aria-label="Volver"><ChevronLeft size={20} /></button>
        <h1>Asistente</h1><span />
      </header>

      <div className="seg">
        <button className={tab === 'summary' ? 'on' : ''} onClick={() => setTab('summary')}>Resumen</button>
        <button className={tab === 'chat' ? 'on' : ''} onClick={() => setTab('chat')}>Chat</button>
        <button disabled>Plan</button>
      </div>

      {tab === 'chat' ? <Chat d={d} msgs={chat} setMsgs={setChat} /> : (
      <>
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

            <h2>Interpretación de la IA</h2>
            <div className="list pad ai-card">
              {adv && (adv.raw ? <p>{adv.raw}</p> : (
                <>
                  {adv.resumen && <p className="ai-sum">{adv.resumen}</p>}
                  {adv.obs.length > 0 && <><h4 className="ai-h">Observaciones</h4><ul className="notes">{adv.obs.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
                  {adv.sug.length > 0 && <><h4 className="ai-h">Sugerencias</h4><ul className="notes">{adv.sug.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
                </>
              ))}
              {!adv && <p className="hint" style={{ marginTop: 0 }}>Pide a la IA que interprete estos números y te sugiera dónde ahorrar.</p>}
              {err && <p className="err">{err}</p>}
              <button className="btn wide" disabled={busy || stats.count === 0} onClick={generate}>{busy ? 'Analizando...' : adv ? 'Regenerar análisis' : 'Generar análisis'}</button>
              <p className="hint">Se envían tus totales por categoría, tus movimientos agrupados con sus notas, tus metas y quién te debe. Nunca números de tarjeta. Son sugerencias de una IA, no asesoría financiera profesional.</p>
            </div>

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

            {(owedList.length > 0 || oweList.length > 0) && (
              <>
                <h2>Deudas pendientes</h2>
                <div className="list pad">
                  {owedList.length > 0 && <div className="bar-top"><span>Te deben</span><b className="pos">{cop(d.owedToMe)}</b></div>}
                  {owedList.map((p) => <div className="bar-top debt-line" key={'o' + p.person}><span>{p.person} <small>({p.n} {p.n === 1 ? 'deuda' : 'deudas'})</small></span><b>{cop(p.left)}</b></div>)}
                  {oweList.length > 0 && <div className="bar-top" style={owedList.length ? { marginTop: 14 } : undefined}><span>Debes</span><b className="neg">{cop(d.iOwe)}</b></div>}
                  {oweList.map((p) => <div className="bar-top debt-line" key={'w' + p.person}><span>{p.person} <small>({p.n} {p.n === 1 ? 'deuda' : 'deudas'})</small></span><b>{cop(p.left)}</b></div>)}
                  <p className="hint">Lo que te deben no cuenta como gasto mientras esté pendiente: esa plata vuelve a ti.</p>
                </div>
              </>
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
      </>
      )}
    </div>
  )
}
