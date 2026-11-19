// Pages Function: POST /api/advice
// Verifica que quien llama sea el dueño (sesión de Firebase) y consulta a Groq con la clave guardada como secreto.
// Variables (Cloudflare > Settings > Variables and secrets): GROQ_API_KEY, GROQ_MODEL, FIREBASE_PROJECT_ID, ALLOWED_UID

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
const dec = new TextDecoder()

const b64u = (s) => {
  const p = s.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(p + '='.repeat((4 - (p.length % 4)) % 4)), (c) => c.charCodeAt(0))
}
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

// Valida un ID token de Firebase (RS256) sin librerías. Devuelve el uid.
async function verifyToken(token, projectId) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('formato')
  const header = JSON.parse(dec.decode(b64u(parts[0])))
  const payload = JSON.parse(dec.decode(b64u(parts[1])))
  if (header.alg !== 'RS256' || !header.kid) throw new Error('alg')
  const res = await fetch(JWKS_URL, { cf: { cacheTtl: 3600, cacheEverything: true } })
  const { keys } = await res.json()
  const jwk = keys.find((k) => k.kid === header.kid)
  if (!jwk) throw new Error('kid')
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]))
  if (!ok) throw new Error('firma')
  const now = Math.floor(Date.now() / 1000)
  if (payload.aud !== projectId || payload.iss !== 'https://securetoken.google.com/' + projectId) throw new Error('emisor')
  if (!payload.sub || payload.exp <= now || payload.iat > now + 300) throw new Error('vigencia')
  return payload.sub
}

const SYSTEM = [
  'Eres el asistente de finanzas personales de un estudiante colombiano de diseño gráfico que vive de una beca y apoyos familiares.',
  'Usa SOLO las cifras del JSON que recibes. No calcules, no estimes y no inventes números nuevos.',
  'Responde en español de Colombia, directo y sin emojis. Montos en pesos con el formato $ 1.234.000.',
  'Eres una guía de ahorro, no un asesor financiero profesional.',
  'Los préstamos pendientes por cobrar no son gasto: no los cuentes como gasto ni como déficit y menciónalos aparte (deudasPendientes).',
  'El campo "detalle" trae, por mes, los gastos por categoría y los ingresos como listas de [nota, veces, total]: "veces" es cuántas veces se repitió esa nota. Úsalo para dar recomendaciones concretas.',
].join(' ')

function summaryMessages(data) {
  const user = [
    'Datos del mes (ya calculados por la app):',
    JSON.stringify(data),
    '',
    'Responde exactamente con este formato, sin markdown:',
    'RESUMEN: (una sola frase de máximo 25 palabras sobre cómo le fue frente al mes anterior)',
    'OBSERVACIONES:',
    '- (3 viñetas de máximo 14 palabras cada una, cada una con una cifra del JSON)',
    'SUGERENCIAS:',
    '- Categoría | monto mensual que podría recortar (solo dígitos, en pesos) | acción en máximo 10 palabras',
    '(2 a 4 líneas con ese formato exacto, montos realistas según el detalle; usa "General" si no aplica a una categoría)',
    'Si "parcial" es true, el mes aún no termina: dilo en el resumen y no concluyas como si estuviera cerrado.',
  ].join('\n')
  return [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }]
}

function planMessages(data) {
  const user = [
    'Plan de ahorro ya calculado por la app (JSON):',
    JSON.stringify(data),
    '',
    'Responde exactamente con este formato, sin markdown:',
    'RESUMEN: (una sola frase de máximo 30 palabras: si el ahorro mensual alcanza y cuándo llegaría a las metas, citando fechas del JSON)',
    'SUGERENCIAS:',
    '- Categoría | monto mensual que podría recortar (solo dígitos, en pesos) | acción en máximo 10 palabras',
    '(3 a 4 líneas con ese formato exacto, según gastoPromedioPorCategoria y el detalle; usa "General" si no aplica a una categoría)',
    'No recalcules fechas ni cuotas: usa las del JSON. Si aTiempo es false para una meta con fecha límite, dilo y di cuánto más al mes haría falta usando cuotaMensualParaLlegarAFecha.',
  ].join('\n')
  return [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }]
}

function chatMessages(data, history) {
  const system = [
    SYSTEM,
    'Respondes preguntas sobre sus finanzas usando solo el contexto que sigue (JSON calculado por la app). Si falta un dato, dilo; no inventes cifras.',
    'Respuestas cortas, máximo 120 palabras, sin markdown ni listas con asteriscos. Para recomendar ahorro indica categoría, monto sugerido y por qué.',
    'Haz solo sumas o restas simples con los datos del contexto; si necesitas un cálculo más complejo, di que no lo tienes. Si preguntan algo ajeno a sus finanzas, redirige con amabilidad.',
    'Contexto: ' + JSON.stringify(data),
  ].join('\n')
  return [{ role: 'system', content: system }, ...history]
}

export async function onRequestPost({ request, env }) {
  if (!env.GROQ_API_KEY || !env.FIREBASE_PROJECT_ID || !env.ALLOWED_UID) return json({ error: 'config' }, 500)

  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  let uid
  try { uid = await verifyToken(token, env.FIREBASE_PROJECT_ID) } catch { return json({ error: 'auth' }, 401) }
  if (uid !== env.ALLOWED_UID) return json({ error: 'forbidden' }, 403)

  const raw = await request.text()
  if (raw.length > 40000) return json({ error: 'too_big' }, 413)
  let body
  try { body = JSON.parse(raw) } catch { return json({ error: 'bad_request' }, 400) }
  if (!body.data || typeof body.data !== 'object') return json({ error: 'bad_request' }, 400)
  let messages
  if (body.kind === 'summary') messages = summaryMessages(body.data)
  else if (body.kind === 'plan') messages = planMessages(body.data)
  else if (body.kind === 'chat') {
    const history = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 800) }))
      .slice(-8)
    if (!history.length || history[history.length - 1].role !== 'user') return json({ error: 'bad_request' }, 400)
    messages = chatMessages(body.data, history)
  } else return json({ error: 'bad_request' }, 400)

  const model = env.GROQ_MODEL || 'openai/gpt-oss-120b'
  const payload = { model, messages, temperature: 0.4, max_completion_tokens: body.kind === 'chat' ? 1200 : 2000 }
  if (model.includes('gpt-oss')) payload.reasoning_effort = 'low'

  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 25000)
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.GROQ_API_KEY },
      body: JSON.stringify(payload),
      signal: ctl.signal,
    })
    if (res.status === 429) return json({ error: 'limit' }, 429)
    if (!res.ok) return json({ error: 'ai', status: res.status }, 502)
    const out = await res.json()
    const text = (out.choices?.[0]?.message?.content || '').trim()
    if (!text) return json({ error: 'empty' }, 502)
    return json({ text, model })
  } catch {
    return json({ error: 'timeout' }, 504)
  } finally {
    clearTimeout(timer)
  }
}
