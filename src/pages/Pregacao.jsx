import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbDelete } from '../lib/supabase.js'
import { MESES, isPastor, fmtBR } from '../lib/utils.js'
import { Tabs, MonthNav, Btn, Modal, FormGrid, FG, Empty } from '../components/UI.jsx'

const emptyPreg = { data:'', culto:'Sábado Manhã', pregador:'', tema:'', serie:'' }
const emptyMsg = { data:'', culto:'Sábado Manhã', tema:'', serie:'', referencia:'', link1:'', link2:'', obs:'' }

export default function Pregacao() {
  const { state, dispatch } = useStore()
  const { escalaPreg, pregacoes, funcoes, user } = state
  const now = new Date()
  const [tab, setTab] = useState('escala')
  const [mes, setMes] = useState(now.getMonth())
  const [ano, setAno] = useState(now.getFullYear())
  const [modal, setModal] = useState(false)
  const [modalMsg, setModalMsg] = useState(false)
  const [form, setForm] = useState(emptyPreg)
  const [formMsg, setFormMsg] = useState(emptyMsg)
  const [loading, setLoading] = useState(false)

  const chM = (d) => { let m=mes+d,a=ano; if(m>11){m=0;a++} if(m<0){m=11;a--} setMes(m);setAno(a) }

  const pregFn = funcoes?.find(f=>f.nome==='Pregadores')
  const pregadores = pregFn?.membros?.length ? pregFn.membros : []

  const escMes = (escalaPreg||[]).filter(p=>{
    const d=new Date(p.data+'T00:00:00')
    return d.getMonth()===mes && d.getFullYear()===ano
  }).sort((a,b)=>a.data.localeCompare(b.data))

  const salvarEsc = async () => {
    if (!form.pregador||!form.data) { dispatch({ type:'TOAST', value:'⚠ Selecione pregador e data.' }); return }
    setLoading(true)
    const row = { data:form.data, culto:form.culto, pregador:form.pregador, tema:form.tema, serie:form.serie }
    const novo = await dbInsert('escala_preg', row)
    dispatch({ type:'SET', key:'escalaPreg', value:[...(escalaPreg||[]), novo||{id:Date.now(),...row}] })
    setLoading(false); setModal(false); setForm(emptyPreg)
    dispatch({ type:'TOAST', value:'✅ Pregador escalado!' })
  }

  const excluirEsc = async (id) => {
    await dbDelete('escala_preg', id)
    dispatch({ type:'SET', key:'escalaPreg', value:(escalaPreg||[]).filter(p=>p.id!==id) })
    dispatch({ type:'TOAST', value:'🗑 Removido.' })
  }

  const salvarMsg = async () => {
    if (!formMsg.tema) { dispatch({ type:'TOAST', value:'⚠ Informe o tema.' }); return }
    setLoading(true)
    const row = { data:formMsg.data, culto:formMsg.culto, tema:formMsg.tema, serie:formMsg.serie, referencia:formMsg.referencia, link1:formMsg.link1, link2:formMsg.link2, obs:formMsg.obs }
    const novo = await dbInsert('pregacoes', row)
    dispatch({ type:'SET', key:'pregacoes', value:[...(pregacoes||[]), {...(novo||{id:Date.now()}),...row,dt:row.data,cu:row.culto,tm:row.tema,sr:row.serie,rf:row.referencia,l1:row.link1||'',l2:row.link2||''}] })
    setLoading(false); setModalMsg(false); setFormMsg(emptyMsg)
    dispatch({ type:'TOAST', value:'✅ Pregação cadastrada!' })
  }

  const excluirMsg = async (id) => {
    await dbDelete('pregacoes', id)
    dispatch({ type:'SET', key:'pregacoes', value:(pregacoes||[]).filter(p=>p.id!==id) })
  }

  return (
    <div>
      <Tabs tabs={[{id:'escala',label:'📅 Escala de Pregadores'},{id:'series',label:'📚 Séries & Mensagens'}]} active={tab} onChange={setTab} />

      {tab==='escala' && (
        <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
            <MonthNav month={mes} year={ano} onPrev={()=>chM(-1)} onNext={()=>chM(1)} />
            {isPastor(user) && <Btn onClick={()=>{setForm({...emptyPreg,data:new Date().toISOString().slice(0,10)});setModal(true)}}>+ Escalar</Btn>}
          </div>
          {escMes.length===0 ? <Empty icon="🎤" text={`Nenhum pregador escalado em ${MESES[mes]}.`} /> : escMes.map(p=>(
            <div key={p.id} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderLeft:'3px solid var(--cy)',borderRadius:10,padding:14,marginBottom:10}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:'var(--w)'}}>{p.pregador}</div>
                  <div style={{fontSize:11,color:'var(--g)',marginTop:3}}>{p.culto} · {fmtBR(p.data)}</div>
                  {p.tema && <div style={{fontSize:12,color:'var(--cy)',marginTop:4}}>{p.tema}</div>}
                  {p.serie && <div style={{fontSize:11,color:'var(--g)'}}>📚 {p.serie}</div>}
                </div>
                {isPastor(user) && <Btn variant="danger" size="xs" onClick={()=>excluirEsc(p.id)}>🗑</Btn>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==='series' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
            {isPastor(user) && <Btn onClick={()=>{setFormMsg({...emptyMsg,data:new Date().toISOString().slice(0,10)});setModalMsg(true)}}>+ Nova</Btn>}
          </div>
          {(pregacoes||[]).length===0 ? <Empty icon="📖" text="Nenhuma pregação cadastrada." /> :
            [...(pregacoes||[])].sort((a,b)=>(b.dt||b.data||'').localeCompare(a.dt||a.data||'')).map(p=>(
              <div key={p.id} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderLeft:'3px solid var(--cy)',borderRadius:10,padding:14,marginBottom:10}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:'var(--w)'}}>{p.tm||p.tema||'(sem tema)'}</div>
                    <div style={{fontSize:11,color:'var(--g)',marginTop:3}}>{p.cu||p.culto} · {fmtBR(p.dt||p.data)}</div>
                    {(p.sr||p.serie) && <div style={{color:'var(--cy)',fontSize:11,marginTop:3}}>📚 {p.sr||p.serie}</div>}
                    {(p.rf||p.referencia) && <div style={{fontSize:11,color:'var(--g)'}}>📖 {p.rf||p.referencia}</div>}
                    <div style={{display:'flex',gap:5,marginTop:7,flexWrap:'wrap'}}>
                      {(p.l1||p.link1) && <a href={p.l1||p.link1} target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',gap:4,padding:'4px 9px',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--gl)',textDecoration:'none',fontSize:11}}>▶ YouTube</a>}
                      {(p.l2||p.link2) && <a href={p.l2||p.link2} target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',gap:4,padding:'4px 9px',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--gl)',textDecoration:'none',fontSize:11}}>⬇ Material</a>}
                    </div>
                  </div>
                  {isPastor(user) && <Btn variant="danger" size="xs" onClick={()=>excluirMsg(p.id)}>🗑</Btn>}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {modal && (
        <Modal title="ESCALAR PREGADOR" onClose={()=>setModal(false)}
          footer={<><Btn variant="outline" onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={salvarEsc} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <FormGrid>
            <FG><label>Data</label><input type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})} /></FG>
            <FG><label>Culto</label><select value={form.culto} onChange={e=>setForm({...form,culto:e.target.value})}><option>Sábado Manhã</option><option>Domingo Noite</option><option>Evento Especial</option></select></FG>
            <FG full><label>Pregador</label>
              <select value={form.pregador} onChange={e=>setForm({...form,pregador:e.target.value})}>
                <option value="">— Selecionar —</option>
                {pregadores.map(p=><option key={p}>{p}</option>)}
              </select>
            </FG>
            <FG full><label>Tema (opcional)</label><input value={form.tema} onChange={e=>setForm({...form,tema:e.target.value})} /></FG>
            <FG full><label>Série (opcional)</label><input value={form.serie} onChange={e=>setForm({...form,serie:e.target.value})} /></FG>
          </FormGrid>
        </Modal>
      )}

      {modalMsg && (
        <Modal title="NOVA PREGAÇÃO" onClose={()=>setModalMsg(false)} wide
          footer={<><Btn variant="outline" onClick={()=>setModalMsg(false)}>Cancelar</Btn><Btn onClick={salvarMsg} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <FormGrid>
            <FG><label>Data</label><input type="date" value={formMsg.data} onChange={e=>setFormMsg({...formMsg,data:e.target.value})} /></FG>
            <FG><label>Culto</label><select value={formMsg.culto} onChange={e=>setFormMsg({...formMsg,culto:e.target.value})}><option>Sábado Manhã</option><option>Domingo Noite</option><option>Evento Especial</option></select></FG>
            <FG full><label>Tema</label><input value={formMsg.tema} onChange={e=>setFormMsg({...formMsg,tema:e.target.value})} /></FG>
            <FG full><label>Série</label><input value={formMsg.serie} onChange={e=>setFormMsg({...formMsg,serie:e.target.value})} /></FG>
            <FG full><label>Referência Bíblica</label><input value={formMsg.referencia} onChange={e=>setFormMsg({...formMsg,referencia:e.target.value})} placeholder="Ex: João 3:16" /></FG>
            <FG full><label>Link YouTube</label><input type="url" value={formMsg.link1} onChange={e=>setFormMsg({...formMsg,link1:e.target.value})} /></FG>
            <FG full><label>Link Material</label><input type="url" value={formMsg.link2} onChange={e=>setFormMsg({...formMsg,link2:e.target.value})} /></FG>
            <FG full><label>Observações</label><textarea value={formMsg.obs} onChange={e=>setFormMsg({...formMsg,obs:e.target.value})} /></FG>
          </FormGrid>
        </Modal>
      )}
    </div>
  )
}
