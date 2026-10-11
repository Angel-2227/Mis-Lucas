export const cop = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0)

export const today = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
export const monthKey = (date) => date.slice(0, 7)
export const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
}
export const shiftMonth = (key, n) => {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
export const dayLabel = (date) => {
  if (date === today()) return 'Hoy'
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })
}
export const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))

export const DEFAULT_CATEGORIES = [
  { name: 'Comida', color: '#E4572E' },
  { name: 'Transporte', color: '#2F80ED' },
  { name: 'Materiales', color: '#8E44AD' },
  { name: 'Universidad', color: '#16A085' },
  { name: 'Impresiones', color: '#F2A900' },
  { name: 'Ocio', color: '#E84393' },
  { name: 'Salud', color: '#D63031' },
  { name: 'Otros', color: '#7F8C8D' },
]

export const DEFAULT_SETTINGS = {
  categories: DEFAULT_CATEGORIES,
  recurring: [{ id: 'beca', name: 'Beca', amount: 800000, accountId: '', skipMonths: [1, 7] }],
  skipped: [],
  fare: 3550,
  pinned: null,
  vault: null,
}

export const ACCOUNT_TYPES = { cash: 'Efectivo', debit: 'Débito', savings: 'Ahorros', credit: 'Crédito', sitp: 'SITP' }
export const ACCOUNT_COLORS = ['#13241B', '#1F3FBF', '#6A2C91', '#B5381E', '#0F6B5B', '#3A3A3A']

// Saldo de cada cuenta = saldo inicial + movimientos. Borrar un movimiento lo revierte solo.
export function computeBalances(accounts, txs) {
  const b = {}
  accounts.forEach((a) => (b[a.id] = Number(a.initial) || 0))
  txs.forEach((t) => {
    if (t.type === 'income' && t.accountId in b) b[t.accountId] += t.amount
    if (t.type === 'expense' && t.accountId in b) b[t.accountId] -= t.amount
    if (t.type === 'transfer') {
      if (t.accountId in b) b[t.accountId] -= t.amount
      if (t.toAccountId in b) b[t.toAccountId] += t.amount
    }
  })
  return b
}

export const BRANDS = {
  nu: { label: 'Nu', cls: 'b-nu' },
  davivienda: { label: 'Davivienda', cls: 'b-davi' },
  daviplata: { label: 'DaviPlata', cls: 'b-daviplata' },
  nequi: { label: 'Nequi', cls: 'b-nequi' },
  tullave: { label: 'TuLlave', cls: 'b-tullave' },
  cash: { label: 'Plata física', cls: 'b-cash' },
}
export const NETWORKS = { '': 'Ninguna', mastercard: 'Mastercard', visa: 'Visa' }
