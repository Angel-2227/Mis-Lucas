// Cálculos del Asistente. Todo se calcula aquí, en el código; la IA (más adelante) solo interpreta estos números.
import { monthKey, monthLabel, round2, cop } from './lib'

// Totales de un mes. Las transferencias, ajustes de saldo y pagos de deuda no cuentan.
export function monthStats(txs, key) {
  let income = 0, expense = 0, saved = 0, count = 0
  const byCat = {}
  const days = new Set()
  for (const t of txs) {
    if (!t.date || monthKey(t.date) !== key) continue
    if (t.type === 'income') { income += t.amount; count++ }
    else if (t.type === 'expense') {
      expense += t.amount; count++
      const c = t.category || 'Otros'
      byCat[c] = (byCat[c] || 0) + t.amount
      days.add(t.date)
    } else if (t.type === 'saving') { saved += t.amount; count++ }
    else if (t.type === 'withdraw') { saved -= t.amount; count++ }
  }
  income = round2(income); expense = round2(expense); saved = round2(saved)
  Object.keys(byCat).forEach((k) => (byCat[k] = round2(byCat[k])))
  const balance = round2(income - expense)
  return {
    key, income, expense, saved, balance, byCat, count,
    expenseDays: days.size,
    rate: income > 0 ? balance / income : null, // qué parte del ingreso sobró
  }
}

const pct = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : null)

// Fila de comparación entre dos meses.
export const row = (name, cur, prev) => ({ name, cur, prev, diff: round2(cur - prev), pct: pct(cur, prev) })

export function compareMonths(cur, prev) {
  const names = [...new Set([...Object.keys(cur.byCat), ...Object.keys(prev.byCat)])]
  const cats = names.map((n) => row(n, cur.byCat[n] || 0, prev.byCat[n] || 0)).sort((a, b) => b.cur - a.cur || b.prev - a.prev)
  return {
    totals: [
      { ...row('Ingresos', cur.income, prev.income), good: 'up' },
      { ...row('Gastos', cur.expense, prev.expense), good: 'down' },
      { ...row('Apartado para metas', cur.saved, prev.saved), good: 'up' },
      { ...row('Balance', cur.balance, prev.balance), good: 'up' },
    ],
    cats,
  }
}

// Observaciones calculadas con reglas simples (no usan IA).
export function notes(cur, prev) {
  const out = []
  const pl = monthLabel(prev.key).split(' ')[0]
  if (prev.expense > 0 && cur.expense > 0) {
    const p = pct(cur.expense, prev.expense)
    if (Math.abs(p) >= 1) out.push(`Gastaste ${Math.abs(Math.round(p))}% ${p > 0 ? 'más' : 'menos'} que en ${pl} (${cop(Math.abs(cur.expense - prev.expense))}).`)
    else out.push(`Tus gastos fueron casi iguales a los de ${pl}.`)
  }
  const { cats } = compareMonths(cur, prev)
  const up = [...cats].filter((c) => c.diff > 0).sort((a, b) => b.diff - a.diff)[0]
  const down = [...cats].filter((c) => c.diff < 0).sort((a, b) => a.diff - b.diff)[0]
  if (up && prev.expense > 0) out.push(`${up.name} fue lo que más subió: ${cop(up.diff)} más que en ${pl}.`)
  if (down) out.push(`${down.name} fue lo que más bajó: ${cop(Math.abs(down.diff))} menos que en ${pl}.`)
  const top = Object.entries(cur.byCat).sort((a, b) => b[1] - a[1])[0]
  if (top && cur.expense > 0) out.push(`${top[0]} concentró el ${Math.round((top[1] / cur.expense) * 100)}% de tus gastos.`)
  if (cur.income > 0) {
    out.push(cur.balance >= 0
      ? `Te sobró el ${Math.round(cur.rate * 100)}% de lo que ingresó (${cop(cur.balance)}).`
      : `Gastaste ${cop(Math.abs(cur.balance))} más de lo que ingresó este mes.`)
  }
  if (cur.saved > 0) out.push(`Apartaste ${cop(cur.saved)} para tus metas.`)
  return out.slice(0, 6)
}
