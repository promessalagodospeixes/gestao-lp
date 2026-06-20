import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mynektdohwpzfbmgfunp.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15bmVrdGRvaHdwemZibWdmdW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTcwMjQsImV4cCI6MjA5NjMzMzAyNH0.mhQIXbVgWkpVxvcOXs80KIoqSphde9juPLlZJJrkOhs'

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

// Rótulos legíveis para cada tabela
const TABLE_LABEL = {
  membros:      'Membros',
  lideranca:    'Liderança',
  agenda:       'Agenda',
  avisos:       'Avisos',
  financeiro:   'Financeiro',
  funcoes:      'Registro de Funções',
  gestores:     'Gestores',
  musicas:      'Músicas',
  escalas:      'Escala Culto',
  escalas_eb:   'Escala EB',
  escalas_lv:   'Escala Louvor',
  escala_preg:  'Escala Pregação',
  devocional:   'Devocional',
  solicitacoes: 'Solicitações',
  usuarios:     'Usuários',
}

const getUser = () => {
  try { return JSON.parse(localStorage.getItem('gestao-lp-user')) } catch { return null }
}

const audit = async (acao, tabela, desc) => {
  const u = getUser()
  if (!u) return
  const label = TABLE_LABEL[tabela] || tabela
  try {
    await sb.from('auditoria').insert({
      usuario_nome: u.nome || 'Sistema',
      usuario_id:   u.id   || null,
      acao,
      detalhes: desc ? `[${label}] ${desc}` : `[${label}]`,
    })
  } catch { /* silencioso */ }
}

export const dbGet = async (table, filters = {}) => {
  let q = sb.from(table).select('*')
  Object.entries(filters).forEach(([k, v]) => { q = q.eq(k, v) })
  const { data, error } = await q
  if (error) { console.error('dbGet', table, error); return [] }
  return data || []
}

export const dbInsert = async (table, row, auditDesc = null) => {
  const { data, error } = await sb.from(table).insert(row).select().single()
  if (error) { console.error('dbInsert', table, error); return null }
  audit('CRIOU', table, auditDesc || (row.titulo || row.nome || row.desc || ''))
  return data
}

export const dbUpdate = async (table, id, row, auditDesc = null) => {
  const { error } = await sb.from(table).update(row).eq('id', id)
  if (error) { console.error('dbUpdate', table, error); return null }
  audit('EDITOU', table, auditDesc || (row.titulo || row.nome || row.desc || `id ${id}`))
  return { id, ...row }
}

export const dbUpsert = async (table, row, conflict, auditDesc = null) => {
  const { data, error } = await sb.from(table).upsert(row, { onConflict: conflict }).select().single()
  if (error) { console.error('dbUpsert', table, error); return null }
  audit('SALVOU', table, auditDesc || (row.titulo || row.nome || ''))
  return data
}

export const dbDelete = async (table, id, auditDesc = null) => {
  const { error } = await sb.from(table).delete().eq('id', id)
  if (error) { console.error('dbDelete', table, error); return false }
  audit('EXCLUIU', table, auditDesc || `id ${id}`)
  return true
}
