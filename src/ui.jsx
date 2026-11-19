import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { parseMoney, formatMoneyInput } from './lib'

export function Sheet({ title, onClose, children }) {
  return createPortal(
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}

export function Field({ label, children }) {
  return <div className="field"><span>{label}</span>{children}</div>
}

export function MoneyInput({ value, onChange, placeholder = '0', allowNegative = false, allowDecimal = false }) {
  return (
    <input
      className="input"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      placeholder={placeholder}
      value={formatMoneyInput(value, allowDecimal)}
      onChange={(e) => onChange(parseMoney(e.target.value, { allowDecimal, allowNegative }))}
    />
  )
}

export function Progress({ value, max }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return <div className="progress"><i style={{ width: pct + '%' }} /></div>
}

export function CopyId({ text }) {
  const [ok, setOk] = useState(false)
  const copy = async (e) => {
    e.stopPropagation()
    try { await navigator.clipboard.writeText(text) } catch {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove()
    }
    setOk(true); setTimeout(() => setOk(false), 1500)
  }
  return (
    <button className="copy-id" onClick={copy} title="Copiar número">
      <span>{text}</span>{ok ? <Check size={14} /> : <Copy size={14} />}
      {ok && <em>Copiado</em>}
    </button>
  )
}

export function MonthNav({ month, onChange, label, shift }) {
  return (
    <div className="month-nav">
      <button className="icon-btn" onClick={() => onChange(shift(month, -1))}><ChevronLeft size={20} /></button>
      <strong>{label(month)}</strong>
      <button className="icon-btn" onClick={() => onChange(shift(month, 1))}><ChevronRight size={20} /></button>
    </div>
  )
}

export const Empty = ({ title, text, action }) => (
  <div className="empty"><strong>{title}</strong><p>{text}</p>{action}</div>
)

export const CatDot = ({ name, color, size = 40 }) => (
  <span className="cat-dot" style={{ background: color + '22', color, width: size, height: size }}>
    {(name || '?')[0].toUpperCase()}
  </span>
)

// Campo de clave: muestra el último carácter escrito por un instante y luego lo cambia por un punto.
// Calcula qué cambió usando la posición del cursor, así funciona al escribir, borrar o pegar en cualquier parte.
export function SecretInput({ value, onChange, placeholder, autoFocus }) {
  const [shown, setShown] = useState(-1)
  const ref = useRef(null)
  const caret = useRef(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const display = value.split('').map((c, i) => (i === shown ? c : '\u2022')).join('')

  const handle = (e) => {
    const next = e.target.value
    const c = e.target.selectionStart ?? next.length
    const tail = next.length - c
    const lp = display.length - tail
    let p = 0
    const max = Math.min(display.length, next.length)
    while (p < max && display[p] === next[p]) p++
    const h = Math.max(0, Math.min(p, c, lp))
    const inserted = next.slice(h, c)
    caret.current = c
    clearTimeout(timer.current)
    if (inserted.length === 1) {
      setShown(h)
      timer.current = setTimeout(() => setShown(-1), 900)
    } else setShown(-1)
    onChange(value.slice(0, h) + inserted + value.slice(Math.max(h, lp)))
  }

  useLayoutEffect(() => {
    if (caret.current !== null && ref.current && document.activeElement === ref.current) {
      ref.current.setSelectionRange(caret.current, caret.current)
    }
    caret.current = null
  })

  return (
    <input
      ref={ref} className="input" type="text" value={display} onChange={handle}
      placeholder={placeholder} autoFocus={autoFocus}
      autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
    />
  )
}
