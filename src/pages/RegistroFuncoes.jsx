import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbUpdate, dbDelete } from '../lib/supabase.js'
import { isPastor } from '../lib/utils.js'
import { Tabs, Btn, Modal, FormGrid, FG, Empty } from '../components/UI.jsx'

const CAT_LABEL = { culto:'⛪ Culto', louvor:'🎵 Equipe de Louvor', eb:'📖 Escola Bíblica', outro:'📌 Outro' }
const emptyFn = { nome:'', cat:'culto', apl:'ambos', membros:[] }

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
  const filtered = busca ? nomes.filter(n=>n.toLowerCase().includes(busca.toLowerCase())) : nomes

  const grupos = { culto:[], louvor:[], eb:[], outro:[] }
  ;(funcoes||[]).forEach(f => (grupos[f.cat]||grupos.outro).push(f))

  const abrirFn = (fn=null) => {
    setForm(fn ? { nome:fn.nome, cat:fn.cat, apl:fn.apl, membros:[...(fn.membros||[])] } : emptyFn)
    setEditId(fn?.id||null); setBusca(''); setModal(true)
  }

  const toggleMb = (nome) => setForm(f=>({...f,membros:f.membros.includes(nome)?f.membros.filter(m=>m!==nome):[...f.membros,nome]}))

  const salvarFn = async () => {
    if (!form.nome) { dispatch({ type:'TOAST', value:'⚠ Informe o nome.' }); return }
    setLoading(true)
    const row = { nome:form.nome, cat:form.cat, apl:form.apl, membros:JSON.stringify(form.membros) }
    if (editId) {
      await dbUpdate('funcoes', editId, row)
      dispatch({ type:'SET', key:'funcoes', value:(funcoes||[]).map(f=>f.id===editId?{...f,...row,membros:form.membros}:f) })
    } else {
      const novo = await dbInsert('funcoes', row)
      dispatch({ type:'SET', key:'funcoes', value:[...(funcoes||[]), {...(novo||{id:Date.now()}),...row,membros:form.membros}] })
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
    if (existing.length) { await upd('gestores', existing[0].id, row) }
    else { await ins('gestores', row) }
    dispatch({ type:'SET', key:'gestores', value:gestForm })
    setLoading(false)
    dispatch({ type:'TOAST', value:'✅ Gestores salvos!' })
  }

  return (
    <div>
      <Tabs tabs={[{id:'funcoes',label:'⚙️ Funções'},{id:'gestores',label:'👤 Gestores'}]} active={tab} onChange={setTab} />

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
                        {(fn.membros||[]).length ? (fn.membros||[]).map(m=>(
                          <span key={m} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 9px',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:6,fontSize:11,color:'var(--tx)',margin:2}}>👤 {m}</span>
                        )) : <span style={{color:'var(--g)',fontSize:12}}>Nenhum membro cadastrado.</span>}
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
                    <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:2,textTransform:'uppercase',width:60,flexShrink:0}}>{label.split(' ')[2]} {i+1}</div>
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
              <div style={{maxHeight:240,overflowY:'auto',background:'var(--s2)'}}>
                {filtered.map(n=>(
                  <label key={n} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 11px',cursor:'pointer',borderBottom:'1px solid var(--bd)',fontSize:12,color:form.membros.includes(n)?'var(--cy)':'var(--tx)',background:form.membros.includes(n)?'var(--cdim)':''}}>
                    <input type="checkbox" checked={form.membros.includes(n)} onChange={()=>toggleMb(n)} style={{accentColor:'var(--cy)',width:15,height:15,flexShrink:0}} /> {n}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
