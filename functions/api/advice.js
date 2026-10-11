// Cloudflare Pages Function: /api/advice
// La clave de Groq vive aquí (variable secreta), nunca en el código del navegador.
import { createRemoteJWKSet, jwtVerify } from 'jose'

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } })

const SYSTEM = `Eres el asistente de ahorro de una app personal de un estudiante universitario colombiano. Recibes un resumen en JSON de sus finanzas del mes, en pesos colombianos.
Da de 3 a 5 consejos concretos y breves para ahorrar, basados SOLO en los datos recibidos: señala la categoría donde más gasta, compara con el mes anterior si hay datos, propón una cifra semanal o diaria realista para llegar a su meta en foco (la primera de la lista) y menciona el gasto en pasajes si es relevante.
No inventes datos ni cifras que no estén en el JSON. No des asesoría de inversión ni recomiendes productos financieros. Tono cercano y directo, sin emojis ni frases de relleno. Máximo 150 palabras. Escribe los montos como $1.234.000.`

export async function onRequestPost({ request, env }) {
  let uid
  try {
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer /, '')
    if (!token) return json({ error: 'Sin sesión.' }, 401)
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
      audience: env.FIREBASE_PROJECT_ID,
    })
    uid = payload.sub
  } catch {
    return json({ error: 'No se pudo verificar tu sesión.' }, 401)
  }
  if (env.ALLOWED_UID && uid !== env.ALLOWED_UID) return json({ error: 'No autorizado.' }, 403)
  if (!env.GROQ_API_KEY) return json({ error: 'Falta la variable GROQ_API_KEY.' }, 500)

  const { summary } = await request.json().catch(() => ({}))
  if (!summary) return json({ error: 'Faltan datos.' }, 400)

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      temperature: 0.4,
      max_tokens: 600,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: 'Mis datos del mes:\n' + JSON.stringify(summary) },
      ],
    }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) return json({ error: j.error?.message || `Groq respondió ${r.status}` }, 502)
  return json({ text: j.choices?.[0]?.message?.content?.trim() || '' })
}
