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
].join(' ')

function summaryMessages(data) {
  const user = [
    'Datos del mes (ya calculados por la app):',
    JSON.stringify(data),
    '',
    'Responde exactamente con este formato, sin markdown:',
    'RESUMEN: (2 a 3 frases sobre cómo le fue frente al mes anterior)',
    'OBSERVACIONES:',
    '- (3 a 4 viñetas con hallazgos concretos apoyados en los datos)',
    'SUGERENCIAS:',
    '- (2 a 3 viñetas con acciones concretas y alcanzables para el próximo mes, citando categorías o metas)',
    'Si "parcial" es true, el mes aún no termina: dilo en el resumen y no concluyas como si estuviera cerrado.',
  ].join('\n')
  return [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }]
}

export async function onRequestPost({ request, env }) {
  if (!env.GROQ_API_KEY || !env.FIREBASE_PROJECT_ID || !env.ALLOWED_UID) return json({ error: 'config' }, 500)

  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  let uid
  try { uid = await verifyToken(token, env.FIREBASE_PROJECT_ID) } catch { return json({ error: 'auth' }, 401) }
  if (uid !== env.ALLOWED_UID) return json({ error: 'forbidden' }, 403)

  const raw = await request.text()
  if (raw.length > 20000) return json({ error: 'too_big' }, 413)
  let body
  try { body = JSON.parse(raw) } catch { return json({ error: 'bad_request' }, 400) }
  if (body.kind !== 'summary' || !body.data || typeof body.data !== 'object') return json({ error: 'bad_request' }, 400)

  const model = env.GROQ_MODEL || 'openai/gpt-oss-120b'
  const payload = { model, messages: summaryMessages(body.data), temperature: 0.4, max_completion_tokens: 2000 }
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
