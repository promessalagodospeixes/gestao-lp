import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbUpsert, dbInsert, dbDelete } from '../lib/supabase.js'
import { MESES, getSabDom, fmtBR, isCafeConexao, isAdmin, waLink, MSG_EB, nomeDisp } from '../lib/utils.js'
import { MonthNav, Btn, BtnGroup, Modal, FormGrid, FG } from '../components/UI.jsx'

const CLASSES = ['Nave','Jovens','Adolescentes','Juvenil','Crianças','Batismal']
const HAS_AUX = ['Nave','Crianças']

export default function EscalaEB() {
  const { state, dispatch } = useStore()
  const { escalasEB, funcoes, membros, ocorrencias, user } = state
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth())
  const [ano, setAno] = useState(now.getFullYear())
  const [abertas, setAbertas] = useState([])
  const [saving, setSaving] = useState(false)
  const [modalWA, setModalWA] = useState(false)
  const [modalMapa, setModalMapa] = useState(false)
  const [msgVersao, setMsgVersao] = useState(0)
  const [filtroWA_EB, setFiltroWA_EB] = useState('mes')
  const [diaSabWA, setDiaSabWA] = useState('')
  const [classeWA_EB, setClasseWA_EB] = useState('')
  const [modalConfEB, setModalConfEB] = useState(null) // {sabIdx, data}
  const [confRespEB, setConfRespEB] = useState('sim')
  const [ocItensEB, setOcItensEB] = useState([])
  const [savingConfEB, setSavingConfEB] = useState(false)

  const hoje = new Date(); hoje.setHours(0,0,0,0)

  const ocorrenciasEB = (sabIdx) => (ocorrencias||[]).filter(o=>o.ano===ano&&o.mes===mes+1&&o.slot===String(sabIdx)&&o.tipo==='eb')

  const abrirConfEB = (sabIdx, data) => {
    const ex = ocorrenciasEB(sabIdx)
    const reais = ex.filter(o=>o.funcao!=='_confirmado')
    setConfRespEB(reais.length?'nao':'sim')
    setOcItensEB(reais.length ? reais.map(o=>({classe:o.funcao||'',nome_original:o.nome_original||'',substituto:o.substituto||'',motivo:o.motivo||''})) : [])
    setModalConfEB({sabIdx, data})
  }

  const salvarConfEB = async () => {
    const {sabIdx} = modalConfEB
    setSavingConfEB(true)
    const existentes = ocorrenciasEB(sabIdx)
    await Promise.all(existentes.map(o=>dbDelete('ocorrencias', o.id)))
    let novos = []
    if (confRespEB==='sim') {
      const row = {ano,mes:mes+1,slot:String(sabIdx),tipo:'eb',funcao:'_confirmado',nome_original:null,substituto:null,motivo:null}
      const novo = await dbInsert('ocorrencias', row)
      novos = [novo||{id:Date.now(),...row}]
    } else {
      for (const it of ocItensEB) {
        if (!it.classe) continue
        const row = {ano,mes:mes+1,slot:String(sabIdx),tipo:'eb',funcao:it.classe,nome_original:it.nome_original||null,substituto:it.substituto||null,motivo:it.motivo||null}
        const novo = await dbInsert('ocorrencias', row)
        novos.push(novo||{id:Date.now()+Math.random(),...row})
      }
    }
    const restantes = (ocorrencias||[]).filter(o=>!(o.ano===ano&&o.mes===mes+1&&o.slot===String(sabIdx)&&o.tipo==='eb'))
    dispatch({type:'SET',key:'ocorrencias',value:[...restantes,...novos]})
    setSavingConfEB(false); setModalConfEB(null)
    dispatch({type:'TOAST',value:'✅ Confirmação registrada!'})
  }

  const chM = (d) => { let m=mes+d,a=ano; if(m>11){m=0;a++} if(m<0){m=11;a--} setMes(m);setAno(a) }
  const ch = `eb-${ano}-${mes}`
  const esc = escalasEB[ch]||{}
  const { sabs } = getSabDom(mes, ano)

  // Only use members registered in the function - never fallback to all members
  const fnMbs = (nome) => {
    const f = (funcoes||[]).find(x=>x.nome===nome)
    return f && (f.membros||[]).length ? f.membros : []
  }

  const toggle = (cl) => setAbertas(a=>a.includes(cl)?a.filter(x=>x!==cl):[...a,cl])

  const setVal = (cl, idx, fn, val) => {
    const k = `${cl}-${idx}`
    const novo = {...escalasEB, [ch]:{...esc,[k]:{...(esc[k]||{}),[fn]:val}}}
    dispatch({ type:'SET', key:'escalasEB', value:novo })
  }

  const gerarAuto = () => {
    const seed = Math.floor(Math.random() * 9973)
    const novoSlots = {}
    CLASSES.forEach(cl => {
      const profs = fnMbs(`Professor EB — ${cl}`)
      const auxs = fnMbs(`Auxiliar EB — ${cl}`)
      if (!profs.length) return
      sabs.forEach((d,i) => {
        if (isCafeConexao(d)) {
          novoSlots[`${cl}-${i}`] = { prof: 'CAFÉ E CONEXÃO', aux: '' }
          return
        }
        const k = `${cl}-${i}`
        novoSlots[k] = { prof: profs[(seed+i)%profs.length] }
        if (HAS_AUX.includes(cl) && auxs.length) {
          const auxOpts = auxs.filter(a=>a!==novoSlots[k].prof)
          novoSlots[k].aux = auxOpts.length ? auxOpts[(seed+i)%auxOpts.length] : ''
        }
      })
    })
    dispatch({ type:'SET', key:'escalasEB', value:{...escalasEB,[ch]:novoSlots} })
    dispatch({ type:'TOAST', value:'✨ Escola Bíblica gerada!' })
  }

  const salvar = async () => {
    setSaving(true)
    const rows = []
    Object.entries(esc).forEach(([k,s]) => {
      const parts = k.split('-')
      const idx = parts.pop()
      const classe = parts.join('-')
      rows.push({ ano, mes:mes+1, classe, slot:idx, prof:s.prof||null, aux:s.aux||null })
    })
    await Promise.all(rows.map(r=>dbUpsert('escalas_eb',r,'ano,mes,classe,slot')))
    setSaving(false)
    dispatch({ type:'TOAST', value:'Escola Biblica salva!' })
  }

  const salvarCelula = async (cl, sabIdx) => {
    const s = esc[`${cl}-${sabIdx}`] || {}
    await dbUpsert('escalas_eb', { ano, mes:mes+1, classe:cl, slot:String(sabIdx), prof:s.prof||null, aux:s.aux||null }, 'ano,mes,classe,slot')
    dispatch({ type:'TOAST', value:'Dia salvo!' })
  }

  // Build WA people list (professores e auxiliares escalados no mês)
  const getPessoasEscaladas = () => {
    const map = {}
    const add = (nome, papel, data) => {
      if (!nome || nome === 'CAFÉ E CONEXÃO') return
      if (!map[nome]) map[nome] = { nome, tel:'', fns:[] }
      map[nome].fns.push(`${papel} — ${fmtBR(new Date(data+'T00:00:00'))}`)
    }
    sabs.forEach((d,i) => {
      const dataStr = d.toISOString().slice(0,10)
      CLASSES.forEach(cl => {
        const s = esc[`${cl}-${i}`]||{}
        if (s.prof) add(s.prof, `Prof. ${cl}`, dataStr)
        if (s.aux) add(s.aux, `Aux. ${cl}`, dataStr)
      })
    })
    return Object.values(map).map(p=>{const mb=(membros||[]).find(m=>m.nome===p.nome);p.tel=mb?.tel||'';p.email=mb?.email||null;return p})
  }
  const todasPessoasEB = getPessoasEscaladas()
  const pessoasEBBase = filtroWA_EB === 'fds'
    ? (() => {
        const agora = new Date()
        const diasAteSab = agora.getDay() === 6 ? 7 : (6 - agora.getDay())
        const proxSab = new Date(agora); proxSab.setDate(agora.getDate() + diasAteSab); proxSab.setHours(0,0,0,0)
        const dataBR = fmtBR(proxSab)
        const filtered = todasPessoasEB.filter(p=>p.fns.some(fn=>fn.includes(dataBR))).map(p=>({...p,fns:p.fns.filter(fn=>fn.includes(dataBR))}))
        return filtered.length ? filtered : todasPessoasEB.filter(()=>false)
      })()
    : filtroWA_EB === 'dia' && diaSabWA !== ''
      ? (() => { const d = sabs[parseInt(diaSabWA)]; return d ? todasPessoasEB.filter(p=>p.fns.some(fn=>fn.includes(fmtBR(d)))).map(p=>({...p,fns:p.fns.filter(fn=>fn.includes(fmtBR(d)))})) : todasPessoasEB })()
      : todasPessoasEB
  const pessoasEB = classeWA_EB
    ? pessoasEBBase.filter(p=>p.fns.some(fn=>fn.includes(classeWA_EB))).map(p=>({...p,fns:p.fns.filter(fn=>fn.includes(classeWA_EB))}))
    : pessoasEBBase
  const msgPreview = MSG_EB[msgVersao]
  const previewText = msgPreview('João', 'Sabado 06/06 — Prof. Crianças')

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
        <MonthNav month={mes} year={ano} onPrev={()=>chM(-1)} onNext={()=>chM(1)} />
        <BtnGroup>
          <Btn variant="outline" size="sm" onClick={gerarAuto}>✨ Gerar Auto</Btn>
          <Btn size="sm" onClick={salvar} disabled={saving}>{saving?'Salvando...':'💾 Salvar'}</Btn>
          <Btn variant="outline" size="sm" onClick={()=>setModalMapa(true)}>🗺 Mapa Geral</Btn>
          <Btn variant="outline" size="sm" onClick={()=>window.print()}>📄 PDF</Btn>
          {isAdmin(user) && <Btn variant="wa" size="sm" onClick={()=>setModalWA(true)}>📱 Enviar Escala</Btn>}
        </BtnGroup>
      </div>
      {CLASSES.map(cl => {
        const profs = fnMbs(`Professor EB — ${cl}`)
        const auxs = fnMbs(`Auxiliar EB — ${cl}`)
        const showAux = HAS_AUX.includes(cl)
        const open = abertas.includes(cl)
        const semProf = !profs.length
        return (
          <div key={cl} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,overflow:'hidden',marginBottom:10}}>
            <div onClick={()=>toggle(cl)} style={{background:'var(--s2)',padding:'9px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontFamily:'var(--font-display)',fontSize:13,letterSpacing:2,color:'var(--w)'}}>📖 CLASSE {cl.toUpperCase()}</span>
                {semProf
                  ? <span style={{background:'rgba(239,68,68,.1)',color:'var(--red)',fontSize:9,padding:'2px 7px',borderRadius:99,fontWeight:600}}>sem prof. cadastrado</span>
                  : <span style={{background:'rgba(34,197,94,.1)',color:'var(--grn)',fontSize:9,padding:'2px 7px',borderRadius:99,fontWeight:600}}>{profs.length} prof.</span>
                }
              </div>
              <span style={{color:'var(--g)',fontSize:12}}>{open?'▲':'▼'}</span>
            </div>
            {open && (
              <div style={{padding:'9px 14px'}}>
                {semProf && <div style={{color:'var(--g)',fontSize:12,padding:'8px 0',fontStyle:'italic'}}>Cadastre professores no Registro de Funções para esta classe.</div>}
                {sabs.map((d,i) => {
                  const k = `${cl}-${i}`
                  const s = esc[k]||{}
                  const cafe = isCafeConexao(d)
                  return (
                    <div key={i} style={{display:'flex',alignItems:'center',padding:'6px 0',borderBottom:'1px solid var(--bd)',gap:9,opacity:cafe?.5:1}}>
                      <div style={{fontSize:9,color:cafe?'var(--yel)':'var(--g)',width:80,flexShrink:0}}>{fmtBR(d)}{cafe?' ☕':''}</div>
                      {cafe
                        ? <div style={{flex:1,fontSize:12,color:'var(--yel)'}}>☕ Café e Conexão — sem EB</div>
                        : <>
                          <select value={s.prof||''} onChange={e=>setVal(cl,i,'prof',e.target.value)} style={{flex:1,padding:'6px 8px',fontSize:11,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--w)'}}>
                            <option value="">— Professor —</option>
                            {profs.map(n=><option key={n} value={n}>{nomeDisp(n, membros)}</option>)}
                          </select>
                          {showAux && <select value={s.aux||''} onChange={e=>setVal(cl,i,'aux',e.target.value)} style={{flex:1,padding:'6px 8px',fontSize:11,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--w)'}}>
                            <option value="">— Auxiliar —</option>
                            {auxs.map(n=><option key={n} value={n}>{nomeDisp(n, membros)}</option>)}
                          </select>}
                          <Btn variant="outline" size="xs" onClick={()=>salvarCelula(cl,i)}>Salvar</Btn>
                        </>
                      }
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Mapa imprimível — oculto na tela, visível ao imprimir */}
      <div className="print-mapa">
        <h2>ESCOLA BÍBLICA — {MESES[mes].toUpperCase()} {ano}</h2>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              {CLASSES.map(cl=><th key={cl}>{cl}</th>)}
            </tr>
          </thead>
          <tbody>
            {sabs.map((d,i)=>{
              const cafe=isCafeConexao(d)
              return(
                <tr key={i}>
                  <td><strong>{fmtBR(d)}</strong>{cafe?' ☕':''}</td>
                  {CLASSES.map(cl=>{
                    const s=esc[`${cl}-${i}`]||{}
                    if(cafe) return <td key={cl} style={{color:'#888'}}>Café</td>
                    const prof=s.prof?nomeDisp(s.prof,membros):'—'
                    const aux=HAS_AUX.includes(cl)&&s.aux?` / ${nomeDisp(s.aux,membros)}`:''
                    return <td key={cl}>{prof}{aux}</td>
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mapa Geral modal */}
      {modalMapa && (
        <Modal title={`MAPA GERAL — ${MESES[mes].toUpperCase()} ${ano}`} onClose={()=>setModalMapa(false)} wide
          footer={<><Btn variant="outline" size="sm" onClick={()=>window.print()}>🖨 Imprimir</Btn><Btn variant="outline" onClick={()=>setModalMapa(false)}>Fechar</Btn></>}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,minWidth:600}}>
              <thead>
                <tr style={{background:'var(--s2)'}}>
                  <th style={{padding:'7px 10px',textAlign:'left',color:'var(--cy)',fontFamily:'var(--font-display)',fontSize:10,letterSpacing:1,borderBottom:'2px solid var(--bd)',whiteSpace:'nowrap'}}>Data</th>
                  {CLASSES.map(cl=>(
                    <th key={cl} style={{padding:'7px 10px',textAlign:'left',color:'var(--cy)',fontFamily:'var(--font-display)',fontSize:10,letterSpacing:1,borderBottom:'2px solid var(--bd)',whiteSpace:'nowrap'}}>{cl}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sabs.map((d,i)=>{
                  const cafe=isCafeConexao(d)
                  return(
                    <tr key={i} style={{borderBottom:'1px solid var(--bd)',background:cafe?'rgba(245,158,11,.04)':''}}>
                      <td style={{padding:'7px 10px',whiteSpace:'nowrap'}}>
                        <span style={{fontWeight:600,color:'var(--w)'}}>{fmtBR(d)}</span>
                        {cafe&&<span style={{marginLeft:5,fontSize:10,color:'var(--yel)'}}>☕</span>}
                      </td>
                      {CLASSES.map(cl=>{
                        const s=esc[`${cl}-${i}`]||{}
                        if(cafe) return <td key={cl} style={{padding:'7px 10px',color:'var(--yel)',fontSize:10}}>Café e Conexão</td>
                        const prof=s.prof?nomeDisp(s.prof,membros):null
                        const aux=HAS_AUX.includes(cl)&&s.aux?nomeDisp(s.aux,membros):null
                        return(
                          <td key={cl} style={{padding:'7px 10px',color:prof?'var(--tx)':'var(--g)',fontSize:10}}>
                            {prof||'—'}
                            {aux&&<div style={{fontSize:9,color:'var(--g)',marginTop:1}}>{aux}</div>}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* Confirmações de sábados passados */}
      {isAdmin(user) && sabs.some(d=>d<hoje) && (
        <div style={{marginTop:16,background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,overflow:'hidden'}}>
          <div style={{background:'var(--s2)',padding:'9px 14px',fontFamily:'var(--font-display)',fontSize:12,letterSpacing:2,color:'var(--w)'}}>CONFIRMAÇÕES</div>
          <div style={{padding:'9px 14px'}}>
            {sabs.map((d,i)=>{
              if(d>=hoje) return null
              if(isCafeConexao(d)) return null
              const ocs = ocorrenciasEB(i)
              const confirmado = ocs.some(o=>o.funcao==='_confirmado')
              const temOc = ocs.some(o=>o.funcao!=='_confirmado')
              return (
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:'1px solid var(--bd)'}}>
                  <div style={{flex:1,fontSize:12,color:'var(--tx)'}}>{fmtBR(d)}</div>
                  {temOc && <span style={{fontSize:10,color:'var(--red)',fontWeight:600}}>⚠ Com ocorrência</span>}
                  <Btn variant={confirmado?(temOc?'danger':'outline'):'wa'} size="xs" onClick={()=>abrirConfEB(i,d)}>
                    {confirmado?(temOc?'⚠ Ocorrência':'✅ Confirmado'):'📋 Confirmar'}
                  </Btn>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal confirmação EB */}
      {modalConfEB && (
        <Modal title={`CONFIRMAR EB — ${fmtBR(modalConfEB.data)}`} onClose={()=>setModalConfEB(null)}
          footer={<><Btn variant="outline" onClick={()=>setModalConfEB(null)}>Cancelar</Btn><Btn onClick={salvarConfEB} disabled={savingConfEB}>{savingConfEB?'Salvando...':'Salvar'}</Btn></>}>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:12,color:'var(--g)'}}>TUDO OCORREU COMO PLANEJADO?</label>
            <div style={{display:'flex',gap:8,marginTop:6}}>
              <Btn variant={confRespEB==='sim'?'green':'outline'} onClick={()=>setConfRespEB('sim')}>✅ Sim</Btn>
              <Btn variant={confRespEB==='nao'?'danger':'outline'} onClick={()=>setConfRespEB('nao')}>❌ Não</Btn>
            </div>
          </div>
          {confRespEB==='nao' && (
            <div>
              {ocItensEB.map((it,i)=>(
                <div key={i} style={{background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:8,padding:12,marginBottom:10}}>
                  <FormGrid>
                    <FG><label>Classe</label>
                      <select value={it.classe} onChange={e=>setOcItensEB(its=>its.map((o,idx)=>idx===i?{...o,classe:e.target.value}:o))}>
                        <option value="">— Selecionar —</option>
                        {CLASSES.map(c=><option key={c}>{c}</option>)}
                      </select>
                    </FG>
                    <FG><label>Quem faltou</label><input value={it.nome_original} onChange={e=>setOcItensEB(its=>its.map((o,idx)=>idx===i?{...o,nome_original:e.target.value}:o))} /></FG>
                    <FG><label>Quem substituiu</label><input value={it.substituto} onChange={e=>setOcItensEB(its=>its.map((o,idx)=>idx===i?{...o,substituto:e.target.value}:o))} /></FG>
                    <FG><label>Motivo</label><input value={it.motivo} onChange={e=>setOcItensEB(its=>its.map((o,idx)=>idx===i?{...o,motivo:e.target.value}:o))} /></FG>
                  </FormGrid>
                  <div style={{textAlign:'right',marginTop:6}}><Btn variant="danger" size="xs" onClick={()=>setOcItensEB(its=>its.filter((_,idx)=>idx!==i))}>🗑 Remover</Btn></div>
                </div>
              ))}
              <Btn variant="outline" size="sm" onClick={()=>setOcItensEB(its=>[...its,{classe:'',nome_original:'',substituto:'',motivo:''}])}>+ Adicionar ocorrência</Btn>
            </div>
          )}
        </Modal>
      )}

      {modalWA && (
        <Modal title={`ENVIAR ESCALA EB — ${MESES[mes].toUpperCase()} ${ano}`} onClose={()=>setModalWA(false)} wide
          footer={<Btn variant="outline" onClick={()=>setModalWA(false)}>Fechar</Btn>}>
          <div style={{display:'flex',gap:6,marginBottom:10}}>
            {[['mes','Todo o mes'],['fds','Proximo FDS'],['dia','Sabado especifico']].map(([v,l])=>(
              <button key={v} onClick={()=>setFiltroWA_EB(v)} style={{flex:1,padding:'7px',borderRadius:7,border:`2px solid ${filtroWA_EB===v?'var(--cy)':'var(--bd)'}`,background:filtroWA_EB===v?'var(--cdim)':'var(--s2)',color:filtroWA_EB===v?'var(--cy)':'var(--g)',cursor:'pointer',fontSize:11,fontWeight:600}}>{l}</button>
            ))}
          </div>
          {filtroWA_EB==='dia'&&(
            <select value={diaSabWA} onChange={e=>setDiaSabWA(e.target.value)} style={{width:'100%',marginBottom:10,padding:'7px 8px',fontSize:12}}>
              <option value="">— Selecionar sabado —</option>
              {sabs.map((d,i)=>!isCafeConexao(d)&&<option key={i} value={String(i)}>{fmtBR(d)}</option>)}
            </select>
          )}
          <select value={classeWA_EB} onChange={e=>setClasseWA_EB(e.target.value)} style={{width:'100%',marginBottom:10,padding:'7px 8px',fontSize:12}}>
            <option value="">📚 Todas as turmas</option>
            {CLASSES.map(cl=><option key={cl} value={cl}>📖 {cl}</option>)}
          </select>
          <div style={{marginBottom:12}}>
            <label>Selecionar Mensagem</label>
            <select value={msgVersao} onChange={e=>setMsgVersao(parseInt(e.target.value))} style={{marginTop:4}}>
              <option value={0}>Aviso 1 — "Passando pra avisar"</option>
              <option value={1}>Aviso 2 — "Segue sua participação"</option>
              <option value={2}>Aviso 3 — "É uma alegria contar com você"</option>
              <option value={3}>🔔 Lembrete — "Esse sábado é você!"</option>
            </select>
          </div>
          <div style={{background:'var(--s2)',borderRadius:8,padding:12,fontSize:12,lineHeight:1.8,color:'var(--tx)',whiteSpace:'pre-wrap',borderLeft:'3px solid var(--cy)',marginBottom:14,maxHeight:150,overflowY:'auto'}}>{previewText}</div>
          {pessoasEB.length===0
            ? <div style={{color:'var(--g)',fontSize:13,textAlign:'center',padding:20}}>{filtroWA_EB==='fds'?'Nenhum escalado para o próximo sábado.':'Ninguem escalado na Escola Biblica neste periodo ainda.'}</div>
            : <>
                {pessoasEB.some(p=>p.email) && (
                  <div style={{marginBottom:12,display:'flex',justifyContent:'flex-end'}}>
                    <button onClick={async()=>{
                      const comEmail=pessoasEB.filter(p=>p.email)
                      dispatch({type:'TOAST',value:`✉ Enviando para ${comEmail.length}...`})
                      try{const r=await fetch('/api/send-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pessoas:comEmail.map(p=>({nome:p.nome,email:p.email,linhas:p.fns})),tipo:'eb',mes,ano,escopo:filtroWA_EB})});const d=await r.json();dispatch({type:'TOAST',value:`✅ ${d.enviados} e-mail(s)!`})}catch{dispatch({type:'TOAST',value:'⚠ Erro.'})}
                    }} style={{padding:'7px 14px',borderRadius:7,border:'1px solid rgba(0,188,212,.4)',background:'rgba(0,188,212,.08)',color:'var(--cy)',cursor:'pointer',fontSize:12,fontWeight:600}}>
                      ✉ Enviar todos por email ({pessoasEB.filter(p=>p.email).length})
                    </button>
                  </div>
                )}
                {pessoasEB.map(p=>(
              <div key={p.nome} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'9px 0',borderBottom:'1px solid var(--bd)'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--w)'}}>{p.nome}</div>
                  <div style={{fontSize:11,color:'var(--g)',marginTop:2}}>{p.fns.join(' · ')}</div>
                </div>
                <div style={{display:'flex',gap:5,flexShrink:0}}>
                  {p.tel ? <a href={waLink(p.tel, MSG_EB[msgVersao](p.nome.split(' ')[0], p.fns.join('\n'), filtroWA_EB))} target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',padding:'5px 10px',background:'rgba(34,197,94,.12)',border:'1px solid rgba(34,197,94,.3)',borderRadius:6,color:'var(--grn)',textDecoration:'none',fontSize:11,fontWeight:600}}>💬</a> : <span style={{fontSize:10,color:'var(--g)'}}>sem tel</span>}
                  <button onClick={async()=>{if(!p.email){dispatch({type:'TOAST',value:'⚠ Sem e-mail cadastrado.'});return}dispatch({type:'TOAST',value:`✉ Enviando...`});try{const r=await fetch('/api/send-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pessoas:[{nome:p.nome,email:p.email,linhas:p.fns}],tipo:'eb',mes,ano,escopo:'mes'})});const d=await r.json();dispatch({type:'TOAST',value:d.enviados?`✅ E-mail enviado!`:'⚠ Falha.'})}catch{dispatch({type:'TOAST',value:'⚠ Erro.'})}}} style={{padding:'5px 10px',borderRadius:6,border:`1px solid ${p.email?'rgba(0,188,212,.4)':'var(--bd)'}`,background:p.email?'rgba(0,188,212,.08)':'transparent',color:p.email?'var(--cy)':'var(--g)',cursor:p.email?'pointer':'default',fontSize:11}}>📧</button>
                </div>
              </div>
            ))}
              </>
          }
        </Modal>
      )}
    </div>
  )
}
