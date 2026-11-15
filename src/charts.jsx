import { cop, shiftMonth, MONTHS_SHORT } from './lib'

// Montos cortos para los gráficos: $ 1,2 M, $ 400 mil.
export const short = (n) => {
  const a = Math.abs(n || 0), s = n < 0 ? '-' : ''
  if (a >= 1e6) return `${s}$ ${(a / 1e6).toFixed(1).replace('.', ',').replace(/,0$/, '')} M`
  if (a >= 1e3) return `${s}$ ${Math.round(a / 1e3)} mil`
  return `${s}$ ${Math.round(a)}`
}
export const PALETTE = ['#2F80ED', '#E84393', '#F2A900', '#16A085', '#8E44AD', '#E4572E', '#0F6B5B', '#6368BD']
export const monthShort = (key) => `${MONTHS_SHORT[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`

export function Delta({ r }) {
  if (r.prev === 0 && r.cur === 0) return <span className="delta flat">-</span>
  if (r.pct === null) return <span className="delta flat">nuevo</span>
  const rounded = Math.round(r.pct)
  if (rounded === 0) return <span className="delta flat">igual</span>
  const good = r.good ? (r.good === 'up') === (r.diff > 0) : null
  return <span className={'delta ' + (good === null ? 'flat' : good ? 'good' : 'bad')}>{r.diff > 0 ? '+' : ''}{rounded}%</span>
}

// Dona: data = [{ name, value, color }]
export function Donut({ data, total, label }) {
  const R = 44, C = 2 * Math.PI * R
  const sum = data.reduce((s, x) => s + x.value, 0) || 1
  let acc = 0
  return (
    <div className="donut">
      <svg viewBox="0 0 120 120" role="img" aria-label={label}>
        <g transform="rotate(-90 60 60)">
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--line)" strokeWidth="18" />
          {data.map((x) => {
            const len = (x.value / sum) * C
            const el = <circle key={x.name} cx="60" cy="60" r={R} fill="none" stroke={x.color} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />
            acc += len
            return el
          })}
        </g>
        <text x="60" y="56" textAnchor="middle" className="donut-l">{label}</text>
        <text x="60" y="72" textAnchor="middle" className="donut-v">{short(total)}</text>
      </svg>
      <ul className="donut-leg">
        {data.map((x) => (
          <li key={x.name}><i className="dot" style={{ background: x.color }} /><span>{x.name}</span><b>{Math.round((x.value / sum) * 100)}%</b></li>
        ))}
      </ul>
    </div>
  )
}

// Barras emparejadas: este mes contra el anterior. rows = [{ name, cur, prev, pct, diff, good }]
export function PairBars({ rows, curLabel, prevLabel }) {
  const max = Math.max(1, ...rows.flatMap((r) => [Math.abs(r.cur), Math.abs(r.prev)]))
  const w = (v) => Math.max(1.5, (Math.abs(v) / max) * 100) + '%'
  return (
    <div>
      <div className="pb-key"><span><i className="dot" style={{ background: 'var(--dark)' }} />{curLabel}</span><span><i className="dot" style={{ background: '#B9C9A4' }} />{prevLabel}</span></div>
      {rows.map((r) => (
        <div className="pb-row" key={r.name}>
          <div className="pb-top"><span>{r.name}</span><Delta r={r} /></div>
          <div className="pb-bar"><i className={'cur' + (r.cur < 0 ? ' neg' : '')} style={{ width: w(r.cur) }} /><em>{short(r.cur)}</em></div>
          <div className="pb-bar"><i className="prev" style={{ width: w(r.prev) }} /><em>{short(r.prev)}</em></div>
        </div>
      ))}
    </div>
  )
}

// Gasto por categoría con una marca vertical donde estuvo el mes anterior.
export function CatBars({ rows, colorOf }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.cur, r.prev]))
  return (
    <div>
      {rows.map((r) => (
        <div className="cb-row" key={r.name}>
          <div className="cb-top"><span>{r.name}</span><b>{short(r.cur)}</b><Delta r={{ ...r, good: 'down' }} /></div>
          <div className="cb-track">
            <i style={{ width: (r.cur / max) * 100 + '%', background: colorOf(r.name) }} />
            {r.prev > 0 && <u style={{ left: (r.prev / max) * 100 + '%' }} title="Mes anterior" />}
          </div>
        </div>
      ))}
      <p className="hint" style={{ marginBottom: 0 }}>La marca vertical indica dónde estuvo el mes anterior.</p>
    </div>
  )
}

// Barra apilada: parts = [{ name, value, color }]
export function StackBar({ parts }) {
  const sum = parts.reduce((s, x) => s + x.value, 0) || 1
  return (
    <div>
      <div className="stackbar">{parts.map((p) => <i key={p.name} style={{ width: (p.value / sum) * 100 + '%', background: p.color }} title={p.name} />)}</div>
      <div className="leg-rows">
        {parts.map((p) => <div key={p.name}><i className="dot" style={{ background: p.color }} /><span>{p.name}</span><b>{cop(p.value)}</b></div>)}
      </div>
    </div>
  )
}

// Líneas: series = [{ name, color, points: [0..1], deadline?: índice }]; now = 'YYYY-MM' del punto 0.
export function Lines({ series, now }) {
  const H = Math.max(...series.map((s) => s.points.length - 1), 1)
  const x = (j) => 34 + (j / H) * 276
  const y = (v) => 140 - Math.min(1, Math.max(0, v)) * 128
  const ticks = [...new Set([0, Math.round(H / 2), H])]
  const lab = (j) => (j === 0 ? 'Hoy' : monthShort(shiftMonth(now, j - 1)))
  return (
    <svg className="chartsvg" viewBox="0 0 320 162" role="img" aria-label="Avance proyectado de tus metas">
      {[0, 0.5, 1].map((g) => (
        <g key={g}><line x1="34" x2="310" y1={y(g)} y2={y(g)} stroke="var(--line)" /><text x="30" y={y(g) + 3} textAnchor="end">{g * 100}%</text></g>
      ))}
      {ticks.map((j) => <text key={j} x={x(j)} y="156" textAnchor={j === 0 ? 'start' : j === H ? 'end' : 'middle'}>{lab(j)}</text>)}
      {series.map((s) => {
        const pts = s.points.map((v, j) => `${x(j)},${y(v)}`).join(' ')
        const last = s.points.length - 1
        return (
          <g key={s.name}>
            {s.deadline !== null && s.deadline !== undefined && s.deadline + 1 <= H && <line x1={x(s.deadline + 1)} x2={x(s.deadline + 1)} y1="12" y2="140" stroke={s.color} strokeDasharray="3 3" opacity=".7" />}
            <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={x(last)} cy={y(s.points[last])} r="3.2" fill={s.color} />
          </g>
        )
      })}
    </svg>
  )
}

// Recortes sugeridos por la IA: tarjetas con monto en grande.
export function CutCards({ cuts, colorOf }) {
  const total = cuts.reduce((s, c) => s + c.amount, 0)
  return (
    <div>
      {total > 0 && <div className="cut-total">Podrías liberar {short(total)} al mes</div>}
      {cuts.map((c, i) => (
        <div className="cut" key={i} style={{ '--c': colorOf(c.cat) }}>
          <div><strong>{c.cat}</strong>{c.action && <small>{c.action}</small>}</div>
          <b>{c.amount > 0 ? '-' + short(c.amount) : ''}</b>
        </div>
      ))}
    </div>
  )
}

// Respuesta de la IA, lo más visual posible.
export function AdviceView({ adv, colorOf }) {
  if (adv.raw) return <p className="ai-p">{adv.raw}</p>
  return (
    <>
      {adv.resumen && <p className="ai-sum">{adv.resumen}</p>}
      {adv.obs.length > 0 && <ul className="obs">{adv.obs.map((x, i) => <li key={i}>{x}</li>)}</ul>}
      {adv.cuts.length > 0 && <><h4 className="ai-h">Dónde recortar</h4><CutCards cuts={adv.cuts} colorOf={colorOf} /></>}
      {adv.sug.length > 0 && <ul className="obs">{adv.sug.map((x, i) => <li key={i}>{x}</li>)}</ul>}
    </>
  )
}
