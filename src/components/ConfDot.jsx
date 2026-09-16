import { useStore } from '../lib/store.jsx'

// Confirmação de presença (do botão no e-mail semanal), usada em todas as
// escalas: culto, louvor, pregação e Escola Bíblica.
//   verde    = confirmou
//   amarelo  = ainda não respondeu
//   vermelho = avisou que não vai poder (motivo no tooltip)
// Só vale nos cultos padrão (Sábado Manhã / Domingo Noite), que são os que o
// e-mail semanal cobre, e na janela em que a pessoa foi convidada (próximo FDS,
// até 9 dias) ou quando já há resposta.
const CULTOS_PADRAO = { sab: 'Sábado Manhã', dom: 'Domingo Noite' }

// Descobre o status de uma pessoa num culto. Devolve 'confirmado' | 'nao_pode'
// | 'pendente' | null (null = não mostrar nada, fora da janela/culto).
export function statusConf(confirmacoes, nome, data, { tipo, culto } = {}) {
  if (!nome || !data) return null
  const cultoNome = culto || CULTOS_PADRAO[tipo]
  if (cultoNome !== 'Sábado Manhã' && cultoNome !== 'Domingo Noite') return null

  const dObj = data instanceof Date ? data : new Date(String(data).slice(0, 10) + 'T00:00:00')
  const dStr = dObj.toISOString().slice(0, 10)

  const c = (confirmacoes || []).find(
    x => x.membro_nome === nome && String(x.data).slice(0, 10) === dStr && x.culto === cultoNome
  )
  if (c?.status === 'confirmado') return 'confirmado'
  if (c?.status === 'nao_pode') return 'nao_pode'

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const fim = new Date(hoje); fim.setDate(hoje.getDate() + 9)
  return dObj >= hoje && dObj <= fim ? 'pendente' : null
}

// Fundo suave + cor de borda para tingir o bloco da pessoa.
export function corConf(status) {
  if (status === 'confirmado') return { bg: 'rgba(52,179,122,.14)', bd: 'var(--grn)' }
  if (status === 'nao_pode') return { bg: 'rgba(239,91,91,.14)', bd: 'var(--red)' }
  if (status === 'pendente') return { bg: 'rgba(216,162,74,.14)', bd: 'var(--yel)' }
  return null
}

const CORES = { confirmado: 'var(--grn)', nao_pode: 'var(--red)', pendente: 'var(--yel)' }
const TITULOS = { confirmado: 'Confirmou presença', nao_pode: 'Avisou que NÃO vai poder', pendente: 'Ainda não respondeu' }

export default function ConfDot({ nome, data, tipo, culto }) {
  const { state } = useStore()
  const st = statusConf(state.confirmacoes, nome, data, { tipo, culto })
  if (!st) return null

  // busca o motivo (só quando não pode) para o tooltip
  const cultoNome = culto || CULTOS_PADRAO[tipo]
  const dStr = (data instanceof Date ? data : new Date(String(data).slice(0, 10) + 'T00:00:00')).toISOString().slice(0, 10)
  const c = (state.confirmacoes || []).find(x => x.membro_nome === nome && String(x.data).slice(0, 10) === dStr && x.culto === cultoNome)
  const titulo = TITULOS[st] + (st === 'nao_pode' && c?.motivo ? ` — ${c.motivo}` : '')

  return (
    <span title={titulo} style={{
      display: 'inline-block', width: 9, height: 9, borderRadius: 99, flexShrink: 0, verticalAlign: 'middle',
      background: CORES[st], border: `2px solid ${CORES[st]}`,
    }} />
  )
}
