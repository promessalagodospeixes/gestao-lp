import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbUpsert } from '../lib/supabase.js'
import { getSabDom, fmtBR } from '../lib/utils.js'
import { MonthNav, Btn, BtnGroup } from '../components/UI.jsx'

const CLASSES = ['Nave','Jovens','Adolescentes','Juvenil','Crianças','Batismal']
const HAS_AUX = ['Nave','Crianças']

export default function EscalaEB() {
  const { state, dispatch } = useStore()
  const { escalasEB, funcoes, membros } = state
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth())
  const [ano, setAno] = useState(now.getFullYear())
  const [abertas, setAbertas] = useState([])
  const [saving, setSaving] = useState(false)

  const chM = (d) => { let m=mes+d,a=ano; if(m>11){m=0;a++} if(m<0){m=11;a--} setMes(m);setAno(a) }
  const ch = `eb-${ano}-${mes}`
  const esc = escalasEB[ch]||{}
  const { sabs } = getSabDom(mes, ano)
  const allMbs = (membros||[]).map(m=>m.nome).sort()
  const fnMbs = (nome) => { const f=(funcoes||[]).find(x=>x.nome===nome); return f&&(f.membros||[]).length?f.membros:allMbs }

  const toggle = (cl) => setAbertas(a=>a.includes(cl)?a.filter(x=>x!==cl):[...a,cl])

  const setVal = (cl, idx, fn, val) => {
    const k = `${cl}-${idx}`
    const novo = {...escalasEB, [ch]:{...esc,[k]:{...(esc[k]||{}),[fn]:val}}}
    dispatch({ type:'SET', key:'escalasEB', value:novo })
  }

  const gerarAuto = () => {
    const novoSlots = {}
    CLASSES.forEach(cl => {
      const profs = fnMbs(`Professor EB — ${cl}`)
      const auxs = fnMbs(`Auxiliar EB — ${cl}`)
      if (!profs.length) return
      sabs.forEach((d,i) => {
        const k = `${cl}-${i}`
        novoSlots[k] = { prof: profs[i%profs.length] }
        if (HAS_AUX.includes(cl) && auxs.length) {
          const auxOpts = auxs.filter(a=>a!==novoSlots[k].prof)
          novoSlots[k].aux = auxOpts.length ? auxOpts[i%auxOpts.length] : ''
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
    dispatch({ type:'TOAST', value:'💾 Escola Bíblica salva!' })
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
        <MonthNav month={mes} year={ano} onPrev={()=>chM(-1)} onNext={()=>chM(1)} />
        <BtnGroup>
          <Btn variant="outline" size="sm" onClick={gerarAuto}>✨ Gerar Auto</Btn>
          <Btn size="sm" onClick={salvar} disabled={saving}>{saving?'Salvando...':'💾 Salvar'}</Btn>
        </BtnGroup>
      </div>
      {CLASSES.map(cl => {
        const profs = fnMbs(`Professor EB — ${cl}`)
        const auxs = fnMbs(`Auxiliar EB — ${cl}`)
        const showAux = HAS_AUX.includes(cl)
        const open = abertas.includes(cl)
        return (
          <div key={cl} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,overflow:'hidden',marginBottom:10}}>
            <div onClick={()=>toggle(cl)} style={{background:'var(--s2)',padding:'9px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontFamily:'var(--font-display)',fontSize:13,letterSpacing:2,color:'var(--w)'}}>📖 CLASSE {cl.toUpperCase()}</span>
                {profs.length > 0 && profs !== allMbs ? <span style={{background:'rgba(34,197,94,.1)',color:'var(--grn)',fontSize:9,padding:'2px 7px',borderRadius:99,fontWeight:600}}>{profs.length} prof.</span> : <span style={{background:'rgba(239,68,68,.1)',color:'var(--red)',fontSize:9,padding:'2px 7px',borderRadius:99,fontWeight:600}}>sem prof.</span>}
              </div>
              <span style={{color:'var(--g)',fontSize:12}}>{open?'▲':'▼'}</span>
            </div>
            {open && (
              <div style={{padding:'9px 14px'}}>
                {sabs.map((d,i) => {
                  const k = `${cl}-${i}`
                  const s = esc[k]||{}
                  return (
                    <div key={i} style={{display:'flex',alignItems:'center',padding:'6px 0',borderBottom:'1px solid var(--bd)',gap:9}}>
                      <div style={{fontSize:9,color:'var(--g)',width:80,flexShrink:0}}>{fmtBR(d)}</div>
                      <select value={s.prof||''} onChange={e=>setVal(cl,i,'prof',e.target.value)} style={{flex:1,padding:'6px 8px',fontSize:11,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--w)'}}>
                        <option value="">— Professor —</option>
                        {profs.map(n=><option key={n}>{n}</option>)}
                      </select>
                      {showAux && <select value={s.aux||''} onChange={e=>setVal(cl,i,'aux',e.target.value)} style={{flex:1,padding:'6px 8px',fontSize:11,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--w)'}}>
                        <option value="">— Auxiliar —</option>
                        {auxs.map(n=><option key={n}>{n}</option>)}
                      </select>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
