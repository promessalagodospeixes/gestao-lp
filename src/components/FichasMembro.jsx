import { useEffect, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbSelect, dbInsert, dbUpdate } from '../lib/supabase.js'
import { logAudit } from '../lib/auditoria.js'
import { fmtBR, isAdmin } from '../lib/utils.js'
import { Btn, Tag, Empty } from './UI.jsx'
import { Check, X, Link2, ChevronRight, UserPlus } from 'lucide-react'

const LINK_FICHA = 'https://gestao.promessalagodospeixes.com.br/ficha'

const ROTULOS = {
  nome: 'Nome', nascimento: 'Nascimento', estado_civil: 'Estado civil', tel: 'WhatsApp',
  email: 'E-mail', profissao: 'Profissão', cep: 'CEP', endereco: 'Rua', numero: 'Número',
  complemento: 'Complemento', bairro: 'Bairro', cidade: 'Cidade', uf: 'UF',
  batizado: 'Batizado', batismo_data: 'Data do batismo', batismo_local: 'Local do batismo',
  igreja_anterior: 'Igreja anterior', como_conheceu: 'Como conheceu', obs: 'Observações',
}

const BATIZADO = { sim: 'Sim', nao: 'Não', quero: 'Ainda não — quer se batizar' }

export default function FichasMembro() {
  const { state, dispatch } = useStore()
  const { membros, user } = state
  const [fichas, setFichas] = useState([])
  const [abertas, setAbertas] = useState({})
  const [ocupado, setOcupado] = useState(null)
  const [copiado, setCopiado] = useState(false)

  const pode = isAdmin(user)

  const carregar = async () => {
    const lista = await dbSelect('fichas_membro', {}, { ordem: 'created_at.desc' })
    setFichas(lista || [])
  }
  useEffect(() => { carregar() }, [])

  if (!pode) return null

  const pendentes = fichas.filter(f => f.status === 'pendente')
  const resolvidas = fichas.filter(f => f.status !== 'pendente')

  const copiarLink = () => {
    navigator.clipboard.writeText(LINK_FICHA).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    })
  }

  const aprovar = async (f) => {
    const d = f.dados || {}
    const jaExiste = (membros || []).find(m => (m.nome || '').trim().toLowerCase() === (d.nome || '').trim().toLowerCase())
    if (jaExiste && !window.confirm(`Já existe um membro chamado "${jaExiste.nome}".\n\nCriar assim mesmo um novo cadastro?`)) return
    setOcupado(f.id)
    try {
      const row = {
        nome: (d.nome || '').trim(), tel: d.tel || null, email: d.email || null,
        situacao: 'Membro',
        nascimento: d.nascimento || null, estado_civil: d.estado_civil || null, profissao: d.profissao || null,
        cep: d.cep || null, endereco: d.endereco || null, numero: d.numero || null,
        complemento: d.complemento || null, bairro: d.bairro || null, cidade: d.cidade || null, uf: d.uf || null,
        batizado: d.batizado === 'sim' ? true : d.batizado === 'nao' ? false : null,
        batismo_data: d.batismo_data || null, batismo_local: d.batismo_local || null,
        igreja_anterior: d.igreja_anterior || null, como_conheceu: d.como_conheceu || null,
        obs: d.obs || null,
      }
      const novo = await dbInsert('membros', row, `Membro criado pela ficha: ${row.nome}`)
      await dbUpdate('fichas_membro', f.id, {
        status: 'aprovada', membro_id: novo?.id || null,
        resolvido_por: user?.nome || '', resolvido_em: new Date().toISOString(),
      })
      await logAudit(user, 'FICHA_APROVADA', `Aprovou a ficha de ${row.nome} e criou o cadastro de membro`)
      dispatch({ type: 'SET', key: 'membros', value: [...(membros || []), novo || { id: Date.now(), ...row }] })
      dispatch({ type: 'TOAST', value: `✅ ${row.nome.split(' ')[0]} agora é membro cadastrado!` })
      carregar()
    } catch (e) {
      dispatch({ type: 'TOAST', value: '⚠ Erro ao aprovar a ficha.' })
    } finally { setOcupado(null) }
  }

  const rejeitar = async (f) => {
    const motivo = window.prompt('Motivo (opcional) — fica registrado só para a secretaria:')
    if (motivo === null) return
    setOcupado(f.id)
    await dbUpdate('fichas_membro', f.id, {
      status: 'rejeitada', obs_interna: motivo || null,
      resolvido_por: user?.nome || '', resolvido_em: new Date().toISOString(),
    })
    await logAudit(user, 'FICHA_REJEITADA', `Rejeitou a ficha de ${f.dados?.nome || '(sem nome)'}`)
    setOcupado(null)
    carregar()
    dispatch({ type: 'TOAST', value: '⛔ Ficha rejeitada.' })
  }

  const Ficha = ({ f }) => {
    const d = f.dados || {}
    const aberta = !!abertas[f.id]
    const campos = Object.entries(ROTULOS)
      .map(([k, rot]) => [rot, k === 'batizado' ? (BATIZADO[d[k]] || '') : d[k]])
      .filter(([, v]) => v)
    return (
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
        <div onClick={() => setAbertas(a => ({ ...a, [f.id]: !a[f.id] }))}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px', cursor: 'pointer' }}>
          <ChevronRight size={15} style={{ color: 'var(--g)', flexShrink: 0, transform: aberta ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--w)' }}>{d.nome || '(sem nome)'}</div>
            <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 2 }}>
              {d.tel || 'sem telefone'}{d.bairro ? ` · ${d.bairro}` : ''}
              {f.created_at ? ` · enviada em ${fmtBR(f.created_at.slice(0, 10))}` : ''}
            </div>
          </div>
          {f.status === 'pendente'
            ? (
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                <Btn variant="green" size="xs" disabled={ocupado === f.id} onClick={() => aprovar(f)}><Check size={14} /> Aprovar</Btn>
                <Btn variant="outline" size="xs" disabled={ocupado === f.id} onClick={() => rejeitar(f)}><X size={14} /></Btn>
              </div>
            )
            : <Tag color={f.status === 'aprovada' ? 'green' : 'gray'}>{f.status === 'aprovada' ? 'Aprovada · virou membro' : 'Rejeitada'}</Tag>
          }
        </div>
        {aberta && (
          <div style={{ padding: '0 15px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))', gap: '6px 16px' }}>
            {campos.map(([rot, v]) => (
              <div key={rot} style={{ fontSize: 12, color: 'var(--tx)', borderBottom: '1px solid var(--bd)', padding: '5px 0' }}>
                <span style={{ color: 'var(--g)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em' }}>{rot}</span>
                <div style={{ color: 'var(--w)' }}>{v}</div>
              </div>
            ))}
            {f.resolvido_por && (
              <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--g)', marginTop: 4 }}>
                {f.status === 'aprovada' ? 'Aprovada' : 'Rejeitada'} por {f.resolvido_por}
                {f.obs_interna ? ` — ${f.obs_interna}` : ''}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--w)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserPlus size={16} style={{ color: 'var(--cy)' }} /> Fichas de novos membros ({pendentes.length})
        </div>
        <Btn variant="outline" size="sm" onClick={copiarLink}>
          <Link2 size={14} /> {copiado ? 'Link copiado!' : 'Copiar link da ficha'}
        </Btn>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--g)', marginBottom: 12 }}>
        Mande <strong style={{ color: 'var(--cy)' }}>{LINK_FICHA}</strong> para a pessoa preencher. A ficha chega aqui para você conferir e aprovar.
      </div>

      {pendentes.length === 0
        ? <Empty icon="📋" text="Nenhuma ficha aguardando aprovação." />
        : pendentes.map(f => <Ficha key={f.id} f={f} />)
      }

      {resolvidas.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--g)', padding: '6px 0' }}>
            Fichas já resolvidas ({resolvidas.length})
          </summary>
          <div style={{ marginTop: 8 }}>{resolvidas.map(f => <Ficha key={f.id} f={f} />)}</div>
        </details>
      )}
    </div>
  )
}
