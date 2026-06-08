import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbUpdate, dbDelete } from '../lib/supabase.js'
import { isPastor, isAdmin, normalizar, toUpperName } from '../lib/utils.js'
import { SecHeader, Btn, Modal, FormGrid, FG, Tag, Empty } from '../components/UI.jsx'

const empty = { nome:'', tel:'', email:'', situacao:'Membro', obs:'' }

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
    setForm(m ? { nome:m.nome, tel:m.tel||'', email:m.email||'', situacao:m.situacao, obs:m.obs||'' } : empty)
    setEditId(m?.id || null)
    setModal(true)
  }

  const salvar = async () => {
    if (!form.nome) { dispatch({ type:'TOAST', value:'⚠ Nome obrigatório.' }); return }
    if (!form.tel) { dispatch({ type:'TOAST', value:'⚠ Telefone obrigatório.' }); return }
    setLoading(true)
    const row = { nome:toUpperName(form.nome), tel:form.tel, email:form.email||'', situacao:form.situacao, obs:form.obs }
    if (editId) {
      await dbUpdate('membros', editId, row)
      dispatch({ type:'SET', key:'membros', value: membros.map(m => m.id===editId ? {...m,...row} : m) })
    } else {
      const novo = await dbInsert('membros', row)
      dispatch({ type:'SET', key:'membros', value: [...membros, {...(novo||{id:Date.now()}),...row}] })
    }
    setLoading(false); setModal(false)
    dispatch({ type:'TOAST', value: editId ? '✅ Atualizado!' : '✅ Cadastrado!' })
  }

  const excluir = async (id) => {
    if (!isPastor(user)) { dispatch({ type:'TOAST', value:'⛔ Sem permissão.' }); return }
    await dbDelete('membros', id)
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
              {isPastor(user) && <Btn variant="danger" size="xs" onClick={()=>excluir(m.id)}>🗑</Btn>}
            </div>
          </div>
        )
      })}

      {modal && (
        <Modal title={editId?'EDITAR MEMBRO':'CADASTRO DE MEMBRO'} onClose={()=>setModal(false)} wide
          footer={<><Btn variant="outline" onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={salvar} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <FormGrid>
            <FG full><label>Nome Completo *</label><input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} onBlur={e=>setForm({...form,nome:toUpperName(e.target.value)})} /></FG>
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
