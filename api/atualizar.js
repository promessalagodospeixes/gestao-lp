// Link pessoal de atualização de cadastro.
//
// Duas metades bem separadas neste mesmo arquivo (o plano da Vercel limita o
// número de funções, por isso não são dois endereços):
//   • 'gerar' e 'cancelar' — só para pastor/secretário logado
//   • 'abrir' e 'salvar'   — público, mas exige o token E a data de nascimento
//
// Regra de ouro: nada de dado pessoal sai daqui antes de a pessoa acertar a data.
import crypto from 'crypto'
import { banco, temChave, soDigitos, cpfValido, sessaoDaRequisicao, criarToken, lerToken } from './_auth.js'

const MAX_TENTATIVAS = 3 // combinado com o Gabriel
const DIAS = 3           // validade do link
const LIMITE_TEXTO = 500

// O que a pessoa pode ver e corrigir. Nada além disto é devolvido nem aceito.
const CAMPOS = ['nascimento', 'tel', 'email', 'cpf', 'rg', 'rg_emissor', 'estado_civil', 'profissao', 'escolaridade',
  'naturalidade', 'nome_mae', 'nome_pai', 'cep', 'endereco', 'numero', 'complemento', 'bairro',
  'cidade', 'uf', 'batizado', 'batismo_data', 'batismo_local', 'igreja_anterior']

const DATAS = new Set(['nascimento', 'batismo_data'])

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

// ── Confirmar presença (botão do e-mail semanal) ──
// Página HTML simples, para abrir bonita no celular ao clicar no e-mail.
function pagina(res, status, { titulo, msg, cor = '#2bb8b0', form = '' }) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return res.status(status).send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title></head>
<body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0f1216;color:#eef2f5;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px">
<div style="background:#171b21;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:28px 24px;max-width:380px;width:100%;text-align:center">
  <div style="font-size:44px;line-height:1;margin-bottom:10px">${cor === '#ef5b5b' ? '📩' : '✅'}</div>
  <div style="font-size:19px;font-weight:700;color:#fff;margin-bottom:8px">${titulo}</div>
  <div style="font-size:14px;color:#aab3bd;line-height:1.5">${msg}</div>
  ${form}
  <div style="font-size:12px;color:#7d8791;margin-top:20px">Igreja Promessa — Lago dos Peixes</div>
</div></body></html>`)
}

const CULTO_TOKEN = (dados, horas = 24 * 8) => criarToken({ k: 'conf', ...dados }, horas)

async function confirmarPresenca(req, res) {
  const dados = lerToken(String(req.query.conf || ''))
  if (!dados || dados.k !== 'conf') {
    return pagina(res, 400, { titulo: 'Link inválido ou vencido', cor: '#ef5b5b',
      msg: 'Este link de confirmação não vale mais. Peça à secretaria para reenviar a escala.' })
  }
  const { nome, data, culto } = dados
  const vai = String(req.query.r || 'sim') !== 'nao'
  const status = vai ? 'confirmado' : 'nao_pode'

  await banco('confirmacoes?on_conflict=data,culto,membro_nome', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ data, culto, membro_nome: nome, status, via: 'email', updated_at: new Date().toISOString() }),
  }).catch(() => {})

  const quando = `${culto} · ${String(data).split('-').reverse().join('/')}`
  if (vai) {
    return pagina(res, 200, {
      titulo: 'Presença confirmada! 🙌',
      msg: `Obrigado, ${String(nome).split(' ')[0]}! Sua presença no <b>${quando}</b> está confirmada. Já aparece para a liderança.`,
    })
  }
  // "não vou poder": registra e oferece deixar o motivo (opcional)
  const form = `
  <form method="POST" action="/api/atualizar" style="margin-top:16px;text-align:left">
    <input type="hidden" name="acao" value="conf_motivo">
    <input type="hidden" name="conf" value="${String(req.query.conf)}">
    <label style="font-size:12px;color:#7d8791">Se quiser, conte o motivo (ajuda a liderança):</label>
    <textarea name="motivo" rows="3" maxlength="300" style="width:100%;margin-top:6px;background:#10141a;border:1px solid rgba(255,255,255,.1);border-radius:9px;color:#eef2f5;padding:9px;font-size:14px;box-sizing:border-box"></textarea>
    <button type="submit" style="margin-top:8px;width:100%;background:#2bb8b0;color:#00201e;border:none;border-radius:9px;padding:11px;font-size:14px;font-weight:700;cursor:pointer">Enviar</button>
  </form>`
  return pagina(res, 200, {
    titulo: 'Obrigado por avisar', cor: '#ef5b5b',
    msg: `Anotamos que você <b>não poderá</b> no ${quando}. A liderança já foi avisada e vai buscar quem cubra.`,
    form,
  })
}

async function salvarMotivo(req, res) {
  const dados = lerToken(String(req.body?.conf || ''))
  if (!dados || dados.k !== 'conf') return pagina(res, 400, { titulo: 'Link inválido', cor: '#ef5b5b', msg: 'Não foi possível registrar o motivo.' })
  const motivo = String(req.body?.motivo || '').slice(0, 300).trim()
  await banco(`confirmacoes?data=eq.${dados.data}&culto=eq.${encodeURIComponent(dados.culto)}&membro_nome=eq.${encodeURIComponent(dados.nome)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ motivo, updated_at: new Date().toISOString() }),
  }).catch(() => {})
  return pagina(res, 200, { titulo: 'Recebido, obrigado!', cor: '#ef5b5b', msg: 'Seu recado chegou à liderança.' })
}

export default async function handler(req, res) {
  // Clique no botão de confirmar presença (link do e-mail) — público, GET.
  if (req.method === 'GET' && req.query?.conf) return confirmarPresenca(req, res)
  if (req.method === 'POST' && (req.body?.acao === 'conf_motivo')) return salvarMotivo(req, res)

  if (req.method !== 'POST') return recusa(res, 405, 'method')
  if (!temChave()) return recusa(res, 500, 'servidor sem chave')

  const { acao, token, nascimento, dados, membro_id } = req.body || {}

  // ── Metade da secretaria: gerar, cancelar ou ver quem já respondeu ──
  if (acao === 'gerar' || acao === 'cancelar' || acao === 'situacao') {
    const sessao = sessaoDaRequisicao(req)
    if (!sessao) return recusa(res, 401, 'Sessão expirada. Entre de novo.')
    if (!['pastor', 'secretario'].includes(sessao.perfil)) return recusa(res, 403, 'Sem permissão.')

    // Painel: em que pé está o link de cada pessoa (sem devolver o token)
    if (acao === 'situacao') {
      const r = await banco('links_atualizacao?select=membro_id,created_at,aberto_em,usado_em,tentativas,bloqueado,cancelado,expira_em&order=created_at.asc&limit=2000')
      if (!r.ok) return recusa(res, 500, 'Não foi possível carregar.')
      const agora = Date.now()
      const porMembro = {}
      for (const l of await r.json()) {
        // o mais recente de cada pessoa manda (os anteriores já foram cancelados)
        porMembro[l.membro_id] = {
          enviado_em: l.created_at,
          abriu: !!l.aberto_em,
          respondeu_em: l.usado_em,
          bloqueado: !!l.bloqueado,
          cancelado: !!l.cancelado,
          vencido: !l.usado_em && new Date(l.expira_em).getTime() < agora,
        }
      }
      return res.status(200).json({ ok: true, situacao: porMembro })
    }

    const id = Number(membro_id)
    if (!Number.isInteger(id) || id <= 0) return recusa(res, 400, 'membro inválido')

    // Só um link vale por pessoa: gerar um novo mata o anterior.
    const matar = () => banco(`links_atualizacao?membro_id=eq.${id}&cancelado=is.false&usado_em=is.null`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ cancelado: true }),
    })

    if (acao === 'cancelar') {
      const r = await matar()
      return r.ok ? res.status(200).json({ ok: true }) : recusa(res, 500, 'Não foi possível cancelar.')
    }

    const rm = await banco(`membros?id=eq.${id}&select=id,nome,nascimento`)
    const alvo = rm.ok ? (await rm.json())[0] : null
    if (!alvo) return recusa(res, 404, 'Membro não encontrado.')
    if (!alvo.nascimento) {
      return recusa(res, 400, 'Preencha a data de nascimento antes — é ela que a pessoa digita para abrir o link.')
    }

    // Se a pessoa já tem um link vivo, devolve o MESMO — assim copiar ou reenviar
    // nunca derruba um link que já está com ela.
    const rv = await banco(`links_atualizacao?membro_id=eq.${id}&cancelado=is.false&usado_em=is.null&bloqueado=is.false&expira_em=gt.${new Date().toISOString()}&select=token,expira_em&order=created_at.desc&limit=1`)
    const vivo = rv.ok ? (await rv.json())[0] : null
    if (vivo && !req.body.novo) {
      return res.status(200).json({ ok: true, token: vivo.token, expira_em: vivo.expira_em, nome: alvo.nome, reaproveitado: true })
    }

    await matar()
    const novo = crypto.randomBytes(24).toString('base64url') // ~192 bits: impossível de adivinhar
    const expira = new Date(Date.now() + DIAS * 24 * 60 * 60 * 1000).toISOString()
    const r = await banco('links_atualizacao', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ membro_id: id, token: novo, expira_em: expira, criado_por: sessao.nome || '' }),
    })
    if (!r.ok) {
      console.error('gerar link', r.status, (await r.text()).slice(0, 200))
      return recusa(res, 500, 'Não foi possível gerar o link.')
    }
    return res.status(200).json({ ok: true, token: novo, expira_em: expira, nome: alvo.nome })
  }

  // ── Metade pública: a partir daqui tudo depende do token ──
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
      atual[c] = DATAS.has(c) ? soData(v) : String(v)
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
      if (c === 'nascimento') {
        // é a chave que abre o link: aceita troca, mas nunca apagar nem lixo
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) continue
        const d = new Date(v + 'T00:00:00')
        if (isNaN(d) || d > new Date() || d.getFullYear() < 1900) {
          return recusa(res, 400, 'Essa data de nascimento não parece certa. Confira o ano.')
        }
        limpo[c] = v
        continue
      }
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
      const depois = DATAS.has(c) ? soData(v) : v
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
