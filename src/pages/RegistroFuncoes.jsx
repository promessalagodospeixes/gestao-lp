import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbUpdate, dbDelete } from '../lib/supabase.js'
import { isPastor, normalizar, DISP_OPTS } from '../lib/utils.js'
import { Tabs, Btn, Modal, FormGrid, FG, Empty } from '../components/UI.jsx'

const CAT_LABEL = { culto:'⛪ Culto', louvor:'🎵 Equipe de Louvor', eb:'📖 Escola Bíblica', outro:'📌 Outro' }
const emptyFn = { nome:'', cat:'culto', apl:'ambos', membros:[], disponibilidades:{} }

export default function RegistroFuncoes() {
  const { state, dispatch } = useStore()
  const { funcoes, membros, gestores, user } = state
  const [tab, setTab] = useState('funcoes')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyFn)
  const [editId, setEditId] = useState(null)
  const [busca, setBusca] = useState('')
  const [aberta, setAberta] = useState(null)
  const [loading, setLoading] = useState(false)
  const [gestForm, setGestForm] = useState(gestores || { vocal:['','',''], instrumental:['','',''] })

  const nomes = [...(membros||[])].map(m=>m.nome).sort()
  const filtered = busca ? nomes.filter(n=>normalizar(n).includes(normalizar(busca))) : nomes

  const grupos = { culto:[], louvor:[], eb:[], outro:[] }
  ;(funcoes||[]).forEach(f => (grupos[f.cat]||grupos.outro).push(f))

  const abrirFn = (fn=null) => {
    setForm(fn ? {
      nome:fn.nome, cat:fn.cat, apl:fn.apl,
      membros:[...(fn.membros||[])],
      disponibilidades:{...(fn.disponibilidades||{})}
    } : emptyFn)
    setEditId(fn?.id||null); setBusca(''); setModal(true)
  }

  const toggleMb = (nome) => {
    setForm(f => {
      const hasMb = f.membros.includes(nome)
      const newMbs = hasMb ? f.membros.filter(m=>m!==nome) : [...f.membros, nome]
      const newDisp = {...f.disponibilidades}
      if (!hasMb) newDisp[nome] = 'semanal'
      else delete newDisp[nome]
      return {...f, membros:newMbs, disponibilidades:newDisp}
    })
  }

  const setDisp = (nome, val) => {
    setForm(f => ({...f, disponibilidades:{...f.disponibilidades,[nome]:val}}))
  }

  const salvarFn = async () => {
    if (!form.nome) { dispatch({ type:'TOAST', value:'⚠ Informe o nome.' }); return }
    setLoading(true)
    const row = {
      nome:form.nome, cat:form.cat, apl:form.apl,
      membros:JSON.stringify(form.membros),
      disponibilidades:JSON.stringify(form.disponibilidades||{})
    }
    if (editId) {
      await dbUpdate('funcoes', editId, row)
      dispatch({ type:'SET', key:'funcoes', value:(funcoes||[]).map(f=>f.id===editId?{...f,...row,membros:form.membros,disponibilidades:form.disponibilidades}:f) })
    } else {
      const novo = await dbInsert('funcoes', row)
      dispatch({ type:'SET', key:'funcoes', value:[...(funcoes||[]), {...(novo||{id:Date.now()}),...row,membros:form.membros,disponibilidades:form.disponibilidades}] })
    }
    setLoading(false); setModal(false)
    dispatch({ type:'TOAST', value:'✅ Função salva!' })
  }

  const excluirFn = async (id) => {
    if (!isPastor(user)) { dispatch({ type:'TOAST', value:'⛔ Sem permissão.' }); return }
    await dbDelete('funcoes', id)
    dispatch({ type:'SET', key:'funcoes', value:(funcoes||[]).filter(f=>f.id!==id) })
    dispatch({ type:'TOAST', value:'🗑 Removida.' })
  }

  const salvarGestores = async () => {
    const { dbGet, dbUpdate: upd, dbInsert: ins } = await import('../lib/supabase.js')
    setLoading(true)
    const existing = await dbGet('gestores')
    const row = { vocal:JSON.stringify(gestForm.vocal), instrumental:JSON.stringify(gestForm.instrumental) }
    if (existing.length) await upd('gestores', existing[0].id, row)
    else await ins('gestores', row)
    dispatch({ type:'SET', key:'gestores', value:gestForm })
    setLoading(false)
    dispatch({ type:'TOAST', value:'✅ Gestores salvos!' })
  }

  // Relatório de funções por pessoa
  const relatorio = [...(membros||[])].map(m => {
    const fns = (funcoes||[]).filter(f=>(f.membros||[]).includes(m.nome))
    return { ...m, fns }
  }).sort((a,b) => b.fns.length - a.fns.length)

  return (
    <div>
      <Tabs tabs={[{id:'funcoes',label:'⚙️ Funções'},{id:'gestores',label:'👤 Gestores'},{id:'relatorio',label:'📊 Relatório'}]} active={tab} onChange={setTab} />

      {tab==='funcoes' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
            <Btn onClick={()=>abrirFn()}>+ Nova Função</Btn>
          </div>
          {Object.entries(CAT_LABEL).map(([cat,label]) => {
            const fns = grupos[cat]||[]
            if (!fns.length) return null
            return (
              <div key={cat} style={{marginBottom:20}}>
                <div style={{fontFamily:'var(--font-display)',fontSize:14,letterSpacing:2,color:'var(--cy)',marginBottom:8,borderBottom:'1px solid var(--bd)',paddingBottom:5}}>{label}</div>
                {fns.map(fn=>(
                  <div key={fn.id} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,marginBottom:8,overflow:'hidden'}}>
                    <div onClick={()=>setAberta(aberta===fn.id?null:fn.id)} style={{background:'var(--s2)',padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontFamily:'var(--font-display)',fontSize:13,letterSpacing:2,color:'var(--w)'}}>{fn.nome}</span>
                        <span style={{background:'#2a2a2a',color:'var(--gl)',fontSize:9,padding:'2px 7px',borderRadius:99,fontWeight:600}}>{(fn.membros||[]).length} pessoas</span>
                      </div>
                      <div style={{display:'flex',gap:5}} onClick={e=>e.stopPropagation()}>
                        <Btn variant="outline" size="xs" onClick={()=>abrirFn(fn)}>✏</Btn>
                        {isPastor(user) && <Btn variant="danger" size="xs" onClick={()=>excluirFn(fn.id)}>🗑</Btn>}
                      </div>
                    </div>
                    {aberta===fn.id && (
                      <div style={{padding:'11px 14px'}}>
                        {(fn.membros||[]).length ? (fn.membros||[]).map(m=>{
                          const disp = (fn.disponibilidades||{})[m]
                          return (
                            <div key={m} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0',borderBottom:'1px solid var(--bd)'}}>
                              <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 9px',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:6,fontSize:11,color:'var(--tx)',flex:1}}>👤 {m}</span>
                              {disp && <span style={{fontSize:10,color:'var(--cy)',background:'var(--cdim)',padding:'3px 8px',borderRadius:5,border:'1px solid var(--cgl)'}}>{DISP_OPTS.find(([v])=>v===disp)?.[1]||disp}</span>}
                            </div>
                          )
                        }) : <span style={{color:'var(--g)',fontSize:12}}>Nenhum membro cadastrado.</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {tab==='gestores' && (
        <div>
          {[['vocal','🎤 Gestor Vocal'],['instrumental','🎸 Gestor Instrumental']].map(([tipo,label])=>(
            <div key={tipo} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,marginBottom:16,overflow:'hidden'}}>
              <div style={{background:'var(--s2)',padding:'9px 14px',fontFamily:'var(--font-display)',fontSize:13,letterSpacing:2,color:'var(--w)'}}>{label}</div>
              <div style={{padding:'11px 14px'}}>
                {[0,1,2].map(i=>(
                  <div key={i} style={{display:'flex',alignItems:'center',padding:'6px 0',borderBottom:'1px solid var(--bd)',gap:9}}>
                    <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:2,textTransform:'uppercase',width:70,flexShrink:0}}>Gestor {i+1}</div>
                    <select value={gestForm[tipo]?.[i]||''} onChange={e=>{const v=[...(gestForm[tipo]||['','',''])];v[i]=e.target.value;setGestForm({...gestForm,[tipo]:v})}} style={{flex:1,padding:'7px 8px',fontSize:12}}>
                      <option value="">— Selecionar —</option>
                      {nomes.map(n=><option key={n}>{n}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Btn onClick={salvarGestores} disabled={loading}>{loading?'Salvando...':'💾 Salvar Gestores'}</Btn>
        </div>
      )}

      {tab==='relatorio' && (
        <div>
          <div style={{marginBottom:14,display:'flex',gap:12}}>
            <div style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:8,padding:'10px 16px',flex:1,textAlign:'center'}}>
              <div style={{fontSize:9,color:'var(--g)',letterSpacing:2,textTransform:'uppercase'}}>Com função</div>
              <div style={{fontFamily:'var(--font-display)',fontSize:24,color:'var(--grn)'}}>{relatorio.filter(m=>m.fns.length>0).length}</div>
            </div>
            <div style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:8,padding:'10px 16px',flex:1,textAlign:'center'}}>
              <div style={{fontSize:9,color:'var(--g)',letterSpacing:2,textTransform:'uppercase'}}>Sem função</div>
              <div style={{fontFamily:'var(--font-display)',fontSize:24,color:'var(--red)'}}>{relatorio.filter(m=>m.fns.length===0).length}</div>
            </div>
            <div style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:8,padding:'10px 16px',flex:1,textAlign:'center'}}>
              <div style={{fontSize:9,color:'var(--g)',letterSpacing:2,textTransform:'uppercase'}}>Total</div>
              <div style={{fontFamily:'var(--font-display)',fontSize:24,color:'var(--cy)'}}>{relatorio.length}</div>
            </div>
          </div>
          {relatorio.map(m=>(
            <div key={m.id} style={{background:'var(--s1)',border:`1px solid ${m.fns.length===0?'rgba(239,68,68,.3)':'var(--bd)'}`,borderRadius:10,padding:'11px 15px',display:'flex',alignItems:'center',gap:10,marginBottom:7}}>
              <div style={{width:32,height:32,borderRadius:'50%',background:m.fns.length>0?'var(--cdim)':'rgba(239,68,68,.1)',border:`2px solid ${m.fns.length>0?'var(--cy)':'var(--red)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:m.fns.length>0?'var(--cy)':'var(--red)',flexShrink:0}}>{m.fns.length}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--w)'}}>{m.nome}</div>
                <div style={{fontSize:11,color:'var(--g)',marginTop:2}}>
                  {m.fns.length===0
                    ? <span style={{color:'var(--red)'}}>Sem função cadastrada</span>
                    : m.fns.map(f=>f.nome).join(' · ')
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={editId?'EDITAR FUNÇÃO':'NOVA FUNÇÃO'} onClose={()=>setModal(false)} wide
          footer={<><Btn variant="outline" onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={salvarFn} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <FormGrid>
            <FG full><label>Nome da Função</label><input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} /></FG>
            <FG><label>Categoria</label><select value={form.cat} onChange={e=>setForm({...form,cat:e.target.value})}>{Object.entries(CAT_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></FG>
            <FG><label>Aplicável a</label><select value={form.apl} onChange={e=>setForm({...form,apl:e.target.value})}><option value="ambos">Sábado e Domingo</option><option value="sabado">Só Sábado</option><option value="domingo">Só Domingo</option><option value="na">Não aplica</option></select></FG>
          </FormGrid>
          <div style={{marginTop:12}}>
            <label>Membros nesta função</label>
            <div style={{border:'1px solid var(--bd)',borderRadius:7,overflow:'hidden',marginTop:4}}>
              <input placeholder="🔍 Buscar membro..." value={busca} onChange={e=>setBusca(e.target.value)} style={{border:'none',borderBottom:'1px solid var(--bd)',borderRadius:0}} />
              <div style={{maxHeight:260,overflowY:'auto',background:'var(--s2)'}}>
                {filtered.map(n=>(
                  <div key={n} style={{borderBottom:'1px solid var(--bd)'}}>
                    <label style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',cursor:'pointer',fontSize:12,color:form.membros.includes(n)?'var(--cy)':'var(--tx)',background:form.membros.includes(n)?'var(--cdim)':''}}>
                      <input type="checkbox" checked={form.membros.includes(n)} onChange={()=>toggleMb(n)} style={{accentColor:'var(--cy)',width:15,height:15,flexShrink:0}} /> {n}
                    </label>
                    {form.membros.includes(n) && (
                      <div style={{padding:'4px 12px 8px 36px',background:'var(--cdim)'}}>
                        <select value={form.disponibilidades[n]||'semanal'} onChange={e=>setDisp(n,e.target.value)} style={{fontSize:11,padding:'4px 8px',background:'var(--s2)',border:'1px solid var(--cy)',borderRadius:5,color:'var(--cy)',width:'auto'}}>
                          {DISP_OPTS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
