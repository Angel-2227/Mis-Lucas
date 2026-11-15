// Cliente del Asistente: arma el resumen que se envía a la IA y lee su respuesta.
// Nunca se envían números de tarjeta, notas de movimientos ni nombres de personas.
import { monthLabel, shiftMonth } from './lib'
import { compareMonths } from './insights'

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

export async function askAdvice(user, kind, data) {
  const token = await user.getIdToken()
  let res
  try {
    res = await fetch('/api/advice', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ kind, data }),
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
