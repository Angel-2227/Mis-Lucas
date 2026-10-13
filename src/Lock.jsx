import { useEffect, useRef, useState } from 'react'
import { Fingerprint } from 'lucide-react'
import { reauthenticateWithPopup } from 'firebase/auth'
import { auth, provider } from './firebase'
import * as V from './vault'
import { bioEnabled, bioSupported, bioCheck } from './biometric'

// Pantalla de bloqueo: se muestra al abrir la app mientras exista una clave de seguridad.
export default function LockScreen({ user, vault, accounts, api, onUnlock }) {
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [bio, setBio] = useState(false)
  const tried = useRef(false)

  const tryBio = async () => {
    setErr('')
    try { await bioCheck(user.uid); onUnlock() } catch { setErr('No se pudo verificar con huella. Usa tu clave.') }
  }

  useEffect(() => {
    if (!bioEnabled(user.uid)) return
    bioSupported().then((ok) => {
      setBio(ok)
      if (ok && !tried.current) { tried.current = true; bioCheck(user.uid).then(onUnlock).catch(() => {}) }
    })
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const ok = await V.unlock(pass, vault)
    setBusy(false)
    if (ok) onUnlock(); else setErr('Clave incorrecta.')
  }

  const forgot = async () => {
    if (!confirm('Para restablecer la clave debes volver a verificar tu cuenta de Google, y se borrarán los números de tarjeta guardados (no los saldos ni los movimientos). ¿Continuar?')) return
    try { await reauthenticateWithPopup(auth.currentUser, provider) } catch { return setErr('No se pudo verificar tu cuenta de Google.') }
    api.saveSettings({ vault: null })
    accounts.filter((a) => a.numberEnc).forEach((a) => api.update('accounts', a.id, { numberEnc: '', last4: '' }))
    V.lock()
  }

  return (
    <div className="login lock">
      <div className="login-mark">M</div>
      <h1>Mis Lucas</h1>
      <p>Ingresa tu clave para abrir la app.</p>
      <form className="lock-form" onSubmit={submit}>
        <input className="input" type="password" autoFocus autoComplete="off" placeholder="Clave" value={pass} onChange={(e) => setPass(e.target.value)} />
        {err && <p className="err">{err}</p>}
        <button className="btn primary" disabled={busy || !pass}>{busy ? 'Verificando...' : 'Desbloquear'}</button>
        {bio && <button type="button" className="btn" onClick={tryBio}><Fingerprint size={18} /> Usar huella o rostro</button>}
      </form>
      <button className="link" onClick={forgot}>Olvidé mi clave</button>
    </div>
  )
}
