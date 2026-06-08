import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbUpdate, dbDelete } from '../lib/supabase.js'
import { MESES, isPastor, fmtBR, waLink, MSG_PREG } from '../lib/utils.js'
import { Tabs, MonthNav, Btn, Modal, FormGrid, FG, Empty } from '../components/UI.jsx'

const emptyPreg = { data:'', culto:'Sábado Manhã', pregador:'', tema:'', referencia:'', serie:'' }
const emptyMensagem = { data:'', culto:'Sábado Manhã', pregador:'', tema:'', referencia:'', link1:'', link2:'', obs:'' }
const emptySerie = { nome:'', qtd:1, mensagens:[] }

export default function Pregacao() {
  const { state, dispatch } = useStore()
  const { escalaPreg, pregacoes, funcoes, membros, user } = state
  const now = new Date()
  const [tab, setTab] = useState('escala')
  const [mes, setMes] = useState(now.getMonth())
  const [ano, setAno] = useState(now.getFullYear())

  // Modal: escalar/editar pregador
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyPreg)
  const [editId, setEditId] = useState(null)

  // Modal: nova série
  const [modalSerie, setModalSerie] = useState(false)
  const [serieForm, setSerieForm] = useState(emptySerie)

  // Modal: editar mensagem
  const [modalEditMsg, setModalEditMsg] = useState(false)
  const [editMsg, setEditMsg] = useState(null) // { pregacao, escItem }

  const [loading, setLoading] = useState(false)

  const chM = (d) => { let m=mes+d,a=ano; if(m>11){m=0;a++} if(m<0){m=11;a--} setMes(m);setAno(a) }

  const pregFn = funcoes?.find(f=>f.nome==='Pregadores')
  const pregadores = pregFn?.membros?.length ? pregFn.membros : []

  const escMes = (escalaPreg||[]).filter(p=>{
    const d=new Date(p.data+'T00:00:00')
    return d.getMonth()===mes && d.getFullYear()===ano
  }).sort((a,b)=>a.data.localeCompare(b.data))

  // ── Escala de pregadores ──────────────────────────────────────────────

  const abrirNovoEsc = () => {
    setForm({...emptyPreg, data:new Date().toISOString().slice(0,10)})
    setEditId(null)
    setModal(true)
  }

  const abrirEditEsc = (p) => {
    setForm({ data:p.data||'', culto:p.culto||'Sábado Manhã', pregador:p.pregador||'', tema:p.tema||'', referencia:p.referencia||'', serie:p.serie||'' })
    setEditId(p.id)
    setModal(true)
  }

  const salvarEsc = async () => {
    if (!form.pregador||!form.data) { dispatch({ type:'TOAST', value:'⚠ Selecione pregador e data.' }); return }
    setLoading(true)
    const row = { data:form.data, culto:form.culto, pregador:form.pregador, tema:form.tema, referencia:form.referencia||null, serie:form.serie }
    if (editId) {
      await dbUpdate('escala_preg', editId, row)
      dispatch({ type:'SET', key:'escalaPreg', value:(escalaPreg||[]).map(p=>p.id===editId?{...p,...row}:p) })
      dispatch({ type:'TOAST', value:'✅ Pregador atualizado!' })
    } else {
      const novo = await dbInsert('escala_preg', row)
      dispatch({ type:'SET', key:'escalaPreg', value:[...(escalaPreg||[]), novo||{id:Date.now(),...row}] })
      dispatch({ type:'TOAST', value:'✅ Pregador escalado!' })
    }
    setLoading(false); setModal(false); setForm(emptyPreg); setEditId(null)
  }

  const excluirEsc = async (id) => {
    await dbDelete('escala_preg', id)
    dispatch({ type:'SET', key:'escalaPreg', value:(escalaPreg||[]).filter(p=>p.id!==id) })
    dispatch({ type:'TOAST', value:'🗑 Removido.' })
  }

  // ── Séries & Mensagens ────────────────────────────────────────────────

  const gerarCampos = () => {
    const n = Math.max(1, Math.min(52, parseInt(serieForm.qtd)||1))
    const mensagens = Array.from({length:n}, (_,i) => serieForm.mensagens[i] || {...emptyMensagem})
    setSerieForm(f => ({ ...f, mensagens }))
  }

  const setMsgCampo = (i, campo, val) => {
    setSerieForm(f => {
      const mensagens = [...f.mensagens]
      mensagens[i] = { ...mensagens[i], [campo]: val }
      return { ...f, mensagens }
    })
  }

  const salvarSerie = async () => {
    if (!serieForm.nome) { dispatch({ type:'TOAST', value:'⚠ Informe o nome da série.' }); return }
    if (!serieForm.mensagens.length) { dispatch({ type:'TOAST', value:'⚠ Defina a quantidade de mensagens e gere os campos.' }); return }
    if (serieForm.mensagens.some(m=>!m.data||!m.pregador||!m.tema)) { dispatch({ type:'TOAST', value:'⚠ Preencha data, pregador e tema de cada mensagem.' }); return }
    setLoading(true)
    const novosEsc = [], novasMsgs = []
    for (const m of serieForm.mensagens) {
      const rowEsc = { data:m.data, culto:m.culto, pregador:m.pregador, tema:m.tema, referencia:m.referencia||null, serie:serieForm.nome }
      const novoEsc = await dbInsert('escala_preg', rowEsc)
      novosEsc.push(novoEsc || { id:Date.now()+Math.random(), ...rowEsc })

      const rowMsg = { data:m.data, culto:m.culto, tema:m.tema, serie:serieForm.nome, referencia:m.referencia, link1:m.link1, link2:m.link2, obs:m.obs }
      const novoMsg = await dbInsert('pregacoes', rowMsg)
      novasMsgs.push({ ...(novoMsg||{id:Date.now()+Math.random()}), ...rowMsg, dt:rowMsg.data, cu:rowMsg.culto, tm:rowMsg.tema, sr:rowMsg.serie, rf:rowMsg.referencia, l1:rowMsg.link1||'', l2:rowMsg.link2||'' })
    }
    dispatch({ type:'SET', key:'escalaPreg', value:[...(escalaPreg||[]), ...novosEsc] })
    dispatch({ type:'SET', key:'pregacoes', value:[...(pregacoes||[]), ...novasMsgs] })
    setLoading(false); setModalSerie(false); setSerieForm(emptySerie)
    dispatch({ type:'TOAST', value:'✅ Série criada!' })
  }

  const excluirMsg = async (id) => {
    await dbDelete('pregacoes', id)
    dispatch({ type:'SET', key:'pregacoes', value:(pregacoes||[]).filter(p=>p.id!==id) })
    dispatch({ type:'TOAST', value:'🗑 Removida.' })
  }

  const abrirEditMsg = (p) => {
    // Find matching escala_preg item
    const escItem = (escalaPreg||[]).find(e =>
      e.data === (p.dt||p.data) && (e.tema === (p.tm||p.tema) || (e.serie && e.serie === (p.sr||p.serie)))
    )
    setEditMsg({
      pregId: p.id,
      escId: escItem?.id || null,
      data: p.dt||p.data||'',
      culto: p.cu||p.culto||'Sábado Manhã',
      pregador: escItem?.pregador||'',
      tema: p.tm||p.tema||'',
      referencia: p.rf||p.referencia||'',
      serie: p.sr||p.serie||'',
      link1: p.l1||p.link1||'',
      link2: p.l2||p.link2||'',
      obs: p.ob||p.obs||'',
    })
    setModalEditMsg(true)
  }

  const salvarEditMsg = async () => {
    if (!editMsg.tema||!editMsg.data) { dispatch({ type:'TOAST', value:'⚠ Data e tema são obrigatórios.' }); return }
    setLoading(true)
    const rowMsg = { data:editMsg.data, culto:editMsg.culto, tema:editMsg.tema, serie:editMsg.serie, referencia:editMsg.referencia, link1:editMsg.link1, link2:editMsg.link2, obs:editMsg.obs }
    await dbUpdate('pregacoes', editMsg.pregId, rowMsg)
    dispatch({ type:'SET', key:'pregacoes', value:(pregacoes||[]).map(p=>p.id===editMsg.pregId?{...p,...rowMsg,dt:rowMsg.data,cu:rowMsg.culto,tm:rowMsg.tema,sr:rowMsg.serie,rf:rowMsg.referencia,l1:rowMsg.link1||'',l2:rowMsg.link2||'',ob:rowMsg.obs||''}:p) })

    if (editMsg.escId) {
      const rowEsc = { data:editMsg.data, culto:editMsg.culto, pregador:editMsg.pregador, tema:editMsg.tema, referencia:editMsg.referencia||null, serie:editMsg.serie }
      await dbUpdate('escala_preg', editMsg.escId, rowEsc)
      dispatch({ type:'SET', key:'escalaPreg', value:(escalaPreg||[]).map(e=>e.id===editMsg.escId?{...e,...rowEsc}:e) })
    }
    setLoading(false); setModalEditMsg(false); setEditMsg(null)
    dispatch({ type:'TOAST', value:'✅ Mensagem atualizada!' })
  }

  const getPregadorMsg = (p) => (escalaPreg||[]).find(e =>
    e.data === (p.dt||p.data) && (e.tema === (p.tm||p.tema) || (e.serie && e.serie === (p.sr||p.serie)))
  )?.pregador || ''

  return (
    <div>
      <Tabs tabs={[{id:'escala',label:'📅 Escala de Pregadores'},{id:'series',label:'📚 Séries & Mensagens'}]} active={tab} onChange={setTab} />

      {tab==='escala' && (
        <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
            <MonthNav month={mes} year={ano} onPrev={()=>chM(-1)} onNext={()=>chM(1)} />
            {isPastor(user) && <Btn onClick={abrirNovoEsc}>+ Escalar</Btn>}
          </div>
          {escMes.length===0 ? <Empty icon="🎤" text={`Nenhum pregador escalado em ${MESES[mes]}.`} /> : escMes.map(p=>(
            <div key={p.id} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderLeft:'3px solid var(--cy)',borderRadius:10,padding:14,marginBottom:10}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:'var(--w)'}}>{p.pregador}</div>
                  <div style={{fontSize:11,color:'var(--g)',marginTop:3}}>{p.culto} · {fmtBR(p.data)}</div>
                  {p.tema && <div style={{fontSize:12,color:'var(--cy)',marginTop:4}}>{p.tema}</div>}
                  {p.referencia && <div style={{fontSize:11,color:'var(--g)',marginTop:2}}>📖 {p.referencia}</div>}
                  {p.serie && <div style={{fontSize:11,color:'var(--g)'}}>📚 {p.serie}</div>}
                </div>
                {isPastor(user) && (
                  <div style={{display:'flex',gap:5}}>
                    <Btn variant="outline" size="xs" onClick={()=>abrirEditEsc(p)}>✏</Btn>
                    <Btn variant="danger" size="xs" onClick={()=>excluirEsc(p.id)}>🗑</Btn>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==='series' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
            {isPastor(user) && <Btn onClick={()=>{setSerieForm(emptySerie);setModalSerie(true)}}>+ Nova Série</Btn>}
          </div>
          {(pregacoes||[]).length===0 ? <Empty icon="📖" text="Nenhuma pregação cadastrada." /> :
            [...(pregacoes||[])].sort((a,b)=>(b.dt||b.data||'').localeCompare(a.dt||a.data||'')).map(p=>{
              const pregadorNome = getPregadorMsg(p)
              const mb = pregadorNome ? (membros||[]).find(m=>m.nome===pregadorNome) : null
              const msgWA = pregadorNome ? MSG_PREG(pregadorNome.split(' ')[0], fmtBR(p.dt||p.data), p.tm||p.tema, p.sr||p.serie, p.l1||p.link1, p.l2||p.link2, p.ob||p.obs) : ''
              return (
              <div key={p.id} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderLeft:'3px solid var(--cy)',borderRadius:10,padding:14,marginBottom:10}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:'var(--w)'}}>{p.tm||p.tema||'(sem tema)'}</div>
                    <div style={{fontSize:11,color:'var(--g)',marginTop:3}}>{p.cu||p.culto} · {fmtBR(p.dt||p.data)}{pregadorNome?` · 🎤 ${pregadorNome}`:''}</div>
                    {(p.sr||p.serie) && <div style={{color:'var(--cy)',fontSize:11,marginTop:3}}>📚 {p.sr||p.serie}</div>}
                    {(p.rf||p.referencia) && <div style={{fontSize:11,color:'var(--g)'}}>📖 {p.rf||p.referencia}</div>}
                    <div style={{display:'flex',gap:5,marginTop:7,flexWrap:'wrap'}}>
                      {(p.l1||p.link1) && <a href={p.l1||p.link1} target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',gap:4,padding:'4px 9px',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--gl)',textDecoration:'none',fontSize:11}}>▶ YouTube</a>}
                      {(p.l2||p.link2) && <a href={p.l2||p.link2} target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',gap:4,padding:'4px 9px',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--gl)',textDecoration:'none',fontSize:11}}>⬇ Material</a>}
                      {pregadorNome && (mb?.tel
                        ? <a href={waLink(mb.tel, msgWA)} target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',gap:4,padding:'4px 9px',background:'rgba(34,197,94,.12)',border:'1px solid rgba(34,197,94,.3)',borderRadius:5,color:'var(--grn)',textDecoration:'none',fontSize:11,fontWeight:600}}>💬 WhatsApp p/ {pregadorNome.split(' ')[0]}</a>
                        : <span style={{fontSize:10,color:'var(--g)'}}>🎤 {pregadorNome} — sem tel cadastrado</span>
                      )}
                    </div>
                  </div>
                  {isPastor(user) && (
                    <div style={{display:'flex',gap:5,flexShrink:0}}>
                      <Btn variant="outline" size="xs" onClick={()=>abrirEditMsg(p)}>✏</Btn>
                      <Btn variant="danger" size="xs" onClick={()=>excluirMsg(p.id)}>🗑</Btn>
                    </div>
                  )}
                </div>
              </div>
            )})
          }
        </div>
      )}

      {/* Modal: escalar / editar pregador */}
      {modal && (
        <Modal title={editId ? 'EDITAR PREGADOR' : 'ESCALAR PREGADOR'} onClose={()=>{setModal(false);setEditId(null)}}
          footer={<><Btn variant="outline" onClick={()=>{setModal(false);setEditId(null)}}>Cancelar</Btn><Btn onClick={salvarEsc} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <FormGrid>
            <FG><label>Data</label><input type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})} /></FG>
            <FG><label>Culto</label><select value={form.culto} onChange={e=>setForm({...form,culto:e.target.value})}><option>Sábado Manhã</option><option>Domingo Noite</option><option>Evento Especial</option></select></FG>
            <FG full><label>Pregador</label>
              <input list="lista-pregadores" value={form.pregador} onChange={e=>setForm({...form,pregador:e.target.value})} placeholder="Selecione ou digite um convidado..." />
              <datalist id="lista-pregadores">{pregadores.map(p=><option key={p} value={p}/>)}</datalist>
            </FG>
            <FG full><label>Tema (opcional)</label><input value={form.tema} onChange={e=>setForm({...form,tema:e.target.value})} /></FG>
            <FG full><label>Texto Bíblico (opcional)</label><input value={form.referencia} onChange={e=>setForm({...form,referencia:e.target.value})} placeholder="Ex: João 3:16" /></FG>
            <FG full><label>Série (opcional)</label><input value={form.serie} onChange={e=>setForm({...form,serie:e.target.value})} /></FG>
          </FormGrid>
        </Modal>
      )}

      {/* Modal: editar mensagem de série */}
      {modalEditMsg && editMsg && (
        <Modal title="EDITAR MENSAGEM" onClose={()=>{setModalEditMsg(false);setEditMsg(null)}} wide
          footer={<><Btn variant="outline" onClick={()=>{setModalEditMsg(false);setEditMsg(null)}}>Cancelar</Btn><Btn onClick={salvarEditMsg} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <FormGrid>
            <FG><label>Data</label><input type="date" value={editMsg.data} onChange={e=>setEditMsg({...editMsg,data:e.target.value})} /></FG>
            <FG><label>Culto</label><select value={editMsg.culto} onChange={e=>setEditMsg({...editMsg,culto:e.target.value})}><option>Sábado Manhã</option><option>Domingo Noite</option><option>Evento Especial</option></select></FG>
            <FG full><label>Pregador</label>
              <input list="lista-pregadores-edit" value={editMsg.pregador} onChange={e=>setEditMsg({...editMsg,pregador:e.target.value})} placeholder="Selecione ou digite um convidado..." />
              <datalist id="lista-pregadores-edit">{pregadores.map(p=><option key={p} value={p}/>)}</datalist>
            </FG>
            <FG full><label>Tema</label><input value={editMsg.tema} onChange={e=>setEditMsg({...editMsg,tema:e.target.value})} /></FG>
            <FG full><label>Referência Bíblica</label><input value={editMsg.referencia} onChange={e=>setEditMsg({...editMsg,referencia:e.target.value})} placeholder="Ex: João 3:16" /></FG>
            <FG full><label>Série</label><input value={editMsg.serie} onChange={e=>setEditMsg({...editMsg,serie:e.target.value})} /></FG>
            <FG><label>Link YouTube</label><input type="url" value={editMsg.link1} onChange={e=>setEditMsg({...editMsg,link1:e.target.value})} /></FG>
            <FG><label>Link Recurso</label><input type="url" value={editMsg.link2} onChange={e=>setEditMsg({...editMsg,link2:e.target.value})} /></FG>
            <FG full><label>Observações</label><textarea value={editMsg.obs} onChange={e=>setEditMsg({...editMsg,obs:e.target.value})} /></FG>
          </FormGrid>
        </Modal>
      )}

      {/* Modal: nova série */}
      {modalSerie && (
        <Modal title="NOVA SÉRIE DE MENSAGENS" onClose={()=>setModalSerie(false)} wide
          footer={<><Btn variant="outline" onClick={()=>setModalSerie(false)}>Cancelar</Btn><Btn onClick={salvarSerie} disabled={loading}>{loading?'Salvando...':'Salvar Série'}</Btn></>}>
          <FormGrid>
            <FG full><label>Nome da Série</label><input value={serieForm.nome} onChange={e=>setSerieForm({...serieForm,nome:e.target.value})} placeholder="Ex: Vidas Transformadas" /></FG>
            <FG><label>Quantidade de Mensagens</label><input type="number" min={1} max={52} value={serieForm.qtd} onChange={e=>setSerieForm({...serieForm,qtd:e.target.value})} /></FG>
            <FG style={{justifyContent:'flex-end'}}><Btn variant="outline" onClick={gerarCampos}>📋 Gerar Campos</Btn></FG>
          </FormGrid>

          {serieForm.mensagens.length>0 && (
            <div style={{marginTop:16,display:'flex',flexDirection:'column',gap:14}}>
              {serieForm.mensagens.map((m,i)=>(
                <div key={i} style={{background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:9,padding:13}}>
                  <div style={{fontFamily:'var(--font-display)',fontSize:12,letterSpacing:2,color:'var(--cy)',marginBottom:9}}>MENSAGEM {i+1}</div>
                  <FormGrid>
                    <FG><label>Data</label><input type="date" value={m.data} onChange={e=>setMsgCampo(i,'data',e.target.value)} /></FG>
                    <FG><label>Culto</label><select value={m.culto} onChange={e=>setMsgCampo(i,'culto',e.target.value)}><option>Sábado Manhã</option><option>Domingo Noite</option><option>Evento Especial</option></select></FG>
                    <FG full><label>Pregador</label>
                      <input list="lista-pregadores" value={m.pregador} onChange={e=>setMsgCampo(i,'pregador',e.target.value)} placeholder="Selecione ou digite um convidado..." />
                    </FG>
                    <FG full><label>Tema</label><input value={m.tema} onChange={e=>setMsgCampo(i,'tema',e.target.value)} /></FG>
                    <FG full><label>Referência Bíblica</label><input value={m.referencia} onChange={e=>setMsgCampo(i,'referencia',e.target.value)} placeholder="Ex: João 3:16" /></FG>
                    <FG><label>Link YouTube</label><input type="url" value={m.link1} onChange={e=>setMsgCampo(i,'link1',e.target.value)} /></FG>
                    <FG><label>Link Recurso</label><input type="url" value={m.link2} onChange={e=>setMsgCampo(i,'link2',e.target.value)} /></FG>
                    <FG full><label>Observações</label><textarea value={m.obs} onChange={e=>setMsgCampo(i,'obs',e.target.value)} /></FG>
                  </FormGrid>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
