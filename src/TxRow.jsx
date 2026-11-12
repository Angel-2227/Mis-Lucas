import { Trash2, ArrowLeftRight, PiggyBank, ArrowDownLeft, Handshake, Eye } from 'lucide-react'
import { CatDot } from './ui'
import { cop } from './lib'

export default function TxRow({ t, d, onDelete, onOpen }) {
  const acc = (id) => (id ? d.accounts.find((a) => a.id === id)?.name || 'Cuenta eliminada' : 'Plata prestada')
  const cat = d.settings.categories.find((c) => c.name === t.category)
  const debt = d.debtMap?.[t.id]
  let icon, title, sub, amt, cls
  if (t.type === 'expense') {
    icon = <CatDot name={t.category} color={cat?.color || '#7F8C8D'} />
    title = t.category || 'Gasto'; sub = acc(t.accountId) + (t.qty ? ` - ${t.qty} pasaje${t.qty > 1 ? 's' : ''}` : ''); amt = '-' + cop(t.amount); cls = 'neg'
  } else if (t.type === 'income') {
    icon = <span className="cat-dot" style={{ background: '#2E9E5B22', color: '#2E9E5B' }}><ArrowDownLeft size={20} /></span>
    title = 'Ingreso'; sub = acc(t.accountId); amt = '+' + cop(t.amount); cls = 'pos'
  } else if (t.type === 'transfer') {
    icon = <span className="cat-dot" style={{ background: '#2F80ED22', color: '#2F80ED' }}><ArrowLeftRight size={20} /></span>
    title = 'Transferencia'; sub = `${acc(t.accountId)} a ${acc(t.toAccountId)}`; amt = cop(t.amount); cls = ''
  } else if (t.type === 'settle') {
    icon = <span className="cat-dot" style={{ background: '#8E44AD22', color: '#8E44AD' }}><Handshake size={20} /></span>
    title = 'Pago de deuda'; sub = `${t.person || ''} - ${acc(t.accountId)}`; amt = (t.dir === 'in' ? '+' : '-') + cop(t.amount); cls = t.dir === 'in' ? 'pos' : 'neg'
  } else {
    const g = d.goals.find((x) => x.id === t.goalId)
    icon = <span className="cat-dot" style={{ background: '#F2A90022', color: '#C98A00' }}><PiggyBank size={20} /></span>
    title = 'Ahorro'; sub = (g?.name || 'Meta eliminada') + (t.accountId ? ` - en ${acc(t.accountId)}` : ''); amt = cop(t.amount); cls = ''
  }
  const stop = (fn) => (e) => { e.stopPropagation(); fn() }
  return (
    <div className={'row' + (onOpen ? ' clickable' : '')} onClick={onOpen ? () => onOpen(t.id) : undefined}>
      {icon}
      <div className="row-main">
        <strong>{title}{debt && <span className={'debt-pill ' + (debt.left <= 0 ? 'done' : debt.kind)}>{debt.left <= 0 ? 'Saldada' : debt.kind === 'owed' ? `Te debe ${debt.person}` : `Debes a ${debt.person}`}</span>}</strong>
        <small>{sub}{t.note ? ` - ${t.note}` : ''}</small>
      </div>
      <b className={'amt ' + cls}>{amt}</b>
      {onOpen && <button className="icon-btn ghost" onClick={stop(() => onOpen(t.id))} aria-label="Ver detalle"><Eye size={16} /></button>}
      {onDelete && <button className="icon-btn ghost" onClick={stop(() => onDelete(t))} aria-label="Eliminar"><Trash2 size={16} /></button>}
    </div>
  )
}
