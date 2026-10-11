// Cloudflare Worker con Cron: cada 5 minutos revisa tus recordatorios y envía notificaciones push (FCM).
// Variables: GOOGLE_SERVICE_ACCOUNT (secreto, JSON completo), FIREBASE_UID, TEST_KEY (opcional, para probar).
const TZ = 'America/Bogota'
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const strB64u = (s) => b64u(new TextEncoder().encode(s))

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000)
  const head = strB64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = strB64u(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }))
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${claim}`))
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${b64u(sig)}` }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error('No se obtuvo token: ' + JSON.stringify(j))
  return j.access_token
}

const fromFs = (v) => {
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFs)
  if ('mapValue' in v) return toData(v.mapValue)
  return null
}
const toData = (doc) => Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, fromFs(v)]))

const fsCall = (path, at, init = {}) =>
  fetch(`https://firestore.googleapis.com/v1/${path}`, { ...init, headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' } })

async function sendFcm(pid, at, token, m) {
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${pid}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { token, data: { title: m.title, body: m.body, url: m.url }, webpush: { headers: { Urgency: 'high', TTL: '7200' } } } }),
  })
  if (r.ok) return 'ok'
  const t = await r.text()
  if (r.status === 404 || t.includes('UNREGISTERED')) return 'dead'
  console.log('FCM error', r.status, t)
  return 'error'
}

async function run(env, force = false) {
  const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT)
  const pid = sa.project_id
  const at = await getAccessToken(sa)
  const docs = `projects/${pid}/databases/(default)/documents`
  const base = `${docs}/users/${env.FIREBASE_UID}`

  const res = await fsCall(`${base}/meta/push`, at)
  if (!res.ok) return
  const push = toData(await res.json())
  const tokens = push.tokens || []
  if (!tokens.length) return

  const now = new Date()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now)
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now).split(':').map(Number)
  const nowMin = h * 60 + m

  const messages = []
  if (force) {
    messages.push({ title: 'Mis Lucas', body: 'Prueba: las notificaciones funcionan.', url: '/' })
  } else {
    const due = (push.reminders || []).filter((r) => {
      if (!r.enabled || !/^\d{2}:\d{2}$/.test(r.time || '')) return false
      const rm = Number(r.time.slice(0, 2)) * 60 + Number(r.time.slice(3))
      return (nowMin - rm + 1440) % 1440 < 5 // la ventana de 5 min coincide con el cron: se envía una sola vez
    })
    if (!due.length) return
    const q = await fsCall(`${base}:runQuery`, at, {
      method: 'POST',
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'transactions' }], where: { fieldFilter: { field: { fieldPath: 'date' }, op: 'EQUAL', value: { stringValue: today } } } } }),
    })
    const rows = q.ok ? (await q.json()).filter((x) => x.document).map((x) => toData(x.document)) : []
    for (const r of due) {
      if (r.kind === 'pasaje') {
        if (!rows.some((t) => t.qty)) messages.push({ title: 'Pasajes de hoy', body: '¿Usaste TuLlave hoy? Cuéntame cuántos pasajes gastaste.', url: '/?add=fare' })
      } else if (!rows.some((t) => t.type === 'expense')) {
        messages.push({ title: 'Mis Lucas', body: '¿Gastaste algo hoy? Anótalo antes de que se te olvide.', url: '/?add=expense' })
      }
    }
  }

  for (const msg of messages) {
    for (const token of tokens) {
      const out = await sendFcm(pid, at, token, msg)
      if (out === 'dead') {
        await fsCall(`${docs}:commit`, at, {
          method: 'POST',
          body: JSON.stringify({ writes: [{ transform: { document: `${base}/meta/push`, fieldTransforms: [{ fieldPath: 'tokens', removeAllFromArray: { values: [{ stringValue: token }] } }] } }] }),
        })
      }
    }
  }
}

export default {
  scheduled(event, env, ctx) { ctx.waitUntil(run(env)) },
  async fetch(req, env) {
    const key = new URL(req.url).searchParams.get('key')
    if (env.TEST_KEY && key === env.TEST_KEY) {
      try { await run(env, true); return new Response('Notificación de prueba enviada.') } catch (e) { return new Response('Error: ' + e.message, { status: 500 }) }
    }
    return new Response('ok')
  },
}
