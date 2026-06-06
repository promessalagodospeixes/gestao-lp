import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbDelete } from '../lib/supabase.js'
import { MESES_A, fmtBR, isAdmin } from '../lib/utils.js'
import { SecHeader, Btn, Modal, FormGrid, FG, Tag, Empty } from '../components/UI.jsx'

const TIPOS = ['Culto','Evento Social','Evento Regional','Vigília','Ceia','Entre Amigos','Outro']
const TAG_COLORS = { Culto:'cyan', Vigília:'yellow', Ceia:'cyan', 'Evento Social':'green', 'Evento Regional':'cyan', 'Entre Amigos':'green', Outro:'gray' }
const empty = { data:'', hora:'', titulo:'', descricao:'', tipo:'Culto' }

export default function Agenda() {
  const { state, dispatch } = useStore()
  const { agenda, user } = state
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(false)

  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const lista = [...(agenda||[])].sort((a,b)=>a.data.localeCompare(b.data))

  const salvar = async () => {
    if (!form.titulo || !form.data) { dispatch({ type:'TOAST', value:'⚠ Título e data obrigatórios.' }); return }
    setLoading(true)
    const row = { data:form.data, hora:form.hora, titulo:form.titulo, descricao:form.descricao, tipo:form.tipo }
    const novo = await dbInsert('agenda', row)
    dispatch({ type:'SET', key:'agenda', value:[...(agenda||[]), {...(novo||{id:Date.now()}),...row,desc:row.descricao}] })
    setLoading(false); setModal(false); setForm(empty)
    dispatch({ type:'TOAST', value:'📅 Evento adicionado!' })
  }

  const excluir = async (id) => {
    await dbDelete('agenda', id)
    dispatch({ type:'SET', key:'agenda', value:(agenda||[]).filter(a=>a.id!==id) })
    dispatch({ type:'TOAST', value:'🗑 Removido.' })
  }

  return (
    <div>
      <SecHeader title="AGENDA" actions={isAdmin(user) && <Btn onClick={()=>{setForm({...empty,data:new Date().toISOString().slice(0,10)});setModal(true)}}>+ Evento</Btn>} />
      {lista.length===0 ? <Empty icon="📅" text="Nenhum evento cadastrado." /> : lista.map(ev => {
        const d = new Date(ev.data+'T00:00:00')
        const passado = d < hoje
        return (
          <div key={ev.id} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'11px 0',borderBottom:'1px solid var(--bd)',opacity:passado?.4:1}}>
            <div style={{background:'var(--cdim)',border:'1px solid var(--cgl)',borderRadius:8,padding:'5px 9px',textAlign:'center',flexShrink:0,minWidth:46}}>
              <div style={{fontFamily:'var(--font-display)',fontSize:20,color:'var(--cy)',lineHeight:1}}>{d.getDate()}</div>
              <div style={{fontSize:8,color:'var(--cy)',letterSpacing:2,textTransform:'uppercase'}}>{MESES_A[d.getMonth()]} {d.getFullYear()}</div>
            </div>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                <div style={{fontSize:13,fontWeight:600,color:'var(--w)'}}>{ev.titulo}</div>
                <Tag color={TAG_COLORS[ev.tipo]||'gray'}>{ev.tipo}</Tag>
              </div>
              <div style={{fontSize:11,color:'var(--g)',marginTop:2}}>{ev.hora?ev.hora+' · ':''}{ev.desc||ev.descricao||''}</div>
            </div>
            {isAdmin(user) && <Btn variant="danger" size="xs" onClick={()=>excluir(ev.id)}>🗑</Btn>}
          </div>
        )
      })}
      {modal && (
        <Modal title="NOVO EVENTO" onClose={()=>setModal(false)}
          footer={<><Btn variant="outline" onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={salvar} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <FormGrid>
            <FG><label>Data</label><input type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})} /></FG>
            <FG><label>Horário</label><input type="time" value={form.hora} onChange={e=>setForm({...form,hora:e.target.value})} /></FG>
            <FG full><label>Título</label><input value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})} /></FG>
            <FG full><label>Descrição</label><textarea value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})} /></FG>
            <FG><label>Tipo</label><select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}>{TIPOS.map(t=><option key={t}>{t}</option>)}</select></FG>
          </FormGrid>
        </Modal>
      )}
    </div>
  )
}
