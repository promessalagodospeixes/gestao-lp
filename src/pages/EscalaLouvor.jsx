import { useState, useMemo } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbUpsert, dbInsert, dbDelete } from '../lib/supabase.js'
import { getSabDom, getCultosOrdenados, fmtBR, isCafeConexao, normalizar, waLink, MSG_LV, MESES } from '../lib/utils.js'
import { MonthNav, Btn, BtnGroup, Modal, FormGrid, FG, Tag } from '../components/UI.jsx'

const INSTS = ['Teclado','Bateria','Baixo','Guitarra','Violão','Som','Telão','Mídia']

// Normaliza valor do instrumental: string antiga → array novo
const normInst = (val) => {
  if (!val) return [{nome:'',obs:''},{nome:'',obs:''}]
  if (typeof val === 'string') return [{nome:val,obs:''},{nome:'',obs:''}]
  if (Array.isArray(val)) {
    const arr = val.map(v => typeof v === 'string' ? {nome:v,obs:''} : {nome:v?.nome||'',obs:v?.obs||''})
    while (arr.length < 2) arr.push({nome:'',obs:''})
    return arr.slice(0,2)
  }
  return [{nome:'',obs:''},{nome:'',obs:''}]
}

export default function EscalaLouvor() {
  const { state, dispatch } = useStore()
  const { escalasLv, funcoes, membros, musicas, setlists } = state
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth())
  const [ano, setAno] = useState(now.getFullYear())
  const [saving, setSaving] = useState(false)
  const [modalSL, setModalSL] = useState(false)
  const [slForm, setSlForm] = useState({ id:null, data:'', culto:'Sábado Manhã', musicas:[], obs:'' })
  const [slBusca, setSlBusca] = useState('')
  const [modalWA, setModalWA] = useState(false)
  const [msgVersao, setMsgVersao] = useState(0)
  const [filtroWA, setFiltroWA] = useState('mes')
  const [modalMapa, setModalMapa] = useState(false)

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

  const setInst = (slot, papel, idx, field, val) => {
    const cur = esc[slot]||{}
    const arr = normInst((cur.inst||{})[papel])
    arr[idx] = {...arr[idx], [field]: val}
    // Se ambos vazios, armazena string vazia para economizar espaço
    const instVal = arr.every(x=>!x.nome) ? '' : arr
    const inst = {...(cur.inst||{}), [papel]: instVal}
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
          novoEsc[slot].inst[papel] = [{nome:p,obs:''},{nome:'',obs:''}]
          iU.push(p)
          lastInstUsed[papel] = [p]
        }
      })
    }

    sabs.forEach((d,i) => fillCulto(`sab-${i}`, i, 3))
    doms.forEach((_,i) => fillCulto(`dom-${i}`, i+10, 3))

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

  const abrirSetlist = (data, cultoNome) => {
    const dataStr = data.toISOString().slice(0,10)
    // Se já existe setlist para esse culto, abre para editar
    const existente = (setlists||[]).find(s=>s.data===dataStr&&s.culto===cultoNome)
    if (existente) {
      setSlForm({ id: existente.id, data: existente.data, culto: existente.culto, musicas: Array.isArray(existente.musicas)?existente.musicas:[], obs: existente.obs||'' })
    } else {
      setSlForm({ id: null, data: dataStr, culto: cultoNome, musicas: [], obs: '' })
    }
    setSlBusca(''); setModalSL(true)
  }

  const salvarSL = async () => {
    if(!slForm.data||!slForm.musicas.length){dispatch({type:'TOAST',value:'⚠ Selecione data e músicas.'});return}
    const row={data:slForm.data,culto:slForm.culto,musicas:JSON.stringify(slForm.musicas),obs:slForm.obs}
    if (slForm.id) {
      // Editar existente
      await dbUpsert('setlists', {...row, id: slForm.id}, 'id')
      dispatch({type:'SET',key:'setlists',value:(setlists||[]).map(s=>s.id===slForm.id?{...s,...row,musicas:slForm.musicas}:s)})
      dispatch({type:'TOAST',value:'✅ Setlist atualizado!'})
    } else {
      const novo=await dbInsert('setlists',row)
      dispatch({type:'SET',key:'setlists',value:[...(setlists||[]),{...(novo||{id:Date.now()}),...row,musicas:slForm.musicas}]})
      dispatch({type:'TOAST',value:'🎵 Setlist salvo!'})
    }
    setModalSL(false);setSlForm({id:null,data:'',culto:'Sábado Manhã',musicas:[],obs:''});setSlBusca('')
  }

  const excluirSL = async (id) => {
    await dbDelete('setlists', id)
    dispatch({type:'SET',key:'setlists',value:(setlists||[]).filter(s=>s.id!==id)})
    dispatch({type:'TOAST',value:'🗑 Setlist removido.'})
  }

  const musicasFiltradas = slBusca
    ? (musicas||[]).filter(m=>normalizar(m.nome).includes(normalizar(slBusca))||normalizar(m.artista||'').includes(normalizar(slBusca)))
    : (musicas||[])

  const CultoCard = ({data,tipo,idx}) => {
    const slot=`${tipo}-${idx}`
    const cafe = tipo==='sab' && isCafeConexao(data)
    const nL=3
    const slData=data.toISOString().slice(0,10)
    const cultoNome = tipo==='sab'?'Sábado Manhã':'Domingo Noite'
    const sl=(setlists||[]).find(s=>s.data===slData&&s.culto===cultoNome)

    return(
      <div style={{background:'var(--s1)',border:`1px solid ${cafe?'rgba(245,158,11,.4)':'var(--bd)'}`,borderRadius:10,overflow:'hidden',marginBottom:12}}>
        <div style={{background:cafe?'rgba(245,158,11,.08)':'var(--s2)',padding:'9px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:12,letterSpacing:2,color:cafe?'var(--yel)':'var(--w)',flex:1}}>
            {tipo==='sab'?'☀ SÁBADO':'🌙 DOMINGO'} — {fmtBR(data)}{cafe?' — ☕ CAFÉ E CONEXÃO':`— ${nL} louvores`}
          </div>
          <button onClick={()=>abrirSetlist(data, cultoNome)} style={{padding:'4px 10px',fontSize:11,background:sl?'rgba(16,185,129,.15)':'var(--s3)',border:`1px solid ${sl?'rgba(16,185,129,.5)':'var(--bd)'}`,borderRadius:5,color:sl?'var(--gr)':'var(--g)',cursor:'pointer',whiteSpace:'nowrap'}}>
            {sl?'🎵 Ver Setlist':'+ Setlist'}
          </button>
        </div>
        <div style={{padding:'11px 14px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div>
              <div style={{fontSize:9,color:'var(--cy)',letterSpacing:2,textTransform:'uppercase',marginBottom:5,fontWeight:600}}>🎤 VOCAL</div>
              {vocais.length===0 && <div style={{color:'var(--g)',fontSize:11,fontStyle:'italic'}}>Cadastre vocais no Registro de Funções</div>}
              {Array.from({length:nL},(_,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',padding:'5px 0',borderBottom:'1px solid var(--bd)',gap:8}}>
                  <div style={{fontSize:9,color:'var(--g)',width:60,flexShrink:0}}>Vocal {i+1}</div>
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
                if(!ms.length) return null
                const arr=normInst((esc[slot]?.inst||{})[papel])
                return(
                  <div key={papel} style={{padding:'5px 0',borderBottom:'1px solid var(--bd)'}}>
                    <div style={{fontSize:9,color:'var(--g)',marginBottom:3}}>{papel}</div>
                    {arr.map((item,idx)=>(
                      <div key={idx} style={{display:'flex',alignItems:'center',gap:4,marginBottom:idx===0?3:0}}>
                        <select value={item.nome} onChange={e=>setInst(slot,papel,idx,'nome',e.target.value)}
                          style={{flex:1,padding:'4px 6px',fontSize:11,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--w)',minWidth:0}}>
                          <option value="">—</option>{ms.map(n=><option key={n}>{n}</option>)}
                        </select>
                        {item.nome&&(
                          <input value={item.obs} onChange={e=>setInst(slot,papel,idx,'obs',e.target.value)}
                            placeholder="L1-L2" title="Quais louvores toca"
                            style={{width:46,padding:'4px 5px',fontSize:10,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--cy)',textAlign:'center'}}/>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
      </div>
    )
  }

  // Próximo FDS
  const proximoFDSSlots = useMemo(() => {
    const hj = new Date(); hj.setHours(0,0,0,0)
    const cultos = getCultosOrdenados(mes, ano).filter(c => c.data >= hj)
    if (!cultos.length) return []
    const first = cultos[0]
    const slots = [`${first.tipo}-${first.idx}`]
    const partner = cultos.find(c => c.tipo !== first.tipo && Math.abs(c.data - first.data) <= 2*24*3600*1000)
    if (partner) slots.push(`${partner.tipo}-${partner.idx}`)
    return slots
  }, [mes, ano])

  const tituloFDS = useMemo(() => {
    return proximoFDSSlots.map(sl => {
      const idx = parseInt(sl.split('-')[1])
      const d = sl.startsWith('sab') ? sabs[idx] : doms[idx]
      return d ? fmtBR(d) : ''
    }).filter(Boolean).join(' + ')
  }, [proximoFDSSlots, sabs, doms])

  // Compila escala por pessoa para o modal WhatsApp
  const todasPessoasLv = useMemo(() => { // eslint-disable-line
    const map = {}
    const addLine = (nome, linha) => {
      if (!nome) return
      if (!map[nome]) map[nome] = []
      map[nome].push(linha)
    }
    getCultosOrdenados(mes, ano).forEach(c => {
      const slot = `${c.tipo}-${c.idx}`
      const dataBR = fmtBR(c.data)
      const tipoNome = c.tipo === 'sab' ? 'Sábado' : 'Domingo'
      const linha = `📅 ${tipoNome} ${dataBR}`
      // Vocais
      for (let n = 1; n <= 3; n++) {
        const nome = esc[`${slot}-v${n}`]
        if (nome) addLine(nome, `${linha} — 🎤 Vocal`)
      }
      // Instrumentais
      const inst = esc[slot]?.inst || {}
      Object.entries(inst).forEach(([papel, val]) => {
        normInst(val).forEach(item => {
          if (item.nome) {
            const obs = item.obs ? ` (${item.obs})` : ''
            addLine(item.nome, `${linha} — 🎸 ${papel}${obs}`)
          }
        })
      })
    })
    // Busca telefone de cada pessoa
    return Object.entries(map).map(([nome, linhas]) => {
      const mb = (membros||[]).find(m => m.nome === nome)
      return { nome, tel: mb?.tel || null, linhas }
    }).sort((a,b) => a.nome.localeCompare(b.nome))
  }, [esc, mes, ano, membros])

  const pessoasLv = useMemo(() => {
    if (filtroWA !== 'fds' || !proximoFDSSlots.length) return todasPessoasLv
    return todasPessoasLv.filter(p =>
      p.linhas.some(linha => proximoFDSSlots.some(sl => {
        const idx = parseInt(sl.split('-')[1])
        const d = sl.startsWith('sab') ? sabs[idx] : doms[idx]
        return d && linha.includes(fmtBR(d))
      }))
    ).map(p => ({
      ...p,
      linhas: p.linhas.filter(linha => proximoFDSSlots.some(sl => {
        const idx = parseInt(sl.split('-')[1])
        const d = sl.startsWith('sab') ? sabs[idx] : doms[idx]
        return d && linha.includes(fmtBR(d))
      }))
    }))
  }, [todasPessoasLv, filtroWA, proximoFDSSlots, sabs, doms])

  const previewWA = MSG_LV[msgVersao]('Nome', '📅 Sábado 07/06 — 🎤 Vocal\n📅 Domingo 15/06 — 🎤 Vocal')

  const mesSLs=(setlists||[]).filter(s=>{const d=new Date(s.data+'T00:00:00');return d.getMonth()===mes&&d.getFullYear()===ano})

  return(
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
        <MonthNav month={mes} year={ano} onPrev={()=>chM(-1)} onNext={()=>chM(1)} />
        <BtnGroup>
          <Btn variant="outline" size="sm" onClick={gerarAuto}>✨ Gerar Auto</Btn>
          <Btn size="sm" onClick={salvar} disabled={saving}>{saving?'Salvando...':'💾 Salvar'}</Btn>
          <Btn variant="outline" size="sm" onClick={()=>setModalMapa(true)}>🗺 Mapa Geral</Btn>
          <Btn variant="outline" size="sm" onClick={()=>setModalWA(true)}>💬 Enviar Escala</Btn>
        </BtnGroup>
      </div>
      {getCultosOrdenados(mes,ano).map(c=><CultoCard key={`${c.tipo}-${c.idx}`} data={c.data} tipo={c.tipo} idx={c.idx}/>)}

      {mesSLs.length>0&&<div style={{marginTop:16}}>
        <div style={{fontFamily:'var(--font-display)',fontSize:16,letterSpacing:2,color:'var(--w)',marginBottom:10}}>SETLISTS</div>
        {mesSLs.map(s=>{
          const ms=(s.musicas||[]).map(id=>{const m=(musicas||[]).find(x=>x.id===id);return m?m.nome:'?'})
          return<div key={s.id} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,padding:12,marginBottom:8}}>
            <div style={{display:'flex',gap:9,marginBottom:6,flexWrap:'wrap',alignItems:'center'}}>
              <strong style={{color:'var(--w)',flex:1}}>{s.culto}</strong>
              <span style={{color:'var(--cy)',fontSize:11}}>{new Date(s.data+'T00:00:00').toLocaleDateString('pt-BR')}</span>
              <button onClick={()=>excluirSL(s.id)} title="Excluir setlist" style={{background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:5,color:'var(--rd)',cursor:'pointer',fontSize:11,padding:'2px 8px'}}>🗑</button>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>{ms.map(m=><Tag key={m} color="cyan">🎵 {m}</Tag>)}</div>
            {s.obs&&<div style={{marginTop:4,fontSize:11,color:'var(--g)'}}>{s.obs}</div>}
          </div>
        })}
      </div>}

      {/* Mapa Geral */}
      {modalMapa&&(
        <Modal title={`MAPA GERAL — ${MESES[mes].toUpperCase()} ${ano}`} onClose={()=>setModalMapa(false)} wide
          footer={<Btn variant="outline" onClick={()=>setModalMapa(false)}>Fechar</Btn>}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,minWidth:700}}>
              <thead>
                <tr style={{background:'var(--s2)'}}>
                  {['Data','V1','V2','V3',...INSTS].map(h=>(
                    <th key={h} style={{padding:'7px 8px',textAlign:'left',color:'var(--cy)',fontFamily:'var(--font-display)',fontSize:10,letterSpacing:1,borderBottom:'2px solid var(--bd)',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {getCultosOrdenados(mes,ano).map(c=>{
                  const slot=`${c.tipo}-${c.idx}`
                  const inst=esc[slot]?.inst||{}
                  return(
                    <tr key={slot} style={{borderBottom:'1px solid var(--bd)'}}>
                      <td style={{padding:'7px 8px',whiteSpace:'nowrap'}}>
                        <span style={{fontWeight:600,color:'var(--w)'}}>{fmtBR(c.data)}</span>
                        <span style={{marginLeft:5,fontSize:10,color:c.tipo==='sab'?'var(--yel)':'var(--cy)'}}>{c.tipo==='sab'?'☀':'🌙'}</span>
                      </td>
                      {[1,2,3].map(n=>(
                        <td key={n} style={{padding:'7px 8px',color:esc[`${slot}-v${n}`]?'var(--tx)':'var(--g)'}}>{esc[`${slot}-v${n}`]||'—'}</td>
                      ))}
                      {INSTS.map(p=>{
                        const arr=normInst(inst[p])
                        const nomes=arr.map(x=>x.nome?(x.obs?`${x.nome.split(' ')[0]} (${x.obs})`:x.nome.split(' ')[0]):null).filter(Boolean)
                        return <td key={p} style={{padding:'7px 8px',color:nomes.length?'var(--tx)':'var(--g)',fontSize:10}}>{nomes.length?nomes.join(' / '):'—'}</td>
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* Modal WhatsApp — Enviar Escala */}
      {modalWA&&(
        <Modal title={`ENVIAR ESCALA DE LOUVOR — ${MESES[mes].toUpperCase()} ${ano}`} onClose={()=>setModalWA(false)} wide
          footer={<Btn variant="outline" onClick={()=>setModalWA(false)}>Fechar</Btn>}>
          {/* Filtro mês vs FDS */}
          <div style={{display:'flex',gap:8,marginBottom:14}}>
            <button onClick={()=>setFiltroWA('mes')} style={{flex:1,padding:'8px',borderRadius:7,border:`2px solid ${filtroWA==='mes'?'var(--cy)':'var(--bd)'}`,background:filtroWA==='mes'?'var(--cdim)':'var(--s2)',color:filtroWA==='mes'?'var(--cy)':'var(--g)',cursor:'pointer',fontSize:12,fontWeight:600}}>
              📅 Todo o mês
            </button>
            <button onClick={()=>setFiltroWA('fds')} style={{flex:1,padding:'8px',borderRadius:7,border:`2px solid ${filtroWA==='fds'?'var(--gr)':'var(--bd)'}`,background:filtroWA==='fds'?'rgba(16,185,129,.1)':'var(--s2)',color:filtroWA==='fds'?'var(--gr)':'var(--g)',cursor:'pointer',fontSize:12,fontWeight:600}}>
              📆 Próximo FDS {filtroWA==='fds'&&tituloFDS?`(${tituloFDS})`:''}
            </button>
          </div>
          <div style={{marginBottom:12}}>
            <label>Selecionar Mensagem</label>
            <select value={msgVersao} onChange={e=>setMsgVersao(parseInt(e.target.value))} style={{marginTop:4}}>
              <option value={0}>Versão 1 — "Contamos com você"</option>
              <option value={1}>Versão 2 — "Que alegria ter você"</option>
              <option value={2}>Versão 3 — "É uma honra servir"</option>
            </select>
          </div>
          <div style={{background:'var(--s2)',borderRadius:8,padding:12,fontSize:12,lineHeight:1.8,color:'var(--tx)',whiteSpace:'pre-wrap',borderLeft:'3px solid var(--cy)',marginBottom:14,maxHeight:130,overflowY:'auto'}}>{previewWA}</div>
          {pessoasLv.length===0
            ? <div style={{color:'var(--g)',fontSize:13,textAlign:'center',padding:20}}>{filtroWA==='fds'?'Nenhum escalado para o próximo FDS.':'Nenhuma pessoa escalada neste mês ainda.'}</div>
            : pessoasLv.map(p=>(
              <div key={p.nome} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 0',borderBottom:'1px solid var(--bd)'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--w)'}}>{p.nome}</div>
                  <div style={{fontSize:11,color:'var(--g)',marginTop:3,lineHeight:1.7}}>{p.linhas.map((l,i)=><div key={i}>{l}</div>)}</div>
                </div>
                {p.tel
                  ? <a href={waLink(p.tel, MSG_LV[msgVersao](p.nome.split(' ')[0], p.linhas.join('\n')))} target="_blank" rel="noopener"
                      style={{display:'inline-flex',alignItems:'center',gap:5,padding:'5px 11px',background:'rgba(34,197,94,.12)',border:'1px solid rgba(34,197,94,.3)',borderRadius:6,color:'var(--grn)',textDecoration:'none',fontSize:11,fontWeight:600,flexShrink:0}}>
                      💬 Enviar
                    </a>
                  : <span style={{fontSize:10,color:'var(--g)',flexShrink:0}}>sem tel</span>
                }
              </div>
            ))
          }
        </Modal>
      )}

      {modalSL&&<Modal title={slForm.id?"EDITAR SETLIST":"REGISTRAR SETLIST"} onClose={()=>setModalSL(false)} wide
        footer={<>
          {slForm.id && <Btn variant="danger" onClick={()=>{excluirSL(slForm.id);setModalSL(false)}}>🗑 Excluir</Btn>}
          <Btn variant="outline" onClick={()=>setModalSL(false)}>Cancelar</Btn>
          <Btn onClick={salvarSL}>Salvar</Btn>
        </>}>
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
