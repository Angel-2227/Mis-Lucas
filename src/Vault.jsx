import { useEffect, useState, useSyncExternalStore } from 'react'
import { Eye, EyeOff, Copy, Check } from 'lucide-react'
import { Sheet, Field, SecretInput } from './ui'
import * as V from './vault'

export const useUnlocked = () => useSyncExternalStore(V.subscribe, V.isUnlocked)

function VaultSheet({ d, onClose, onDone }) {
  const vault = d.settings.vault
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!vault) {
      if (pass.length < 6) return setErr('Usa al menos 6 caracteres.')
      if (pass !== pass2) return setErr('Las claves no coinciden.')
    }
    setBusy(true)
    if (vault) {
      const ok = await V.unlock(pass, vault)
      setBusy(false)
      if (!ok) return setErr('Clave incorrecta.')
    } else {
      d.api.saveSettings({ vault: await V.createVault(pass) })
      setBusy(false)
    }
    onDone()
  }

  const forgot = () => {
    if (!confirm('Se borrarán los números de tarjeta guardados (no los saldos ni movimientos). ¿Continuar?')) return
    d.api.saveSettings({ vault: null })
    d.accounts.filter((a) => a.numberEnc).forEach((a) => d.api.update('accounts', a.id, { numberEnc: '', last4: '' }))
    V.lock(); onClose()
  }

  return (
    <Sheet title={vault ? 'Desbloquear números' : 'Crear clave de seguridad'} onClose={onClose}>
      <form onSubmit={submit}>
        {!vault && <p className="hint">Esta clave cifra los números de tus tarjetas. Si la olvidas no se pueden recuperar. Mejor que sea distinta a la de tu banco.</p>}
        <Field label="Clave"><SecretInput autoFocus value={pass} onChange={setPass} /></Field>
        {!vault && <Field label="Repite la clave"><SecretInput value={pass2} onChange={setPass2} /></Field>}
        {err && <p className="err">{err}</p>}
        <button className="btn primary wide" disabled={busy || !pass}>{busy ? 'Verificando...' : vault ? 'Desbloquear' : 'Crear clave'}</button>
        {vault && <button type="button" className="link" style={{ marginTop: 14, marginLeft: 0 }} onClick={forgot}>Olvidé mi clave</button>}
      </form>
    </Sheet>
  )
}

// run(fn): ejecuta fn de inmediato si está desbloqueado; si no, pide la clave primero.
export function useGate(d) {
  const [pending, setPending] = useState(null)
  const run = (fn) => (V.isUnlocked() ? fn() : setPending({ fn }))
  const sheet = pending && (
    <VaultSheet d={d} onClose={() => setPending(null)} onDone={() => { const f = pending.fn; setPending(null); f() }} />
  )
  return [run, sheet]
}

export function CardNumber({ a, run }) {
  const unlocked = useUnlocked()
  const [full, setFull] = useState(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => { if (!unlocked) setFull(null) }, [unlocked])

  const last4 = a.last4 || (a.number ? String(a.number).slice(-4) : '')
  if (!last4) return null

  const get = async () => (a.numberEnc ? V.decryptText(a.numberEnc) : String(a.number))
  const reveal = () => (full ? setFull(null) : run(async () => { try { setFull(await get()) } catch { alert('No se pudo descifrar el número.') } }))
  const copy = () => run(async () => {
    try {
      const text = await get()
      try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { setFull(text) }
    } catch { alert('No se pudo descifrar el número.') }
  })
  const pretty = full ? full.replace(/(.{4})/g, '$1 ').trim() : `•••• ${last4}`

  return (
    <div className="cnum">
      <span>{pretty}</span>
      <button onClick={reveal} aria-label={full ? 'Ocultar número' : 'Ver número'}>{full ? <EyeOff size={15} /> : <Eye size={15} />}</button>
      <button onClick={copy} aria-label="Copiar número">{copied ? <Check size={15} /> : <Copy size={15} />}</button>
    </div>
  )
}
