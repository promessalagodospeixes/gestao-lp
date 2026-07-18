import { useState, useMemo } from 'react'
import { useStore } from '../lib/store.jsx'
import { getSabDom, fmtBR, normalizar, nomeDisp, MESES } from '../lib/utils.js'
import { SecHeader, Empty } from '../components/UI.jsx'

const TIPO_LABEL = { culto:'Escala de Culto', eb:'Escola Bíblica', louvor:'Equipe de Louvor' }
const TIPO_COLOR = { culto:'var(--cy)', eb:'var(--grn)', louvor:'#f97316' }

const computarData = (oc) => {
  try {
    const { sabs, doms } = getSabDom(oc.mes - 1, oc.ano)
    if (oc.slot.startsWith('sab-')) return sabs[parseInt(oc.slot.split('-')[1])] || null
    if (oc.slot.startsWith('dom-')) return doms[parseInt(oc.slot.split('-')[1])] || null
    // EB: slot é um número (índice do sábado)
    const idx = parseInt(oc.slot)
    if (!isNaN(idx)) return sabs[idx] || null
    return null
  } catch { return null }
}

export default function Ocorrencias() {
  const { state } = useStore()
  const { ocorrencias, membros } = state
  const [filtroMembro, setFiltroMembro] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')

  const lista = useMemo(() => {
    return (ocorrencias||[])
      .filter(oc => oc.funcao !== '_confirmado')
      .filter(oc => {
        if (!filtroTipo) return true
        return oc.tipo === filtroTipo
      })
      .filter(oc => {
        if (!filtroMembro) return true
        const q = normalizar(filtroMembro)
        return normalizar(oc.nome_original||'').includes(q) || normalizar(oc.substituto||'').includes(q)
      })
      .map(oc => ({ ...oc, dataObj: computarData(oc) }))
      .sort((a, b) => {
        if (a.ano !== b.ano) return b.ano - a.ano
        if (a.mes !== b.mes) return b.mes - a.mes
        if (a.dataObj && b.dataObj) return b.dataObj - a.dataObj
        return 0
      })
  }, [ocorrencias, filtroMembro, filtroTipo])

  const chipStyle = (active) => ({
    padding:'4px 11px', borderRadius:99, fontSize:10, fontWeight:600, cursor:'pointer',
    border: active ? '1px solid var(--cy)' : '1px solid var(--bd)',
    background: active ? 'var(--cdim)' : 'transparent',
    color: active ? 'var(--cy)' : 'var(--g)',
  })

  return (
    <div>
      <SecHeader title="Ocorrências" />

      {/* Filtros */}
      <div style={{marginBottom:14,display:'flex',flexDirection:'column',gap:8}}>
        <input
          value={filtroMembro}
          onChange={e=>setFiltroMembro(e.target.value)}
          placeholder="🔍 Filtrar por membro (quem faltou ou substituiu)..."
          style={{width:'100%',boxSizing:'border-box'}}
        />
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {[['','Todos'],['culto','Culto'],['eb','Escola Bíblica'],['louvor','Louvor']].map(([v,l])=>(
            <button key={v} style={chipStyle(filtroTipo===v)} onClick={()=>setFiltroTipo(v)}>{l}</button>
          ))}
        </div>
      </div>

      {lista.length === 0
        ? <Empty icon="📋" text={filtroMembro ? `Nenhuma ocorrência encontrada para "${filtroMembro}".` : 'Nenhuma ocorrência registrada.'} />
        : lista.map((oc, i) => {
            const dataFormatada = oc.dataObj ? fmtBR(oc.dataObj) : `${MESES[oc.mes-1]} ${oc.ano}`
            const tipoColor = TIPO_COLOR[oc.tipo] || 'var(--g)'
            const tipoLabel = TIPO_LABEL[oc.tipo] || oc.tipo || 'Culto'
            return (
              <div key={oc.id||i} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderLeft:`3px solid ${tipoColor}`,borderRadius:10,padding:'12px 15px',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                  <span style={{fontSize:12,fontWeight:700,color:'var(--w)'}}>{dataFormatada}</span>
                  <span style={{fontSize:9,fontWeight:700,color:tipoColor,background:`${tipoColor}20`,padding:'2px 8px',borderRadius:99,textTransform:'uppercase',letterSpacing:1}}>{tipoLabel}</span>
                  {oc.funcao && <span style={{fontSize:11,color:'var(--g)'}}>{oc.funcao}</span>}
                </div>
                <div className="grid-2" style={{gap:8}}>
                  <div>
                    <div style={{fontSize:9,color:'var(--red)',letterSpacing:1,textTransform:'uppercase',marginBottom:2}}>Quem faltou</div>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--w)'}}>{nomeDisp(oc.nome_original||'—', membros)}</div>
                  </div>
                  {oc.substituto && (
                    <div>
                      <div style={{fontSize:9,color:'var(--grn)',letterSpacing:1,textTransform:'uppercase',marginBottom:2}}>Substituído por</div>
                      <div style={{fontSize:13,fontWeight:600,color:'var(--tx)'}}>{nomeDisp(oc.substituto, membros)}</div>
                    </div>
                  )}
                </div>
                {oc.motivo && (
                  <div style={{marginTop:8,fontSize:11,color:'var(--g)',background:'var(--s2)',padding:'6px 10px',borderRadius:6}}>
                    Motivo: {oc.motivo}
                  </div>
                )}
              </div>
            )
          })
      }
    </div>
  )
}
