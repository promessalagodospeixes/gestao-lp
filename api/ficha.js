// Recebe a ficha preenchida no link público. Só grava — nunca devolve dados.
import { banco, temChave, cpfValido, soDigitos } from './_auth.js'

const LIMITE_TEXTO = 500

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'method' })
  if (!temChave()) return res.status(500).json({ erro: 'servidor sem chave' })

  const { dados } = req.body || {}
  if (!dados || typeof dados !== 'object') return res.status(400).json({ erro: 'dados inválidos' })
  if (!String(dados.nome || '').trim() || !String(dados.tel || '').trim()) {
    return res.status(400).json({ erro: 'Nome e telefone são obrigatórios.' })
  }

  // CPF é obrigatório: sem ele a igreja não consegue registrar a pessoa no sistema nacional.
  const cpf = soDigitos(dados.cpf)
  if (!cpf) return res.status(400).json({ erro: 'O CPF é obrigatório.' })
  if (!cpfValido(cpf)) return res.status(400).json({ erro: 'Esse CPF não confere. Confira os números.' })

  // Já é membro? Então não precisa mandar ficha de novo.
  const rm = await banco(`membros?cpf=eq.${cpf}&select=id`)
  if (rm.ok && (await rm.json()).length) {
    return res.status(400).json({ erro: 'Esse CPF já está cadastrado na igreja. Fale com a secretaria.' })
  }

  // Só aceita os campos previstos, com tamanho limitado (evita abuso)
  const permitidos = ['nome', 'cpf', 'nascimento', 'estado_civil', 'tel', 'email', 'profissao', 'cep',
    'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'batizado', 'batismo_data',
    'batismo_local', 'igreja_anterior', 'como_conheceu', 'obs']
  const limpo = {}
  for (const c of permitidos) {
    const v = dados[c]
    if (typeof v === 'string' && v.trim()) limpo[c] = v.trim().slice(0, LIMITE_TEXTO)
  }
  limpo.cpf = cpf // sempre só dígitos, para bater com o cadastro

  // Trava simples contra envio repetido: mesmo telefone nos últimos 5 minutos
  const desde = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const r0 = await banco(`fichas_membro?created_at=gte.${desde}&select=id,dados`)
  const recentes = r0.ok ? await r0.json() : []
  if (recentes.some((f) => (f.dados?.tel || '') === limpo.tel || soDigitos(f.dados?.cpf) === cpf)) {
    return res.status(200).json({ ok: true, repetida: true })
  }

  const rp = await banco(`fichas_membro?status=eq.pendente&select=id,dados`)
  if (rp.ok && (await rp.json()).some((f) => soDigitos(f.dados?.cpf) === cpf)) {
    return res.status(400).json({ erro: 'Já recebemos uma ficha com esse CPF. Ela está sendo conferida.' })
  }

  const r = await banco('fichas_membro', {
    method: 'POST',
    body: JSON.stringify({ dados: limpo, status: 'pendente' }),
  })
  if (!r.ok) {
    console.error('ficha', r.status, (await r.text()).slice(0, 200))
    return res.status(500).json({ erro: 'Não foi possível enviar agora.' })
  }
  return res.status(200).json({ ok: true })
}
