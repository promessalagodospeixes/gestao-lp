// Gera (ou cancela) o link pessoal de atualização de cadastro.
// Só quem está logado como pastor ou secretário consegue chamar.
import crypto from 'crypto'
import { banco, temChave, sessaoDaRequisicao } from './_auth.js'

const DIAS = 3 // validade combinada com o Gabriel

const ehAdmin = (s) => ['pastor', 'secretario'].includes(s?.perfil)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'method' })
  if (!temChave()) return res.status(500).json({ erro: 'servidor sem chave' })

  const sessao = sessaoDaRequisicao(req)
  if (!sessao) return res.status(401).json({ erro: 'Sessão expirada. Entre de novo.' })
  if (!ehAdmin(sessao)) return res.status(403).json({ erro: 'Sem permissão.' })

  const { acao, membro_id } = req.body || {}
  const id = Number(membro_id)
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ erro: 'membro inválido' })

  // Mata qualquer link anterior da pessoa: só um vale por vez.
  const matar = () => banco(`links_atualizacao?membro_id=eq.${id}&cancelado=is.false&usado_em=is.null`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ cancelado: true }),
  })

  if (acao === 'cancelar') {
    const r = await matar()
    if (!r.ok) return res.status(500).json({ erro: 'Não foi possível cancelar.' })
    return res.status(200).json({ ok: true })
  }

  // Sem data de nascimento não há como a pessoa provar que é ela.
  const rm = await banco(`membros?id=eq.${id}&select=id,nome,nascimento`)
  const membro = rm.ok ? (await rm.json())[0] : null
  if (!membro) return res.status(404).json({ erro: 'Membro não encontrado.' })
  if (!membro.nascimento) {
    return res.status(400).json({ erro: 'Preencha a data de nascimento antes — é ela que a pessoa digita para abrir o link.' })
  }

  await matar()

  const token = crypto.randomBytes(24).toString('base64url') // ~192 bits: impossível de adivinhar
  const expira = new Date(Date.now() + DIAS * 24 * 60 * 60 * 1000).toISOString()
  const r = await banco('links_atualizacao', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ membro_id: id, token, expira_em: expira, criado_por: sessao.nome || '' }),
  })
  if (!r.ok) {
    console.error('link', r.status, (await r.text()).slice(0, 200))
    return res.status(500).json({ erro: 'Não foi possível gerar o link.' })
  }
  return res.status(200).json({ ok: true, token, expira_em: expira, nome: membro.nome })
}
