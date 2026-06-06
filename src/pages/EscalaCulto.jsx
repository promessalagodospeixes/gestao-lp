import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbUpsert } from '../lib/supabase.js'
import { MESES, getSabDom, fmtBR, isAdmin } from '../lib/utils.js'
import { MonthNav, Btn, BtnGroup, Empty } from '../components/UI.jsx'

const FNS_SAB = [{k:'dir',l:'Direção'},{k:'voc',l:'Vocal Solo'},{k:'mor',l:'Mordomia'},{k:'por',l:'Portaria'},{k:'ord',l:'Ordenado do Dia'}]
const FNS_DOM = [{k:'dir',l:'Direção'},{k:'mor',l:'Mordomia'},{k:'por',l:'Portaria'},{k:'ord',l:'Ordenado do Dia'}]

export default function EscalaCulto() {
  const { state, dispatch } = useStore()
  const { escalas, funcoes, membros, escalaPreg, user } = state
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth())
  const [ano, setAno] = useState(now.getFullYear())
  const [saving, setSaving] = useState(false)

  const chM = (d) => { let m=mes+d,a=ano; if(m>11){m=0;a++} if(m<0){m=11;a--} setMes(m);setAno(a) }
  const ch = `${ano}-${mes}`
  const esc = escalas[ch] || {}
  const { sabs, doms } = getSabDom(mes, ano)

  const fnMbs = (nome) => { const f=(funcoes||[]).find(x=>x.nome===nome); return f&&(f.membros||[]).length?f.membros:[...(membros||[])].map(m=>m.nome).sort() }
  const getPregador = (data, tipo) => (escalaPreg||[]).find(p=>p.data===data&&(tipo==='sab'?p.culto==='Sábado Manhã':p.culto==='Domingo Noite'))

  const setVal = (slot, fn, val) => {
    const prev = (esc[slot]||{})[fn]||''
    if (val && val !== prev) {
      const slotData = esc[slot]||{}
      const jaUsado = Object.entries(slotData).some(([f,v])=>v===val&&f!==fn)
      if (jaUsado && !window.confirm(`⚠ ${val} já tem outra função neste culto. Forçar?`)) return
      // Check max
      const mb = (membros||[]).find(m=>m.nome===val)
      if (mb && mb.maxMes > 0) {
        const cnt = Object.values(esc).filter(s=>Object.values(s).includes(val)).length
        if (cnt >= mb.maxMes) { dispatch({ type:'TOAST', value:`⚠ ${val} — limite de ${mb.maxMes}x/mês atingido.` }); return }
      }
    }
    const novoEsc = { ...escalas, [ch]: { ...esc, [slot]: { ...(esc[slot]||{}), [fn]: val } } }
    dispatch({ type:'SET', key:'escalas', value:novoEsc })
  }

  const gerarAuto = () => {
    const pick = (lista, usados, off) => { for(let i=0;i<lista.length;i++){const p=lista[(off+i)%lista.length];if(!usados.includes(p))return p;} return lista[off%lista.length]||'' }
    const dir=fnMbs('Direção'),voc=fnMbs('Vocal Solo'),mor=fnMbs('Mordomia'),por=fnMbs('Portaria'),ord=fnMbs('Ordenado do Dia')
    const novoSlots = {}
    sabs.forEach((d,i)=>{const u=[];const pDir=pick(dir,u,i);u.push(pDir);const pVoc=pick(voc,u,i);u.push(pVoc);const pMor=pick(mor,u,i+1);u.push(pMor);const pPor=pick(por,u,i+2);u.push(pPor);const pOrd=pick(ord,u,i+3);novoSlots[`sab-${i}`]={dir:pDir,voc:pVoc,mor:pMor,por:pPor,ord:pOrd}})
    doms.forEach((d,i)=>{const u=[];const pDir=pick(dir,u,i+2);u.push(pDir);const pMor=pick(mor,u,i+3);u.push(pMor);const pPor=pick(por,u,i+4);u.push(pPor);const pOrd=pick(ord,u,i+5);novoSlots[`dom-${i}`]={dir:pDir,mor:pMor,por:pPor,ord:pOrd}})
    dispatch({ type:'SET', key:'escalas', value:{...escalas,[ch]:novoSlots} })
    dispatch({ type:'TOAST', value:'✨ Escala gerada! Revise se necessário.' })
  }

  const salvar = async () => {
    setSaving(true)
    const slots = esc
    const rows = Object.entries(slots).map(([slot,s])=>({ano,mes:mes+1,slot,dir:s.dir||null,voc:s.voc||null,mor:s.mor||null,por:s.por||null,ord:s.ord||null}))
    await Promise.all(rows.map(r=>dbUpsert('escalas',r,'ano,mes,slot')))
    setSaving(false)
    dispatch({ type:'TOAST', value:'💾 Escala salva!' })
  }

  const Sel = ({slot,fn,opts,val}) => (
    <select value={val||''} onChange={e=>setVal(slot,fn,e.target.value)} style={{flex:1,padding:'7px 8px',fontSize:12,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--w)'}}>
      <option value="">— Selecionar —</option>
      {opts.map(n=><option key={n}>{n}</option>)}
    </select>
  )

  const CultoCard = ({data,tipo,idx}) => {
    const slot = `${tipo}-${idx}`
    const s = esc[slot]||{}
    const fns = tipo==='sab'?FNS_SAB:FNS_DOM
    const dataStr = data.toISOString().slice(0,10)
    const preg = getPregador(dataStr, tipo)
    const sub = tipo==='sab' ? `EB 9h · Culto 10h30 · ${fmtBR(data)}` : `18h00 · ${fmtBR(data)}`
    return (
      <div style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,overflow:'hidden',marginBottom:12}}>
        <div style={{background:'var(--s2)',padding:'9px 14px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:13,letterSpacing:2,color:'var(--w)'}}>{tipo==='sab'?'☀ SÁBADO — MANHÃ':'🌙 DOMINGO — NOITE'}</div>
          <div style={{fontSize:10,color:'var(--cy)'}}>{sub}</div>
        </div>
        <div style={{padding:'9px 14px'}}>
          {/* Pregador */}
          <div style={{display:'flex',alignItems:'center',padding:'6px 0',borderBottom:'1px solid var(--bd)',gap:9,background:'rgba(0,188,212,.05)'}}>
            <div style={{fontSize:9,fontWeight:700,color:'var(--cy)',letterSpacing:1,textTransform:'uppercase',width:90,flexShrink:0}}>🎤 Pregador</div>
            <div style={{fontSize:12,color:preg?'var(--w)':'var(--g)',fontWeight:preg?600:400}}>{preg?preg.pregador:'Não definido'}</div>
          </div>
          {fns.map(f=>(
            <div key={f.k} style={{display:'flex',alignItems:'center',padding:'5px 0',borderBottom:'1px solid var(--bd)',gap:9}}>
              <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:1,textTransform:'uppercase',width:90,flexShrink:0,lineHeight:1.3}}>{f.l}</div>
              <Sel slot={slot} fn={f.k} opts={fnMbs(f.l==='Vocal Solo'?'Vocal Solo':f.l)} val={s[f.k]} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
        <MonthNav month={mes} year={ano} onPrev={()=>chM(-1)} onNext={()=>chM(1)} />
        <BtnGroup>
          <Btn variant="outline" size="sm" onClick={gerarAuto}>✨ Gerar Auto</Btn>
          <Btn size="sm" onClick={salvar} disabled={saving}>{saving?'Salvando...':'💾 Salvar'}</Btn>
          <Btn variant="outline" size="sm" onClick={()=>window.print()}>📄 PDF</Btn>
        </BtnGroup>
      </div>
      {sabs.map((d,i)=><CultoCard key={`sab-${i}`} data={d} tipo="sab" idx={i} />)}
      {doms.map((d,i)=><CultoCard key={`dom-${i}`} data={d} tipo="dom" idx={i} />)}
    </div>
  )
}
