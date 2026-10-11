import { useState } from 'react'

// Usa /public/mascot/<pose>.png si existe; si no, muestra un marcador simple.
const MOUTH = { hola: 'M38 62 Q50 72 62 62', feliz: 'M36 60 Q50 78 64 60', pensando: 'M42 66 H58', alerta: 'M45 66 Q50 58 55 66' }

export default function Mascot({ pose = 'hola', size = 96 }) {
  const [failed, setFailed] = useState('')
  if (failed !== pose) {
    return <img className="mascot" src={`/mascot/${pose}.png`} width={size} height={size} alt="" onError={() => setFailed(pose)} />
  }
  return (
    <svg className="mascot" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect x="12" y="14" width="76" height="72" rx="30" fill="#C9F24A" />
      <circle cx="38" cy="46" r="6" fill="#13241B" />
      <circle cx="62" cy="46" r="6" fill="#13241B" />
      <path d={MOUTH[pose] || MOUTH.hola} stroke="#13241B" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  )
}
