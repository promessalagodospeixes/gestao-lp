import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbDelete } from '../lib/supabase.js'
import { isAdmin } from '../lib/utils.js'
import { podeExcluirOuSolicitar } from '../lib/solicitacoes.js'
import { SecHeader, Btn, Modal, FormGrid, FG, Tag, Empty } from '../components/UI.jsx'

const empty = { titulo:'', msg:'', prioridade:'Normal' }
const PRIO_COLOR = { Urgente:'red', Normal:'gray', Informativo:'cyan' }

export default function Avisos() {
  const { state, dispatch } = useStore()
  const { avisos, user } = state
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(false)

  const salvar = async () => {
    if (!form.titulo) { dispatch({ type:'TOAST', value:'⚠ Informe o título.' }); return }
    setLoading(true)
    const row = { ...form, data: new Date().toISOString().slice(0,10) }
    const novo = await dbInsert('avisos', row)
    dispatch({ type:'SET', key:'avisos', value:[novo||{id:Date.now(),...row}, ...(avisos||[])] })
    setLoading(false); setModal(false); setForm(empty)
    dispatch({ type:'TOAST', value:'📢 Publicado!' })
  }

  const excluir = async (id, titulo) => {
    const ok = await podeExcluirOuSolicitar(user, dispatch, { tabela:'avisos', registroId:id, descricao:`Excluir aviso "${titulo}"` })
    if (!ok) return
    await dbDelete('avisos', id)
    dispatch({ type:'SET', key:'avisos', value:(avisos||[]).filter(a=>a.id!==id) })
    dispatch({ type:'TOAST', value:'🗑 Removido.' })
  }

  return (
    <div>
      <SecHeader title="AVISOS" actions={isAdmin(user) && <Btn onClick={()=>{setForm(empty);setModal(true)}}>+ Aviso</Btn>} />
      {(avisos||[]).length===0 ? <Empty icon="📢" text="Nenhum aviso." /> : (avisos||[]).map(av => (
        <div key={av.id} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,padding:'13px 15px',marginBottom:9}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:6}}>
            <Tag color={PRIO_COLOR[av.prioridade]||'gray'}>{av.prioridade}</Tag>
            <strong style={{color:'var(--w)',fontSize:13}}>{av.titulo}</strong>
            <span style={{marginLeft:'auto',fontSize:10,color:'var(--g)'}}>{av.data}</span>
            {isAdmin(user) && <Btn variant="danger" size="xs" onClick={()=>excluir(av.id, av.titulo)}>🗑</Btn>}
          </div>
          <div style={{fontSize:13,color:'var(--tx)'}}>{av.msg}</div>
        </div>
      ))}
      {modal && (
        <Modal title="NOVO AVISO" onClose={()=>setModal(false)}
          footer={<><Btn variant="outline" onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={salvar} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <FormGrid>
            <FG full><label>Título</label><input value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})} /></FG>
            <FG full><label>Mensagem</label><textarea value={form.msg} onChange={e=>setForm({...form,msg:e.target.value})} /></FG>
            <FG><label>Prioridade</label><select value={form.prioridade} onChange={e=>setForm({...form,prioridade:e.target.value})}><option>Normal</option><option>Urgente</option><option>Informativo</option></select></FG>
          </FormGrid>
        </Modal>
      )}
    </div>
  )
}
