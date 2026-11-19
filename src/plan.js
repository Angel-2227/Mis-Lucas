// Plan de ahorro: todo se calcula aquí; la IA solo lo interpreta.
import { monthKey, shiftMonth, monthLabel, today, round2 } from './lib'
import { monthStats } from './insights'

// Promedio de los últimos 3 meses cerrados que tengan datos.
export function baseline(txs) {
  const cur = monthKey(today())
  const ms = [-3, -2, -1].map((n) => monthStats(txs, shiftMonth(cur, n))).filter((s) => s.income > 0 || s.expense > 0)
  const n = ms.length
  if (!n) return { n: 0, income: 0, expense: 0, margin: 0, byCat: {}, suggested: 0 }
  const avg = (f) => round2(ms.reduce((s, m) => s + f(m), 0) / n)
  const income = avg((m) => m.income)
  const expense = avg((m) => m.expense)
  const cats = [...new Set(ms.flatMap((m) => Object.keys(m.byCat)))]
  const byCat = Object.fromEntries(cats.map((c) => [c, avg((m) => m.byCat[c] || 0)]))
  const margin = round2(income - expense)
  return { n, income, expense, margin, byCat, suggested: Math.max(0, Math.floor(margin / 10000) * 10000) }
}

const target0 = (g, left) => (g.target > 0 ? Math.min(1, Math.max(0, 1 - left / g.target)) : 1)

// Simula mes a mes (máx. 5 años). Primero cubre la cuota que necesitan las metas con fecha límite,
// luego reparte lo que sobra: 'priority' = una por una según el orden; 'split' = en partes iguales.
export function simulate(goals, saved, monthly, mode) {
  const now = monthKey(today())
  const cy = Number(now.slice(0, 4)), cm = Number(now.slice(5, 7))
  const left0 = goals.map((g) => Math.max(0, g.target - (saved[g.id] || 0)))
  const left = [...left0]
  const dIdx = goals.map((g) => (g.deadline ? Number(g.deadline.slice(0, 4)) * 12 + Number(g.deadline.slice(5, 7)) - (cy * 12 + cm) : null))
  const first = goals.map(() => 0)
  const hist = []
  const eta = left.map((l) => (l <= 0.5 ? 0 : null))
  for (let i = 0; i < 60; i++) {
    if (eta.every((e) => e !== null)) break
    let budget = monthly
    const alloc = goals.map(() => 0)
    goals.forEach((g, k) => {
      if (left[k] <= 0.5 || dIdx[k] === null || budget <= 0) return
      const need = Math.ceil(left[k] / Math.max(1, dIdx[k] - i + 1))
      const a = Math.min(need, budget, left[k])
      alloc[k] += a; budget -= a
    })
    if (mode === 'split') {
      let open = goals.map((_, k) => k).filter((k) => left[k] - alloc[k] > 0.5)
      while (budget > 0.5 && open.length) {
        const share = budget / open.length
        let used = 0
        open.forEach((k) => { const a = Math.min(share, left[k] - alloc[k]); alloc[k] += a; used += a })
        budget -= used
        open = open.filter((k) => left[k] - alloc[k] > 0.5)
        if (used < 0.5) break
      }
    } else {
      goals.forEach((g, k) => { const a = Math.min(budget, Math.max(0, left[k] - alloc[k])); if (a > 0) { alloc[k] += a; budget -= a } })
    }
    goals.forEach((g, k) => {
      left[k] = round2(left[k] - alloc[k])
      if (i === 0) first[k] = Math.round(alloc[k])
      if (left[k] <= 0.5 && eta[k] === null) eta[k] = i
    })
    hist.push(left.slice())
  }
  return goals.map((g, k) => ({
    id: g.id, name: g.name, target: g.target, saved: saved[g.id] || 0, left: round2(left0[k]),
    deadline: g.deadline || null,
    thisMonth: first[k],
    eta: eta[k], // meses desde el actual (0 = este mes); null = más de 5 años
    etaLabel: eta[k] === null ? null : monthLabel(shiftMonth(now, eta[k])),
    onTime: g.deadline && eta[k] !== null ? eta[k] <= dIdx[k] : g.deadline ? false : null,
    deadlineIdx: dIdx[k],
    curve: [target0(g, left0[k]), ...hist.map((h) => (g.target > 0 ? Math.min(1, Math.max(0, 1 - h[k] / g.target)) : 1))],
    perMonthForDeadline: g.deadline && left0[k] > 0 ? Math.ceil(left0[k] / Math.max(1, dIdx[k] + 1)) : null,
  }))
}
