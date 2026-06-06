import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbUpsert, dbInsert } from '../lib/supabase.js'
import { getSabDom, fmtBR } from '../lib/utils.js'
import { MonthNav, Btn, BtnGroup, Modal, FormGrid, FG, Tag } from '../components/UI.jsx'

const INSTS = ['Teclado','Bateria','Baixo','Guitarra','Violão','Som','Telão','Mídia']

export default function EscalaLouvor() {
  const { state, dispatch } = useStore()
  const { escalasLv, funcoes, membros, musicas, setlists } = state
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth())
  const [ano, setAno] = useState(now.getFullYear())
  const [saving, setSaving] = useState(false)
  const [modalSL, setModalSL] = useState(false)
  const [slForm, setSlForm] = useState({ data:'', culto:'Sábado Manhã', musicas:[], obs:'' })

  const chM = (d) => { let m=mes+d,a=ano; if(m>11){m=0;a++} if(m<0){m=11;a--} setMes(m);setAno(a) }
  const ch = `lv-${ano}-${mes}`
  const esc = escalasLv[ch]||{}
  const { sabs, doms } = getSabDom(mes, ano)
  const allMbs = (membros||[]).map(m=>m.nome).sort()
  const fnMbs = (nome) => { const f=(funcoes||[]).find(x=>x.nome===nome); return f&&(f.membros||[]).length?f.membros:allMbs }

  const vocais = fnMbs('Vocal Equipe')

  const setVoc = (slot, n, val) => {
    const key = `${slot}-v${n}`
    dispatch({ type:'SET', key:'escalasLv', value:{...escalasLv,[ch]:{...esc,[key]:val}} })
  }

  const setInst = (slot, papel, val) => {
    const cur = esc[slot]||{}
    const inst = {...(cur.inst||{}), [papel]:val}
    dispatch({ type:'SET', key:'escalasLv', value:{...escalasLv,[ch]:{...esc,[slot]:{...cur,inst}}} })
  }

  const gerarAuto = () => {
    const pick = (lista, usV, usI, off) => { for(let i=0;i<lista.length;i++){const p=lista[(off+i)%lista.length];if(!usV.includes(p)&&!usI.includes(p))return p;} return lista[off%lista.length]||'' }
    const novoEsc = {}
    const fillCulto = (slot, idx, nL) => {
      const vU=[]
      for(let n=1;n<=nL;n++){const p=pick(vocais,vU,[],idx*nL+n-1);novoEsc[`${slot}-v${n}`]=p;if(p)vU.push(p)}
      novoEsc[slot]={inst:{}}
      const iU=[]
      INSTS.forEach((papel,pi)=>{const ms=fnMbs(papel);if(!ms.length)return;const p=pick(ms,vU,iU,idx+pi);novoEsc[slot].inst[papel]=p;if(p)iU.push(p)})
    }
    sabs.forEach((_,i)=>fillCulto(`sab-${i}`,i,4))
    doms.forEach((_,i)=>fillCulto(`dom-${i}`,i+10,5))
    dispatch({ type:'SET', key:'escalasLv', value:{...escalasLv,[ch]:novoEsc} })
    dispatch({ type:'TOAST', value:'✨ Louvor gerado!' })
  }

  const salvar = async () => {
    setSaving(true)
    const slots = {}
    Object.entries(esc).forEach(([k,v])=>{
      if(k.includes('-v')){const slot=k.replace(/-v\d+$/,'');if(!slots[slot])slots[slot]={vocal:{}};slots[slot].vocal[k.match(/-v(\d+)$/)[1]]=v}
      else if(v&&v.inst){if(!slots[k])slots[k]={vocal:{}};slots[k].inst=v.inst}
    })
    const rows = Object.entries(slots).map(([slot,s])=>{
      const [tipo,...rest]=slot.split('-');const idx=rest[rest.length-1]
      return{ano,mes:mes+1,slot,vocal:JSON.stringify(s.vocal||{}),instrumental:JSON.stringify(s.inst||{})}
    })
    await Promise.all(rows.map(r=>dbUpsert('escalas_lv',r,'ano,mes,slot')))
    setSaving(false)
    dispatch({ type:'TOAST', value:'💾 Louvor salvo!' })
  }

  const salvarSL = async () => {
    if(!slForm.data||!slForm.musicas.length){dispatch({type:'TOAST',value:'⚠ Selecione data e músicas.'});return}
    const row={data:slForm.data,culto:slForm.culto,musicas:JSON.stringify(slForm.musicas),obs:slForm.obs}
    const novo=await dbInsert('setlists',row)
    dispatch({type:'SET',key:'setlists',value:[...(setlists||[]),{...(novo||{id:Date.now()}),...row,musicas:slForm.musicas}]})
    setModalSL(false);setSlForm({data:'',culto:'Sábado Manhã',musicas:[],obs:''})
    dispatch({type:'TOAST',value:'🎵 Setlist salvo!'})
  }

  const CultoCard = ({data,tipo,idx}) => {
    const slot=`${tipo}-${idx}`
    const nL=tipo==='sab'?4:5
    const slData=data.toISOString().slice(0,10)
    const sl=(setlists||[]).find(s=>s.data===slData&&(tipo==='sab'?s.culto==='Sábado Manhã':s.culto==='Domingo Noite'))
    return(
      <div style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,overflow:'hidden',marginBottom:12}}>
        <div style={{background:'var(--s2)',padding:'9px 14px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:12,letterSpacing:2,color:'var(--w)'}}>{tipo==='sab'?'☀ SÁBADO':'🌙 DOMINGO'} — {fmtBR(data)} — {nL} louvores</div>
          {sl?<Tag color="green">🎵 Setlist</Tag>:<Tag color="gray">Sem setlist</Tag>}
        </div>
        <div style={{padding:'11px 14px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <div>
            <div style={{fontSize:9,color:'var(--cy)',letterSpacing:2,textTransform:'uppercase',marginBottom:5,fontWeight:600}}>🎤 VOCAL</div>
            {Array.from({length:nL},(_,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',padding:'5px 0',borderBottom:'1px solid var(--bd)',gap:8}}>
                <div style={{fontSize:9,color:'var(--g)',width:60,flexShrink:0}}>Louvor {i+1}</div>
                <select value={esc[`${slot}-v${i+1}`]||''} onChange={e=>setVoc(slot,i+1,e.target.value)} style={{flex:1,padding:'5px 8px',fontSize:11,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--w)'}}>
                  <option value="">—</option>{vocais.map(n=><option key={n}>{n}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div>
            <div style={{fontSize:9,color:'var(--cy)',letterSpacing:2,textTransform:'uppercase',marginBottom:5,fontWeight:600}}>🎸 INSTRUMENTAL</div>
            {INSTS.map(papel=>{
              const ms=fnMbs(papel)
              return(
                <div key={papel} style={{display:'flex',alignItems:'center',padding:'5px 0',borderBottom:'1px solid var(--bd)',gap:8}}>
                  <div style={{fontSize:9,color:'var(--g)',width:60,flexShrink:0}}>{papel}</div>
                  <select value={(esc[slot]?.inst||{})[papel]||''} onChange={e=>setInst(slot,papel,e.target.value)} style={{flex:1,padding:'5px 8px',fontSize:11,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--w)'}}>
                    <option value="">—</option>{ms.map(n=><option key={n}>{n}</option>)}
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const mesSLs=(setlists||[]).filter(s=>{const d=new Date(s.data+'T00:00:00');return d.getMonth()===mes&&d.getFullYear()===ano})

  return(
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
        <MonthNav month={mes} year={ano} onPrev={()=>chM(-1)} onNext={()=>chM(1)} />
        <BtnGroup>
          <Btn variant="outline" size="sm" onClick={gerarAuto}>✨ Gerar Auto</Btn>
          <Btn size="sm" onClick={salvar} disabled={saving}>{saving?'Salvando...':'💾 Salvar'}</Btn>
          <Btn size="sm" onClick={()=>{setSlForm({data:new Date().toISOString().slice(0,10),culto:'Sábado Manhã',musicas:[],obs:''});setModalSL(true)}}>🎵 Setlist</Btn>
        </BtnGroup>
      </div>
      {sabs.map((d,i)=><CultoCard key={`sab-${i}`} data={d} tipo="sab" idx={i}/>)}
      {doms.map((d,i)=><CultoCard key={`dom-${i}`} data={d} tipo="dom" idx={i}/>)}
      {mesSLs.length>0&&<div style={{marginTop:16}}>
        <div style={{fontFamily:'var(--font-display)',fontSize:16,letterSpacing:2,color:'var(--w)',marginBottom:10}}>SETLISTS</div>
        {mesSLs.map(s=>{
          const ms=(s.musicas||[]).map(id=>{const m=(musicas||[]).find(x=>x.id===id);return m?m.nome:'?'})
          return<div key={s.id} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,padding:12,marginBottom:8}}>
            <div style={{display:'flex',gap:9,marginBottom:6}}><strong style={{color:'var(--w)'}}>{s.culto}</strong><span style={{color:'var(--cy)',fontSize:11}}>{new Date(s.data+'T00:00:00').toLocaleDateString('pt-BR')}</span></div>
            <div>{ms.map(m=><Tag key={m} color="cyan">🎵 {m}</Tag>)}</div>
            {s.obs&&<div style={{marginTop:4,fontSize:11,color:'var(--g)'}}>{s.obs}</div>}
          </div>
        })}
      </div>}
      {modalSL&&<Modal title="REGISTRAR SETLIST" onClose={()=>setModalSL(false)}
        footer={<><Btn variant="outline" onClick={()=>setModalSL(false)}>Cancelar</Btn><Btn onClick={salvarSL}>Salvar</Btn></>}>
        <FormGrid>
          <FG><label>Data</label><input type="date" value={slForm.data} onChange={e=>setSlForm({...slForm,data:e.target.value})}/></FG>
          <FG><label>Culto</label><select value={slForm.culto} onChange={e=>setSlForm({...slForm,culto:e.target.value})}><option>Sábado Manhã</option><option>Domingo Noite</option></select></FG>
          <FG full><label>Músicas</label>
            <div style={{maxHeight:170,overflowY:'auto',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:7,padding:7}}>
              {(musicas||[]).map(m=><label key={m.id} style={{display:'flex',alignItems:'center',gap:6,padding:4,cursor:'pointer',fontSize:12,color:'var(--tx)'}}>
                <input type="checkbox" checked={slForm.musicas.includes(m.id)} onChange={()=>setSlForm(f=>({...f,musicas:f.musicas.includes(m.id)?f.musicas.filter(x=>x!==m.id):[...f.musicas,m.id]}))} style={{accentColor:'var(--cy)'}}/> {m.nome}{m.artista?' — '+m.artista:''}
              </label>)}
              {!(musicas||[]).length&&<div style={{color:'var(--g)',fontSize:11,padding:6}}>Nenhuma música cadastrada.</div>}
            </div>
          </FG>
          <FG full><label>Observações</label><input value={slForm.obs} onChange={e=>setSlForm({...slForm,obs:e.target.value})}/></FG>
        </FormGrid>
      </Modal>}
    </div>
  )
}
