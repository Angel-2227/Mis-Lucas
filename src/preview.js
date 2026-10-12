// Enlaces de metas y búsqueda de la imagen del producto.

// Solo acepta http/https y dominios con punto; devuelve '' si no es válido.
export function normalizeUrl(input) {
  let s = (input || '').trim()
  if (!s) return ''
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s
  try {
    const u = new URL(s)
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.')) return ''
    return u.href
  } catch { return '' }
}

export const hostOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

// El navegador no puede leer páginas de otros sitios (CORS), así que se consulta
// el servicio gratuito Microlink, que devuelve la imagen principal de la página.
// Solo se guarda el enlace de la imagen, no el archivo.
export async function findImage(pageUrl) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 9000)
  try {
    const r = await fetch('https://api.microlink.io/?url=' + encodeURIComponent(pageUrl), { signal: ctrl.signal })
    const j = await r.json()
    const img = j?.data?.image?.url
    return typeof img === 'string' && /^https?:\/\//i.test(img) ? img : ''
  } catch { return '' } finally { clearTimeout(timer) }
}
