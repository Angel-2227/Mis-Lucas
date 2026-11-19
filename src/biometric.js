// Huella, rostro o bloqueo del dispositivo mediante WebAuthn (autenticador de plataforma).
// Es un bloqueo local de la app en este dispositivo: no reemplaza la clave que cifra los números.
const storeKey = (uid) => 'mislucas:bio:' + uid
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const challenge = () => crypto.getRandomValues(new Uint8Array(32))

export async function bioSupported() {
  try { return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) } catch { return false }
}
export const bioEnabled = (uid) => { try { return !!localStorage.getItem(storeKey(uid)) } catch { return false } }
export const bioDisable = (uid) => { try { localStorage.removeItem(storeKey(uid)) } catch { /* sin acceso a localStorage */ } }

export async function bioEnable(user) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: challenge(),
      rp: { name: 'Mis Lucas' },
      user: { id: new TextEncoder().encode(user.uid).slice(0, 64), name: user.email || user.uid, displayName: user.displayName || 'Mis Lucas' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
      attestation: 'none',
    },
  })
  if (!cred) throw new Error('cancelado')
  localStorage.setItem(storeKey(user.uid), b64u(cred.rawId))
}

export async function bioCheck(uid) {
  const id = localStorage.getItem(storeKey(uid))
  if (!id) throw new Error('sin credencial')
  const res = await navigator.credentials.get({
    publicKey: {
      challenge: challenge(),
      allowCredentials: [{ type: 'public-key', id: unb64u(id), transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000,
    },
  })
  if (!res) throw new Error('cancelado')
}
