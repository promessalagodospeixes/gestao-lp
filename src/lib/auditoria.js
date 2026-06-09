import { sb } from './supabase'

export const logAudit = async (user, acao, detalhes) => {
  try {
    await sb.from('auditoria').insert({
      usuario_nome: user?.nome || 'Sistema',
      usuario_id: user?.id || null,
      acao,
      detalhes: typeof detalhes === 'object' ? JSON.stringify(detalhes) : String(detalhes || ''),
    })
  } catch (e) {
    console.warn('audit log failed:', e)
  }
}
