import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbUpdate, dbDelete } from '../lib/supabase.js'
import { cascadeRenomear } from '../lib/cascadeRename.js'
import { isAdmin, normalizar, toUpperName, primeiroUltimo, fmtBR, cpfValido, cpfMascara } from '../lib/utils.js'
import { podeExcluirOuSolicitar } from '../lib/solicitacoes.js'
import { SecHeader, Btn, Modal, FormGrid, FG, Tag, Empty } from '../components/UI.jsx'
import { Plus, Pencil, Trash2, ChevronRight, Link2, Check } from 'lucide-react'

const LINK_FICHA = 'https://gestao.promessalagodospeixes.com.br/ficha'

// Campos gravados no banco (a tela inteira gira em torno desta lista)
const CAMPOS = [
  'nome', 'nome_exibicao', 'tel', 'email', 'situacao', 'obs',
  'nascimento', 'genero', 'estado_civil', 'naturalidade', 'cpf', 'rg', 'rg_emissor',
  'profissao', 'escolaridade', 'nome_mae', 'nome_pai',
  'cep', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'uf',
  'batizado', 'batismo_data', 'batismo_local', 'pastor_batismo',
  'batismo_es', 'igreja_anterior', 'como_conheceu',
]

const empty = CAMPOS.reduce((a, c) => ({ ...a, [c]: '' }), { situacao: 'Membro' })

const ESCOLARIDADE = ['Analfabeto', 'Ensino Fundamental Incompleto', 'Ensino Fundamental Completo',
  'Ensino Médio Incompleto', 'Ensino Médio Completo', 'Superior Incompleto', 'Superior Completo', 'Pós-graduação']
const ESTADO_CIVIL = ['Solteiro(a)', 'Casado(a)', 'União Estável', 'Divorciado(a)', 'Viúvo(a)']

// data do banco (2005-12-31) <-> input type=date
const paraInput = (v) => (v ? String(v).slice(0, 10) : '')

export default function Membros() {
  const { state, dispatch } = useStore()
  const { membros, funcoes, user } = state
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [aberto, setAberto] = useState(null)
  const [copiado, setCopiado] = useState(false)

  const copiarLink = () => {
    navigator.clipboard.writeText(LINK_FICHA).then(() => {
      setCopiado(true); setTimeout(() => setCopiado(false), 2500)
      dispatch({ type: 'TOAST', value: '🔗 Link copiado! Cole no WhatsApp da pessoa.' })
    }).catch(() => dispatch({ type: 'TOAST', value: '⚠ Copie o link na mão: ' + LINK_FICHA }))
  }

  const lista = q
    ? membros.filter(m => normalizar(m.nome).includes(normalizar(q)))
    : membros

  const getFuncoesMembro = (nome) => (funcoes || []).filter(f => (f.membros || []).includes(nome))

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const cpfRuim = String(form.cpf || '').length === 11 && !cpfValido(form.cpf)

  const abrir = (m = null) => {
    if (m) {
      const f = {}
      CAMPOS.forEach(c => {
        if (c === 'batizado') f[c] = m[c] === true ? 'sim' : m[c] === false ? 'nao' : ''
        else if (c === 'batismo_es') f[c] = !!m[c]
        else if (c === 'nascimento' || c === 'batismo_data') f[c] = paraInput(m[c])
        else f[c] = m[c] ?? ''
      })
      setForm(f)
    } else setForm(empty)
    setEditId(m?.id || null)
    setModal(true)
  }

  const onNomeBlur = (e) => {
    const n = toUpperName(e.target.value)
    setForm(f => ({ ...f, nome: n, nome_exibicao: f.nome_exibicao || primeiroUltimo(n) }))
  }

  const salvar = async () => {
    if (!form.nome) { dispatch({ type: 'TOAST', value: '⚠ Nome obrigatório.' }); return }
    if (!form.tel) { dispatch({ type: 'TOAST', value: '⚠ Telefone obrigatório.' }); return }
    const cpfLimpo = String(form.cpf || '').replace(/[^0-9]/g, '')
    if (cpfLimpo && !cpfValido(cpfLimpo)) { dispatch({ type: 'TOAST', value: '⚠ CPF não confere.' }); return }
    const repetido = cpfLimpo && membros.find(m => m.id !== editId && String(m.cpf || '').replace(/[^0-9]/g, '') === cpfLimpo)
    if (repetido) { dispatch({ type: 'TOAST', value: `⚠ Esse CPF já é de ${repetido.nome}.` }); return }
    setLoading(true)
    const nomeNovo = toUpperName(form.nome)
    const row = {}
    CAMPOS.forEach(c => {
      if (c === 'nome') row[c] = nomeNovo
      else if (c === 'batizado') row[c] = form[c] === 'sim' ? true : form[c] === 'nao' ? false : null
      else if (c === 'batismo_es') row[c] = !!form[c]
      else if (c === 'situacao') row[c] = form[c] || 'Membro'
      else if (c === 'cpf') row[c] = cpfLimpo || null
      else row[c] = form[c] === '' ? null : form[c]
    })
    if (editId) {
      const nomeAntigo = membros.find(m => m.id === editId)?.nome || ''
      await dbUpdate('membros', editId, row)
      if (nomeAntigo && nomeAntigo !== nomeNovo) {
        dispatch({ type: 'TOAST', value: '🔄 Atualizando referências...' })
        const { funcoesAtualizadas, gestoresAtualizado } = await cascadeRenomear(nomeAntigo, nomeNovo)
        if (funcoesAtualizadas) dispatch({ type: 'SET', key: 'funcoes', value: funcoesAtualizadas })
        if (gestoresAtualizado) dispatch({ type: 'SET', key: 'gestores', value: gestoresAtualizado })
      }
      dispatch({ type: 'SET', key: 'membros', value: membros.map(m => m.id === editId ? { ...m, ...row } : m) })
    } else {
      const novo = await dbInsert('membros', row)
      dispatch({ type: 'SET', key: 'membros', value: [...membros, { ...(novo || { id: Date.now() }), ...row }] })
    }
    setLoading(false); setModal(false)
    dispatch({ type: 'TOAST', value: editId ? '✅ Membro atualizado!' : '✅ Cadastrado!' })
  }

  const excluir = async (id, nome) => {
    const ok = await podeExcluirOuSolicitar(user, dispatch, { tabela: 'membros', registroId: id, descricao: `Excluir membro "${nome}"` })
    if (!ok) return
    await dbDelete('membros', id, nome)
    dispatch({ type: 'SET', key: 'membros', value: membros.filter(m => m.id !== id) })
    dispatch({ type: 'TOAST', value: '🗑 Removido.' })
  }

  // Ficha resumida que abre ao clicar no membro
  const Detalhe = ({ m }) => {
    const endereco = [m.endereco, m.numero, m.complemento].filter(Boolean).join(', ')
    const local = [m.bairro, m.cidade, m.uf].filter(Boolean).join(' - ')
    const linhas = [
      ['Nascimento', m.nascimento ? fmtBR(paraInput(m.nascimento)) : ''],
      ['Gênero', m.genero], ['Estado civil', m.estado_civil], ['Naturalidade', m.naturalidade],
      ['CPF', m.cpf ? cpfMascara(m.cpf) : ''], ['RG', [m.rg, m.rg_emissor].filter(Boolean).join(' / ')],
      ['Profissão', m.profissao], ['Escolaridade', m.escolaridade],
      ['Mãe', m.nome_mae], ['Pai', m.nome_pai],
      ['Endereço', endereco], ['Bairro / Cidade', local], ['CEP', m.cep],
      ['Batizado', m.batizado === true ? 'Sim' : m.batizado === false ? 'Não' : ''],
      ['Data do batismo', m.batismo_data ? fmtBR(paraInput(m.batismo_data)) : ''],
      ['Local do batismo', m.batismo_local], ['Pastor oficiante', m.pastor_batismo],
      ['Batismo no Espírito Santo', m.batismo_es ? 'Sim' : ''],
      ['Igreja anterior', m.igreja_anterior], ['Como conheceu', m.como_conheceu],
    ].filter(([, v]) => v)
    if (!linhas.length) return <div style={{ fontSize: 11.5, color: 'var(--g)', padding: '2px 0 10px' }}>Sem informações adicionais. Clique no lápis para preencher.</div>
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,190px),1fr))', gap: '6px 16px', padding: '4px 0 10px' }}>
        {linhas.map(([rot, v]) => (
          <div key={rot} style={{ fontSize: 12, borderBottom: '1px solid var(--bd)', padding: '5px 0' }}>
            <span style={{ color: 'var(--g)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>{rot}</span>
            <div style={{ color: 'var(--w)' }}>{v}</div>
          </div>
        ))}
      </div>
    )
  }

  const semFicha = membros.filter(m => !m.nascimento).length

  return (
    <div>
      <SecHeader title={`Membros (${membros.length})`} actions={isAdmin(user) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Btn variant="outline" onClick={copiarLink}>{copiado ? <Check size={15} /> : <Link2 size={15} />} {copiado ? 'Copiado!' : 'Link de cadastro'}</Btn>
          <Btn onClick={() => abrir()}><Plus size={15} /> Adicionar</Btn>
        </div>
      )} />
      {isAdmin(user) && (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 11.5, color: 'var(--g)', lineHeight: 1.6 }}>
          Para a pessoa se cadastrar sozinha, mande o link <strong style={{ color: 'var(--cy)', wordBreak: 'break-all' }}>{LINK_FICHA}</strong> — ela preenche a ficha e você aprova em <strong style={{ color: 'var(--w)' }}>Solicitações</strong>.
        </div>
      )}
      <input placeholder="🔍 Buscar membro..." value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 8 }} />
      {semFicha > 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--g)', marginBottom: 12 }}>
          {semFicha} {semFicha === 1 ? 'pessoa está' : 'pessoas estão'} sem data de nascimento — clique no nome para ver a ficha completa.
        </div>
      )}
      {lista.length === 0 ? <Empty icon="👥" text="Nenhum membro encontrado." /> : lista.map(m => {
        const fns = getFuncoesMembro(m.nome)
        const open = aberto === m.id
        return (
          <div key={m.id} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '12px 15px', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--s2)', border: '2px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: 'var(--cy)', flexShrink: 0 }}>{m.nome[0]}</div>
              <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setAberto(open ? null : m.id)}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--w)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <ChevronRight size={13} style={{ color: 'var(--g)', flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nome}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
                  <Tag color={m.situacao === 'Membro' ? 'cyan' : 'gray'}>{m.situacao}</Tag>
                  {fns.length > 0
                    ? fns.map(f => <Tag key={f.id} color="gray">{f.nome}</Tag>)
                    : <Tag color="red">Sem função</Tag>}
                </div>
                <div style={{ fontSize: 10, color: 'var(--g)', marginTop: 2 }}>
                  {m.tel || 'sem tel'}{m.email ? ' · ' + m.email : ''}
                  {m.nascimento ? ' · nasc. ' + fmtBR(paraInput(m.nascimento)) : ''}
                  {m.obs ? ' · ' + m.obs : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                {isAdmin(user) && <Btn variant="outline" size="xs" onClick={() => abrir(m)}><Pencil size={14} /></Btn>}
                {isAdmin(user) && <Btn variant="danger" size="xs" onClick={() => excluir(m.id, m.nome)}><Trash2 size={14} /></Btn>}
              </div>
            </div>
            {open && <Detalhe m={m} />}
          </div>
        )
      })}

      {modal && (
        <Modal title={editId ? 'Editar Membro' : 'Cadastro de Membro'} onClose={() => setModal(false)} wide
          footer={<><Btn variant="outline" onClick={() => setModal(false)}>Cancelar</Btn><Btn onClick={salvar} disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Btn></>}>

          <Titulo>Identificação</Titulo>
          <FormGrid>
            <FG full><label>Nome Completo *</label><input value={form.nome} onChange={e => set('nome', e.target.value)} onBlur={onNomeBlur} placeholder="Nome como consta no cadastro" /></FG>
            <FG full>
              <label>Nome de Exibição <span style={{ fontWeight: 400, color: 'var(--g)', fontSize: 10 }}>(como aparece nas escalas)</span></label>
              <input value={form.nome_exibicao} onChange={e => set('nome_exibicao', e.target.value)} placeholder={form.nome ? primeiroUltimo(form.nome) : 'Preenchido automaticamente ao digitar o nome'} />
            </FG>
            <FG><label>Data de nascimento</label><input type="date" value={form.nascimento} onChange={e => set('nascimento', e.target.value)} /></FG>
            <FG><label>Gênero</label><select value={form.genero} onChange={e => set('genero', e.target.value)}><option value="">—</option><option>Feminino</option><option>Masculino</option></select></FG>
            <FG><label>Estado civil</label><select value={form.estado_civil} onChange={e => set('estado_civil', e.target.value)}><option value="">—</option>{ESTADO_CIVIL.map(x => <option key={x}>{x}</option>)}</select></FG>
            <FG><label>Naturalidade</label><input value={form.naturalidade} onChange={e => set('naturalidade', e.target.value)} placeholder="Cidade onde nasceu" /></FG>
            <FG>
              <label>CPF</label>
              <input value={cpfMascara(form.cpf)} onChange={e => set('cpf', e.target.value.replace(/[^0-9]/g, '').slice(0, 11))}
                inputMode="numeric" placeholder="000.000.000-00" style={cpfRuim ? { borderColor: 'var(--red)' } : undefined} />
              {cpfRuim && <div style={{ fontSize: 10, color: 'var(--red)' }}>CPF não confere — confira os números.</div>}
            </FG>
            <FG><label>RG</label><input value={form.rg} onChange={e => set('rg', e.target.value)} /></FG>
            <FG><label>Órgão emissor</label><input value={form.rg_emissor} onChange={e => set('rg_emissor', e.target.value)} placeholder="DETRAN, IFP/RJ..." /></FG>
            <FG><label>Profissão</label><input value={form.profissao} onChange={e => set('profissao', e.target.value)} /></FG>
            <FG full><label>Escolaridade</label><select value={form.escolaridade} onChange={e => set('escolaridade', e.target.value)}><option value="">—</option>{ESCOLARIDADE.map(x => <option key={x}>{x}</option>)}</select></FG>
            <FG><label>Nome da mãe</label><input value={form.nome_mae} onChange={e => set('nome_mae', e.target.value)} /></FG>
            <FG><label>Nome do pai</label><input value={form.nome_pai} onChange={e => set('nome_pai', e.target.value)} /></FG>
          </FormGrid>

          <Titulo>Contato</Titulo>
          <FormGrid>
            <FG><label>Telefone *</label><input value={form.tel} onChange={e => set('tel', e.target.value)} placeholder="21 99999-9999" /></FG>
            <FG><label>Email</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></FG>
          </FormGrid>

          <Titulo>Endereço</Titulo>
          <FormGrid>
            <FG><label>CEP</label><input value={form.cep} onChange={e => set('cep', e.target.value)} inputMode="numeric" /></FG>
            <FG><label>Rua</label><input value={form.endereco} onChange={e => set('endereco', e.target.value)} /></FG>
            <FG><label>Número</label><input value={form.numero} onChange={e => set('numero', e.target.value)} /></FG>
            <FG><label>Complemento</label><input value={form.complemento} onChange={e => set('complemento', e.target.value)} placeholder="Casa 1, apto..." /></FG>
            <FG><label>Bairro</label><input value={form.bairro} onChange={e => set('bairro', e.target.value)} /></FG>
            <FG><label>Cidade</label><input value={form.cidade} onChange={e => set('cidade', e.target.value)} /></FG>
            <FG><label>UF</label><input value={form.uf} onChange={e => set('uf', e.target.value.toUpperCase().slice(0, 2))} maxLength={2} /></FG>
          </FormGrid>

          <Titulo>Vida na igreja</Titulo>
          <FormGrid>
            <FG full>
              <label>Situação</label>
              <select value={form.situacao} onChange={e => set('situacao', e.target.value)}><option>Membro</option><option>Frequentante</option></select>
              <div style={{ fontSize: 10, color: 'var(--g)' }}>Membro = batizado e recebido na igreja. Frequentante = participa mas ainda não é membro (crianças, visitantes).</div>
            </FG>
            <FG><label>Batizado nas águas</label><select value={form.batizado} onChange={e => set('batizado', e.target.value)}><option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option></select></FG>
            <FG><label>Data do batismo</label><input type="date" value={form.batismo_data} onChange={e => set('batismo_data', e.target.value)} /></FG>
            <FG><label>Local do batismo</label><input value={form.batismo_local} onChange={e => set('batismo_local', e.target.value)} /></FG>
            <FG><label>Pastor oficiante</label><input value={form.pastor_batismo} onChange={e => set('pastor_batismo', e.target.value)} /></FG>
            <FG full style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="bes" checked={!!form.batismo_es} onChange={e => set('batismo_es', e.target.checked)} style={{ width: 16, height: 16, margin: 0 }} />
              <label htmlFor="bes" style={{ margin: 0, cursor: 'pointer' }}>Batizado no Espírito Santo</label>
            </FG>
            <FG><label>Igreja anterior</label><input value={form.igreja_anterior} onChange={e => set('igreja_anterior', e.target.value)} /></FG>
            <FG><label>Como conheceu a igreja</label><input value={form.como_conheceu} onChange={e => set('como_conheceu', e.target.value)} /></FG>
            <FG full><label>Observações</label><input value={form.obs} onChange={e => set('obs', e.target.value)} placeholder="Plantão, restrições..." /></FG>
          </FormGrid>
        </Modal>
      )}
    </div>
  )
}

function Titulo({ children }) {
  return <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--cy)', textTransform: 'uppercase', letterSpacing: '.07em', margin: '16px 0 8px', paddingBottom: 5, borderBottom: '1px solid var(--bd)' }}>{children}</div>
}
