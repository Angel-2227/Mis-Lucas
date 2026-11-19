import { useMemo, useState } from 'react'
import { cop, today, monthKey } from './lib'
import { MoneyInput, Progress, Empty } from './ui'
import { monthStats } from './insights'
import { baseline, simulate } from './plan'
import { askAdvice, buildPlanPayload, parseAdvice } from './ai'
import { StackBar, Lines, AdviceView, PALETTE, short } from './charts'

export default function Plan({ d, openAdd }) {
  const goals = useMemo(() => [...d.goals].filter((g) => !g.done).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [d.goals])
  const base = useMemo(() => baseline(d.txs), [d.txs])
  const saved = d.settings.plan
  const [val, setVal] = useState(String(saved?.monthly ?? base.suggested))
  const [mode, setMode] = useState(saved?.mode || 'priority')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const monthly = Number(val) || 0
  const plan = useMemo(() => simulate(goals, d.savedByGoal, monthly, mode), [goals, d.savedByGoal, monthly, mode])
  const dirty = !saved || saved.monthly !== monthly || saved.mode !== mode
  const now = monthKey(today())
  const doneThisMonth = monthStats(d.txs, now).saved
  const adv = text ? parseAdvice(text) : null
  const colorOf = (n) => d.settings.categories.find((c) => c.name === n)?.color || '#7F8C8D'
  const color = (i) => PALETTE[i % PALETTE.length]

  const unfinished = plan.filter((p) => p.left > 0)
  const maxEta = Math.max(0, ...plan.map((p) => (p.eta === null ? 0 : p.eta)))
  const horizon = plan.some((p) => p.left > 0 && p.eta === null) ? 36 : Math.min(36, Math.max(3, maxEta + 2))
  const series = plan.map((p, i) => ({
    name: p.name, color: color(i), deadline: p.deadline ? p.deadlineIdx : null,
    points: Array.from({ length: horizon + 1 }, (_, j) => p.curve[Math.min(j, p.curve.length - 1)]),
  })).filter((s, i) => plan[i].left > 0)
  const parts = plan.map((p, i) => ({ name: p.name, value: p.thisMonth, color: color(i) })).filter((p) => p.value > 0)

  const save = () => d.api.saveSettings({ plan: { monthly, mode } })
  const generate = async () => {
    setBusy(true); setErr('')
    try { setText(await askAdvice(d.user, 'plan', buildPlanPayload(d, base, plan, monthly, mode))) }
    catch (e) { setErr(e.message || 'No se pudo generar el plan.') }
    setBusy(false)
  }

  if (goals.length === 0) return <Empty title="Sin metas activas" text="Crea una meta en la pestaña Metas para armar tu plan de ahorro." />

  return (
    <div className="stats-grid">
      <div>
        <h2>Cuánto puedes ahorrar al mes</h2>
        <div className="list pad">
          <MoneyInput value={val} onChange={setVal} />
          {base.n > 0 ? (
            <div className="plan-base">
              <div><small>Ingresas</small><b className="pos">{short(base.income)}</b></div>
              <div><small>Gastas</small><b className="neg">{short(base.expense)}</b></div>
              <div><small>Te sobra</small><b>{short(base.margin)}</b></div>
            </div>
          ) : <p className="hint">Aún no hay meses cerrados con datos. Escribe cuánto quieres ahorrar al mes.</p>}
          {base.n > 0 && <p className="hint" style={{ marginTop: 0 }}>Promedio de los últimos {base.n} {base.n === 1 ? 'mes cerrado' : 'meses cerrados'}.{base.suggested !== monthly && base.suggested > 0 && <> <button className="link" onClick={() => setVal(String(base.suggested))}>Usar {cop(base.suggested)}</button></>}</p>}
          <div className="seg" style={{ marginTop: 10 }}>
            <button className={mode === 'priority' ? 'on' : ''} onClick={() => setMode('priority')}>Por prioridad</button>
            <button className={mode === 'split' ? 'on' : ''} onClick={() => setMode('split')}>Repartir</button>
          </div>
          {dirty && <button className="btn primary wide" style={{ marginTop: 10 }} onClick={save}>Guardar este plan</button>}
          {doneThisMonth > 0 && <p className="hint">Este mes ya apartaste {cop(doneThisMonth)}.</p>}
        </div>

        <h2>Cómo se reparte este mes</h2>
        <div className="list pad">
          {parts.length === 0 ? <p className="hint" style={{ margin: 0 }}>{monthly <= 0 ? 'Escribe cuánto vas a ahorrar para ver el reparto.' : 'Este mes no hay aportes por repartir.'}</p> : <StackBar parts={parts} />}
        </div>

        <h2>Recomendaciones de la IA</h2>
        <div className="list pad ai-card">
          {adv ? <AdviceView adv={adv} colorOf={colorOf} /> : <p className="hint" style={{ marginTop: 0 }}>Pide a la IA dónde recortar para llegar antes a tus metas.</p>}
          {err && <p className="err">{err}</p>}
          <button className="btn wide" disabled={busy || monthly <= 0} onClick={generate}>{busy ? 'Analizando...' : adv ? 'Regenerar recomendaciones' : 'Generar recomendaciones'}</button>
          <p className="hint">Las fechas y cuotas las calcula la app; la IA solo las interpreta. Son sugerencias, no asesoría financiera profesional.</p>
        </div>
      </div>

      <div>
        <h2>Avance proyectado</h2>
        <div className="list pad">
          {series.length === 0 ? <p className="hint" style={{ margin: 0 }}>Ya tienes el dinero de todas tus metas.</p> : (
            <>
              <Lines series={series} now={now} />
              <div className="leg-rows">{plan.map((p, i) => p.left > 0 && <div key={p.id}><i className="dot" style={{ background: color(i) }} /><span>{p.name}</span><small className="muted">{p.etaLabel ? 'termina ' + p.etaLabel.split(' ')[0] + ' ' + p.etaLabel.slice(-4) : 'más de 5 años'}</small></div>)}</div>
              {plan.some((p) => p.deadline && p.left > 0) && <p className="hint" style={{ marginBottom: 0 }}>La línea punteada marca la fecha límite de la meta.</p>}
            </>
          )}
        </div>

        <h2>Tus metas</h2>
        {plan.map((p, i) => (
          <div className="goal" key={p.id} style={{ borderLeft: `6px solid ${color(i)}` }}>
            <div className="goal-head"><strong>{p.name}</strong><b>{Math.round((p.saved / p.target) * 100) || 0}%</b></div>
            <Progress value={p.saved} max={p.target} />
            <div className="goal-nums"><span>{short(p.saved)} de {short(p.target)}</span></div>
            {p.left <= 0 ? <span className="badge good">Dinero completo</span> : (
              <>
                <div className="badges">
                  <span className="badge">{p.thisMonth > 0 ? `Este mes: ${short(p.thisMonth)}` : 'Este mes: $ 0'}</span>
                  {p.etaLabel && <span className="badge">{p.eta === 0 ? 'Completa este mes' : 'Completa: ' + p.etaLabel.split(' ')[0]}</span>}
                  {p.deadline && (p.onTime ? <span className="badge good">A tiempo</span> : <span className="badge bad">Faltan {short(Math.max(0, p.perMonthForDeadline - p.thisMonth))} al mes</span>)}
                </div>
                <div className="goal-btns"><button className="btn small primary" onClick={() => openAdd({ type: 'saving', goalId: p.id })}>Aportar</button></div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
