import { Trash2, ArrowLeftRight, PiggyBank, ArrowDownLeft } from 'lucide-react'
import { CatDot } from './ui'
import { cop } from './lib'

export default function TxRow({ t, d, onDelete }) {
  const acc = (id) => d.accounts.find((a) => a.id === id)?.name || 'Cuenta eliminada'
  const cat = d.settings.categories.find((c) => c.name === t.category)
  let icon, title, sub, amt, cls
  if (t.type === 'expense') {
    icon = <CatDot name={t.category} color={cat?.color || '#7F8C8D'} />
    title = t.category || 'Gasto'; sub = acc(t.accountId); amt = '-' + cop(t.amount); cls = 'neg'
  } else if (t.type === 'income') {
    icon = <span className="cat-dot" style={{ background: '#2E9E5B22', color: '#2E9E5B' }}><ArrowDownLeft size={20} /></span>
    title = 'Ingreso'; sub = acc(t.accountId); amt = '+' + cop(t.amount); cls = 'pos'
  } else if (t.type === 'transfer') {
    icon = <span className="cat-dot" style={{ background: '#2F80ED22', color: '#2F80ED' }}><ArrowLeftRight size={20} /></span>
    title = 'Transferencia'; sub = `${acc(t.accountId)} a ${acc(t.toAccountId)}`; amt = cop(t.amount); cls = ''
  } else {
    const g = d.goals.find((x) => x.id === t.goalId)
    icon = <span className="cat-dot" style={{ background: '#F2A90022', color: '#C98A00' }}><PiggyBank size={20} /></span>
    title = 'Ahorro'; sub = g?.name || 'Meta eliminada'; amt = cop(t.amount); cls = ''
  }
  return (
    <div className="row">
      {icon}
      <div className="row-main"><strong>{title}</strong><small>{sub}{t.note ? ` - ${t.note}` : ''}</small></div>
      <b className={'amt ' + cls}>{amt}</b>
      {onDelete && <button className="icon-btn ghost" onClick={() => onDelete(t)} aria-label="Eliminar"><Trash2 size={16} /></button>}
    </div>
  )
}
