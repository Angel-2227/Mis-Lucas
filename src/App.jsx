import { useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth'
import { addDoc, collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { Home as HomeIcon, ListOrdered, Plus, Target, PieChart } from 'lucide-react'
import { auth, db, provider } from './firebase'
import { DEFAULT_SETTINGS, clean, computeBalances } from './lib'
import Home from './Home'
import Movements from './Movements'
import Goals from './Goals'
import Analytics from './Analytics'
import Settings from './Settings'
import AddSheet from './AddSheet'

function useCollection(uid, name) {
  const [items, setItems] = useState([])
  useEffect(() => {
    return onSnapshot(collection(db, 'users', uid, name), (s) =>
      setItems(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
  }, [uid, name])
  return items
}

function useSettings(uid) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const seeded = useRef(false)
  useEffect(() => {
    const ref = doc(db, 'users', uid, 'meta', 'settings')
    return onSnapshot(ref, { includeMetadataChanges: true }, (s) => {
      if (s.exists()) setSettings({ ...DEFAULT_SETTINGS, ...s.data() })
      else if (!s.metadata.fromCache && !seeded.current) { seeded.current = true; setDoc(ref, DEFAULT_SETTINGS) }
    })
  }, [uid])
  return settings
}

const ROUTES = { home: '/', moves: '/movimientos', goals: '/metas', stats: '/analisis', settings: '/ajustes' }
const tabFromPath = (p) => {
  const clean = p.replace(/\/+$/, '') || '/'
  return Object.keys(ROUTES).find((k) => ROUTES[k] === clean) || 'home'
}

function NavBtn({ id, label, Icon, on, onClick }) {
  return (
    <a href={ROUTES[id]} className={on ? 'on' : ''} onClick={(e) => { e.preventDefault(); onClick() }}>
      <Icon size={22} /><span>{label}</span>
    </a>
  )
}

async function login() {
  try { await signInWithPopup(auth, provider) } catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) signInWithRedirect(auth, provider)
  }
}

function Login() {
  return (
    <div className="login">
      <div className="login-mark">B</div>
      <h1>Bolsillo</h1>
      <p>Tus ingresos, gastos y metas en un solo lugar.</p>
      <button className="btn primary" onClick={login}>Entrar con Google</button>
    </div>
  )
}

function Main({ user }) {
  const uid = user.uid
  const accounts = useCollection(uid, 'accounts')
  const txs = useCollection(uid, 'transactions')
  const goals = useCollection(uid, 'goals')
  const settings = useSettings(uid)
  const [tab, setTab] = useState(() => tabFromPath(window.location.pathname))
  const go = (t) => {
    if (ROUTES[t] !== window.location.pathname) window.history.pushState({}, '', ROUTES[t])
    setTab(t)
    window.scrollTo(0, 0)
  }
  useEffect(() => {
    const onPop = () => setTab(tabFromPath(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const [sheet, setSheet] = useState(null) // { initial }

  const api = useMemo(() => ({
    add: (name, data) => addDoc(collection(db, 'users', uid, name), clean(data)),
    update: (name, id, data) => updateDoc(doc(db, 'users', uid, name, id), clean(data)),
    remove: (name, id) => deleteDoc(doc(db, 'users', uid, name, id)),
    saveSettings: (patch) => setDoc(doc(db, 'users', uid, 'meta', 'settings'), patch, { merge: true }),
    logout: () => signOut(auth),
  }), [uid])

  const d = useMemo(() => {
    const bal = computeBalances(accounts, txs)
    const savedByGoal = {}
    txs.filter((t) => t.type === 'saving').forEach((t) => (savedByGoal[t.goalId] = (savedByGoal[t.goalId] || 0) + t.amount))
    const reserved = goals.filter((g) => !g.done).reduce((s, g) => s + (savedByGoal[g.id] || 0), 0)
    const money = accounts.filter((a) => a.type !== 'sitp') // el saldo SITP solo sirve para pasajes
    const total = money.reduce((s, a) => s + bal[a.id], 0)
    const physical = money.filter((a) => a.type === 'cash').reduce((s, a) => s + bal[a.id], 0)
    const free = money.filter((a) => !a.locked).reduce((s, a) => s + bal[a.id], 0)
    return { accounts, txs, goals, settings, bal, savedByGoal, reserved, total, physical, virtual: total - physical, available: free - reserved, api, user }
  }, [accounts, txs, goals, settings, api, user])

  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  const openAdd = (initial = {}) => setSheet({ initial })
  const nav = [
    ['home', 'Inicio', HomeIcon], ['moves', 'Movimientos', ListOrdered], null,
    ['goals', 'Metas', Target], ['stats', 'Análisis', PieChart],
  ]

  return (
    <div className="app">
      {!online && <div className="offline">Sin conexión. Tus cambios se guardan y se sincronizan al volver.</div>}
      <main>
        {tab === 'home' && <Home d={d} go={go} openAdd={openAdd} />}
        {tab === 'moves' && <Movements d={d} />}
        {tab === 'goals' && <Goals d={d} openAdd={openAdd} />}
        {tab === 'stats' && <Analytics d={d} />}
        {tab === 'settings' && <Settings d={d} back={() => go('home')} />}
      </main>
      <nav className="bottom-nav">
        <div className="brand"><b>M</b><span>Mis Lucas</span></div>
        {nav.map((n, i) => n ? (
          <NavBtn key={n[0]} id={n[0]} label={n[1]} Icon={n[2]} on={tab === n[0]} onClick={() => go(n[0])} />
        ) : (
          <button key={i} className="fab" onClick={() => openAdd()} aria-label="Agregar movimiento"><Plus size={26} /><span className="fab-label">Nuevo movimiento</span></button>
        ))}
      </nav>
      {sheet && <AddSheet d={d} initial={sheet.initial} onClose={() => setSheet(null)} />}
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(undefined)
  useEffect(() => onAuthStateChanged(auth, setUser), [])
  if (user === undefined) return <div className="login"><p>Cargando...</p></div>
  return user ? <Main user={user} /> : <Login />
}
