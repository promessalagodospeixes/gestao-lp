import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbDelete } from '../lib/supabase.js'
import { SecHeader, Btn, Modal, FormGrid, FG, Empty } from '../components/UI.jsx'

const DIAS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

export default function Devocional() {
  const { state, dispatch } = useStore()
  const { devocionais, respostas, user } = state
  const isProf = ['pastor','secretario','professor'].includes(user?.perfil)

  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const dw = hoje.getDay()
  const seg = new Date(hoje); seg.setDate(hoje.getDate()-(dw===0?6:dw-1))
  const sex = new Date(seg); sex.setDate(seg.getDate()+4)
  const dvs = (devocionais||[]).filter(d=>{const dd=new Date(d.data+'T00:00:00');return dd>=seg&&dd<=sex}).sort((a,b)=>a.data.localeCompare(b.data))

  const [modal, setModal] = useState(false)
  const [modalR, setModalR] = useState(null)
  const [form, setForm] = useState({ data:new Date().toISOString().slice(0,10), titulo:'', referencia:'', texto:'', link:'' })
  const [comentario, setComentario] = useState('')
  const [loading, setLoading] = useState(false)

  const salvar = async () => {
    if (!form.titulo) { dispatch({ type:'TOAST', value:'⚠ Informe o título.' }); return }
    setLoading(true)
    const novo = await dbInsert('devocionais', form)
    dispatch({ type:'SET', key:'devocionais', value:[...(devocionais||[]), novo||{id:Date.now(),...form}] })
    setLoading(false); setModal(false)
    dispatch({ type:'TOAST', value:'📿 Devocional publicado!' })
  }

  const marcarFeito = async () => {
    if (!modalR) return
    const row = { devocional_id:modalR.id, usuario_id:user?.id, nome_user:user?.nome, comentario, data:new Date().toISOString().slice(0,10) }
    const novo = await dbInsert('devocionais_respostas', row)
    dispatch({ type:'SET', key:'respostas', value:[...(respostas||[]).filter(r=>!(r.devocional_id===modalR.id&&r.usuario_id===user?.id)), novo||{id:Date.now(),...row}] })
    setModalR(null); setComentario('')
    dispatch({ type:'TOAST', value:'✅ Devocional feito!' })
  }

  const excluir = async (id) => {
    await dbDelete('devocionais', id)
    dispatch({ type:'SET', key:'devocionais', value:(devocionais||[]).filter(d=>d.id!==id) })
  }

  return (
    <div>
      <SecHeader title="DEVOCIONAL DA SEMANA" actions={isProf && <Btn onClick={()=>setModal(true)}>+ Novo</Btn>} />
      {dvs.length===0 ? <Empty icon="📿" text="Nenhum devocional publicado esta semana." /> : dvs.map(dv => {
        const resp = (respostas||[]).filter(r=>r.devocional_id===dv.id)
        const minha = (respostas||[]).find(r=>r.devocional_id===dv.id&&r.usuario_id===user?.id)
        const dd = new Date(dv.data+'T00:00:00')
        return (
          <div key={dv.id} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,overflow:'hidden',marginBottom:11}}>
            <div style={{background:'var(--s2)',padding:'9px 14px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:'var(--w)'}}>{DIAS[dd.getDay()]} {dd.toLocaleDateString('pt-BR')} — {dv.titulo}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{fontSize:11,color:'var(--cy)'}}>{dv.referencia}</div>
                {isProf && <span style={{fontSize:11,color:'var(--grn)',fontWeight:600}}>{resp.length} resp.</span>}
                {user?.perfil==='pastor' && <Btn variant="danger" size="xs" onClick={()=>excluir(dv.id)}>🗑</Btn>}
              </div>
            </div>
            <div style={{padding:'13px 14px'}}>
              <div style={{fontSize:12,lineHeight:1.8,color:'var(--tx)',marginBottom:10}}>{dv.texto}</div>
              {dv.link && <a href={dv.link} target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',gap:4,padding:'4px 9px',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--gl)',textDecoration:'none',fontSize:11,marginBottom:10}}>🔗 Recurso</a>}
              {minha && <div style={{background:'var(--s2)',borderRadius:8,padding:10,marginTop:8}}>
                <div style={{fontSize:11,fontWeight:600,color:'var(--cy)',marginBottom:3}}>✅ Você fez este devocional</div>
                <div style={{fontSize:12,color:'var(--tx)'}}>{minha.comentario||'(sem comentário)'}</div>
              </div>}
              {!minha && !isProf && <Btn size="sm" onClick={()=>{setModalR(dv);setComentario('')}} style={{marginTop:8}}>✏ Fazer Devocional</Btn>}
              {isProf && resp.length>0 && <div style={{marginTop:10,borderTop:'1px solid var(--bd)',paddingTop:10}}>
                {resp.map(r=><div key={r.id} style={{background:'var(--s2)',borderRadius:8,padding:10,marginBottom:6}}>
                  <div style={{fontSize:11,fontWeight:600,color:'var(--cy)',marginBottom:3}}>{r.nome_user}</div>
                  <div style={{fontSize:12,color:'var(--tx)'}}>{r.comentario||'(sem comentário)'}</div>
                </div>)}
              </div>}
            </div>
          </div>
        )
      })}

      {modal && <Modal title="NOVO DEVOCIONAL" onClose={()=>setModal(false)}
        footer={<><Btn variant="outline" onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={salvar} disabled={loading}>{loading?'Salvando...':'Publicar'}</Btn></>}>
        <FormGrid>
          <FG><label>Data</label><input type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})}/></FG>
          <FG full><label>Título</label><input value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})}/></FG>
          <FG full><label>Referência Bíblica</label><input value={form.referencia} onChange={e=>setForm({...form,referencia:e.target.value})} placeholder="Ex: Salmos 23:1"/></FG>
          <FG full><label>Texto / Reflexão</label><textarea value={form.texto} onChange={e=>setForm({...form,texto:e.target.value})} style={{minHeight:100}}/></FG>
          <FG full><label>Link de Recurso</label><input type="url" value={form.link} onChange={e=>setForm({...form,link:e.target.value})} placeholder="YouTube, Instagram..."/></FG>
        </FormGrid>
      </Modal>}

      {modalR && <Modal title="FAZER DEVOCIONAL" onClose={()=>setModalR(null)}
        footer={<><Btn variant="outline" onClick={()=>setModalR(null)}>Cancelar</Btn><Btn variant="green" onClick={marcarFeito}>✅ Marcar como Feito</Btn></>}>
        <div style={{background:'var(--s2)',borderRadius:8,padding:13,marginBottom:14}}>
          <div style={{fontWeight:600,color:'var(--w)'}}>{modalR.titulo}</div>
          <div style={{fontSize:12,color:'var(--cy)',marginTop:3}}>{modalR.referencia}</div>
          {modalR.texto && <div style={{fontSize:12,color:'var(--tx)',marginTop:7,lineHeight:1.7}}>{modalR.texto}</div>}
        </div>
        <FG full><label>Minha reflexão</label><textarea value={comentario} onChange={e=>setComentario(e.target.value)} style={{minHeight:90}} placeholder="Escreva sua reflexão aqui..."/></FG>
      </Modal>}
    </div>
  )
}
