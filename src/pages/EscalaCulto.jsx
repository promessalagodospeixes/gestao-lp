import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbUpsert, dbInsert, dbDelete } from '../lib/supabase.js'
import { MESES, getSabDom, getCultosOrdenados, fmtBR, isPastor, isAdmin, isCafeConexao, waLink, MSG_ESCALA } from '../lib/utils.js'
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
  const [modalConf, setModalConf] = useState(null)
  const [confResp, setConfResp] = useState('sim')
  const [ocItens, setOcItens] = useState([])
  const [savingConf, setSavingConf] = useState(false)

  const hoje = new Date(); hoje.setHours(0,0,0,0)

  const ocorrenciasSlot = (slot) => (ocorrencias||[]).filter(o=>o.ano===ano&&o.mes===mes+1&&o.slot===slot)

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
      const row = { ano, mes:mes+1, slot, funcao:'_confirmado', nome_original:null, substituto:null, motivo:null }
      const novo = await dbInsert('ocorrencias', row)
      novos = [novo || { id:Date.now(), ...row }]
    } else {
      for (const it of ocItens) {
        if (!it.funcao) continue
        const row = { ano, mes:mes+1, slot, funcao:it.funcao, nome_original:it.nome_original||null, substituto:it.substituto||null, motivo:it.motivo||null }
        const novo = await dbInsert('ocorrencias', row)
        novos.push(novo || { id:Date.now()+Math.random(), ...row })
      }
    }
    const restantes = (ocorrencias||[]).filter(o=>!(o.ano===ano&&o.mes===mes+1&&o.slot===slot))
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

  const setVal = (slot, fn, val) => {
    const prev = (esc[slot]||{})[fn]||''
    if (val && val !== prev) {
      const slotData = esc[slot]||{}
      const jaUsado = Object.entries(slotData).some(([f,v])=>v===val&&f!==fn)
      if (jaUsado && !window.confirm(`⚠ ${val} já tem outra função neste culto. Forçar?`)) return
      if (fn !== 'voc') {
        // Check if person is in louvor that day
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
    const pick = (lista, usados, off) => {
      if (!lista.length) return ''
      for(let i=0;i<lista.length;i++){const p=lista[(off+i)%lista.length];if(!usados.includes(p))return p;}
      return lista[off%lista.length]||''
    }
    const dir=fnMbs('Direção'),voc=fnMbs('Vocal Solo'),mor=fnMbs('Mordomia'),por=fnMbs('Portaria'),ord=fnMbs('Ordenado do Dia')
    const novoSlots = {}
    // Track last used index per function to avoid sequential repetition
    const lastIdx = { dir:{}, voc:{}, mor:{}, por:{}, ord:{} }

    sabs.forEach((d,i)=>{
      const u=[]
      const cafe = isCafeConexao(d)
      const pDir=pick(dir,u,i); u.push(pDir)
      const pVoc=cafe?'':pick(voc,u,i); if(pVoc)u.push(pVoc)
      const pMor=pick(mor,u,i+1); u.push(pMor)
      const pPor=pick(por,u,i+2); u.push(pPor)
      const pOrd=pick(ord,u,i+3)
      novoSlots[`sab-${i}`]={dir:pDir,voc:cafe?'CAFÉ E CONEXÃO':pVoc,mor:pMor,por:pPor,ord:pOrd}
    })
    doms.forEach((d,i)=>{
      const u=[]
      const pDir=pick(dir,u,i+2); u.push(pDir)
      const pMor=pick(mor,u,i+3); u.push(pMor)
      const pPor=pick(por,u,i+4); u.push(pPor)
      const pOrd=pick(ord,u,i+5)
      novoSlots[`dom-${i}`]={dir:pDir,mor:pMor,por:pPor,ord:pOrd}
    })
    dispatch({ type:'SET', key:'escalas', value:{...escalas,[ch]:novoSlots} })
    dispatch({ type:'TOAST', value:'✨ Escala gerada! Revise se necessário.' })
  }

  const salvar = async () => {
    setSaving(true)
    const rows = Object.entries(esc).map(([slot,s])=>({ano,mes:mes+1,slot,dir:s.dir||null,voc:s.voc||null,mor:s.mor||null,por:s.por||null,ord:s.ord||null}))
    await Promise.all(rows.map(r=>dbUpsert('escalas',r,'ano,mes,slot')))
    setSaving(false)
    dispatch({ type:'TOAST', value:'💾 Escala salva!' })
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
    return Object.values(map).map(p=>{const mb=(membros||[]).find(m=>m.nome===p.nome);p.tel=mb?.tel||'';return p})
  }

  const Sel = ({slot,fn,opts,val,readOnly}) => {
    if (readOnly) return <div style={{flex:1,padding:'7px 8px',fontSize:12,color:val?'var(--w)':'var(--g)'}}>{val||'—'}</div>
    return (
      <select value={val||''} onChange={e=>setVal(slot,fn,e.target.value)} style={{flex:1,padding:'7px 8px',fontSize:12,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--w)'}}>
        <option value="">— Selecionar —</option>
        {opts.map(n=><option key={n}>{n}</option>)}
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

    return (
      <div style={{background:'var(--s1)',border:`1px solid ${cafe?'rgba(245,158,11,.4)':'var(--bd)'}`,borderRadius:10,overflow:'hidden',marginBottom:12}}>
        <div style={{background:cafe?'rgba(245,158,11,.08)':'var(--s2)',padding:'9px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:13,letterSpacing:2,color:cafe?'var(--yel)':'var(--w)'}}>{tipo==='sab'?'☀ SÁBADO — MANHÃ':'🌙 DOMINGO — NOITE'}{cafe?' — ☕ CAFÉ E CONEXÃO':''}</div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{fontSize:10,color:cafe?'var(--yel)':'var(--cy)'}}>{sub}</div>
            {passado && isAdmin(user) && (
              <Btn variant={confirmado?(temOcorrencia?'danger':'outline'):'wa'} size="xs" onClick={()=>abrirConfirmacao(slot,data,tipo,s,fns)}>
                {confirmado ? (temOcorrencia ? '⚠ Com ocorrência' : '✅ Confirmado') : '📋 Confirmar culto'}
              </Btn>
            )}
          </div>
        </div>
        <div style={{padding:'9px 14px'}}>
          {/* Pregador - read only for secretario */}
          <div style={{display:'flex',alignItems:'center',padding:'6px 0',borderBottom:'1px solid var(--bd)',gap:9,background:'rgba(0,188,212,.05)'}}>
            <div style={{fontSize:9,fontWeight:700,color:'var(--cy)',letterSpacing:1,textTransform:'uppercase',width:90,flexShrink:0}}>🎤 Pregador</div>
            <div style={{fontSize:12,color:preg?'var(--w)':'var(--g)',fontWeight:preg?600:400,flex:1}}>{preg?preg.pregador:'Não definido'}</div>
            {isPastor(user) && <span style={{fontSize:9,color:'var(--g)'}}>gerenciar em Pregação</span>}
          </div>
          {fns.map(f=>{
            const isCafe = cafe && f.k==='voc'
            const opts = fnMbs(f.l==='Vocal Solo'?'Vocal Solo':f.l)
            return (
              <div key={f.k} style={{display:'flex',alignItems:'center',padding:'5px 0',borderBottom:'1px solid var(--bd)',gap:9,opacity:isCafe?.5:1}}>
                <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:1,textTransform:'uppercase',width:90,flexShrink:0,lineHeight:1.3}}>{f.l}</div>
                {isCafe
                  ? <div style={{flex:1,fontSize:12,color:'var(--yel)'}}>☕ Café e Conexão</div>
                  : <Sel slot={slot} fn={f.k} opts={opts} val={s[f.k]} readOnly={!canEdit&&f.k==='voc'} />
                }
              </div>
            )
          })}
          {temOcorrencia && (
            <div style={{marginTop:9,background:'rgba(239,68,68,.07)',border:'1px solid rgba(239,68,68,.25)',borderRadius:7,padding:'8px 11px'}}>
              <div style={{fontSize:9,fontWeight:700,color:'var(--red)',letterSpacing:1,textTransform:'uppercase',marginBottom:5}}>⚠ Ocorrências registradas</div>
              {ocs.filter(o=>o.funcao!=='_confirmado').map(o=>(
                <div key={o.id} style={{fontSize:11,color:'var(--tx)',padding:'3px 0'}}>
                  <strong>{o.funcao}</strong>: {o.nome_original||'—'} → substituído por {o.substituto||'—'}{o.motivo?` (${o.motivo})`:''}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const pessoas = getPessoasEscaladas()
  const msgPreview = MSG_ESCALA[msgVersao]
  const previewText = msgPreview('João', 'Sábado 07/06 — Direção\nDomingo 08/06 — Portaria')

  return (
    <div>
      <div className="no-print" style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
        <MonthNav month={mes} year={ano} onPrev={()=>chM(-1)} onNext={()=>chM(1)} />
        <BtnGroup>
          {isAdmin(user) && <Btn variant="outline" size="sm" onClick={gerarAuto}>✨ Gerar Auto</Btn>}
          {isAdmin(user) && <Btn size="sm" onClick={salvar} disabled={saving}>{saving?'Salvando...':'💾 Salvar'}</Btn>}
          <Btn variant="outline" size="sm" onClick={()=>window.print()}>📄 PDF</Btn>
          {isAdmin(user) && <Btn variant="wa" size="sm" onClick={()=>setModalWA(true)}>📱 Enviar Escala</Btn>}
        </BtnGroup>
      </div>

      <div className="print-area">
        <div className="print-title print-only">ESCALA DE CULTO — {MESES[mes].toUpperCase()} {ano}</div>
        {getCultosOrdenados(mes,ano).map(c=><CultoCard key={`${c.tipo}-${c.idx}`} data={c.data} tipo={c.tipo} idx={c.idx} />)}
      </div>

      {/* WhatsApp Modal */}
      {modalWA && (
        <Modal title={`ENVIAR ESCALA — ${MESES[mes].toUpperCase()} ${ano}`} onClose={()=>setModalWA(false)} wide
          footer={<Btn variant="outline" onClick={()=>setModalWA(false)}>Fechar</Btn>}>
          <div style={{marginBottom:12}}>
            <label>Selecionar Mensagem</label>
            <select value={msgVersao} onChange={e=>setMsgVersao(parseInt(e.target.value))} style={{marginTop:4}}>
              <option value={0}>Versão 1 — "Contamos com sua participação"</option>
              <option value={1}>Versão 2 — "Que bom contar com você"</option>
              <option value={2}>Versão 3 — "É uma alegria servir junto"</option>
            </select>
          </div>
          <div style={{background:'var(--s2)',borderRadius:8,padding:12,fontSize:12,lineHeight:1.8,color:'var(--tx)',whiteSpace:'pre-wrap',borderLeft:'3px solid var(--cy)',marginBottom:14,maxHeight:150,overflowY:'auto'}}>{previewText}</div>
          {pessoas.length===0
            ? <div style={{color:'var(--g)',fontSize:13,textAlign:'center',padding:20}}>Nenhuma pessoa escalada neste mês ainda.</div>
            : pessoas.map(p=>(
              <div key={p.nome} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'9px 0',borderBottom:'1px solid var(--bd)'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--w)'}}>{p.nome}</div>
                  <div style={{fontSize:11,color:'var(--g)',marginTop:2}}>{p.fns.join(' · ')}</div>
                </div>
                {p.tel
                  ? <a href={waLink(p.tel, MSG_ESCALA[msgVersao](p.nome.split(' ')[0], p.fns.join('\n')))} target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',gap:5,padding:'5px 11px',background:'rgba(34,197,94,.12)',border:'1px solid rgba(34,197,94,.3)',borderRadius:6,color:'var(--grn)',textDecoration:'none',fontSize:11,fontWeight:600,flexShrink:0}}>💬 Enviar</a>
                  : <span style={{fontSize:10,color:'var(--g)',flexShrink:0}}>sem tel</span>
                }
              </div>
            ))
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
