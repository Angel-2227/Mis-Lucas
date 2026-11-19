// Cifrado local de números de tarjeta (AES-GCM, clave derivada con PBKDF2).
// Firestore solo guarda texto cifrado; la clave vive únicamente en memoria.
const enc = new TextEncoder()
const dec = new TextDecoder()
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const TTL = 10 * 60 * 1000 // 10 minutos

let key = null
let timer = null
const subs = new Set()
const notify = () => subs.forEach((f) => f())

async function derive(pass, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  )
}
async function seal(k, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(text))
  const out = new Uint8Array(12 + ct.byteLength)
  out.set(iv); out.set(new Uint8Array(ct), 12)
  return b64(out)
}
async function open(k, s) {
  const raw = unb64(s)
  return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, k, raw.slice(12)))
}
function arm(k) {
  key = k
  clearTimeout(timer)
  timer = setTimeout(lock, TTL)
  notify()
}

export function lock() { key = null; clearTimeout(timer); notify() }
export const isUnlocked = () => key !== null
export const subscribe = (f) => { subs.add(f); return () => subs.delete(f) }
export const encryptText = (t) => seal(key, t)
export const decryptText = (s) => open(key, s)

export async function createVault(pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const k = await derive(pass, salt)
  const check = await seal(k, 'ok')
  arm(k)
  return { salt: b64(salt), check }
}
export async function unlock(pass, vault) {
  try {
    const k = await derive(pass, unb64(vault.salt))
    if ((await open(k, vault.check)) !== 'ok') return false
    arm(k)
    return true
  } catch { return false }
}
