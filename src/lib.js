export const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100

const fmt0 = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const fmt2 = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 2 })
// Muestra decimales solo cuando el valor los tiene.
export const cop = (n) => {
  const x = round2(n) + 0
  return Number.isInteger(x) ? fmt0.format(x) : fmt2.format(x)
}

// Campo de dinero. Valor interno: texto con punto decimal ("1234.5").
// En pantalla: miles con punto y decimales con coma. La coma siempre es decimal;
// un punto escrito al final también (teclados con punto decimal).
export function parseMoney(raw, { allowDecimal = false, allowNegative = false } = {}) {
  const s = String(raw ?? '')
  const neg = allowNegative && s.trim().startsWith('-')
  let int = s
  let dec = null
  const ci = s.lastIndexOf(',')
  if (allowDecimal && ci >= 0) { int = s.slice(0, ci); dec = s.slice(ci + 1) }
  else if (allowDecimal && s.endsWith('.')) { int = s.slice(0, -1); dec = '' }
  int = int.replace(/\D/g, '')
  if (dec !== null) dec = dec.replace(/\D/g, '').slice(0, 2)
  return (neg ? '-' : '') + int + (dec !== null ? '.' + dec : '')
}
export function formatMoneyInput(value, allowDecimal = false) {
  const str = String(value ?? '')
  const neg = str.startsWith('-')
  const [i = '', dd] = str.replace('-', '').split('.')
  const intShown = i ? Number(i).toLocaleString('es-CO') : dd !== undefined && allowDecimal ? '0' : ''
  return (neg ? '-' : '') + intShown + (allowDecimal && dd !== undefined ? ',' + dd : '')
}

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
// Se calcula en centavos (enteros) para que los decimales no acumulen errores.
export function computeBalances(accounts, txs) {
  const c = (n) => Math.round((Number(n) || 0) * 100)
  const b = {}
  accounts.forEach((a) => (b[a.id] = c(a.initial)))
  txs.forEach((t) => {
    const v = c(t.amount)
    if (t.type === 'income' && t.accountId in b) b[t.accountId] += v
    if (t.type === 'expense' && t.accountId in b) b[t.accountId] -= v
    if (t.type === 'transfer') {
      if (t.accountId in b) b[t.accountId] -= v
      if (t.toAccountId in b) b[t.toAccountId] += v
    }
  })
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v / 100]))
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
