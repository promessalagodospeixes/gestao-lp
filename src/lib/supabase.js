// Acesso ao banco pelo servidor (/api/db). O navegador não tem mais chave do banco:
// toda operação leva o token da sessão e é conferida no servidor.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mynektdohwpzfbmgfunp.supabase.co'
// Chave pública, usada só para o Storage (fotos do site, que são públicas mesmo).
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15bmVrdGRvaHdwemZibWdmdW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTcwMjQsImV4cCI6MjA5NjMzMzAyNH0.mhQIXbVgWkpVxvcOXs80KIoqSphde9juPLlZJJrkOhs'

export const sbStorage = createClient(SUPABASE_URL, SUPABASE_KEY)
// Compatibilidade: telas antigas que usam sb.storage continuam funcionando.
export const sb = sbStorage

export const getToken = () => localStorage.getItem('gestao-lp-token') || ''
export const setToken = (t) => t ? localStorage.setItem('gestao-lp-token', t) : localStorage.removeItem('gestao-lp-token')

const TABLE_LABEL = {
  membros: 'Membros', lideranca: 'Liderança', agenda: 'Agenda', avisos: 'Avisos',
  financeiro: 'Financeiro', funcoes: 'Registro de Funções', gestores: 'Gestores',
  musicas: 'Músicas', escalas: 'Escala Culto', escalas_eb: 'Escala EB',
  escalas_lv: 'Escala Louvor', escala_preg: 'Escala Pregação', devocional: 'Devocional',
  solicitacoes: 'Solicitações', usuarios: 'Usuários', series: 'Séries',
  series_subtemas: 'Subtemas', fichas_membro: 'Fichas de membro',
}

const getUser = () => {
  try { return JSON.parse(localStorage.getItem('gestao-lp-user')) } catch { return null }
}

// Conversa com o servidor
async function chamar(corpo) {
  const r = await fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(corpo),
  })
  if (r.status === 401) {
    // sessão expirou: volta para o login sem deixar tela quebrada
    localStorage.removeItem('gestao-lp-token')
    localStorage.removeItem('gestao-lp-user')
    window.location.reload()
    return { erro: 'sessão expirada' }
  }
  const resp = await r.json().catch(() => ({ erro: 'resposta inválida' }))
  // o servidor renova a sessão sozinho enquanto a pessoa usa o sistema
  if (resp && resp.token) setToken(resp.token)
  return resp
}

const audit = async (acao, tabela, desc) => {
  const u = getUser()
  if (!u) return
  const label = TABLE_LABEL[tabela] || tabela
  try {
    await chamar({
      acao: 'insert', tabela: 'auditoria',
      dados: {
        usuario_nome: u.nome || 'Sistema', usuario_id: u.id || null,
        acao, detalhes: desc ? `[${label}] ${desc}` : `[${label}]`,
      },
    })
  } catch { /* auditoria nunca derruba a ação principal */ }
}

export const dbGet = async (table, filters = {}) => {
  const r = await chamar({ acao: 'select', tabela: table, filtros: filters })
  if (r.erro) { console.error('dbGet', table, r.erro); return [] }
  return r.dados || []
}

export const dbInsert = async (table, row, auditDesc = null) => {
  const r = await chamar({ acao: 'insert', tabela: table, dados: row })
  if (r.erro) { console.error('dbInsert', table, r.erro); return null }
  const novo = Array.isArray(r.dados) ? r.dados[0] : r.dados
  audit('CRIOU', table, auditDesc || (row.titulo || row.nome || row.desc || ''))
  return novo
}

export const dbUpdate = async (table, id, row, auditDesc = null) => {
  const r = await chamar({ acao: 'update', tabela: table, id, dados: row })
  if (r.erro) { console.error('dbUpdate', table, r.erro); return { _err: r.erro } }
  audit('EDITOU', table, auditDesc || (row.titulo || row.nome || row.desc || `id ${id}`))
  return { id, ...row }
}

export const dbUpsert = async (table, row, conflict, auditDesc = null) => {
  const r = await chamar({ acao: 'upsert', tabela: table, dados: row, conflito: conflict })
  if (r.erro) { console.error('dbUpsert', table, r.erro); return null }
  const novo = Array.isArray(r.dados) ? r.dados[0] : r.dados
  audit('SALVOU', table, auditDesc || (row.titulo || row.nome || ''))
  return novo
}

export const dbDelete = async (table, id, auditDesc = null) => {
  const r = await chamar({ acao: 'delete', tabela: table, id })
  if (r.erro) { console.error('dbDelete', table, r.erro); return false }
  audit('EXCLUIU', table, auditDesc || `id ${id}`)
  return true
}

// Para as telas que faziam sb.from('x').select() direto
export const dbSelect = (table, filtros = {}, extra = {}) =>
  chamar({ acao: 'select', tabela: table, filtros, ...extra }).then(r => r.dados || [])

// Atualiza vários registros por um campo (ex.: trocar o nome de alguém em todas as escalas)
export const dbUpdateOnde = async (table, campo, valor, row) => {
  const r = await chamar({ acao: 'updateOnde', tabela: table, campo, valor, dados: row })
  if (r.erro) { console.error('dbUpdateOnde', table, r.erro); return false }
  return true
}
