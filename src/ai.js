import { monthKey, shiftMonth, today } from './lib'

// Resumen solo de montos y categorías: sin números de tarjeta ni nombres de cuentas.
export function buildSummary(d) {
  const m = monthKey(today())
  const sum = (key, type) => d.txs.filter((t) => t.type === type && monthKey(t.date) === key).reduce((s, t) => s + t.amount, 0)
  const tx = d.txs.filter((t) => monthKey(t.date) === m)
  const byCat = {}
  tx.filter((t) => t.type === 'expense').forEach((t) => { const k = t.category || 'Otros'; byCat[k] = (byCat[k] || 0) + t.amount })
  const day = new Date().getDate()
  const gastos = sum(m, 'expense')
  return {
    mes: m,
    dia_del_mes: day,
    ingresos_mes: sum(m, 'income'),
    gastos_mes: gastos,
    gastos_mes_anterior: sum(shiftMonth(m, -1), 'expense'),
    ahorrado_en_metas_mes: sum(m, 'saving'),
    gasto_promedio_diario: Math.round(gastos / day),
    gastos_por_categoria: Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([categoria, monto]) => ({ categoria, monto })),
    pasajes_usados_mes: tx.reduce((s, t) => s + (t.qty || 0), 0),
    valor_pasaje: d.settings.fare,
    disponible_ahora: Math.round(d.available),
    dinero_apartado_en_metas: Math.round(d.reserved),
    metas: [...d.goals].filter((g) => !g.done).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((g) => ({ nombre: g.name, precio: g.target, ahorrado: d.savedByGoal[g.id] || 0, fecha_limite: g.deadline || null })),
    ingresos_recurrentes: d.settings.recurring.map((r) => ({ nombre: r.name, monto: r.amount, meses_sin_pago: r.skipMonths })),
  }
}
