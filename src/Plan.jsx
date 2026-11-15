import { useMemo, useState } from 'react'
import { cop, today, monthKey } from './lib'
import { MoneyInput, Progress, Empty } from './ui'
import { monthStats } from './insights'
import { baseline, simulate } from './plan'
import { askAdvice, buildPlanPayload, parseAdvice } from './ai'

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
  const doneThisMonth = monthStats(d.txs, monthKey(today())).saved
  const adv = text ? parseAdvice(text) : null

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
            <p className="hint">En los últimos {base.n} {base.n === 1 ? 'mes cerrado' : 'meses cerrados'} ingresaste {cop(base.income)} al mes en promedio y gastaste {cop(base.expense)}: te sobran {cop(base.margin)}.
              {base.suggested !== monthly && base.suggested > 0 && <> <button className="link" onClick={() => setVal(String(base.suggested))}>Usar {cop(base.suggested)}</button></>}</p>
          ) : <p className="hint">Aún no hay meses cerrados con datos. Escribe cuánto quieres ahorrar al mes.</p>}
          <div className="seg" style={{ marginTop: 12 }}>
            <button className={mode === 'priority' ? 'on' : ''} onClick={() => setMode('priority')}>Por prioridad</button>
            <button className={mode === 'split' ? 'on' : ''} onClick={() => setMode('split')}>Repartir</button>
          </div>
          <p className="hint">{mode === 'priority' ? 'Termina una meta antes de pasar a la siguiente, en el orden de la pestaña Metas.' : 'Reparte el ahorro en partes iguales entre todas las metas.'} Las metas con fecha límite reciben primero la cuota que necesitan.</p>
          {dirty && <button className="btn primary wide" style={{ marginTop: 4 }} onClick={save}>Guardar este plan</button>}
          {doneThisMonth > 0 && <p className="hint">Este mes ya apartaste {cop(doneThisMonth)}.</p>}
        </div>

        <h2>Recomendaciones de la IA</h2>
        <div className="list pad ai-card">
          {adv && (adv.raw ? <p>{adv.raw}</p> : (
            <>
              {adv.resumen && <p className="ai-sum">{adv.resumen}</p>}
              {adv.sug.length > 0 && <><h4 className="ai-h">Sugerencias</h4><ul className="notes">{adv.sug.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
            </>
          ))}
          {!adv && <p className="hint" style={{ marginTop: 0 }}>Pide a la IA que interprete tu plan y te diga dónde recortar para llegar antes.</p>}
          {err && <p className="err">{err}</p>}
          <button className="btn wide" disabled={busy || monthly <= 0} onClick={generate}>{busy ? 'Analizando...' : adv ? 'Regenerar recomendaciones' : 'Generar recomendaciones'}</button>
          <p className="hint">Las fechas y cuotas las calcula la app; la IA solo las interpreta. Son sugerencias, no asesoría financiera profesional.</p>
        </div>
      </div>

      <div>
        <h2>Tus metas</h2>
        {plan.map((p, i) => (
          <div className={'goal' + (i === 0 ? ' focus' : '')} key={p.id}>
            <div className="goal-head"><strong>{p.name}</strong></div>
            <Progress value={p.saved} max={p.target} />
            <div className="goal-nums"><span>{cop(p.saved)} de {cop(p.target)}</span><b>{Math.round((p.saved / p.target) * 100) || 0}%</b></div>
            {p.left <= 0 ? <small className="muted">Ya tienes el dinero de esta meta.</small> : (
              <>
                <small className="muted">
                  {p.thisMonth > 0 ? `Aparta ${cop(p.thisMonth)} este mes. ` : 'Este mes no le toca aporte. '}
                  {p.etaLabel ? (p.eta === 0 ? 'La completas este mes.' : `La completas en ${p.etaLabel}.`) : 'Con este ahorro tardarías más de 5 años.'}
                </small>
                {p.deadline && (
                  <small className={p.onTime ? 'pos' : 'neg'} style={{ display: 'block', marginTop: 4 }}>
                    {p.onTime ? 'Llegas a tiempo a tu fecha límite.' : `Para llegar a tiempo necesitas ${cop(p.perMonthForDeadline)} al mes solo para esta meta.`}
                  </small>
                )}
                <div className="goal-btns"><button className="btn small primary" onClick={() => openAdd({ type: 'saving', goalId: p.id })}>Aportar</button></div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
