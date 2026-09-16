import { useStore } from '../lib/store.jsx'

// Bolinha de confirmação de presença (do botão no e-mail semanal), usada em
// todas as escalas: culto, louvor, pregação e Escola Bíblica.
//   verde cheio    = confirmou
//   vermelho cheio = avisou que não vai poder (motivo no tooltip)
//   vermelho vazado = ainda não respondeu
// Só aparece na janela em que a pessoa foi convidada (próximo FDS, até 9 dias)
// ou quando já há resposta — e só para os cultos padrão (Sábado Manhã / Domingo
// Noite), que são os que o e-mail semanal cobre.
const CULTOS_PADRAO = { sab: 'Sábado Manhã', dom: 'Domingo Noite' }

export default function ConfDot({ nome, data, tipo, culto }) {
  const { state } = useStore()
  if (!nome || !data) return null

  const cultoNome = culto || CULTOS_PADRAO[tipo]
  if (cultoNome !== 'Sábado Manhã' && cultoNome !== 'Domingo Noite') return null

  const dObj = data instanceof Date ? data : new Date(String(data).slice(0, 10) + 'T00:00:00')
  const dStr = dObj.toISOString().slice(0, 10)

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const fim = new Date(hoje); fim.setDate(hoje.getDate() + 9)

  const c = (state.confirmacoes || []).find(
    x => x.membro_nome === nome && String(x.data).slice(0, 10) === dStr && x.culto === cultoNome
  ) || null

  const naJanela = dObj >= hoje && dObj <= fim
  if (!c && !naJanela) return null

  const est = c?.status === 'confirmado'
    ? { cor: 'var(--grn)', cheio: true, t: 'Confirmou presença' }
    : c?.status === 'nao_pode'
      ? { cor: 'var(--red)', cheio: true, t: 'Avisou que NÃO vai poder' + (c.motivo ? ` — ${c.motivo}` : '') }
      : { cor: 'var(--red)', cheio: false, t: 'Ainda não confirmou' }

  return (
    <span title={est.t} style={{
      display: 'inline-block', width: 9, height: 9, borderRadius: 99, flexShrink: 0, verticalAlign: 'middle',
      background: est.cheio ? est.cor : 'transparent', border: `2px solid ${est.cor}`,
    }} />
  )
}
