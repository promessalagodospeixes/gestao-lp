// Porta única de acesso ao banco. O navegador não fala mais direto com o Supabase:
// manda a operação para cá, o servidor confere quem é a pessoa e só então executa.
import { banco, temChave, sessaoDaRequisicao } from './_auth.js'

// Tabelas que o sistema usa (lista fechada — nada fora disso é aceito)
const TABELAS = new Set([
  'membros', 'usuarios', 'gestores', 'funcoes', 'lideranca', 'agenda', 'avisos', 'musicas',
  'pregacoes', 'escala_preg', 'series', 'series_subtemas', 'financeiro', 'escalas', 'escalas_eb',
  'escalas_lv', 'setlists', 'ocorrencias', 'solicitacoes', 'devocionais', 'devocionais_respostas',
  'ministerios', 'atas', 'lembretes', 'cultos_especiais', 'site_config', 'envios_email',
  'fichas_membro', 'auditoria',
])

// Só pastor e secretário mexem nessas
const SO_ADMIN = new Set(['membros', 'usuarios', 'gestores', 'lideranca', 'financeiro', 'atas', 'fichas_membro', 'site_config'])
// Ninguém apaga pelo sistema (histórico é sagrado)
const NUNCA_APAGA = new Set(['auditoria', 'login_tentativas'])
// Campos que nunca voltam para o navegador
const CAMPOS_PROIBIDOS = ['senha', 'senha_hash']

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

  const { acao, tabela, filtros, dados, id, conflito, ordem, limite } = req.body || {}
  if (!TABELAS.has(tabela)) return res.status(400).json({ erro: 'tabela não permitida' })

  const escrita = ['insert', 'update', 'upsert', 'delete'].includes(acao)
  if (escrita && SO_ADMIN.has(tabela) && !ehAdmin(sessao)) {
    return res.status(403).json({ erro: 'Você não tem permissão para alterar isso.' })
  }
  if (acao === 'delete' && NUNCA_APAGA.has(tabela)) {
    return res.status(403).json({ erro: 'Este registro não pode ser apagado.' })
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
    if (acao === 'delete') return res.status(200).json({ ok: true })
    const corpo = await r.json().catch(() => [])
    return res.status(200).json({ dados: limpar(corpo) })
  } catch (e) {
    console.error('db erro', e)
    return res.status(500).json({ erro: 'Erro no servidor.' })
  }
}
