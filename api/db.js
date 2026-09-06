// Porta única de acesso ao banco. O navegador não fala mais direto com o Supabase:
// manda a operação para cá, o servidor confere quem é a pessoa e só então executa.
import { banco, temChave, sessaoDaRequisicao, tokenRenovado, guardarArquivo, urlPublica, montarCodigoRecibo } from './_auth.js'

// Tabelas que o sistema usa (lista fechada — nada fora disso é aceito)
const TABELAS = new Set([
  'membros', 'usuarios', 'gestores', 'funcoes', 'lideranca', 'agenda', 'avisos', 'musicas',
  'pregacoes', 'escala_preg', 'series', 'series_subtemas', 'financeiro', 'escalas', 'escalas_eb',
  'escalas_lv', 'setlists', 'ocorrencias', 'solicitacoes', 'devocionais', 'devocionais_respostas',
  'ministerios', 'atas', 'lembretes', 'cultos_especiais', 'site_config', 'envios_email',
  'fichas_membro', 'auditoria', 'eb_licoes', 'eb_aulas',
  'fin_contas', 'fin_meses', 'fin_contribuicoes', 'fin_despesas', 'fin_depositos', 'fin_config',
])

// Só pastor e secretário mexem nessas
const SO_ADMIN = new Set(['membros', 'usuarios', 'gestores', 'lideranca', 'financeiro', 'atas', 'fichas_membro', 'site_config'])

// Tesouraria: quem deu quanto é o dado mais sensível do sistema, então aqui a
// trava vale para LER também, não só para escrever.
// Quem entra NÃO está decidido no código: é o que o pastor configurou na aba
// Gestores (a página 'financeiro'). Consultado a cada acesso — tirou lá, caiu aqui.
const SO_TESOURARIA = new Set(['fin_contas', 'fin_meses', 'fin_contribuicoes', 'fin_despesas', 'fin_depositos', 'fin_config'])

// Quem pode mexer numa página é o que o pastor marcou na aba Gestores.
// Consultado a cada acesso: tirou lá, cai aqui na hora.
async function podePagina(sessao, pagina) {
  if (sessao?.perfil === 'pastor') return true
  const nome = sessao?.nome
  if (!nome) return false
  try {
    const r = await banco('gestores?select=permissoes&limit=1')
    if (!r.ok) return false
    const g = (await r.json())[0]
    const perms = g?.permissoes
      ? (typeof g.permissoes === 'object' ? g.permissoes : JSON.parse(g.permissoes || '{}'))
      : {}
    const paginas = perms[nome]
    return Array.isArray(paginas) && paginas.includes(pagina)
  } catch (e) {
    console.error('permissao', pagina, e)
    return false
  }
}

const podeTesouraria = (s) => podePagina(s, 'financeiro')
// Ninguém apaga pelo sistema (histórico é sagrado)
const NUNCA_APAGA = new Set(['auditoria', 'login_tentativas'])
// Campos que nunca voltam para o navegador
const CAMPOS_PROIBIDOS = ['senha', 'senha_hash']
// Pastas de foto do site (lista fechada: ninguem inventa caminho)
const PASTAS_FOTO = new Set(['capa','agenda','familia','galeria','mensagens','reels','sobre'])

const ehAdmin = (s) => ['pastor', 'secretario'].includes(s?.perfil)

function limpar(dado) {
  if (Array.isArray(dado)) return dado.map(limpar)
  if (dado && typeof dado === 'object') {
    const copia = { ...dado }
    for (const c of CAMPOS_PROIBIDOS) delete copia[c]
    return copia
  }
  return dado
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'method' })
  if (!temChave()) return res.status(500).json({ erro: 'servidor sem SUPABASE_SERVICE_KEY' })

  const sessao = sessaoDaRequisicao(req)
  if (!sessao) return res.status(401).json({ erro: 'Sessão expirada. Entre de novo.' })
  // vai junto na resposta quando estiver perto de vencer; o navegador guarda e segue logado
  const renovado = tokenRenovado(sessao)

  const { acao, tabela, filtros, dados, id, conflito, ordem, limite } = req.body || {}

  // Foto do site: passa por aqui para o navegador não precisar de chave do Storage.
  // (Fica junto do banco porque o plano da Vercel limita o número de funções.)
  if (acao === 'foto') {
    if (!ehAdmin(sessao)) return res.status(403).json({ erro: 'Sem permissão para trocar fotos.' })
    const pasta = String(req.body.pasta || '')
    if (!PASTAS_FOTO.has(pasta)) return res.status(400).json({ erro: 'pasta inválida' })
    const base64 = String(req.body.base64 || '')
    if (!base64) return res.status(400).json({ erro: 'arquivo vazio' })
    const bytes = Buffer.from(base64, 'base64')
    if (!bytes.length) return res.status(400).json({ erro: 'arquivo inválido' })
    if (bytes.length > 6 * 1024 * 1024) return res.status(413).json({ erro: 'Foto muito grande (máx. 6 MB).' })
    const nome = `${pasta}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
    const r = await guardarArquivo('site', nome, bytes, 'image/jpeg')
    if (!r.ok) {
      console.error('foto', r.status, (await r.text()).slice(0, 200))
      return res.status(500).json({ erro: 'Não foi possível salvar a foto.' })
    }
    return res.status(200).json({ ok: true, url: urlPublica('site', nome) })
  }

  // ── Os dízimos da própria pessoa ──
  // O membro não enxerga a tesouraria, mas tem direito ao que é dele. Aqui o
  // filtro é o dono da sessão: não existe jeito de pedir os dízimos de outro.
  if (acao === 'meus_dizimos') {
    const meuId = sessao?.membro_id
    if (!meuId) return res.status(200).json({ dados: [], config: null })
    const [rc, rk, rcfg] = await Promise.all([
      banco(`fin_contribuicoes?membro_id=eq.${encodeURIComponent(meuId)}&codigo_recibo=not.is.null&select=id,data,mes_ref,valor,recibo,codigo_recibo,forma,conta_id,validado_em&order=data.desc&limit=2000`),
      banco('fin_contas?papel=eq.dizimo&lado=eq.R&select=id'),
      banco('fin_config?id=eq.1&select=igreja_codigo,igreja_nome,convencao_nome,convencao_cnpj,pastor_nome,tesoureiro_nome'),
    ])
    if (!rc.ok) return res.status(200).json({ dados: [], config: null })
    const todas = await rc.json()
    const idsDizimo = new Set((rk.ok ? await rk.json() : []).map((c) => c.id))
    const config = rcfg.ok ? (await rcfg.json())[0] || null : null
    // Só dízimo: oferta não tem dono, não gera recibo nominal.
    const dados = todas.filter((c) => idsDizimo.has(c.conta_id))
    return res.status(200).json({ dados, config, ...(renovado ? { token: renovado } : {}) })
  }

  // ── Assinar o mês ──
  // Igual à ata: duas assinaturas. O tesoureiro assina que conferiu, o pastor
  // assina que aprovou. Com as duas, o mês fecha e os recibos nascem.
  // A trava mora aqui, no servidor — a tela só mostra o que já foi decidido.
  if (acao === 'assinar_mes') {
    if (!(await podeTesouraria(sessao))) return res.status(403).json({ erro: 'Sem permissão.' })
    const ref = String(req.body.ref || '')
    if (!/^\d{4}-\d{2}-01$/.test(ref)) return res.status(400).json({ erro: 'mês inválido' })

    const rm = await banco(`fin_meses?ref=eq.${ref}&select=*`)
    const mes = rm.ok ? (await rm.json())[0] : null
    if (!mes) return res.status(400).json({ erro: 'Mês ainda não existe. Lance algo antes.' })
    if (mes.status === 'fechado') return res.status(400).json({ erro: 'Mês já está fechado.' })

    const ehPastor = sessao.perfil === 'pastor'
    const campo = ehPastor ? 'assinatura_pastor' : 'assinatura_tesoureiro'
    if (mes[campo]) return res.status(400).json({ erro: 'Você já assinou este mês.' })

    const agora = new Date().toISOString()
    const patch = { [campo]: agora, [`${campo}_nome`]: sessao.nome || null }

    // Com as duas assinaturas, fecha.
    const pastorOk = ehPastor ? agora : mes.assinatura_pastor
    const tesourOk = ehPastor ? mes.assinatura_tesoureiro : agora
    const fechou = !!(pastorOk && tesourOk)
    if (fechou) { patch.status = 'fechado'; patch.fechado_em = agora; patch.fechado_por = sessao.id || null }

    const ru = await banco(`fin_meses?ref=eq.${ref}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch),
    })
    if (!ru.ok) return res.status(500).json({ erro: 'Não foi possível assinar.' })
    const atualizado = (await ru.json())[0]
    return res.status(200).json({
      ok: true, mes: atualizado, fechou,
      quem: ehPastor ? 'pastor' : 'tesoureiro',
      ...(renovado ? { token: renovado } : {}),
    })
  }

  // ── Reabrir o mês: SÓ O PASTOR ──
  // Às vezes precisa ajustar depois de fechado. Mas quem destrava é só ele:
  // não adianta o tesoureiro querer mexer sozinho no que já foi aprovado.
  if (acao === 'reabrir_mes') {
    if (sessao?.perfil !== 'pastor') {
      return res.status(403).json({ erro: 'Só o pastor pode reabrir um mês fechado.' })
    }
    const ref = String(req.body.ref || '')
    if (!/^\d{4}-\d{2}-01$/.test(ref)) return res.status(400).json({ erro: 'mês inválido' })
    const motivo = String(req.body.motivo || '').trim()
    if (motivo.length < 5) return res.status(400).json({ erro: 'Escreva o motivo da reabertura.' })

    const ru = await banco(`fin_meses?ref=eq.${ref}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        status: 'aberto',
        assinatura_pastor: null, assinatura_pastor_nome: null,
        assinatura_tesoureiro: null, assinatura_tesoureiro_nome: null,
        fechado_em: null, fechado_por: null,
        reaberto_em: new Date().toISOString(),
        reaberto_por_nome: sessao.nome || null,
        reaberto_motivo: motivo,
      }),
    })
    if (!ru.ok) return res.status(500).json({ erro: 'Não foi possível reabrir.' })
    // Fica registrado na auditoria: reabrir mês fechado não passa despercebido.
    await banco('auditoria', {
      method: 'POST',
      body: JSON.stringify({
        usuario_nome: sessao.nome || 'Sistema', usuario_id: sessao.id || null,
        acao: 'REABRIU', detalhes: `[Financeiro] Reabriu ${ref} — motivo: ${motivo}`,
      }),
    }).catch(() => {})
    return res.status(200).json({ ok: true, mes: (await ru.json())[0], ...(renovado ? { token: renovado } : {}) })
  }

  // ── Validar o mês: é aqui que os recibos nascem ──
  // Enquanto o mês está aberto, nada tem código. Quando o tesoureiro confere
  // tudo e valida, cada dízimo ganha um número sequencial (continuando o talão)
  // e um código que não se repete e não se transfere.
  if (acao === 'validar_recibos') {
    if (!(await podeTesouraria(sessao))) return res.status(403).json({ erro: 'Sem permissão.' })
    const ref = String(req.body.ref || '')
    if (!/^\d{4}-\d{2}-01$/.test(ref)) return res.status(400).json({ erro: 'mês inválido' })

    const rcfg = await banco('fin_config?id=eq.1&select=*')
    const cfg = rcfg.ok ? (await rcfg.json())[0] : null
    if (!cfg) return res.status(500).json({ erro: 'Configuração da igreja não encontrada.' })

    const rk = await banco('fin_contas?papel=eq.dizimo&lado=eq.R&select=id')
    const idsDizimo = new Set((rk.ok ? await rk.json() : []).map((c) => c.id))

    const rc = await banco(`fin_contribuicoes?mes_ref=eq.${ref}&codigo_recibo=is.null&select=id,valor,membro_id,nome,conta_id,recibo&order=id`)
    const pendentes = (rc.ok ? await rc.json() : []).filter((c) => idsDizimo.has(c.conta_id))
    if (!pendentes.length) return res.status(200).json({ ok: true, gerados: 0 })

    const competencia = ref.slice(0, 4) + ref.slice(5, 7)
    let numero = Number(cfg.proximo_recibo) || 1
    const agora = new Date().toISOString()
    let gerados = 0

    for (const c of pendentes) {
      const codigo = montarCodigoRecibo({
        igreja: cfg.igreja_codigo, competencia, numero,
        membroId: c.membro_id, valor: c.valor,
      })
      const r = await banco(`fin_contribuicoes?id=eq.${c.id}&codigo_recibo=is.null`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        // O campo `recibo` é o número do talão de papel da Região e fica como
        // está. A numeração do sistema é outra, de propósito: 6 dígitos, fora
        // da faixa regional, para nunca colidir com o talão de outra igreja.
        body: JSON.stringify({
          codigo_recibo: codigo,
          validado_em: agora,
          validado_por: sessao.id || null,
        }),
      })
      if (r.ok && (await r.json()).length) { numero++; gerados++ }
    }

    await banco('fin_config?id=eq.1', { method: 'PATCH', body: JSON.stringify({ proximo_recibo: numero }) })
    return res.status(200).json({ ok: true, gerados, proximo: numero, ...(renovado ? { token: renovado } : {}) })
  }

  if (!TABELAS.has(tabela)) return res.status(400).json({ erro: 'tabela não permitida' })

  // Tesouraria é fechada por completo: nem ler.
  if (SO_TESOURARIA.has(tabela) && !(await podeTesouraria(sessao))) {
    return res.status(403).json({ erro: 'Sem permissão.' })
  }

  const escrita = ['insert', 'update', 'upsert', 'delete'].includes(acao)
  // Secretaria (atas): quem escreve é quem o pastor liberou em Gestores.
  if (escrita && tabela === 'atas') {
    if (!ehAdmin(sessao) && !(await podePagina(sessao, 'atas'))) {
      return res.status(403).json({ erro: 'Você não tem permissão para alterar isso.' })
    }
  } else if (escrita && SO_ADMIN.has(tabela) && !ehAdmin(sessao)) {
    return res.status(403).json({ erro: 'Você não tem permissão para alterar isso.' })
  }
  if (acao === 'delete' && NUNCA_APAGA.has(tabela)) {
    return res.status(403).json({ erro: 'Este registro não pode ser apagado.' })
  }
  // Fechamento e assinatura só mudam pelas ações próprias (assinar_mes /
  // reabrir_mes), que conferem quem é. Pela via comum, esses campos são intocáveis.
  if (tabela === 'fin_meses' && ['update', 'insert', 'upsert'].includes(acao)) {
    const proibidos = ['status', 'assinatura_pastor', 'assinatura_pastor_nome',
      'assinatura_tesoureiro', 'assinatura_tesoureiro_nome', 'fechado_em', 'fechado_por']
    const corpo = Array.isArray(dados) ? dados : [dados || {}]
    if (corpo.some(d => proibidos.some(c => c in (d || {})))) {
      return res.status(403).json({ erro: 'O fechamento do mês só muda pela assinatura.' })
    }
  }
  // Recibo entregue não some nem muda de valor. A pessoa já tem o papel na mão
  // e a Região já recebeu a via dela — apagar aqui criaria um buraco na numeração.
  if (tabela === 'fin_contribuicoes' && ['delete', 'update'].includes(acao)) {
    const r = await banco(`fin_contribuicoes?id=eq.${encodeURIComponent(id)}&select=codigo_recibo`)
    const atual = r.ok ? (await r.json())[0] : null
    if (atual?.codigo_recibo) {
      return res.status(403).json({
        erro: `Recibo ${atual.codigo_recibo} já foi emitido. Para corrigir, lance um estorno — não apague.`,
      })
    }
  }
  // Dados pessoais completos: só admin lê fichas
  if (acao === 'select' && tabela === 'fichas_membro' && !ehAdmin(sessao)) {
    return res.status(403).json({ erro: 'Sem permissão.' })
  }

  try {
    let caminho = tabela
    let opcoes = {}

    if (acao === 'select') {
      const partes = ['select=*']
      Object.entries(filtros || {}).forEach(([k, v]) => partes.push(`${k}=eq.${encodeURIComponent(v)}`))
      if (ordem) partes.push(`order=${ordem}`)
      partes.push(`limit=${Math.min(Number(limite) || 5000, 5000)}`)
      caminho += `?${partes.join('&')}`
    } else if (acao === 'insert') {
      opcoes = { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(dados) }
    } else if (acao === 'update') {
      caminho += `?id=eq.${encodeURIComponent(id)}`
      opcoes = { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(dados) }
    } else if (acao === 'upsert') {
      caminho += `?on_conflict=${encodeURIComponent(conflito || 'id')}`
      opcoes = {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(dados),
      }
    } else if (acao === 'updateOnde') {
      // troca em massa por um campo (usado ao renomear alguém em todas as escalas)
      if (!ehAdmin(sessao)) return res.status(403).json({ erro: 'Sem permissão.' })
      const campo = String(req.body.campo || '')
      if (!/^[a-z_0-9]+$/.test(campo)) return res.status(400).json({ erro: 'campo inválido' })
      caminho += `?${campo}=eq.${encodeURIComponent(req.body.valor)}`
      opcoes = { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(dados) }
    } else if (acao === 'delete') {
      caminho += `?id=eq.${encodeURIComponent(id)}`
      opcoes = { method: 'DELETE' }
    } else {
      return res.status(400).json({ erro: 'ação inválida' })
    }

    const r = await banco(caminho, opcoes)
    if (!r.ok) {
      const detalhe = await r.text()
      console.error('db', acao, tabela, r.status, detalhe.slice(0, 200))
      return res.status(r.status).json({ erro: 'Operação recusada pelo banco.', detalhe: detalhe.slice(0, 200) })
    }
    if (acao === 'delete') return res.status(200).json({ ok: true, ...(renovado ? { token: renovado } : {}) })
    const corpo = await r.json().catch(() => [])
    return res.status(200).json({ dados: limpar(corpo), ...(renovado ? { token: renovado } : {}) })
  } catch (e) {
    console.error('db erro', e)
    return res.status(500).json({ erro: 'Erro no servidor.' })
  }
}
