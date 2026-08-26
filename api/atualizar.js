// Link pessoal de atualização de cadastro (/atualizar?c=TOKEN).
// Regra de ouro: nada de dado pessoal sai daqui antes de a pessoa acertar a data de nascimento.
import { banco, temChave, soDigitos, cpfValido } from './_auth.js'

const MAX_TENTATIVAS = 3 // combinado com o Gabriel
const LIMITE_TEXTO = 500

// O que a pessoa pode ver e corrigir. Nada além disto é devolvido nem aceito.
const CAMPOS = ['tel', 'email', 'cpf', 'rg', 'rg_emissor', 'estado_civil', 'profissao', 'escolaridade',
  'naturalidade', 'nome_mae', 'nome_pai', 'cep', 'endereco', 'numero', 'complemento', 'bairro',
  'cidade', 'uf', 'batizado', 'batismo_data', 'batismo_local', 'igreja_anterior']

const recusa = (res, codigo, msg) => res.status(codigo).json({ erro: msg })

// Busca o link e diz por que ele não serve mais, se for o caso.
async function acharLink(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return { erro: 'Link inválido.' }
  const r = await banco(`links_atualizacao?token=eq.${encodeURIComponent(token)}&select=*`)
  const l = r.ok ? (await r.json())[0] : null
  if (!l) return { erro: 'Link inválido. Peça um novo à secretaria da igreja.' }
  if (l.cancelado) return { erro: 'Este link foi cancelado. Peça um novo à secretaria.' }
  if (l.usado_em) return { erro: 'Este link já foi usado. Se precisar corrigir algo, peça um novo à secretaria.' }
  if (l.bloqueado || l.tentativas >= MAX_TENTATIVAS) return { erro: 'Link bloqueado por tentativas erradas. Peça um novo à secretaria.' }
  if (new Date(l.expira_em) < new Date()) return { erro: 'Este link venceu (vale 3 dias). Peça um novo à secretaria.' }
  return { link: l }
}

const soData = (v) => String(v || '').slice(0, 10)

export default async function handler(req, res) {
  if (req.method !== 'POST') return recusa(res, 405, 'method')
  if (!temChave()) return recusa(res, 500, 'servidor sem chave')

  const { acao, token, nascimento, dados } = req.body || {}
  const { link, erro } = await acharLink(token)
  if (erro) return recusa(res, 400, erro)

  const rm = await banco(`membros?id=eq.${link.membro_id}&select=*`)
  const membro = rm.ok ? (await rm.json())[0] : null
  if (!membro) return recusa(res, 400, 'Cadastro não encontrado. Fale com a secretaria.')

  // ── O cadeado: a data de nascimento precisa bater ──
  if (soData(nascimento) !== soData(membro.nascimento)) {
    const n = (link.tentativas || 0) + 1
    await banco(`links_atualizacao?id=eq.${link.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ tentativas: n, bloqueado: n >= MAX_TENTATIVAS }),
    })
    const restam = MAX_TENTATIVAS - n
    return recusa(res, 401, restam > 0
      ? `Data de nascimento não confere. ${restam === 1 ? 'Resta 1 tentativa' : `Restam ${restam} tentativas`}.`
      : 'Link bloqueado por tentativas erradas. Peça um novo à secretaria.')
  }

  // Acertou: zera o contador para não acumular erro antigo
  if (link.tentativas) {
    await banco(`links_atualizacao?id=eq.${link.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ tentativas: 0 }),
    })
  }

  // ── Abrir: devolve só os campos editáveis ──
  if (acao === 'abrir') {
    const atual = {}
    CAMPOS.forEach((c) => {
      const v = membro[c]
      if (v === null || v === undefined) { atual[c] = ''; return }
      if (c === 'batizado') { atual[c] = v === true ? 'sim' : 'nao'; return }
      atual[c] = c === 'batismo_data' ? soData(v) : String(v)
    })
    await banco(`links_atualizacao?id=eq.${link.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ aberto_em: link.aberto_em || new Date().toISOString() }),
    })
    return res.status(200).json({ ok: true, nome: membro.nome, dados: atual })
  }

  // ── Salvar: nada entra no cadastro direto; vira pedido para a secretaria aprovar ──
  if (acao === 'salvar') {
    if (!dados || typeof dados !== 'object') return recusa(res, 400, 'dados inválidos')

    const limpo = {}
    for (const c of CAMPOS) {
      let v = dados[c]
      if (typeof v !== 'string') continue
      v = v.trim().slice(0, LIMITE_TEXTO)
      if (c === 'cpf') {
        const d = soDigitos(v)
        if (!d) continue
        if (!cpfValido(d)) return recusa(res, 400, 'Esse CPF não confere. Confira os números.')
        const rc = await banco(`membros?cpf=eq.${d}&id=neq.${membro.id}&select=id`)
        if (rc.ok && (await rc.json()).length) return recusa(res, 400, 'Esse CPF já está em outro cadastro. Fale com a secretaria.')
        limpo[c] = d
        continue
      }
      limpo[c] = v
    }

    // Só o que realmente mudou vira pedido
    const mudou = {}
    for (const [c, v] of Object.entries(limpo)) {
      const antes = membro[c] === null || membro[c] === undefined ? ''
        : (c === 'batizado' ? (membro[c] === true ? 'sim' : 'nao') : String(membro[c]))
      const depois = c === 'batismo_data' ? soData(v) : v
      if (String(antes) !== String(depois)) mudou[c] = { antes: String(antes), depois: String(depois) }
    }
    if (!Object.keys(mudou).length) {
      await banco(`links_atualizacao?id=eq.${link.id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ usado_em: new Date().toISOString() }),
      })
      return res.status(200).json({ ok: true, semMudanca: true })
    }

    const r = await banco('fichas_membro', {
      method: 'POST',
      body: JSON.stringify({
        tipo: 'atualizacao', membro_id: membro.id, status: 'pendente',
        dados: { nome: membro.nome, mudancas: mudou },
      }),
    })
    if (!r.ok) {
      console.error('atualizar', r.status, (await r.text()).slice(0, 200))
      return recusa(res, 500, 'Não foi possível enviar agora. Tente de novo.')
    }
    // Link morre aqui, como combinado
    await banco(`links_atualizacao?id=eq.${link.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ usado_em: new Date().toISOString() }),
    })
    return res.status(200).json({ ok: true, total: Object.keys(mudou).length })
  }

  return recusa(res, 400, 'ação inválida')
}
