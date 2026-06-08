import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbUpsert, dbInsert } from '../lib/supabase.js'
import { getSabDom, getCultosOrdenados, fmtBR, isCafeConexao, normalizar } from '../lib/utils.js'
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
  const [slBusca, setSlBusca] = useState('')

  const chM = (d) => { let m=mes+d,a=ano; if(m>11){m=0;a++} if(m<0){m=11;a--} setMes(m);setAno(a) }
  const ch = `lv-${ano}-${mes}`
  const esc = escalasLv[ch]||{}
  const { sabs, doms } = getSabDom(mes, ano)

  // Only use registered members - never fallback
  const fnMbs = (nome) => {
    const f = (funcoes||[]).find(x=>x.nome===nome)
    return f && (f.membros||[]).length ? f.membros : []
  }
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
    // Smart rotation - avoid sequential repetition
    const smartPick = (lista, usadosVocal, usadosInst, lastUsed, off) => {
      if (!lista.length) return ''
      // Filter out those used in previous culto
      const pref = lista.filter(p => !usadosVocal.includes(p) && !usadosInst.includes(p) && !lastUsed.includes(p))
      const pool = pref.length ? pref : lista.filter(p => !usadosVocal.includes(p) && !usadosInst.includes(p))
      const final = pool.length ? pool : lista
      return final[off % final.length] || ''
    }

    const novoEsc = {}
    const lastVocUsed = []
    const lastInstUsed = {}

    const fillCulto = (slot, idx, nL) => {
      if (!vocais.length && INSTS.every(p=>!fnMbs(p).length)) return
      const vU = []
      for(let n=1;n<=nL;n++){
        const p = smartPick(vocais, vU, [], lastVocUsed, idx*nL+n-1)
        novoEsc[`${slot}-v${n}`] = p
        if(p) vU.push(p)
      }
      lastVocUsed.length = 0
      lastVocUsed.push(...vU)

      novoEsc[slot] = {inst:{}}
      const iU = []
      INSTS.forEach((papel,pi)=>{
        const ms = fnMbs(papel)
        if(!ms.length) return  // Skip if nobody registered
        const last = lastInstUsed[papel] || []
        const p = smartPick(ms, vU, iU, last, idx+pi)
        if (p) {
          novoEsc[slot].inst[papel] = p
          iU.push(p)
          lastInstUsed[papel] = [p]
        }
      })
    }

    sabs.forEach((d,i) => {
      const slot = `sab-${i}`
      if (isCafeConexao(d)) {
        // Café e Conexão - no louvor solo but instrumental can play
        fillCulto(slot, i, 0) // 0 vocals
        novoEsc[slot] = { ...novoEsc[slot], cafe: true }
      } else {
        fillCulto(slot, i, 4)
      }
    })
    doms.forEach((_,i) => fillCulto(`dom-${i}`, i+10, 5))

    dispatch({ type:'SET', key:'escalasLv', value:{...escalasLv,[ch]:novoEsc} })
    dispatch({ type:'TOAST', value:'✨ Louvor gerado!' })
  }

  const salvar = async () => {
    setSaving(true)
    const slots = {}
    Object.entries(esc).forEach(([k,v])=>{
      if(k.match(/-v\d+$/)){
        const slot=k.replace(/-v\d+$/,'')
        if(!slots[slot])slots[slot]={vocal:{}}
        slots[slot].vocal[k.match(/-v(\d+)$/)[1]]=v
      } else if(v&&typeof v==='object'&&v.inst){
        if(!slots[k])slots[k]={vocal:{}}
        slots[k].inst=v.inst
      }
    })
    const rows = Object.entries(slots).map(([slot,s])=>({ano,mes:mes+1,slot,vocal:JSON.stringify(s.vocal||{}),instrumental:JSON.stringify(s.inst||{})}))
    await Promise.all(rows.map(r=>dbUpsert('escalas_lv',r,'ano,mes,slot')))
    setSaving(false)
    dispatch({ type:'TOAST', value:'💾 Louvor salvo!' })
  }

  const salvarSL = async () => {
    if(!slForm.data||!slForm.musicas.length){dispatch({type:'TOAST',value:'⚠ Selecione data e músicas.'});return}
    const row={data:slForm.data,culto:slForm.culto,musicas:JSON.stringify(slForm.musicas),obs:slForm.obs}
    const novo=await dbInsert('setlists',row)
    dispatch({type:'SET',key:'setlists',value:[...(setlists||[]),{...(novo||{id:Date.now()}),...row,musicas:slForm.musicas}]})
    setModalSL(false);setSlForm({data:'',culto:'Sábado Manhã',musicas:[],obs:''});setSlBusca('')
    dispatch({type:'TOAST',value:'🎵 Setlist salvo!'})
  }

  const musicasFiltradas = slBusca
    ? (musicas||[]).filter(m=>normalizar(m.nome).includes(normalizar(slBusca))||normalizar(m.artista||'').includes(normalizar(slBusca)))
    : (musicas||[])

  const CultoCard = ({data,tipo,idx}) => {
    const slot=`${tipo}-${idx}`
    const cafe = tipo==='sab' && isCafeConexao(data)
    const nL=cafe?0:tipo==='sab'?4:5
    const slData=data.toISOString().slice(0,10)
    const sl=(setlists||[]).find(s=>s.data===slData&&(tipo==='sab'?s.culto==='Sábado Manhã':s.culto==='Domingo Noite'))

    return(
      <div style={{background:'var(--s1)',border:`1px solid ${cafe?'rgba(245,158,11,.4)':'var(--bd)'}`,borderRadius:10,overflow:'hidden',marginBottom:12}}>
        <div style={{background:cafe?'rgba(245,158,11,.08)':'var(--s2)',padding:'9px 14px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:12,letterSpacing:2,color:cafe?'var(--yel)':'var(--w)'}}>
            {tipo==='sab'?'☀ SÁBADO':'🌙 DOMINGO'} — {fmtBR(data)}{cafe?' — ☕ CAFÉ E CONEXÃO':`— ${nL} louvores`}
          </div>
          {sl?<Tag color="green">🎵 Setlist</Tag>:<Tag color="gray">Sem setlist</Tag>}
        </div>
        {cafe ? (
          <div style={{padding:'12px 14px',color:'var(--yel)',fontSize:12}}>☕ Café e Conexão — sem louvor vocal neste sábado</div>
        ) : (
          <div style={{padding:'11px 14px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div>
              <div style={{fontSize:9,color:'var(--cy)',letterSpacing:2,textTransform:'uppercase',marginBottom:5,fontWeight:600}}>🎤 VOCAL</div>
              {vocais.length===0 && <div style={{color:'var(--g)',fontSize:11,fontStyle:'italic'}}>Cadastre vocais no Registro de Funções</div>}
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
                if(!ms.length) return null // Don't show instruments with no one registered
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
        )}
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
          <Btn size="sm" onClick={()=>{setSlForm({data:new Date().toISOString().slice(0,10),culto:'Sábado Manhã',musicas:[],obs:''});setSlBusca('');setModalSL(true)}}>🎵 Setlist</Btn>
        </BtnGroup>
      </div>
      {getCultosOrdenados(mes,ano).map(c=><CultoCard key={`${c.tipo}-${c.idx}`} data={c.data} tipo={c.tipo} idx={c.idx}/>)}

      {mesSLs.length>0&&<div style={{marginTop:16}}>
        <div style={{fontFamily:'var(--font-display)',fontSize:16,letterSpacing:2,color:'var(--w)',marginBottom:10}}>SETLISTS</div>
        {mesSLs.map(s=>{
          const ms=(s.musicas||[]).map(id=>{const m=(musicas||[]).find(x=>x.id===id);return m?m.nome:'?'})
          return<div key={s.id} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,padding:12,marginBottom:8}}>
            <div style={{display:'flex',gap:9,marginBottom:6,flexWrap:'wrap'}}>
              <strong style={{color:'var(--w)'}}>{s.culto}</strong>
              <span style={{color:'var(--cy)',fontSize:11}}>{new Date(s.data+'T00:00:00').toLocaleDateString('pt-BR')}</span>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>{ms.map(m=><Tag key={m} color="cyan">🎵 {m}</Tag>)}</div>
            {s.obs&&<div style={{marginTop:4,fontSize:11,color:'var(--g)'}}>{s.obs}</div>}
          </div>
        })}
      </div>}

      {modalSL&&<Modal title="REGISTRAR SETLIST" onClose={()=>setModalSL(false)} wide
        footer={<><Btn variant="outline" onClick={()=>setModalSL(false)}>Cancelar</Btn><Btn onClick={salvarSL}>Salvar</Btn></>}>
        <FormGrid>
          <FG><label>Data</label><input type="date" value={slForm.data} onChange={e=>setSlForm({...slForm,data:e.target.value})}/></FG>
          <FG><label>Culto</label><select value={slForm.culto} onChange={e=>setSlForm({...slForm,culto:e.target.value})}><option>Sábado Manhã</option><option>Domingo Noite</option></select></FG>
          <FG full>
            <label>Músicas ({slForm.musicas.length} selecionadas)</label>
            <input placeholder="🔍 Buscar música..." value={slBusca} onChange={e=>setSlBusca(e.target.value)} style={{marginBottom:6}}/>
            <div style={{maxHeight:200,overflowY:'auto',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:7}}>
              {musicasFiltradas.length===0
                ? <div style={{color:'var(--g)',fontSize:11,padding:10}}>Nenhuma música encontrada.</div>
                : musicasFiltradas.map(m=>(
                  <label key={m.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',cursor:'pointer',borderBottom:'1px solid var(--bd)',fontSize:12,color:slForm.musicas.includes(m.id)?'var(--cy)':'var(--tx)',background:slForm.musicas.includes(m.id)?'var(--cdim)':''}}>
                    <input type="checkbox" checked={slForm.musicas.includes(m.id)} onChange={()=>setSlForm(f=>({...f,musicas:f.musicas.includes(m.id)?f.musicas.filter(x=>x!==m.id):[...f.musicas,m.id]}))} style={{accentColor:'var(--cy)',flexShrink:0,width:15,height:15}}/>
                    <span style={{flex:1,minWidth:0,lineHeight:1.4,wordBreak:'break-word'}}>{m.nome}{m.artista?' — '+m.artista:''}</span>
                  </label>
                ))
              }
            </div>
          </FG>
          <FG full><label>Observações</label><input value={slForm.obs} onChange={e=>setSlForm({...slForm,obs:e.target.value})}/></FG>
        </FormGrid>
      </Modal>}
    </div>
  )
}
