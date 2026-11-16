import { useState } from 'react'
import { Modal, Btn } from './UI.jsx'
import { Mail } from 'lucide-react'
import { getToken } from '../lib/supabase.js'
import { fmtBR, nomeDisp } from '../lib/utils.js'

// Modal que aparece quando se troca/remove alguém de uma escala: oferece avisar
// a pessoa por e-mail que ela NÃO está mais escalada (evita o conflito de duas
// pessoas aparecerem no mesmo dia — caso Pâmela × Quézia). Usado em Culto, EB e Louvor.
//   aviso = { nome, email, funcao, data (Date), rotuloDia ('Sáb'|'Dom') }
export default function AvisoSaida({ aviso, membros, mes, ano, usuario, dispatch, onClose }) {
  const [saving, setSaving] = useState(false)
  if (!aviso) return null
  const primeiro = String(aviso.nome).split(' ')[0]
  const enviar = async () => {
    if (!aviso.email) { dispatch({ type: 'TOAST', value: '⚠ Sem e-mail cadastrado — avise por outro meio.' }); return }
    setSaving(true)
    const linha = `${fmtBR(aviso.data)} ${aviso.rotuloDia} — ${aviso.funcao}`
    try {
      const r = await fetch('/api/send-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ pessoas: [{ nome: aviso.nome, email: aviso.email, linhas: [linha] }], tipo: 'saiu', mes, ano, escopo: 'saiu', usuario }),
      })
      const d = await r.json(); window.dispatchEvent(new Event('email-enviado'))
      dispatch({ type: 'TOAST', value: d.enviados ? '✅ Avisado que saiu da escala!' : '⚠ Falha ao enviar.' })
    } catch { dispatch({ type: 'TOAST', value: '⚠ Erro ao enviar.' }) }
    setSaving(false); onClose()
  }
  return (
    <Modal title="Mudança na escala" onClose={onClose}
      footer={<>
        <Btn variant="outline" onClick={onClose}>Só fechar</Btn>
        {aviso.email && <Btn onClick={enviar} disabled={saving}>{saving ? 'Enviando...' : <><Mail size={15} /> Avisar {primeiro} por e-mail</>}</Btn>}
      </>}>
      <p style={{ fontSize: 13, color: 'var(--tx)', lineHeight: 1.6, margin: '0 0 10px' }}>
        Você tirou <b style={{ color: 'var(--w)' }}>{nomeDisp(aviso.nome, membros)}</b> da função <b style={{ color: 'var(--w)' }}>{aviso.funcao}</b> do dia <b style={{ color: 'var(--w)' }}>{fmtBR(aviso.data)}</b>.
      </p>
      {aviso.email
        ? <p style={{ fontSize: 12.5, color: 'var(--gl)', lineHeight: 1.6, margin: 0 }}>Se essa pessoa <b>já recebeu e-mail</b> desse dia, é bom avisar que mudou — senão ela pode aparecer achando que ainda é dela. Mandar o aviso de "você saiu da escala"?</p>
        : <p style={{ fontSize: 12.5, color: 'var(--yel)', lineHeight: 1.6, margin: 0 }}>⚠ Essa pessoa não tem e-mail cadastrado. Avise por WhatsApp ou pessoalmente que a escala mudou.</p>}
    </Modal>
  )
}
