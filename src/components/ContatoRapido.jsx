import { MessageCircle, Mail } from 'lucide-react'
import { useStore } from '../lib/store.jsx'
import { waLink } from '../lib/utils.js'

// Ícones de WhatsApp e e-mail ao lado de uma pessoa, em qualquer escala.
// Abre a conversa/compositor já no contato certo — para o líder mandar rápido.
export default function ContatoRapido({ nome, msg, size = 13 }) {
  const { state } = useStore()
  const membros = (state.membros?.length ? state.membros : state.membrosTodos) || []
  if (!nome) return null
  const mb = membros.find(m => m.nome === nome)
  const tel = mb?.tel
  const email = mb?.email
  if (!tel && !email) return null

  const primeiro = String(nome).trim().split(' ')[0]
  const texto = msg || `Paz, ${primeiro}! Passando sobre a escala 🙏`
  const stop = (e) => e.stopPropagation()
  const base = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, textDecoration: 'none', flexShrink: 0 }

  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {tel && (
        <a href={waLink(tel, texto)} target="_blank" rel="noopener" title={`WhatsApp de ${primeiro}`} onClick={stop}
          style={{ ...base, background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.3)', color: 'var(--grn)' }}>
          <MessageCircle size={size} />
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} title={`E-mail de ${primeiro}`} onClick={stop}
          style={{ ...base, background: 'var(--cdim)', border: '1px solid var(--cgl)', color: 'var(--cy)' }}>
          <Mail size={size} />
        </a>
      )}
    </span>
  )
}
