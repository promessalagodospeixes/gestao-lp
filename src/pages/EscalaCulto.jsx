import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbUpsert, dbInsert, dbDelete } from '../lib/supabase.js'
import { MESES, getSabDom, getCultosOrdenados, fmtBR, isPastor, isAdmin, isCafeConexao, waLink, MSG_ESCALA, MSG_GRUPO_CULTO, nomeDisp } from '../lib/utils.js'
import { MonthNav, Btn, BtnGroup, Modal, FG, FormGrid, Tabs } from '../components/UI.jsx'

const FNS_SAB = [{k:'dir',l:'Direção'},{k:'voc',l:'Vocal Solo'},{k:'mor',l:'Mordomia'},{k:'por',l:'Portaria'},{k:'ord',l:'Ordenado do Dia'}]
const FNS_DOM = [{k:'dir',l:'Direção'},{k:'mor',l:'Mordomia'},{k:'por',l:'Portaria'},{k:'ord',l:'Ordenado do Dia'}]

export default function EscalaCulto() {
  const { state, dispatch } = useStore()
  const { escalas, funcoes, membros, escalaPreg, ocorrencias, user } = state
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth())
  const [ano, setAno] = useState(now.getFullYear())
  const [saving, setSaving] = useState(false)
  const [modalWA, setModalWA] = useState(false)
  const [msgVersao, setMsgVersao] = useState(0)
  const [filtroWA, setFiltroWA] = useState('mes')
  const [modalMapa, setModalMapa] = useState(false)
  const [modalConf, setModalConf] = useState(null)
  const [modalGrupoCulto, setModalGrupoCulto] = useState(false)
  const [cultosAbertos, setCultosAbertos] = useState({}) // cultos fechados por padrão
  const [copiadoCulto, setCopiadoCulto] = useState(false)
  const [diaSlotWA, setDiaSlotWA] = useState('')
  const [confResp, setConfResp] = useState('sim')
  const [ocItens, setOcItens] = useState([])
  const [savingConf, setSavingConf] = useState(false)

  const hoje = new Date(); hoje.setHours(0,0,0,0)

  const ocorrenciasSlot = (slot) => (ocorrencias||[]).filter(o=>o.ano===ano&&o.mes===mes+1&&o.slot===slot&&(o.tipo==='culto'||!o.tipo))

  const abrirConfirmacao = (slot, data, tipo, s, fns) => {
    const existentes = ocorrenciasSlot(slot)
    const reais = existentes.filter(o=>o.funcao!=='_confirmado')
    setModalConf({ slot, data, tipo, s, fns })
    setConfResp(reais.length ? 'nao' : 'sim')
    setOcItens(reais.length ? reais.map(o=>({funcao:o.funcao||'',nome_original:o.nome_original||'',substituto:o.substituto||'',motivo:o.motivo||''})) : [])
  }

  const addOcItem = () => setOcItens(its=>[...its,{funcao:'',nome_original:'',substituto:'',motivo:''}])
  const setOcItem = (i,campo,val) => setOcItens(its=>its.map((o,idx)=>idx===i?{...o,[campo]:val}:o))
  const setOcFuncao = (i,lbl) => setOcItens(its=>its.map((o,idx)=>{
    if (idx!==i) return o
    const fn = modalConf.fns.find(f=>f.l===lbl)
    return { ...o, funcao:lbl, nome_original: fn ? (modalConf.s[fn.k]||'') : o.nome_original }
  }))
  const rmOcItem = (i) => setOcItens(its=>its.filter((_,idx)=>idx!==i))

  const salvarConfirmacao = async () => {
    const { slot } = modalConf
    setSavingConf(true)
    const existentes = ocorrenciasSlot(slot)
    await Promise.all(existentes.map(o=>dbDelete('ocorrencias', o.id)))
    let novos = []
    if (confResp === 'sim') {
      const row = { ano, mes:mes+1, slot, tipo:'culto', funcao:'_confirmado', nome_original:null, substituto:null, motivo:null }
      const novo = await dbInsert('ocorrencias', row)
      novos = [novo || { id:Date.now(), ...row }]
    } else {
      for (const it of ocItens) {
        if (!it.funcao) continue
        const row = { ano, mes:mes+1, slot, tipo:'culto', funcao:it.funcao, nome_original:it.nome_original||null, substituto:it.substituto||null, motivo:it.motivo||null }
        const novo = await dbInsert('ocorrencias', row)
        novos.push(novo || { id:Date.now()+Math.random(), ...row })
      }
    }
    const restantes = (ocorrencias||[]).filter(o=>!(o.ano===ano&&o.mes===mes+1&&o.slot===slot&&(o.tipo==='culto'||!o.tipo)))
    dispatch({ type:'SET', key:'ocorrencias', value:[...restantes, ...novos] })
    setSavingConf(false); setModalConf(null)
    dispatch({ type:'TOAST', value:'✅ Confirmação registrada!' })
  }

  const chM = (d) => { let m=mes+d,a=ano; if(m>11){m=0;a++} if(m<0){m=11;a--} setMes(m);setAno(a) }
  const ch = `${ano}-${mes}`
  const esc = escalas[ch] || {}
  const { sabs, doms } = getSabDom(mes, ano)

  const fnMbs = (nome) => {
    const f = (funcoes||[]).find(x=>x.nome===nome)
    return f && (f.membros||[]).length ? f.membros : []
  }

  const getPregador = (data, tipo) => (escalaPreg||[]).find(p => {
    const pd = typeof p.data === 'string' ? p.data : p.data
    return pd === data && (tipo==='sab' ? p.culto==='Sábado Manhã' : p.culto==='Domingo Noite')
  })

  const getPregadorDoSlot = (slot) => {
    const tipo = slot.startsWith('sab') ? 'sab' : 'dom'
    const idx = parseInt(slot.split('-')[1])
    const d = tipo === 'sab' ? sabs[idx] : doms[idx]
    if (!d) return null
    return getPregador(d.toISOString().slice(0,10), tipo)?.pregador || null
  }

  const setVal = (slot, fn, val) => {
    const prev = (esc[slot]||{})[fn]||''
    if (val && val !== prev) {
      // Bloqueia se a pessoa é o pregador deste culto
      const pregadorDoDia = getPregadorDoSlot(slot)
      if (pregadorDoDia && pregadorDoDia === val) {
        if (!window.confirm(`⚠ ${val} está escalado(a) para PREGAR neste culto. Forçar mesmo assim?`)) return
      }
      const slotData = esc[slot]||{}
      const jaUsado = Object.entries(slotData).some(([f,v])=>v===val&&f!==fn)
      if (jaUsado && !window.confirm(`⚠ ${val} já tem outra função neste culto. Forçar?`)) return
      if (fn !== 'voc') {
        const lvCh = `lv-${ano}-${mes}`
        const lvEsc = (state.escalasLv||{})[lvCh]||{}
        const slotType = slot.startsWith('sab') ? 'sab' : 'dom'
        const slotIdx = slot.split('-')[1]
        const lvSlot = `${slotType}-${slotIdx}`
        const inLv = Object.entries(lvEsc).some(([k,v])=>{
          if (k.startsWith(lvSlot) && v === val) return true
          if (k === lvSlot && v?.inst) return Object.values(v.inst).includes(val)
          return false
        })
        if (inLv && !window.confirm(`⚠ ${val} está na equipe de louvor neste dia. Forçar?`)) return
      }
    }
    const novoEsc = { ...escalas, [ch]: { ...esc, [slot]: { ...(esc[slot]||{}), [fn]: val } } }
    dispatch({ type:'SET', key:'escalas', value:novoEsc })
  }

  const gerarAuto = () => {
    const seed = Math.floor(Math.random() * 9973)
    const dir=fnMbs('Direção'),voc=fnMbs('Vocal Solo'),mor=fnMbs('Mordomia'),por=fnMbs('Portaria'),ord=fnMbs('Ordenado do Dia')
    const novoSlots = {}

    // Rastreia quem foi escalado por último em cada função para evitar repetição consecutiva
    const prev = { dir:'', voc:'', mor:'', por:'', ord:'' }

    const pickFn = (lista, fnKey, usados, off) => {
      if (!lista.length) return ''
      // Prefere quem não foi usado no culto anterior nesta função
      const pool = lista.filter(p => !usados.includes(p) && p !== prev[fnKey])
      const fallback = lista.filter(p => !usados.includes(p))
      const final = pool.length ? pool : (fallback.length ? fallback : lista)
      for(let i=0;i<final.length;i++){const p=final[(seed+off+i)%final.length];if(p)return p}
      return final[0]||''
    }

    // Processa todos os cultos em ordem cronológica (sab+dom intercalados)
    getCultosOrdenados(mes, ano).forEach((c, gi) => {
      const { tipo, idx, data } = c
      const u = []
      const cafe = tipo==='sab' && isCafeConexao(data)
      // Exclui pregador da geração automática
      const pregDoDia = getPregador(data.toISOString().slice(0,10), tipo)?.pregador
      if (pregDoDia) u.push(pregDoDia)

      if (tipo === 'sab') {
        const pDir=pickFn(dir,'dir',u,gi);   u.push(pDir);   prev.dir=pDir
        const pVoc=cafe?'':pickFn(voc,'voc',u,gi); if(pVoc){u.push(pVoc); prev.voc=pVoc}
        const pMor=pickFn(mor,'mor',u,gi+1); u.push(pMor); prev.mor=pMor
        const pPor=pickFn(por,'por',u,gi+2); u.push(pPor); prev.por=pPor
        const pOrd=pickFn(ord,'ord',u,gi+3); prev.ord=pOrd
        novoSlots[`sab-${idx}`]={dir:pDir,voc:cafe?'CAFÉ E CONEXÃO':pVoc,mor:pMor,por:pPor,ord:pOrd}
      } else {
        const pDir=pickFn(dir,'dir',u,gi+2); u.push(pDir); prev.dir=pDir
        const pMor=pickFn(mor,'mor',u,gi+3); u.push(pMor); prev.mor=pMor
        const pPor=pickFn(por,'por',u,gi+4); u.push(pPor); prev.por=pPor
        const pOrd=pickFn(ord,'ord',u,gi+5); prev.ord=pOrd
        novoSlots[`dom-${idx}`]={dir:pDir,mor:pMor,por:pPor,ord:pOrd}
      }
    })

    dispatch({ type:'SET', key:'escalas', value:{...escalas,[ch]:novoSlots} })
    dispatch({ type:'TOAST', value:'✨ Escala gerada! Revise se necessário.' })
  }

  const salvar = async () => {
    setSaving(true)
    const rows = Object.entries(esc).map(([slot,s])=>({ano,mes:mes+1,slot,dir:s.dir||null,voc:s.voc||null,mor:s.mor||null,por:s.por||null,ord:s.ord||null}))
    await Promise.all(rows.map(r=>dbUpsert('escalas',r,'ano,mes,slot')))
    setSaving(false)
    dispatch({ type:'TOAST', value:'Escala salva!' })
  }

  const salvarSlot = async (slot) => {
    const s = esc[slot] || {}
    await dbUpsert('escalas', {ano, mes:mes+1, slot, dir:s.dir||null, voc:s.voc||null, mor:s.mor||null, por:s.por||null, ord:s.ord||null}, 'ano,mes,slot')
    dispatch({ type:'TOAST', value:'Dia salvo!' })
  }

  // Build WA people list
  const getPessoasEscaladas = () => {
    const map = {}
    const lb = {dir:'Direção',voc:'Vocal Solo',mor:'Mordomia',por:'Portaria',ord:'Ordenado do Dia'}
    const addFn = (nome, fn, data) => {
      if (!nome || nome === 'CAFÉ E CONEXÃO') return
      if (!map[nome]) map[nome] = { nome, tel:'', fns:[] }
      map[nome].fns.push(`${fn} — ${fmtBR(new Date(data+'T00:00:00'))}`)
    }
    sabs.forEach((d,i)=>{const s=esc[`sab-${i}`]||{};Object.entries(s).forEach(([k,v])=>{if(lb[k])addFn(v,lb[k],d.toISOString().slice(0,10))})})
    doms.forEach((d,i)=>{const s=esc[`dom-${i}`]||{};Object.entries(s).forEach(([k,v])=>{if(lb[k])addFn(v,lb[k],d.toISOString().slice(0,10))})})
    return Object.values(map).map(p=>{const mb=(membros||[]).find(m=>m.nome===p.nome);p.tel=mb?.tel||'';p.email=mb?.email||'';return p})
  }

  const Sel = ({slot,fn,opts,val,readOnly}) => {
    if (readOnly) return <div style={{flex:1,padding:'7px 8px',fontSize:12,color:val?'var(--w)':'var(--g)'}}>{val?nomeDisp(val,membros):'—'}</div>
    return (
      <select value={val||''} onChange={e=>setVal(slot,fn,e.target.value)} style={{flex:1,padding:'7px 8px',fontSize:12,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--w)'}}>
        <option value="">— Selecionar —</option>
        {opts.map(n=><option key={n} value={n}>{nomeDisp(n, membros)}</option>)}
      </select>
    )
  }

  const CultoCard = ({data,tipo,idx}) => {
    const slot = `${tipo}-${idx}`
    const s = esc[slot]||{}
    const fns = tipo==='sab'?FNS_SAB:FNS_DOM
    const dataStr = data.toISOString().slice(0,10)
    const preg = getPregador(dataStr, tipo)
    const cafe = tipo==='sab' && isCafeConexao(data)
    const sub = tipo==='sab' ? `${cafe?'☕ Café e Conexão · ':''}EB 9h · Culto 10h30 · ${fmtBR(data)}` : `18h00 · ${fmtBR(data)}`
    const canEdit = isPastor(user)
    const passado = data < hoje
    const ocs = ocorrenciasSlot(slot)
    const confirmado = ocs.length > 0
    const temOcorrencia = ocs.some(o=>o.funcao!=='_confirmado')

    const aberto = !!cultosAbertos[slot]
    const nPreenchidos = fns.filter(f=>s[f.k]).length + (preg?1:0)

    return (
      <div style={{background:'var(--s1)',border:`1px solid ${cafe?'rgba(245,158,11,.4)':'var(--bd)'}`,borderRadius:10,overflow:'hidden',marginBottom:12}}>
        <div onClick={()=>setCultosAbertos(p=>({...p,[slot]:!p[slot]}))} style={{background:cafe?'rgba(245,158,11,.08)':'var(--s2)',padding:'9px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8,cursor:'pointer'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:11,color:'var(--cy)',display:'inline-block',transform:aberto?'rotate(90deg)':'none',transition:'transform .15s'}}>▶</span>
            <div>
              <div style={{fontFamily:'var(--font-display)',fontSize:13,letterSpacing:2,color:cafe?'var(--yel)':'var(--w)'}}>{tipo==='sab'?'☀ SÁBADO — MANHÃ':'🌙 DOMINGO — NOITE'}{cafe?' — ☕ CAFÉ E CONEXÃO':''}</div>
              <div style={{fontSize:10,color:cafe?'var(--yel)':'var(--cy)',marginTop:2}}>{fmtBR(data)}{!aberto && nPreenchidos>0 ? ` · ${nPreenchidos} escalado(s)` : ''}{!aberto && temOcorrencia ? ' · ⚠' : ''}</div>
            </div>
          </div>
          <div onClick={e=>e.stopPropagation()} style={{display:'flex',alignItems:'center',gap:8}}>
            {aberto && <div style={{fontSize:10,color:cafe?'var(--yel)':'var(--cy)'}}>{sub.replace(` · ${fmtBR(data)}`,'')}</div>}
            {aberto && isAdmin(user) && <Btn variant="outline" size="xs" onClick={()=>salvarSlot(slot)}>Salvar dia</Btn>}
            {/* Confirmação sempre visível, mesmo com o culto fechado */}
            {passado && isAdmin(user) && (
              <Btn variant={confirmado?(temOcorrencia?'danger':'outline'):'wa'} size="xs" onClick={()=>abrirConfirmacao(slot,data,tipo,s,fns)}>
                {confirmado ? (temOcorrencia ? '⚠ Com ocorrência' : '✅ Confirmado') : '📋 Confirmar culto'}
              </Btn>
            )}
          </div>
        </div>
        {aberto && <div style={{padding:'9px 14px'}}>
          {/* Pregador - read only for secretario */}
          <div style={{display:'flex',alignItems:'center',padding:'6px 0',borderBottom:'1px solid var(--bd)',gap:9,background:'rgba(0,188,212,.05)'}}>
            <div style={{fontSize:9,fontWeight:700,color:'var(--cy)',letterSpacing:1,textTransform:'uppercase',width:90,flexShrink:0}}>🎤 Pregador</div>
            <div style={{fontSize:12,color:preg?'var(--w)':'var(--g)',fontWeight:preg?600:400,flex:1}}>{preg?nomeDisp(preg.pregador,membros):'Não definido'}</div>
            {isPastor(user) && <span style={{fontSize:9,color:'var(--g)'}}>gerenciar em Pregação</span>}
          </div>
          {fns.map(f=>{
            const isCafe = cafe && f.k==='voc'
            const opts = fnMbs(f.l==='Vocal Solo'?'Vocal Solo':f.l)
            const isPregando = preg && s[f.k] && s[f.k] === preg.pregador
            return (
              <div key={f.k} style={{display:'flex',alignItems:'center',padding:'5px 0',borderBottom:'1px solid var(--bd)',gap:9,opacity:isCafe?.5:1,background:isPregando?'rgba(239,68,68,.06)':''}}>
                <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:1,textTransform:'uppercase',width:90,flexShrink:0,lineHeight:1.3}}>{f.l}</div>
                {isCafe
                  ? <div style={{flex:1,fontSize:12,color:'var(--yel)'}}>☕ Café e Conexão</div>
                  : <>
                      {Sel({slot, fn:f.k, opts, val:s[f.k], readOnly:!canEdit&&f.k==='voc'})}
                      {isPregando && <span style={{fontSize:9,color:'var(--red)',fontWeight:700,flexShrink:0}}>⚠ PREGA</span>}
                    </>
                }
              </div>
            )
          })}
          {temOcorrencia && (
            <div style={{marginTop:9,background:'rgba(239,68,68,.07)',border:'1px solid rgba(239,68,68,.25)',borderRadius:7,padding:'8px 11px'}}>
              <div style={{fontSize:9,fontWeight:700,color:'var(--red)',letterSpacing:1,textTransform:'uppercase',marginBottom:5}}>⚠ Ocorrências registradas</div>
              {ocs.filter(o=>o.funcao!=='_confirmado').map(o=>(
                <div key={o.id} style={{fontSize:11,color:'var(--tx)',padding:'3px 0'}}>
                  <strong>{o.funcao}</strong>: {o.nome_original?nomeDisp(o.nome_original,membros):'—'} → substituído por {o.substituto?nomeDisp(o.substituto,membros):'—'}{o.motivo?` (${o.motivo})`:''}
                </div>
              ))}
            </div>
          )}
        </div>}
      </div>
    )
  }

  // Próximo FDS: slots dos cultos a partir de hoje
  const proximoFDSSlots = (() => {
    const hj = new Date(); hj.setHours(0,0,0,0)
    const cultos = getCultosOrdenados(mes, ano).filter(c => c.data >= hj)
    if (!cultos.length) return []
    const first = cultos[0]
    const slots = [`${first.tipo}-${first.idx}`]
    const partner = cultos.find(c => c.tipo !== first.tipo && Math.abs(c.data - first.data) <= 2*24*3600*1000)
    if (partner) slots.push(`${partner.tipo}-${partner.idx}`)
    return slots
  })()

  const enviarEmailEscala = async () => {
    const lb = {dir:'Direção',voc:'Vocal Solo',mor:'Mordomia',por:'Portaria',ord:'Ordenado do Dia'}
    const map = {}
    const add = (nome, linha) => {
      if (!nome || nome==='CAFÉ E CONEXÃO') return
      if (!map[nome]) map[nome] = []
      map[nome].push(linha)
    }
    sabs.forEach((d,i)=>{ const s=esc[`sab-${i}`]||{}; Object.entries(lb).forEach(([k,l])=>{ if(s[k]) add(s[k],`${d.toLocaleDateString('pt-BR')} Sáb — ${l}`) }) })
    doms.forEach((d,i)=>{ const s=esc[`dom-${i}`]||{}; Object.entries({dir:'Direção',mor:'Mordomia',por:'Portaria',ord:'Ordenado do Dia'}).forEach(([k,l])=>{ if(s[k]) add(s[k],`${d.toLocaleDateString('pt-BR')} Dom — ${l}`) }) })
    const pessoas = Object.entries(map).map(([nome,linhas])=>{
      const mb=(membros||[]).find(m=>m.nome===nome)
      return { nome, email:mb?.email||null, linhas }
    })
    const comEmail = pessoas.filter(p=>p.email).length
    if (!comEmail) { dispatch({type:'TOAST',value:'⚠ Nenhum membro escalado tem e-mail cadastrado.'}); return }
    dispatch({type:'TOAST',value:`✉ Enviando para ${comEmail} pessoa(s)...`})
    try {
      const r = await fetch('/api/send-email', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ pessoas, tipo:'culto', mes, ano, escopo:'mes' })
      })
      const d = await r.json()
      dispatch({type:'TOAST',value:`✅ ${d.enviados} e-mail(s) enviado(s)!${d.semEmail?` (${d.semEmail} sem e-mail)`:''}`})
    } catch { dispatch({type:'TOAST',value:'⚠ Erro ao enviar e-mails.'}) }
  }

  const enviarEmailIndividual = async (p, escopoAtual) => {
    if (!p.email) { dispatch({type:'TOAST',value:`⚠ ${p.nome.split(' ')[0]} não tem e-mail cadastrado.`}); return }
    dispatch({type:'TOAST',value:`✉ Enviando para ${p.nome.split(' ')[0]}...`})
    try {
      const r = await fetch('/api/send-email', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ pessoas:[{nome:p.nome,email:p.email,linhas:p.fns}], tipo:'culto', mes, ano, escopo:escopoAtual||filtroWA })
      })
      const d = await r.json()
      dispatch({type:'TOAST',value: d.enviados ? `✅ E-mail enviado para ${p.nome.split(' ')[0]}!` : '⚠ Falha ao enviar.'})
    } catch { dispatch({type:'TOAST',value:'⚠ Erro ao enviar.'}) }
  }

  const todasPessoas = getPessoasEscaladas()
  const pessoas = filtroWA === 'fds'
    ? todasPessoas.filter(p => p.fns.some(fn => proximoFDSSlots.some(sl => {
        const d = sl.startsWith('sab') ? sabs[parseInt(sl.split('-')[1])] : doms[parseInt(sl.split('-')[1])]
        return d && fn.includes(fmtBR(d))
      })))
    : filtroWA === 'dia' && diaSlotWA
      ? (() => {
          const d = diaSlotWA.startsWith('sab') ? sabs[parseInt(diaSlotWA.split('-')[1])] : doms[parseInt(diaSlotWA.split('-')[1])]
          return d ? todasPessoas.filter(p => p.fns.some(fn => fn.includes(fmtBR(d)))) : todasPessoas
        })()
      : todasPessoas

  const tituloFDS = proximoFDSSlots.length ? (() => {
    return proximoFDSSlots.map(sl => {
      const d = sl.startsWith('sab') ? sabs[parseInt(sl.split('-')[1])] : doms[parseInt(sl.split('-')[1])]
      return d ? fmtBR(d) : ''
    }).filter(Boolean).join(' + ')
  })() : 'Nenhum FDS próximo'

  const msgPreview = MSG_ESCALA[msgVersao]
  const previewText = msgPreview('João', 'Sábado 07/06 — Direção\nDomingo 08/06 — Portaria')

  return (
    <div>
      <div className="no-print" style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
        <MonthNav month={mes} year={ano} onPrev={()=>chM(-1)} onNext={()=>chM(1)} />
        <BtnGroup>
          {isAdmin(user) && <Btn variant="outline" size="sm" onClick={gerarAuto}>✨ Gerar Auto</Btn>}
          {isAdmin(user) && <Btn size="sm" onClick={salvar} disabled={saving}>{saving?'Salvando...':'💾 Salvar'}</Btn>}
          <Btn variant="outline" size="sm" onClick={()=>setModalMapa(true)}>🗺 Mapa Geral</Btn>
          <Btn variant="outline" size="sm" onClick={()=>window.print()}>📄 PDF</Btn>
          <Btn variant="outline" size="sm" onClick={()=>{setCopiadoCulto(false);setModalGrupoCulto(true)}}>👥 Msg Grupo</Btn>
          {isAdmin(user) && <Btn variant="wa" size="sm" onClick={()=>setModalWA(true)}>📱 Enviar Escala</Btn>}
        </BtnGroup>
      </div>

      <div className="no-print">
        {/* Chamado como função (não como <Componente/>) para não desmontar os
            cards a cada alteração — evita o pulo da página para o topo */}
        {getCultosOrdenados(mes,ano).map(c=><div key={`${c.tipo}-${c.idx}`}>{CultoCard({data:c.data,tipo:c.tipo,idx:c.idx})}</div>)}
      </div>

      {/* Mapa imprimível — oculto na tela, visível ao imprimir */}
      <div className="print-mapa">
        <h2>ESCALA DE CULTO — {MESES[mes].toUpperCase()} {ano}</h2>
        <table>
          <thead>
            <tr>{['Data','Pregador','Direção','Vocal Solo','Mordomia','Portaria','Ord. Dia'].map(h=><th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {getCultosOrdenados(mes,ano).map(c=>{
              const slot=`${c.tipo}-${c.idx}`
              const s=esc[slot]||{}
              const preg=getPregador(c.data.toISOString().slice(0,10),c.tipo)
              const cafe=c.tipo==='sab'&&isCafeConexao(c.data)
              return(
                <tr key={slot}>
                  <td><strong>{fmtBR(c.data)}</strong> {c.tipo==='sab'?'Sáb':'Dom'}</td>
                  <td>{preg?.pregador||'—'}</td>
                  <td>{s.dir?nomeDisp(s.dir,membros):'—'}</td>
                  <td>{cafe?'Café e Conexão':s.voc?nomeDisp(s.voc,membros):'—'}</td>
                  <td>{s.mor?nomeDisp(s.mor,membros):'—'}</td>
                  <td>{s.por?nomeDisp(s.por,membros):'—'}</td>
                  <td>{s.ord?nomeDisp(s.ord,membros):'—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Mensagem para Grupo */}
      {modalGrupoCulto && (() => {
        const hj = new Date(); hj.setHours(0,0,0,0)
        const cultos = getCultosOrdenados(mes, ano)
        const futuros = cultos.filter(c => c.data >= hj)
        const fdsSlots = futuros.length
          ? cultos.filter(c => Math.abs(c.data - futuros[0].data) <= 2*24*3600*1000)
          : cultos.slice(-2)
        const msgSlots = fdsSlots.map(c => {
          const slot = `${c.tipo}-${c.idx}`
          const s = esc[slot] || {}
          const preg = getPregador(c.data.toISOString().slice(0,10), c.tipo)
          return {
            tipo: c.tipo, data: c.data,
            label: c.tipo==='sab'?'Sabado Manha':'Domingo Noite',
            pregador: preg ? nomeDisp(preg.pregador, membros) : null,
            dir: s.dir ? nomeDisp(s.dir, membros) : null,
            voc: s.voc && s.voc !== 'CAFÉ E CONEXÃO' ? nomeDisp(s.voc, membros) : (s.voc==='CAFÉ E CONEXÃO'?'Cafe e Conexao':null),
            mor: s.mor ? nomeDisp(s.mor, membros) : null,
            por: s.por ? nomeDisp(s.por, membros) : null,
            ord: s.ord ? nomeDisp(s.ord, membros) : null,
          }
        })
        const texto = MSG_GRUPO_CULTO(msgSlots)
        const copiar = () => navigator.clipboard.writeText(texto).then(() => setCopiadoCulto(true))
        return (
          <Modal title="MENSAGEM PARA O GRUPO" onClose={()=>setModalGrupoCulto(false)} wide
            footer={<><Btn onClick={copiar} variant={copiadoCulto?'green':'cyan'}>{copiadoCulto?'Copiado!':'Copiar texto'}</Btn><Btn variant="outline" onClick={()=>setModalGrupoCulto(false)}>Fechar</Btn></>}>
            <div style={{fontSize:11,color:'var(--g)',marginBottom:10}}>
              Texto da escala do proximo FDS. Copie e cole no grupo do WhatsApp.
            </div>
            <textarea
              readOnly value={texto||'Nenhuma pessoa escalada para este FDS ainda.'}
              style={{width:'100%',minHeight:200,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:8,padding:12,fontSize:12,color:'var(--tx)',lineHeight:1.8,resize:'vertical',fontFamily:'monospace',boxSizing:'border-box'}}
              onClick={e=>e.target.select()}
            />
          </Modal>
        )
      })()}

      {/* Mapa Geral */}
      {modalMapa && (
        <Modal title={`MAPA GERAL — ${MESES[mes].toUpperCase()} ${ano}`} onClose={()=>setModalMapa(false)} wide
          footer={<><Btn variant="outline" size="sm" onClick={()=>window.print()}>🖨 Imprimir</Btn><Btn variant="outline" onClick={()=>setModalMapa(false)}>Fechar</Btn></>}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,minWidth:600}}>
              <thead>
                <tr style={{background:'var(--s2)'}}>
                  {['Data','Pregador','Direção','Vocal Solo','Mordomia','Portaria','Ord. Dia'].map(h=>(
                    <th key={h} style={{padding:'7px 10px',textAlign:'left',color:'var(--cy)',fontFamily:'var(--font-display)',fontSize:10,letterSpacing:1,borderBottom:'2px solid var(--bd)',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {getCultosOrdenados(mes,ano).map(c=>{
                  const slot=`${c.tipo}-${c.idx}`
                  const s=esc[slot]||{}
                  const preg=getPregador(c.data.toISOString().slice(0,10),c.tipo)
                  const cafe=c.tipo==='sab'&&isCafeConexao(c.data)
                  return(
                    <tr key={slot} style={{borderBottom:'1px solid var(--bd)',background:cafe?'rgba(245,158,11,.04)':''}}>
                      <td style={{padding:'7px 10px',whiteSpace:'nowrap'}}>
                        <span style={{fontWeight:600,color:'var(--w)'}}>{fmtBR(c.data)}</span>
                        <span style={{marginLeft:5,fontSize:10,color:c.tipo==='sab'?'var(--yel)':'var(--cy)'}}>{c.tipo==='sab'?'☀ Sáb':'🌙 Dom'}</span>
                      </td>
                      <td style={{padding:'7px 10px',color:preg?'var(--w)':'var(--g)'}}>{preg?.pregador||'—'}</td>
                      <td style={{padding:'7px 10px',color:s.dir?'var(--tx)':'var(--g)'}}>{s.dir?nomeDisp(s.dir,membros):'—'}</td>
                      <td style={{padding:'7px 10px',color:cafe?'var(--yel)':s.voc?'var(--tx)':'var(--g)'}}>{cafe?'☕ Café':s.voc?nomeDisp(s.voc,membros):'—'}</td>
                      <td style={{padding:'7px 10px',color:s.mor?'var(--tx)':'var(--g)'}}>{s.mor?nomeDisp(s.mor,membros):'—'}</td>
                      <td style={{padding:'7px 10px',color:s.por?'var(--tx)':'var(--g)'}}>{s.por?nomeDisp(s.por,membros):'—'}</td>
                      <td style={{padding:'7px 10px',color:s.ord?'var(--tx)':'var(--g)'}}>{s.ord?nomeDisp(s.ord,membros):'—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* WhatsApp Modal */}
      {modalWA && (
        <Modal title={`ENVIAR ESCALA — ${MESES[mes].toUpperCase()} ${ano}`} onClose={()=>setModalWA(false)} wide
          footer={<Btn variant="outline" onClick={()=>setModalWA(false)}>Fechar</Btn>}>
          {/* Filtro mês / FDS / Dia */}
          <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap'}}>
            {[['mes','Todo o mes'],['fds','Proximo FDS'],['dia','Dia especifico']].map(([v,l])=>(
              <button key={v} onClick={()=>setFiltroWA(v)} style={{flex:1,padding:'7px',borderRadius:7,border:`2px solid ${filtroWA===v?'var(--cy)':'var(--bd)'}`,background:filtroWA===v?'var(--cdim)':'var(--s2)',color:filtroWA===v?'var(--cy)':'var(--g)',cursor:'pointer',fontSize:11,fontWeight:600,minWidth:80}}>
                {l}{v==='fds'&&filtroWA==='fds'&&tituloFDS?` (${tituloFDS})`:''}
              </button>
            ))}
          </div>
          {filtroWA==='dia'&&(
            <select value={diaSlotWA} onChange={e=>setDiaSlotWA(e.target.value)} style={{width:'100%',marginBottom:10,padding:'7px 8px',fontSize:12}}>
              <option value="">— Selecionar culto —</option>
              {getCultosOrdenados(mes,ano).map(c=>(
                <option key={`${c.tipo}-${c.idx}`} value={`${c.tipo}-${c.idx}`}>{c.tipo==='sab'?'Sab':'Dom'} {fmtBR(c.data)}</option>
              ))}
            </select>
          )}
          <div style={{marginBottom:12}}>
            <label>Selecionar Mensagem</label>
            <select value={msgVersao} onChange={e=>setMsgVersao(parseInt(e.target.value))} style={{marginTop:4}}>
              <option value={0}>Aviso 1 — "Contamos com sua participação"</option>
              <option value={1}>Aviso 2 — "Que bom contar com você"</option>
              <option value={2}>Aviso 3 — "É uma alegria servir junto"</option>
              <option value={3}>🔔 Lembrete — "Esse FDS é você!"</option>
            </select>
          </div>
          <div style={{background:'var(--s2)',borderRadius:8,padding:12,fontSize:12,lineHeight:1.8,color:'var(--tx)',whiteSpace:'pre-wrap',borderLeft:'3px solid var(--cy)',marginBottom:14,maxHeight:130,overflowY:'auto'}}>{previewText}</div>
          {pessoas.length===0
            ? <div style={{color:'var(--g)',fontSize:13,textAlign:'center',padding:20}}>{filtroWA==='fds'?'Nenhum escalado para o próximo FDS.':'Nenhuma pessoa escalada neste mês ainda.'}</div>
            : <>
                {/* Botão enviar todos por email */}
                {pessoas.some(p=>p.email) && (
                  <div style={{marginBottom:12,display:'flex',justifyContent:'flex-end'}}>
                    <button onClick={async()=>{
                      const comEmail = pessoas.filter(p=>p.email)
                      dispatch({type:'TOAST',value:`✉ Enviando para ${comEmail.length} pessoa(s)...`})
                      try{
                        const r = await fetch('/api/send-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pessoas:comEmail.map(p=>({nome:p.nome,email:p.email,linhas:p.fns})),tipo:'culto',mes,ano,escopo:filtroWA})})
                        const d = await r.json()
                        dispatch({type:'TOAST',value:`✅ ${d.enviados} e-mail(s) enviado(s)!${d.semEmail?` (${d.semEmail} sem e-mail)`:''}`})
                      }catch{dispatch({type:'TOAST',value:'⚠ Erro ao enviar.'})}
                    }} style={{padding:'7px 14px',borderRadius:7,border:'1px solid rgba(0,188,212,.4)',background:'rgba(0,188,212,.08)',color:'var(--cy)',cursor:'pointer',fontSize:12,fontWeight:600}}>
                      ✉ Enviar todos por email ({pessoas.filter(p=>p.email).length})
                    </button>
                  </div>
                )}
                {pessoas.map(p=>(
                  <div key={p.nome} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'9px 0',borderBottom:'1px solid var(--bd)'}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:600,color:'var(--w)'}}>{p.nome}</div>
                      <div style={{fontSize:11,color:'var(--g)',marginTop:2}}>{p.fns.join(' · ')}</div>
                    </div>
                    <div style={{display:'flex',gap:5,flexShrink:0,alignItems:'center'}}>
                      {p.tel
                        ? <a href={waLink(p.tel, MSG_ESCALA[msgVersao](p.nome.split(' ')[0], p.fns.join('\n'), filtroWA))} target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',gap:4,padding:'5px 10px',background:'rgba(34,197,94,.12)',border:'1px solid rgba(34,197,94,.3)',borderRadius:6,color:'var(--grn)',textDecoration:'none',fontSize:11,fontWeight:600}}>💬</a>
                        : <span style={{fontSize:10,color:'var(--g)'}}>sem tel</span>
                      }
                      <button onClick={()=>enviarEmailIndividual(p)} title={p.email?`Enviar email`:'Sem e-mail'}
                        style={{padding:'5px 10px',borderRadius:6,border:`1px solid ${p.email?'rgba(0,188,212,.4)':'var(--bd)'}`,background:p.email?'rgba(0,188,212,.08)':'transparent',color:p.email?'var(--cy)':'var(--g)',cursor:p.email?'pointer':'default',fontSize:11,fontWeight:600}}>
                        📧
                      </button>
                    </div>
                  </div>
                ))}
              </>
          }
        </Modal>
      )}

      {/* Confirmação pós-culto */}
      {modalConf && (
        <Modal title={`CONFIRMAR CULTO — ${fmtBR(modalConf.data)}`} onClose={()=>setModalConf(null)}
          footer={<><Btn variant="outline" onClick={()=>setModalConf(null)}>Cancelar</Btn><Btn onClick={salvarConfirmacao} disabled={savingConf}>{savingConf?'Salvando...':'💾 Salvar'}</Btn></>}>
          <div style={{marginBottom:16}}>
            <label>Tudo ocorreu como planejado?</label>
            <div style={{display:'flex',gap:8,marginTop:6}}>
              <Btn variant={confResp==='sim'?'green':'outline'} onClick={()=>setConfResp('sim')}>✅ Sim</Btn>
              <Btn variant={confResp==='nao'?'danger':'outline'} onClick={()=>setConfResp('nao')}>❌ Não</Btn>
            </div>
          </div>
          {confResp==='nao' && (
            <div>
              {ocItens.map((it,i)=>(
                <div key={i} style={{background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:8,padding:12,marginBottom:10}}>
                  <FormGrid>
                    <FG><label>Função</label>
                      <select value={it.funcao} onChange={e=>setOcFuncao(i,e.target.value)}>
                        <option value="">— Selecionar —</option>
                        {modalConf.fns.map(f=><option key={f.k}>{f.l}</option>)}
                      </select>
                    </FG>
                    <FG><label>Quem era escalado(a)</label><input value={it.nome_original} onChange={e=>setOcItem(i,'nome_original',e.target.value)} /></FG>
                    <FG><label>Quem substituiu</label>
                      <select value={it.substituto} onChange={e=>setOcItem(i,'substituto',e.target.value)}>
                        <option value="">— Selecionar —</option>
                        {(membros||[]).map(m=><option key={m.id} value={m.nome}>{m.nome}</option>)}
                      </select>
                    </FG>
                    <FG><label>Motivo</label><input value={it.motivo} onChange={e=>setOcItem(i,'motivo',e.target.value)} /></FG>
                  </FormGrid>
                  <div style={{textAlign:'right',marginTop:8}}><Btn variant="danger" size="xs" onClick={()=>rmOcItem(i)}>🗑 Remover</Btn></div>
                </div>
              ))}
              <Btn variant="outline" size="sm" onClick={addOcItem}>+ Adicionar ocorrência</Btn>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
