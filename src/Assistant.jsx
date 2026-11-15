import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cop, today, monthKey, monthLabel, shiftMonth } from './lib'
import { MonthNav, Empty, Progress } from './ui'
import { monthStats, compareMonths, notes } from './insights'
import { askAdvice, buildPayload, parseAdvice } from './ai'
import Chat from './Chat'
import Plan from './Plan'
import { Donut, PairBars, CatBars, AdviceView, PALETTE } from './charts'

export default function Assistant({ d, back, openAdd }) {
  const cur = monthKey(today())
  const [tab, setTab] = useState('summary')
  const [chat, setChat] = useState([]) // la conversación vive mientras la app esté abierta
  const [month, setMonth] = useState(shiftMonth(cur, -1)) // por defecto, el último mes cerrado
  const prevKey = shiftMonth(month, -1)
  const stats = monthStats(d.txs, month)
  const prev = monthStats(d.txs, prevKey)
  const { totals, cats } = compareMonths(stats, prev)
  const list = notes(stats, prev)
  const colorOf = (n) => d.settings.categories.find((c) => c.name === n)?.color || '#7F8C8D'
  const pairs = totals.filter((r) => r.name !== 'Apartado para metas' || r.cur > 0 || r.prev > 0)
  const catSorted = Object.entries(stats.byCat).sort((a, b) => b[1] - a[1])
  const donutData = [...catSorted.slice(0, 5).map(([name, value]) => ({ name, value, color: colorOf(name) })),
    ...(catSorted.length > 5 ? [{ name: 'Otros', value: catSorted.slice(5).reduce((x, [, v]) => x + v, 0), color: '#B9C9A4' }] : [])]
  const closed = month < cur
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
        <button className={tab === 'plan' ? 'on' : ''} onClick={() => setTab('plan')}>Plan</button>
      </div>

      {tab === 'chat' ? <Chat d={d} msgs={chat} setMsgs={setChat} /> : tab === 'plan' ? <Plan d={d} openAdd={openAdd} /> : (
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

            <h2>Análisis de la IA</h2>
            <div className="list pad ai-card">
              {adv ? <AdviceView adv={adv} colorOf={colorOf} /> : <p className="hint" style={{ marginTop: 0 }}>Pide a la IA un análisis corto de este mes, con los recortes que te sugiere.</p>}
              {err && <p className="err">{err}</p>}
              <button className="btn wide" disabled={busy || stats.count === 0} onClick={generate}>{busy ? 'Analizando...' : adv ? 'Regenerar análisis' : 'Generar análisis'}</button>
              <p className="hint">Se envían tus totales por categoría, tus movimientos agrupados con sus notas, tus metas y quién te debe. Nunca números de tarjeta. Son sugerencias de una IA, no asesoría financiera profesional.</p>
            </div>

            <h2>¿En qué se fue el dinero?</h2>
            <div className="list pad">
              {donutData.length === 0 ? <p className="hint" style={{ margin: 0 }}>No hay gastos en este mes.</p> : <Donut data={donutData} total={stats.expense} label="Gastos" />}
            </div>

            <h2>Contra {monthLabel(prevKey).split(' ')[0]}</h2>
            <div className="list pad">
              <PairBars rows={pairs} curLabel={monthLabel(month).split(' ')[0]} prevLabel={monthLabel(prevKey).split(' ')[0]} />
              <p className="hint" style={{ marginBottom: 0 }}>Los préstamos que te deben no cuentan como gasto mientras estén pendientes.</p>
            </div>

            {list.length > 0 && (
              <details className="more">
                <summary>Ver lo más notable en texto</summary>
                <ul className="notes">{list.map((n, i) => <li key={i}>{n}</li>)}</ul>
              </details>
            )}
          </div>

          <div>
            <h2>Gasto por categoría</h2>
            {cats.length === 0 ? <Empty title="Sin gastos" text="No hay gastos en estos meses." /> : (
              <div className="list pad"><CatBars rows={cats} colorOf={colorOf} /></div>
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
