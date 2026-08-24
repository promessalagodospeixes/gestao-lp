import { useEffect } from 'react'
import { Mail, MailCheck } from 'lucide-react'
import { dbGet } from '../lib/supabase.js'
import { useStore } from '../lib/store.jsx'

// Mostra "✓ Enviado em 05/08 09:12" ou "Nunca enviado" para uma escala.
// tipo: culto | eb | louvor | pregacao | fds-automatico | lembrete-diario
// ref : '2026-8' (mês) ou '2026-08-15' (dia)
export function ultimoEnvio(envios, tipo, ref) {
  const lista = (envios || []).filter(e => e.tipo === tipo && (!ref || e.ref === ref) && e.enviados > 0)
  if (!lista.length) return null
  return lista.reduce((a, b) => (new Date(a.created_at) > new Date(b.created_at) ? a : b))
}

export const fmtQuando = (iso) => {
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function SeloEnvio({ tipo, periodo, rotulo }) {
  const { state, dispatch } = useStore()

  // Recarrega o histórico assim que um e-mail é disparado em qualquer tela
  useEffect(() => {
    const atualizar = async () => {
      const lista = await dbGet('envios_email')
      dispatch({ type: 'SET', key: 'enviosEmail', value: lista })
    }
    window.addEventListener('email-enviado', atualizar)
    return () => window.removeEventListener('email-enviado', atualizar)
  }, [])
  const env = ultimoEnvio(state.enviosEmail, tipo, periodo)
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700,
    padding: '3px 9px', borderRadius: 99, whiteSpace: 'nowrap',
  }
  if (!env) {
    return (
      <span title="Nenhum e-mail enviado ainda" style={{ ...base, background: 'transparent', border: '1px solid var(--bd)', color: 'var(--g)' }}>
        <Mail size={11} /> {rotulo ? `${rotulo}: ` : ''}não enviado
      </span>
    )
  }
  const quem = env.origem === 'automatico' ? 'automático' : (env.usuario || 'manual')
  return (
    <span
      title={`${env.enviados} e-mail(s) para: ${(env.pessoas || []).join(', ') || '—'}\nEnvio ${quem}${env.sem_email ? ` · ${env.sem_email} sem e-mail` : ''}`}
      style={{ ...base, background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.4)', color: 'var(--grn)' }}
    >
      <MailCheck size={11} /> {rotulo ? `${rotulo}: ` : ''}enviado {fmtQuando(env.created_at)}
      {env.enviados ? ` (${env.enviados})` : ''}
    </span>
  )
}
