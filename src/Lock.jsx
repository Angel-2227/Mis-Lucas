import { useEffect, useRef, useState } from 'react'
import { Fingerprint } from 'lucide-react'
import { reauthenticateWithPopup } from 'firebase/auth'
import { auth, provider } from './firebase'
import * as V from './vault'
import { SecretInput } from './ui'
import { bioEnabled, bioSupported, bioCheck, bioEnable } from './biometric'

// Pantalla de bloqueo: se muestra al abrir la app mientras exista una clave de seguridad.
export default function LockScreen({ user, vault, accounts, api, onUnlock }) {
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [bio, setBio] = useState(false)
  const tried = useRef(false)

  const tryBio = async () => {
    setErr('')
    try { await bioCheck(user.uid); onUnlock() } catch (e) { setErr(`No se pudo verificar con huella (${e.name || 'error'}). Usa tu clave.`) }
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
        <SecretInput autoFocus placeholder="Clave" value={pass} onChange={setPass} />
        {err && <p className="err">{err}</p>}
        <button className="btn primary" disabled={busy || !pass}>{busy ? 'Verificando...' : 'Desbloquear'}</button>
        {bio && <button type="button" className="btn" onClick={tryBio}><Fingerprint size={18} /> Usar huella o rostro</button>}
      </form>
      <button className="link" onClick={forgot}>Olvidé mi clave</button>
    </div>
  )
}

// Ofrece activar la huella justo después de abrir la app con la clave.
export function BioOffer({ user, hasVault }) {
  const [show, setShow] = useState(false)
  const [msg, setMsg] = useState('')
  const flag = 'mislucas:bio-declined:' + user.uid
  useEffect(() => {
    let declined = false
    try { declined = !!localStorage.getItem(flag) } catch { /* sin acceso */ }
    if (!hasVault || declined || bioEnabled(user.uid)) return
    bioSupported().then(setShow)
  }, [hasVault])
  if (!show) return null
  const enable = async () => {
    try { await bioEnable(user); setShow(false) } catch (e) { setMsg(`No se pudo activar (${e.name || 'error'}).`) }
  }
  const decline = () => { try { localStorage.setItem(flag, '1') } catch { /* sin acceso */ } setShow(false) }
  return (
    <div className="bio-offer">
      <div><strong>Abrir con huella o rostro</strong><small>{msg || 'Actívalo en este dispositivo para no escribir la clave.'}</small></div>
      <button className="btn small" onClick={decline}>Ahora no</button>
      <button className="btn small primary" onClick={enable}>Activar</button>
    </div>
  )
}
