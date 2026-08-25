// Troca de senha. A pessoa autenticada muda a própria senha;
// pastor e secretário podem redefinir a de outra pessoa.
import { banco, temChave, gerarHash, conferirHash, sessaoDaRequisicao } from './_auth.js'

const MIN = 6

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'method' })
  if (!temChave()) return res.status(500).json({ erro: 'servidor sem chave' })

  const sessao = sessaoDaRequisicao(req)
  if (!sessao) return res.status(401).json({ erro: 'Sessão expirada. Entre de novo.' })

  const { senhaAtual, senhaNova, alvoId, alvoTabela } = req.body || {}
  if (!senhaNova || String(senhaNova).length < MIN) {
    return res.status(400).json({ erro: `A senha precisa ter pelo menos ${MIN} caracteres.` })
  }
  if (['123456', '000000', 'senha1', '111111'].includes(String(senhaNova))) {
    return res.status(400).json({ erro: 'Essa senha é fácil demais. Escolha outra.' })
  }

  const ehAdmin = ['pastor', 'secretario'].includes(sessao.perfil)
  const redefinindoOutro = alvoId && String(alvoId) !== String(sessao.id)
  if (redefinindoOutro && !ehAdmin) {
    return res.status(403).json({ erro: 'Você só pode trocar a sua própria senha.' })
  }

  const tabela = redefinindoOutro ? (alvoTabela === 'usuarios' ? 'usuarios' : 'membros') : sessao.tabela
  const id = redefinindoOutro ? alvoId : sessao.id

  // Trocando a própria: confere a senha atual
  if (!redefinindoOutro) {
    const r0 = await banco(`${tabela}?id=eq.${id}&select=senha,senha_hash`)
    const [pessoa] = r0.ok ? await r0.json() : []
    if (!pessoa) return res.status(404).json({ erro: 'Cadastro não encontrado.' })
    const ok = pessoa.senha_hash
      ? conferirHash(senhaAtual, pessoa.senha_hash)
      : String(senhaAtual) === String(pessoa.senha || '123456')
    if (!ok) return res.status(401).json({ erro: 'Senha atual incorreta.' })
  }

  const r = await banco(`${tabela}?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ senha_hash: gerarHash(senhaNova), trocar_senha: false, senha: null }),
  })
  if (!r.ok) return res.status(500).json({ erro: 'Não foi possível salvar a nova senha.' })
  return res.status(200).json({ ok: true })
}
