import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbDelete } from '../lib/supabase.js'
import { PERFIL_LABEL } from '../lib/utils.js'
import { SecHeader, Btn, Modal, FormGrid, FG, Tag, Empty } from '../components/UI.jsx'

const empty = { nome:'', login:'', senha:'', perfil:'membro', email:'' }

export default function Usuarios() {
  const { state, dispatch } = useStore()
  const { usuarios } = state
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(false)

  const salvar = async () => {
    if (!form.nome||!form.login||!form.senha) { dispatch({ type:'TOAST', value:'⚠ Preencha todos os campos.' }); return }
    setLoading(true)
    const novo = await dbInsert('usuarios', form)
    dispatch({ type:'SET', key:'usuarios', value:[...(usuarios||[]), novo||{id:Date.now(),...form}] })
    setLoading(false); setModal(false); setForm(empty)
    dispatch({ type:'TOAST', value:'✅ Usuário criado!' })
  }

  const excluir = async (id) => {
    await dbDelete('usuarios', id)
    dispatch({ type:'SET', key:'usuarios', value:(usuarios||[]).filter(u=>u.id!==id) })
    dispatch({ type:'TOAST', value:'🗑 Removido.' })
  }

  return (
    <div>
      <SecHeader title="USUÁRIOS" actions={<Btn onClick={()=>{setForm(empty);setModal(true)}}>+ Novo</Btn>} />
      <div style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr>{['Nome','Login','Perfil','Email',''].map(h=><th key={h} style={{background:'var(--s2)',padding:'8px 13px',textAlign:'left',fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:2,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
          <tbody>
            {(usuarios||[]).map(u=>(
              <tr key={u.id} style={{borderTop:'1px solid var(--bd)'}}>
                <td style={{padding:'9px 13px',fontSize:12,fontWeight:600,color:'var(--w)'}}>{u.nome}</td>
                <td style={{padding:'9px 13px',fontSize:12,color:'var(--cy)'}}>{u.login}</td>
                <td style={{padding:'9px 13px'}}><Tag color="cyan">{PERFIL_LABEL[u.perfil]||u.perfil}</Tag></td>
                <td style={{padding:'9px 13px',fontSize:11,color:'var(--g)'}}>{u.email||'—'}</td>
                <td style={{padding:'9px 13px'}}>{u.perfil!=='pastor'&&<Btn variant="danger" size="xs" onClick={()=>excluir(u.id)}>🗑</Btn>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title="NOVO USUÁRIO" onClose={()=>setModal(false)}
          footer={<><Btn variant="outline" onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={salvar} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <FormGrid>
            <FG full><label>Nome</label><input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} /></FG>
            <FG><label>Login</label><input value={form.login} onChange={e=>setForm({...form,login:e.target.value})} placeholder="Telefone ou apelido" /></FG>
            <FG><label>Senha</label><input type="password" value={form.senha} onChange={e=>setForm({...form,senha:e.target.value})} /></FG>
            <FG><label>Perfil</label>
              <select value={form.perfil} onChange={e=>setForm({...form,perfil:e.target.value})}>
                {Object.entries(PERFIL_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </FG>
            <FG><label>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></FG>
          </FormGrid>
        </Modal>
      )}
    </div>
  )
}
