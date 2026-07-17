import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { sb } from '../lib/supabase.js'
import { dbInsert, dbDelete } from '../lib/supabase.js'
import { logAudit } from '../lib/auditoria.js'
import { PERFIL_LABEL } from '../lib/utils.js'
import { SecHeader, Btn, Modal, FormGrid, FG, Tag, Empty } from '../components/UI.jsx'

const empty = { nome:'', login:'', senha:'', perfil:'membro', email:'', cpf:'', tel:'' }

export default function Usuarios() {
  const { state, dispatch } = useStore()
  const { usuarios, user } = state
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(empty)
  const [novaSenha, setNovaSenha] = useState('')
  const [loading, setLoading] = useState(false)

  const abrirNovo = () => { setForm(empty); setEditId(null); setNovaSenha(''); setModal(true) }
  const abrirEditar = (u) => {
    setForm({ nome:u.nome||'', login:u.login||'', senha:'', perfil:u.perfil||'membro', email:u.email||'', cpf:u.cpf||'', tel:u.tel||'' })
    setEditId(u.id); setNovaSenha(''); setModal(true)
  }

  const salvar = async () => {
    if (!form.nome || (!editId && !form.login) || (!editId && !form.senha)) {
      dispatch({ type:'TOAST', value:'⚠ Preencha nome, login e senha.' }); return
    }
    setLoading(true)
    if (editId) {
      const updates = { nome:form.nome, login:form.login, perfil:form.perfil, email:form.email||null, cpf:form.cpf||null, tel:form.tel||null }
      if (novaSenha) updates.senha = novaSenha
      await sb.from('usuarios').update(updates).eq('id', editId)
      dispatch({ type:'SET', key:'usuarios', value:(usuarios||[]).map(u=>u.id===editId?{...u,...updates}:u) })
      await logAudit(user, 'USUARIO_EDITADO', `Editou usuário: ${form.nome}`)
      dispatch({ type:'TOAST', value:'✅ Usuário atualizado!' })
    } else {
      const row = { nome:form.nome, login:form.login, senha:form.senha, perfil:form.perfil, email:form.email||null, cpf:form.cpf||null, tel:form.tel||null }
      const novo = await dbInsert('usuarios', row)
      dispatch({ type:'SET', key:'usuarios', value:[...(usuarios||[]), novo||{id:Date.now(),...row}] })
      await logAudit(user, 'USUARIO_CRIADO', `Criou usuário: ${form.nome} (${form.perfil})`)
      dispatch({ type:'TOAST', value:'✅ Usuário criado!' })
    }
    setLoading(false); setModal(false); setForm(empty)
  }

  const excluir = async (u) => {
    if (!window.confirm(`Excluir o usuário "${u.nome}"? Esta ação não pode ser desfeita.`)) return
    await dbDelete('usuarios', u.id)
    dispatch({ type:'SET', key:'usuarios', value:(usuarios||[]).filter(x=>x.id!==u.id) })
    await logAudit(user, 'USUARIO_EXCLUIDO', `Excluiu usuário: ${u.nome}`)
    dispatch({ type:'TOAST', value:'🗑 Removido.' })
  }

  return (
    <div>
      <SecHeader title="USUÁRIOS" actions={<Btn onClick={abrirNovo}>+ Novo</Btn>} />
      {(usuarios||[]).length === 0
        ? <Empty icon="🔐" text="Nenhum usuário cadastrado." />
        : (
          <div style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['Nome','Login','Perfil','CPF / Tel / Email',''].map(h=><th key={h} style={{background:'var(--s2)',padding:'8px 13px',textAlign:'left',fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:2,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
              <tbody>
                {(usuarios||[]).map(u=>(
                  <tr key={u.id} style={{borderTop:'1px solid var(--bd)'}}>
                    <td style={{padding:'9px 13px',fontSize:12,fontWeight:600,color:'var(--w)'}}>{u.nome}</td>
                    <td style={{padding:'9px 13px',fontSize:12,color:'var(--cy)'}}>{u.login}</td>
                    <td style={{padding:'9px 13px'}}><Tag color="cyan">{PERFIL_LABEL[u.perfil]||u.perfil}</Tag></td>
                    <td style={{padding:'9px 13px',fontSize:11,color:'var(--g)'}}>
                      {[u.cpf, u.tel, u.email].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td style={{padding:'9px 13px',display:'flex',gap:5}}>
                      <Btn variant="outline" size="xs" onClick={()=>abrirEditar(u)}>✏</Btn>
                      {u.perfil!=='pastor'&&<Btn variant="danger" size="xs" onClick={()=>excluir(u)}>🗑</Btn>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }

      {modal && (
        <Modal title={editId?'EDITAR USUÁRIO':'NOVO USUÁRIO'} onClose={()=>setModal(false)}
          footer={<><Btn variant="outline" onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={salvar} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <FormGrid>
            <FG full><label>Nome</label><input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} /></FG>
            <FG><label>CPF</label><input value={form.cpf} onChange={e=>setForm({...form,cpf:e.target.value})} placeholder="000.000.000-00" /></FG>
            <FG><label>Telefone / WhatsApp</label><input value={form.tel} onChange={e=>setForm({...form,tel:e.target.value})} placeholder="21 99999-9999" /></FG>
            <FG full><label>E-mail</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></FG>
            <FG><label>Login (apelido)</label><input value={form.login} onChange={e=>setForm({...form,login:e.target.value})} placeholder="Ex: gabriel" /></FG>
            <FG><label>{editId?'Nova Senha (deixe vazio p/ manter)':'Senha'}</label>
              <input type="password" value={editId?novaSenha:form.senha}
                onChange={e=>editId?setNovaSenha(e.target.value):setForm({...form,senha:e.target.value})} />
            </FG>
            <FG><label>Perfil</label>
              <select value={form.perfil} onChange={e=>setForm({...form,perfil:e.target.value})}>
                {Object.entries(PERFIL_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </FG>
          </FormGrid>
        </Modal>
      )}
    </div>
  )
}
