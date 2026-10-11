import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react'

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

export function MoneyInput({ value, onChange, placeholder = '0' }) {
  const shown = value ? Number(value).toLocaleString('es-CO') : ''
  return (
    <input
      className="input"
      inputMode="numeric"
      placeholder={placeholder}
      value={shown}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
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
