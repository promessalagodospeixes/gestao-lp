import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbDelete } from '../lib/supabase.js'
import { isPastor, waLink } from '../lib/utils.js'
import { SecHeader, Btn, Modal, FormGrid, FG, Empty } from '../components/UI.jsx'

const empty = { cargo:'', nome:'', tel:'', email:'' }

export default function Lideranca() {
  const { state, dispatch } = useStore()
  const { lideranca, user } = state
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(false)

  const salvar = async () => {
    if (!form.nome) { dispatch({ type:'TOAST', value:'⚠ Nome obrigatório.' }); return }
    setLoading(true)
    const novo = await dbInsert('lideranca', form)
    dispatch({ type:'SET', key:'lideranca', value:[...lideranca, novo||{id:Date.now(),...form}] })
    setLoading(false); setModal(false); setForm(empty)
    dispatch({ type:'TOAST', value:'✅ Líder cadastrado!' })
  }

  const excluir = async (id) => {
    await dbDelete('lideranca', id)
    dispatch({ type:'SET', key:'lideranca', value:lideranca.filter(l=>l.id!==id) })
    dispatch({ type:'TOAST', value:'🗑 Removido.' })
  }

  return (
    <div>
      <SecHeader title="LIDERANÇA" actions={<Btn onClick={()=>{setForm(empty);setModal(true)}}>+ Cadastrar</Btn>} />
      {lideranca.length===0 ? <Empty icon="👑" text="Nenhum líder cadastrado." /> : lideranca.map(l => (
        <div key={l.id} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,padding:'13px 15px',display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
          <div style={{width:36,height:36,borderRadius:'50%',background:'var(--cdim)',border:'2px solid var(--cy)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-display)',fontSize:14,color:'var(--cy)',flexShrink:0}}>{l.nome[0]}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:9,color:'var(--cy)',letterSpacing:2,textTransform:'uppercase'}}>{l.cargo}</div>
            <div style={{fontSize:13,fontWeight:700,color:'var(--w)',marginTop:1}}>{l.nome}</div>
            {l.email && <div style={{fontSize:11,color:'var(--g)'}}>{l.email}</div>}
            {l.tel && <a href={waLink(l.tel,`Olá ${l.nome}!`)} target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 10px',background:'rgba(34,197,94,.12)',border:'1px solid rgba(34,197,94,.3)',borderRadius:6,color:'var(--grn)',textDecoration:'none',fontSize:11,fontWeight:600,marginTop:5}}>💬 WhatsApp</a>}
          </div>
          {isPastor(user) && <Btn variant="danger" size="xs" onClick={()=>excluir(l.id)}>🗑</Btn>}
        </div>
      ))}
      {modal && (
        <Modal title="CADASTRAR LÍDER" onClose={()=>setModal(false)}
          footer={<><Btn variant="outline" onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={salvar} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <FormGrid>
            <FG full><label>Cargo</label><input value={form.cargo} onChange={e=>setForm({...form,cargo:e.target.value})} placeholder="Pastor, Secretário, Diácono..." /></FG>
            <FG full><label>Nome</label><input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} /></FG>
            <FG><label>Telefone</label><input value={form.tel} onChange={e=>setForm({...form,tel:e.target.value})} placeholder="21 99999-9999" /></FG>
            <FG><label>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></FG>
          </FormGrid>
        </Modal>
      )}
    </div>
  )
}
