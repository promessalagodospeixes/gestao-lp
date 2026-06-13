import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbUpdate, dbDelete } from '../lib/supabase.js'
import { loadAllData } from '../lib/dataLoader.js'
import { logAudit } from '../lib/auditoria.js'
import { fmtBR, isPastor } from '../lib/utils.js'
import { SecHeader, Btn, Tag, Empty } from '../components/UI.jsx'

export default function Solicitacoes() {
  const { state, dispatch } = useStore()
  const { solicitacoes, user } = state
  const [loadingId, setLoadingId] = useState(null)

  const podeAprovar = isPastor(user)
  const todas = [...(solicitacoes || [])].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  const lista = podeAprovar ? todas : todas.filter(s => s.solicitante_id === user?.id)
  const pendentes = lista.filter(s => s.status === 'pendente')
  const resolvidas = lista.filter(s => s.status !== 'pendente')

  const aprovar = async (s) => {
    setLoadingId(s.id)
    await dbDelete(s.tabela, s.registro_id)
    await dbUpdate('solicitacoes', s.id, { status: 'aprovado', resolvido_em: new Date().toISOString() })
    await logAudit(user, 'SOLICITACAO_APROVADA', `Aprovou exclusão: ${s.descricao} (solicitado por ${s.solicitante_nome})`)
    const allData = await loadAllData()
    dispatch({ type: 'LOAD_ALL', data: allData })
    dispatch({ type: 'TOAST', value: '✅ Exclusão aprovada e realizada.' })
    setLoadingId(null)
  }

  const rejeitar = async (s) => {
    setLoadingId(s.id)
    await dbUpdate('solicitacoes', s.id, { status: 'rejeitado', resolvido_em: new Date().toISOString() })
    dispatch({ type: 'SET', key: 'solicitacoes', value: (solicitacoes || []).map(x => x.id === s.id ? { ...x, status: 'rejeitado', resolvido_em: new Date().toISOString() } : x) })
    await logAudit(user, 'SOLICITACAO_REJEITADA', `Rejeitou exclusão: ${s.descricao} (solicitado por ${s.solicitante_nome})`)
    dispatch({ type: 'TOAST', value: '⛔ Solicitação rejeitada.' })
    setLoadingId(null)
  }

  const Item = ({ s }) => (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '12px 15px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--w)' }}>{s.descricao}</div>
          <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 3 }}>
            Solicitado por <strong style={{ color: 'var(--cy)' }}>{s.solicitante_nome}</strong>
            {s.created_at ? ` · ${fmtBR(s.created_at.slice(0,10))}` : ''}
          </div>
        </div>
        {s.status === 'pendente'
          ? (podeAprovar
            ? (
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <Btn variant="danger" size="xs" disabled={loadingId === s.id} onClick={() => aprovar(s)}>🗑 Aprovar Exclusão</Btn>
                <Btn variant="outline" size="xs" disabled={loadingId === s.id} onClick={() => rejeitar(s)}>✕ Rejeitar</Btn>
              </div>
            )
            : <Tag color="yellow">Aguardando Pastor</Tag>
          )
          : <Tag color={s.status === 'aprovado' ? 'red' : 'gray'}>{s.status === 'aprovado' ? 'Aprovado · Excluído' : 'Rejeitado'}</Tag>
        }
      </div>
    </div>
  )

  return (
    <div>
      <SecHeader title={podeAprovar ? `SOLICITAÇÕES DE EXCLUSÃO (${pendentes.length})` : 'MINHAS SOLICITAÇÕES'} />
      {pendentes.length === 0
        ? <Empty icon="📨" text="Nenhuma solicitação pendente." />
        : pendentes.map(s => <Item key={s.id} s={s} />)
      }
      {resolvidas.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: 2, color: 'var(--g)', marginBottom: 8, borderBottom: '1px solid var(--bd)', paddingBottom: 5 }}>HISTÓRICO</div>
          {resolvidas.map(s => <Item key={s.id} s={s} />)}
        </div>
      )}
    </div>
  )
}
