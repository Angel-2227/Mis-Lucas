// Cliente del Asistente: arma el resumen que se envía a la IA y lee su respuesta.
// Nunca se envían números de tarjeta, notas de movimientos ni nombres de personas.
import { monthLabel, monthKey, shiftMonth, today } from './lib'
import { compareMonths, monthStats } from './insights'

const snap = (s) => ({ ingresos: s.income, gastos: s.expense, apartadoParaMetas: s.saved, balance: s.balance, gastoPorCategoria: s.byCat })

export function buildPayload(d, month, cur, prev, closed) {
  const { cats } = compareMonths(cur, prev)
  const fixed = (d.settings.recurring || []).filter((r) => r.kind === 'expense').reduce((s, r) => s + (Number(r.amount) || 0), 0)
  return {
    mes: monthLabel(month),
    mesAnterior: monthLabel(shiftMonth(month, -1)),
    parcial: !closed,
    actual: snap(cur),
    anterior: snap(prev),
    cambiosPorCategoria: cats.map((c) => ({ categoria: c.name, actual: c.cur, anterior: c.prev, diferencia: c.diff })),
    metasActivas: d.goals.filter((g) => !g.done).map((g) => ({ nombre: g.name, precio: g.target, ahorrado: d.savedByGoal[g.id] || 0 })),
    disponibleHoy: d.available,
    teDeben: d.owedToMe,
    debes: d.iOwe,
    gastosFijosMensuales: fixed,
  }
}

const ERRORS = {
  auth: 'No se pudo verificar tu sesión. Cierra y abre la app e intenta de nuevo.',
  forbidden: 'Esta cuenta no tiene permiso para usar la IA. Revisa ALLOWED_UID en Cloudflare.',
  config: 'Faltan variables en Cloudflare (GROQ_API_KEY, FIREBASE_PROJECT_ID o ALLOWED_UID). Revisa y vuelve a desplegar.',
  limit: 'Se alcanzó el límite gratuito de Groq. Intenta de nuevo en unos minutos.',
  ai: 'Groq respondió con un error. Intenta de nuevo.',
  empty: 'La IA no devolvió texto. Intenta de nuevo.',
  timeout: 'La IA tardó demasiado en responder. Intenta de nuevo.',
  too_big: 'El resumen enviado es demasiado grande.',
  bad_request: 'La solicitud no fue válida.',
}

export async function askAdvice(user, kind, data, messages) {
  const token = await user.getIdToken()
  let res
  try {
    res = await fetch('/api/advice', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ kind, data, messages }),
    })
  } catch { throw new Error('Sin conexión con el servidor de IA.') }
  let j = null
  try { j = await res.json() } catch { /* respuesta que no es JSON */ }
  if (!res.ok || !j?.text) throw new Error(ERRORS[j?.error] || 'El servidor de IA no está disponible.')
  return j.text
}

// Convierte el texto del modelo en secciones. Si no respeta el formato, devuelve el texto tal cual en "raw".
export function parseAdvice(text) {
  const out = { resumen: '', obs: [], sug: [], raw: '' }
  let sec = 'res'
  for (const line of String(text || '').split('\n')) {
    const t = line.replace(/\*\*/g, '').trim()
    if (!t) continue
    if (/^RESUMEN\s*:?/i.test(t)) { sec = 'res'; out.resumen = t.replace(/^RESUMEN\s*:?\s*/i, ''); continue }
    if (/^OBSERVACIONES\s*:?/i.test(t)) { sec = 'obs'; continue }
    if (/^SUGERENCIAS\s*:?/i.test(t)) { sec = 'sug'; continue }
    const item = t.replace(/^[-*•]\s*/, '')
    if (sec === 'obs') out.obs.push(item)
    else if (sec === 'sug') out.sug.push(item)
    else out.resumen += (out.resumen ? ' ' : '') + item
  }
  if (!out.resumen && !out.obs.length && !out.sug.length) out.raw = String(text || '')
  return out
}

// Contexto del chat: últimos 3 meses cerrados + el actual, metas, deudas y gastos fijos.
// Los números derivados (proyección, cuota de metas) se calculan aquí para que la IA no tenga que hacer cuentas.
export function buildChatContext(d) {
  const t = today()
  const cur = monthKey(t)
  const y = Number(t.slice(0, 4)), m = Number(t.slice(5, 7)), day = Number(t.slice(8, 10))
  const daysInMonth = new Date(y, m, 0).getDate()
  const meses = [-3, -2, -1, 0].map((n) => {
    const k = shiftMonth(cur, n)
    return { mes: monthLabel(k), parcial: k === cur, ...snap(monthStats(d.txs, k)) }
  })
  const now = monthStats(d.txs, cur)
  const rec = d.settings.recurring || []
  return {
    hoy: t,
    diaDelMes: day,
    diasDelMes: daysInMonth,
    gastoDelMesHastaHoy: now.expense,
    proyeccionGastoFinDeMes: Math.round((now.expense / Math.max(1, day)) * daysInMonth),
    meses,
    disponibleHoy: d.available,
    enAhorroParaMetas: d.reserved,
    teDeben: d.owedToMe,
    debes: d.iOwe,
    ingresosRecurrentes: rec.filter((r) => r.kind !== 'expense').map((r) => ({ monto: r.amount, mesesSinPago: (r.skipMonths || []).map((x) => monthLabel(`2026-${String(x).padStart(2, '0')}`).split(' ')[0]) })),
    gastosFijos: rec.filter((r) => r.kind === 'expense').map((r) => ({ monto: r.amount, categoria: r.category || 'Otros', diaDePago: r.day || null })),
    metas: d.goals.filter((g) => !g.done).map((g) => {
      const saved = d.savedByGoal[g.id] || 0
      const left = Math.max(0, g.target - saved)
      const o = { nombre: g.name, precio: g.target, ahorrado: saved, faltante: left }
      if (g.deadline && left > 0) {
        o.fechaLimite = g.deadline
        o.cuotaMensualSugerida = Math.ceil(left / Math.max(1, Math.ceil((new Date(g.deadline) - new Date()) / (1000 * 60 * 60 * 24 * 30))))
      }
      return o
    }),
  }
}
