import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbUpdate, dbDelete } from '../lib/supabase.js'
import { cascadeRenomear } from '../lib/cascadeRename.js'
import { isAdmin, normalizar, toUpperName, primeiroUltimo } from '../lib/utils.js'
import { podeExcluirOuSolicitar } from '../lib/solicitacoes.js'
import { SecHeader, Btn, Modal, FormGrid, FG, Tag, Empty } from '../components/UI.jsx'

const empty = { nome:'', nome_exibicao:'', tel:'', email:'', situacao:'Membro', obs:'' }

export default function Membros() {
  const { state, dispatch } = useStore()
  const { membros, funcoes, user } = state
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [verFuncoes, setVerFuncoes] = useState(null)

  const lista = q
    ? membros.filter(m => normalizar(m.nome).includes(normalizar(q)))
    : membros

  // Get functions for a member
  const getFuncoesMembro = (nome) => (funcoes||[]).filter(f => (f.membros||[]).includes(nome))

  const abrir = (m = null) => {
    setForm(m ? { nome:m.nome, nome_exibicao:m.nome_exibicao||'', tel:m.tel||'', email:m.email||'', situacao:m.situacao, obs:m.obs||'' } : empty)
    setEditId(m?.id || null)
    setModal(true)
  }

  // Quando nome completo é preenchido, sugere encurtamento automático
  const onNomeBlur = (e) => {
    const n = toUpperName(e.target.value)
    setForm(f => ({ ...f, nome: n, nome_exibicao: f.nome_exibicao || primeiroUltimo(n) }))
  }

  const salvar = async () => {
    if (!form.nome) { dispatch({ type:'TOAST', value:'⚠ Nome obrigatório.' }); return }
    if (!form.tel) { dispatch({ type:'TOAST', value:'⚠ Telefone obrigatório.' }); return }
    setLoading(true)
    const nomeNovo = toUpperName(form.nome)
    const row = { nome: nomeNovo, nome_exibicao:form.nome_exibicao||null, tel:form.tel, email:form.email||'', situacao:form.situacao, obs:form.obs }
    if (editId) {
      const membroAtual = membros.find(m => m.id === editId)
      const nomeAntigo = membroAtual?.nome || ''
      await dbUpdate('membros', editId, row)
      // Se o nome mudou, propaga a alteração em todas as tabelas
      if (nomeAntigo && nomeAntigo !== nomeNovo) {
        dispatch({ type:'TOAST', value:'🔄 Atualizando referências...' })
        const { funcoesAtualizadas, gestoresAtualizado } = await cascadeRenomear(nomeAntigo, nomeNovo)
        if (funcoesAtualizadas) dispatch({ type:'SET', key:'funcoes', value: funcoesAtualizadas })
        if (gestoresAtualizado) dispatch({ type:'SET', key:'gestores', value: gestoresAtualizado })
      }
      dispatch({ type:'SET', key:'membros', value: membros.map(m => m.id===editId ? {...m,...row} : m) })
    } else {
      const novo = await dbInsert('membros', row)
      dispatch({ type:'SET', key:'membros', value: [...membros, {...(novo||{id:Date.now()}),...row}] })
    }
    setLoading(false); setModal(false)
    dispatch({ type:'TOAST', value: editId ? '✅ Membro atualizado!' : '✅ Cadastrado!' })
  }

  const excluir = async (id, nome) => {
    const ok = await podeExcluirOuSolicitar(user, dispatch, { tabela:'membros', registroId:id, descricao:`Excluir membro "${nome}"` })
    if (!ok) return
    await dbDelete('membros', id, nome)
    dispatch({ type:'SET', key:'membros', value: membros.filter(m => m.id !== id) })
    dispatch({ type:'TOAST', value:'🗑 Removido.' })
  }

  return (
    <div>
      <SecHeader title={`MEMBROS (${membros.length})`} actions={isAdmin(user) && <Btn onClick={() => abrir()}>+ Adicionar</Btn>} />
      <input placeholder="🔍 Buscar membro..." value={q} onChange={e=>setQ(e.target.value)} style={{marginBottom:14}} />
      {lista.length === 0 ? <Empty icon="👥" text="Nenhum membro encontrado." /> : lista.map(m => {
        const fns = getFuncoesMembro(m.nome)
        return (
          <div key={m.id} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,padding:'12px 15px',display:'flex',alignItems:'center',gap:11,marginBottom:8}}>
            <div style={{width:34,height:34,borderRadius:'50%',background:'var(--s2)',border:'2px solid var(--bd)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12,color:'var(--cy)',flexShrink:0}}>{m.nome[0]}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:'var(--w)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.nome}</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:3,marginTop:3}}>
                <Tag color={m.situacao==='Membro'?'cyan':'gray'}>{m.situacao}</Tag>
                {fns.length > 0
                  ? fns.map(f => <Tag key={f.id} color="gray">{f.nome}</Tag>)
                  : <Tag color="red">Sem função</Tag>
                }
              </div>
              <div style={{fontSize:10,color:'var(--g)',marginTop:2}}>{m.tel||'sem tel'}{m.email?' · '+m.email:''}{m.obs?' · '+m.obs:''}</div>
            </div>
            <div style={{display:'flex',gap:5,flexShrink:0}}>
              {isAdmin(user) && <Btn variant="outline" size="xs" onClick={()=>abrir(m)}>✏</Btn>}
              {isAdmin(user) && <Btn variant="danger" size="xs" onClick={()=>excluir(m.id, m.nome)}>🗑</Btn>}
            </div>
          </div>
        )
      })}

      {modal && (
        <Modal title={editId?'EDITAR MEMBRO':'CADASTRO DE MEMBRO'} onClose={()=>setModal(false)} wide
          footer={<><Btn variant="outline" onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={salvar} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <FormGrid>
            <FG full><label>Nome Completo *</label><input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} onBlur={onNomeBlur} placeholder="Nome como consta no cadastro" /></FG>
            <FG full>
              <label>Nome de Exibição <span style={{fontWeight:400,color:'var(--g)',fontSize:10}}>(como aparece nas escalas)</span></label>
              <input value={form.nome_exibicao} onChange={e=>setForm({...form,nome_exibicao:e.target.value})} placeholder={form.nome ? primeiroUltimo(form.nome) : 'Preenchido automaticamente ao digitar o nome'} />
              {form.nome && !form.nome_exibicao && <div style={{fontSize:10,color:'var(--g)',marginTop:3}}>💡 Sugestão: <strong style={{color:'var(--cy)'}}>{primeiroUltimo(form.nome)}</strong> — deixe em branco para usar ou escreva o que preferir.</div>}
            </FG>
            <FG><label>Telefone *</label><input value={form.tel} onChange={e=>setForm({...form,tel:e.target.value})} placeholder="21 99999-9999" /></FG>
            <FG><label>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></FG>
            <FG><label>Situação</label><select value={form.situacao} onChange={e=>setForm({...form,situacao:e.target.value})}><option>Membro</option><option>Frequentante</option></select></FG>
            <FG full><label>Observações</label><input value={form.obs} onChange={e=>setForm({...form,obs:e.target.value})} placeholder="Plantão, restrições..." /></FG>
          </FormGrid>
        </Modal>
      )}
    </div>
  )
}
