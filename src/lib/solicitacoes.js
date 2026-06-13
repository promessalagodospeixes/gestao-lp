import { dbInsert } from './supabase.js'
import { isPastor } from './utils.js'

// Verifica se o usuário pode excluir diretamente. Se for o Pastor, retorna true
// (a tela deve seguir com a exclusão normalmente). Caso contrário, registra uma
// solicitação de exclusão para o Pastor aprovar e retorna false (não excluir agora).
export async function podeExcluirOuSolicitar(user, dispatch, { tabela, registroId, descricao }) {
  if (isPastor(user)) return true

  const ok = window.confirm(
    `Você não tem permissão para excluir.\n\nDeseja enviar uma solicitação de exclusão ao Pastor?\n\n${descricao}`
  )
  if (!ok) return false

  await dbInsert('solicitacoes', {
    tabela,
    registro_id: String(registroId),
    descricao,
    solicitante_nome: user?.nome || '',
    solicitante_id: user?.id || null,
    status: 'pendente',
  })
  dispatch({ type: 'TOAST', value: '📨 Solicitação de exclusão enviada ao Pastor.' })
  return false
}
