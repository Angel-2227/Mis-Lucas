import { useEffect, useRef, useState } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { askAdvice, buildChatContext } from './ai'

const IDEAS = ['¿Cuánto puedo ahorrar este mes?', '¿En qué categoría debería recortar?', '¿Cómo voy con mis metas?', '¿Me alcanza el dinero hasta fin de mes?']

export default function Chat({ d, msgs, setMsgs }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const end = useRef(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [msgs.length, busy])

  const run = async (history) => {
    setBusy(true); setErr('')
    try {
      const reply = await askAdvice(d.user, 'chat', buildChatContext(d), history.slice(-8))
      setMsgs([...history, { role: 'assistant', content: reply }])
    } catch (e) { setErr(e.message || 'No se pudo obtener respuesta.') }
    setBusy(false)
  }
  const send = (q) => {
    const content = (q ?? text).trim()
    if (!content || busy) return
    const next = [...msgs, { role: 'user', content }]
    setMsgs(next); setText('')
    run(next)
  }
  const failed = err && msgs.length > 0 && msgs[msgs.length - 1].role === 'user'

  return (
    <div className="chat">
      {msgs.length === 0 ? (
        <div className="list pad">
          <p className="hint" style={{ marginTop: 0 }}>Pregúntame sobre tus gastos, tus metas o cuánto puedes ahorrar. Respondo con tus movimientos de los últimos meses, categoría por categoría.</p>
          <div className="chips">{IDEAS.map((q) => <button key={q} className="chip" onClick={() => send(q)}>{q}</button>)}</div>
        </div>
      ) : (
        <div className="bubbles">
          {msgs.map((m, i) => <div key={i} className={'bubble ' + m.role}>{m.content.replace(/\*\*/g, '')}</div>)}
          {busy && <div className="bubble assistant typing">Pensando...</div>}
        </div>
      )}
      {err && <p className="err">{err}{failed && <> <button className="link" onClick={() => run(msgs)}>Reintentar</button></>}</p>}
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send() }}>
        <input className="input" value={text} maxLength={500} placeholder="Escribe tu pregunta" onChange={(e) => setText(e.target.value)} />
        <button className="btn primary" disabled={busy || !text.trim()} aria-label="Enviar"><Send size={18} /></button>
      </form>
      <div className="chat-foot">
        <small className="muted">Se envían tus movimientos agrupados por categoría con sus notas, tus metas y quién te debe. Nunca números de tarjeta. Son sugerencias de una IA, no asesoría financiera profesional.</small>
        {msgs.length > 0 && <button className="link" onClick={() => { setMsgs([]); setErr('') }}><Trash2 size={13} /> Nueva conversación</button>}
      </div>
      <div ref={end} />
    </div>
  )
}
