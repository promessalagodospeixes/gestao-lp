import { useStore } from '../lib/store.jsx'
import { MESES_A, DISP_OPTS, fmtBR, nextWeekend, getSabDom, getCultosOrdenados, waLink, nomeDisp, cargosArray } from '../lib/utils.js'
import { StatCard } from '../components/UI.jsx'

export default function Dashboard() {
  const { state } = useStore()
  const { user, membros, musicas, financeiro, escalas, escalasLv, escalaPreg, lideranca, agenda, funcoes, setlists } = state
  const isAdmin = ['pastor','secretario'].includes(user?.perfil)
  const nome = user?.nome || ''
  const now = new Date()

  // ── Financeiro (admin) ────────────────────────────────────────────────────
  const finMes = (financeiro||[]).filter(f => {
    const d = new Date(f.data)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const saldo = finMes.filter(f=>f.tipo==='entrada').reduce((a,b)=>a+b.valor,0)
              - finMes.filter(f=>f.tipo==='saida').reduce((a,b)=>a+b.valor,0)

  // ── Próximo FDS ───────────────────────────────────────────────────────────
  const { sab, dom } = nextWeekend()
  const sabKey = `${sab.getFullYear()}-${sab.getMonth()}`
  const domKey = `${dom.getFullYear()}-${dom.getMonth()}`
  const si = Math.max(0, getSabDom(sab.getMonth(), sab.getFullYear()).sabs.findIndex(s => s.getDate() === sab.getDate()))
  const di = Math.max(0, getSabDom(dom.getMonth(), dom.getFullYear()).doms.findIndex(s => s.getDate() === dom.getDate()))
  const eSab = (escalas[sabKey]||{})[`sab-${si}`] || {}
  const eDom = (escalas[domKey]||{})[`dom-${di}`] || {}
  const pregSab = (escalaPreg||[]).find(p => p.data === sab.toISOString().slice(0,10) && p.culto === 'Sábado Manhã')
  const pregDom = (escalaPreg||[]).find(p => p.data === dom.toISOString().slice(0,10) && p.culto === 'Domingo Noite')

  // Louvor do próximo FDS
  const getLouvorSlot = (data, tipo, idx) => {
    const ch = `lv-${data.getFullYear()}-${data.getMonth()}`
    const lv = escalasLv?.[ch] || {}
    const slot = `${tipo}-${idx}`
    const vocals = []
    for (let n = 1; n <= 6; n++) { const v = lv[`${slot}-v${n}`]; if (v) vocals.push(v) }
    return { vocals, inst: lv[slot]?.inst || {} }
  }
  const lvSab = getLouvorSlot(sab, 'sab', si)
  const lvDom = getLouvorSlot(dom, 'dom', di)

  // ── Agenda ────────────────────────────────────────────────────────────────
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const proxAgenda = (agenda||[]).filter(a => new Date(a.data+'T00:00:00') >= hoje)
    .sort((a,b)=>a.data.localeCompare(b.data)).slice(0,4)

  // ══════════════════════════════════════════════════════════════════════════
  // VISÃO ADMIN — escala completa
  // ══════════════════════════════════════════════════════════════════════════
  const fnLabels = { dir:'Direção', voc:'Vocal Solo', mor:'Mordomia', por:'Portaria', ord:'Ordenado' }

  const EscPrevAdmin = ({ esc, lvData, data, tipo, preg }) => {
    const fns = tipo === 'sab' ? ['dir','voc','mor','por','ord'] : ['dir','mor','por','ord']
    const { vocals, inst } = lvData
    const instArr = Object.entries(inst)
    return (
      <div style={{ background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:10, overflow:'hidden' }}>
        <div style={{ background:'var(--s2)', padding:'8px 13px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:12, letterSpacing:2, color:'var(--w)' }}>{tipo==='sab'?'☀ SÁBADO':'🌙 DOMINGO'}</div>
          <div style={{ fontSize:10, color:'var(--cy)' }}>{fmtBR(data)}</div>
        </div>
        <div style={{ padding:'9px 13px' }}>
          <div style={{ display:'flex', alignItems:'center', padding:'4px 0', borderBottom:'1px solid var(--bd)', gap:8, fontSize:11 }}>
            <div style={{ width:80, fontSize:9, color:'var(--cy)', textTransform:'uppercase', letterSpacing:1, flexShrink:0, fontWeight:700 }}>🎤 Pregador</div>
            <div style={{ color: preg?'var(--w)':'var(--g)', fontWeight: preg?600:400 }}>{preg ? nomeDisp(preg.pregador,membros) : 'Não definido'}</div>
          </div>
          {fns.map(k => {
            const v = esc[k] || ''
            return (
              <div key={k} style={{ display:'flex', alignItems:'center', padding:'4px 0', borderBottom:'1px solid var(--bd)', gap:8, fontSize:11 }}>
                <div style={{ width:80, fontSize:9, color:'var(--g)', textTransform:'uppercase', letterSpacing:1, flexShrink:0 }}>{fnLabels[k]}</div>
                <div style={{ color:'var(--tx)' }}>{v ? nomeDisp(v,membros) : <span style={{color:'var(--g)'}}>—</span>}</div>
              </div>
            )
          })}
          {(vocals.length > 0 || instArr.length > 0) && (
            <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid var(--bd)' }}>
              <div style={{ fontSize:9, color:'var(--cy)', letterSpacing:2, textTransform:'uppercase', fontWeight:700, marginBottom:5 }}>🎵 Louvor</div>
              {vocals.length > 0 && (
                <div style={{ display:'flex', gap:8, padding:'3px 0', fontSize:11 }}>
                  <div style={{ width:80, fontSize:9, color:'var(--g)', textTransform:'uppercase', letterSpacing:1, flexShrink:0 }}>Vocais</div>
                  <div style={{ color:'var(--tx)', flexWrap:'wrap', display:'flex', gap:4 }}>
                    {vocals.map((v,i) => <span key={i}>{nomeDisp(v,membros)}{i<vocals.length-1?',':''}</span>)}
                  </div>
                </div>
              )}
              {instArr.map(([papel, v]) => {
                const nomes = Array.isArray(v) ? v.filter(x=>x?.nome).map(x=>nomeDisp(x.nome,membros)) : v ? [nomeDisp(v,membros)] : []
                if (!nomes.length) return null
                return (
                  <div key={papel} style={{ display:'flex', alignItems:'center', padding:'3px 0', gap:8, fontSize:11 }}>
                    <div style={{ width:80, fontSize:9, color:'var(--g)', textTransform:'uppercase', letterSpacing:1, flexShrink:0 }}>{papel}</div>
                    <div style={{ color:'var(--tx)' }}>{nomes.join(' / ')}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VISÃO MEMBRO — só o que é dele
  // ══════════════════════════════════════════════════════════════════════════
  const minhasFuncoes = (funcoes||[]).filter(f => (f.membros||[]).includes(nome))

  // Verifica participação num culto específico
  const minhaParticipacao = (esc, lvData, tipo) => {
    const fns = tipo === 'sab' ? ['dir','voc','mor','por','ord'] : ['dir','mor','por','ord']
    const itens = []
    // Funções de culto
    fns.forEach(k => { if (esc[k] === nome) itens.push({ label: fnLabels[k], destaque: true }) })
    // Louvor — vocal
    if (lvData.vocals.includes(nome)) itens.push({ label: '🎤 Vocal', destaque: true })
    // Louvor — instrumental
    Object.entries(lvData.inst).forEach(([papel, v]) => {
      const estaInst = Array.isArray(v) ? v.some(x => x?.nome === nome) : v === nome
      if (estaInst) itens.push({ label: `🎸 ${papel}`, destaque: true })
    })
    return itens
  }

  const partSab = minhaParticipacao(eSab, lvSab, 'sab')
  const partDom = minhaParticipacao(eDom, lvDom, 'dom')
  const temFDS = partSab.length > 0 || partDom.length > 0

  // Próxima escala de louvor (próximos 3 meses)
  const minhaEscalaLouvor = (() => {
    if (!nome) return []
    const resultado = []
    for (let offset = 0; offset < 3; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
      const ch = `lv-${d.getFullYear()}-${d.getMonth()}`
      const lv = escalasLv?.[ch] || {}
      getCultosOrdenados(d.getMonth(), d.getFullYear()).forEach(c => {
        if (c.data < hoje) return
        const slot = `${c.tipo}-${c.idx}`
        const vocals = []
        for (let n = 1; n <= 6; n++) { const v = lv[`${slot}-v${n}`]; if (v) vocals.push(v) }
        const inst = lv[slot]?.inst || {}
        const estaVocal = vocals.includes(nome)
        const estaInst = Object.entries(inst).find(([,v]) => Array.isArray(v) ? v.some(x=>x?.nome===nome) : v===nome)
        if (estaVocal || estaInst) {
          const cultoNome = c.tipo==='sab'?'Sábado Manhã':'Domingo Noite'
          const dataStr = c.data.toISOString().slice(0,10)
          const sl = (setlists||[]).find(s=>s.data===dataStr&&s.culto===cultoNome)
          let songNames = []
          if (estaInst && sl?.musicas?.length) {
            const entry = Array.isArray(estaInst[1]) ? estaInst[1].find(x=>x?.nome===nome) : null
            const lvNums = entry?.louvores || []
            songNames = lvNums.map(n=>(musicas||[]).find(m=>m.id===(sl.musicas||[])[n-1])?.nome).filter(Boolean)
          }
          const vocalSolos = lv[slot]?.vocalSolos || {}
          const meusSolos = estaVocal ? vocalSolos[nome] : null
          let soloNames = []
          if (meusSolos && meusSolos !== 'todos' && Array.isArray(meusSolos) && sl?.musicas?.length) {
            soloNames = meusSolos.map(n=>(musicas||[]).find(m=>m.id===(sl.musicas||[])[n-1])?.nome).filter(Boolean)
          }
          resultado.push({
            data: c.data, tipo: c.tipo,
            funcao: estaVocal ? 'Vocal' : `Instrumental — ${estaInst[0]}`,
            songNames,
            soloNames,
            soloTodos: meusSolos === 'todos',
          })
        }
      })
    }
    return resultado.slice(0, 8)
  })()

  // Próxima escala de culto (funções dir/voc/mor/por/ord)
  const minhaEscalaCulto = (() => {
    if (!nome) return []
    const resultado = []
    for (let offset = 0; offset < 3; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
      const ch = `${d.getFullYear()}-${d.getMonth()}`
      const esc = escalas[ch] || {}
      getCultosOrdenados(d.getMonth(), d.getFullYear()).forEach(c => {
        if (c.data < hoje) return
        const slot = `${c.tipo}-${c.idx}`
        const s = esc[slot] || {}
        Object.entries(fnLabels).forEach(([k, label]) => {
          if (s[k] === nome) resultado.push({ data: c.data, tipo: c.tipo, funcao: label })
        })
      })
    }
    return resultado.slice(0, 8)
  })()

  const minhaEscalaCompleta = [...minhaEscalaCulto, ...minhaEscalaLouvor]
    .sort((a, b) => a.data - b.data)
    .slice(0, 10)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <style>{`
        @media (max-width: 768px) {
          .dash-fds-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── ADMIN ── */}
      {isAdmin && (
        <>
          {/* ── Gráficos ── */}
          {(() => {
            const META_MEMBROS = 150
            const totalMembros = membros.length
            const pctMembros = Math.min(100, Math.round((totalMembros / META_MEMBROS) * 100))
            const comFuncao = (membros||[]).filter(m => (funcoes||[]).some(f => (f.membros||[]).includes(m.nome))).length
            const semFuncao = totalMembros - comFuncao
            const entradas = finMes.filter(f=>f.tipo==='entrada').reduce((a,b)=>a+b.valor,0)
            const saidas = finMes.filter(f=>f.tipo==='saida').reduce((a,b)=>a+b.valor,0)
            const maxFin = Math.max(entradas, saidas, 1)

            // Últimos 6 meses financeiro
            const mesesFin = Array.from({length:6},(_,i)=>{
              const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1)
              const ent = (financeiro||[]).filter(f=>{ const fd=new Date(f.data); return fd.getMonth()===d.getMonth()&&fd.getFullYear()===d.getFullYear()&&f.tipo==='entrada' }).reduce((a,b)=>a+b.valor,0)
              const sai = (financeiro||[]).filter(f=>{ const fd=new Date(f.data); return fd.getMonth()===d.getMonth()&&fd.getFullYear()===d.getFullYear()&&f.tipo==='saida' }).reduce((a,b)=>a+b.valor,0)
              return { label: MESES_A[d.getMonth()], ent, sai }
            })
            const maxMes = Math.max(...mesesFin.flatMap(m=>[m.ent,m.sai]), 1)

            const Card = ({title, children}) => (
              <div style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:12,padding:'14px 16px'}}>
                <div style={{fontSize:9,color:'var(--g)',letterSpacing:2,textTransform:'uppercase',marginBottom:12}}>{title}</div>
                {children}
              </div>
            )

            return (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12,marginBottom:20}}>

                {/* Meta de Membros */}
                <Card title="Meta de Membros">
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:8}}>
                    <div style={{fontFamily:'var(--font-display)',fontSize:36,color:'var(--cy)',lineHeight:1}}>{totalMembros}</div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:11,color:'var(--g)'}}>Meta: {META_MEMBROS}</div>
                      <div style={{fontSize:18,fontWeight:700,color:'var(--cy)'}}>{pctMembros}%</div>
                    </div>
                  </div>
                  <div style={{background:'var(--s2)',borderRadius:99,height:10,overflow:'hidden'}}>
                    <div style={{width:`${pctMembros}%`,height:'100%',background:`linear-gradient(90deg, var(--cy), #00e5ff)`,borderRadius:99,transition:'width .5s'}} />
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',marginTop:6,fontSize:10,color:'var(--g)'}}>
                    <span>0</span><span>{Math.round(META_MEMBROS/2)}</span><span>{META_MEMBROS}</span>
                  </div>
                  <div style={{fontSize:11,color:'var(--g)',marginTop:8}}>Faltam <strong style={{color:'var(--w)'}}>{META_MEMBROS - totalMembros}</strong> para a meta</div>
                </Card>

                {/* Membros com função */}
                <Card title="Envolvimento na Igreja">
                  <div style={{display:'flex',alignItems:'center',gap:16}}>
                    <svg width={90} height={90} viewBox="0 0 36 36">
                      {(() => {
                        const pct = totalMembros > 0 ? comFuncao / totalMembros : 0
                        const r = 15.9, c = 18
                        const circ = 2 * Math.PI * r
                        const dash = pct * circ
                        return <>
                          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--s2)" strokeWidth={3.8} />
                          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--grn)" strokeWidth={3.8}
                            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                            transform={`rotate(-90 ${c} ${c})`} />
                          <text x={c} y={c+1} textAnchor="middle" dominantBaseline="middle" fontSize={7} fontWeight="bold" fill="var(--w)">{Math.round(pct*100)}%</text>
                        </>
                      })()}
                    </svg>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                        <div style={{width:10,height:10,borderRadius:'50%',background:'var(--grn)',flexShrink:0}} />
                        <span style={{fontSize:12,color:'var(--tx)'}}>Com função</span>
                        <span style={{marginLeft:'auto',fontSize:14,fontWeight:700,color:'var(--grn)'}}>{comFuncao}</span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <div style={{width:10,height:10,borderRadius:'50%',background:'var(--s2)',border:'1px solid var(--bd)',flexShrink:0}} />
                        <span style={{fontSize:12,color:'var(--tx)'}}>Sem função</span>
                        <span style={{marginLeft:'auto',fontSize:14,fontWeight:700,color:'var(--g)'}}>{semFuncao}</span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Financeiro do mês */}
                <Card title={`Financeiro — ${MESES_A[now.getMonth()].toUpperCase()}`}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                    <div>
                      <div style={{fontSize:9,color:'var(--grn)',letterSpacing:1,textTransform:'uppercase'}}>Entradas</div>
                      <div style={{fontSize:18,fontWeight:700,color:'var(--grn)'}}>R${entradas.toLocaleString('pt-BR',{minimumFractionDigits:0})}</div>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:'var(--red)',letterSpacing:1,textTransform:'uppercase'}}>Saídas</div>
                      <div style={{fontSize:18,fontWeight:700,color:'var(--red)'}}>R${saidas.toLocaleString('pt-BR',{minimumFractionDigits:0})}</div>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'flex-end',gap:4,height:50}}>
                    {[{v:entradas,c:'var(--grn)'},{v:saidas,c:'var(--red)'}].map((b,i)=>(
                      <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                        <div style={{width:'100%',background:b.c,borderRadius:'4px 4px 0 0',height:`${Math.max(4,(b.v/maxFin)*46)}px`,opacity:.85}} />
                        <div style={{fontSize:8,color:'var(--g)'}}>{i===0?'Ent':'Saí'}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:8,fontSize:11,color:saldo>=0?'var(--grn)':'var(--red)',fontWeight:600}}>
                    Saldo: R${Math.abs(saldo).toLocaleString('pt-BR')} {saldo>=0?'positivo':'negativo'}
                  </div>
                </Card>

                {/* Histórico financeiro 6 meses */}
                <Card title="Histórico Financeiro (6 meses)">
                  <div style={{display:'flex',alignItems:'flex-end',gap:3,height:70,marginBottom:6}}>
                    {mesesFin.map((m,i)=>(
                      <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                        <div style={{width:'100%',display:'flex',flexDirection:'column',justifyContent:'flex-end',height:60,gap:1}}>
                          <div style={{background:'var(--grn)',borderRadius:'3px 3px 0 0',height:`${Math.max(2,(m.ent/maxMes)*55)}px`,opacity:.8}} />
                          <div style={{background:'var(--red)',borderRadius:'3px 3px 0 0',height:`${Math.max(2,(m.sai/maxMes)*55)}px`,opacity:.8}} />
                        </div>
                        <div style={{fontSize:8,color:'var(--g)',textAlign:'center'}}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:10,fontSize:9,color:'var(--g)'}}>
                    <span><span style={{color:'var(--grn)'}}>■</span> Entradas</span>
                    <span><span style={{color:'var(--red)'}}>■</span> Saídas</span>
                  </div>
                </Card>

              </div>
            )
          })()}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:11, marginBottom:18 }}>
            <StatCard label="Membros" value={membros.length} />
            <StatCard label="Músicas" value={musicas.length} />
            <StatCard label={`Saldo ${MESES_A[now.getMonth()]}`} value={'R$'+Math.round(saldo)} color={saldo>=0?'var(--grn)':'var(--red)'} />
          </div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:19, color:'var(--w)', letterSpacing:2, marginBottom:12 }}>PRÓXIMO FINAL DE SEMANA</div>
          <div className="dash-fds-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:18 }}>
            <EscPrevAdmin esc={eSab} lvData={lvSab} data={sab} tipo="sab" preg={pregSab} />
            <EscPrevAdmin esc={eDom} lvData={lvDom} data={dom} tipo="dom" preg={pregDom} />
          </div>
        </>
      )}

      {/* ── MEMBRO ── */}
      {!isAdmin && (
        <>
          {/* Saudação */}
          <div style={{ background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:12, padding:'16px 18px', marginBottom:18 }}>
            <div style={{ fontSize:11, color:'var(--g)', marginBottom:4 }}>Bem-vindo(a) de volta 👋</div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:20, color:'var(--w)', letterSpacing:1 }}>
              {user?.nome_exibicao || nome.split(' ')[0] || 'Membro'}
            </div>
            {minhasFuncoes.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:8 }}>
                {minhasFuncoes.map(f => (
                  <span key={f.id} style={{ fontSize:10, color:'var(--cy)', background:'var(--cdim)', padding:'3px 9px', borderRadius:5, border:'1px solid var(--cgl)' }}>{f.nome}</span>
                ))}
              </div>
            )}
          </div>

          {/* Minha participação no próximo FDS */}
          <div style={{ fontFamily:'var(--font-display)', fontSize:17, color:'var(--w)', letterSpacing:2, marginBottom:10 }}>PRÓXIMO FINAL DE SEMANA</div>
          {!temFDS
            ? <div style={{ background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:10, padding:'14px 16px', color:'var(--g)', fontSize:13, marginBottom:18 }}>
                Você não está escalado(a) neste final de semana.
              </div>
            : (
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:18 }}>
                {[{data:sab, tipo:'sab', part:partSab}, {data:dom, tipo:'dom', part:partDom}].map(({data, tipo, part}) => {
                  if (!part.length) return null
                  return (
                    <div key={tipo} style={{ background:'var(--s1)', border:'1px solid var(--cy)', borderRadius:10, overflow:'hidden' }}>
                      <div style={{ background:'var(--cdim)', padding:'8px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ fontFamily:'var(--font-display)', fontSize:12, letterSpacing:2, color:'var(--cy)' }}>{tipo==='sab'?'☀ SÁBADO':'🌙 DOMINGO'}</div>
                        <div style={{ fontSize:11, color:'var(--cy)', fontWeight:600 }}>{fmtBR(data)}</div>
                      </div>
                      <div style={{ padding:'10px 14px' }}>
                        {part.map((item, i) => (
                          <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'5px 0', borderBottom: i < part.length-1 ? '1px solid var(--bd)' : 'none' }}>
                            <span style={{ fontSize:18 }}>✅</span>
                            <span style={{ fontSize:14, fontWeight:700, color:'var(--cy)' }}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          }

          {/* Minha escala completa */}
          {minhaEscalaCompleta.length > 0 && (
            <div style={{ marginBottom:18 }}>
              <div style={{ fontFamily:'var(--font-display)', fontSize:17, color:'var(--w)', letterSpacing:2, marginBottom:10 }}>MINHA ESCALA</div>
              <div style={{ background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:10, overflow:'hidden' }}>
                {minhaEscalaCompleta.map((item, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderBottom: i < minhaEscalaCompleta.length-1 ? '1px solid var(--bd)' : 'none' }}>
                    <div style={{ background:'var(--cdim)', border:'1px solid var(--cgl)', borderRadius:7, padding:'5px 9px', textAlign:'center', flexShrink:0, minWidth:44 }}>
                      <div style={{ fontFamily:'var(--font-display)', fontSize:18, color:'var(--cy)', lineHeight:1 }}>{item.data.getDate()}</div>
                      <div style={{ fontSize:8, color:'var(--cy)', letterSpacing:1, textTransform:'uppercase' }}>{MESES_A[item.data.getMonth()]}</div>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, color:'var(--g)' }}>{item.tipo==='sab'?'Sábado Manhã':'Domingo Noite'}</div>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--w)', marginTop:2 }}>{item.funcao}</div>
                      {item.songNames?.length > 0 && <div style={{fontSize:11,color:'var(--cy)',marginTop:2}}>Suas musicas: {item.songNames.join(', ')}</div>}
                      {item.soloTodos && <div style={{fontSize:11,color:'var(--cy)',marginTop:2}}>Solo em todos os louvores</div>}
                      {item.soloNames?.length > 0 && <div style={{fontSize:11,color:'var(--cy)',marginTop:2}}>Solo: {item.soloNames.join(', ')}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sem escala */}
          {minhaEscalaCompleta.length === 0 && (
            <div style={{ background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:10, padding:'14px 16px', color:'var(--g)', fontSize:12, marginBottom:18 }}>
              Nenhuma escala encontrada nos próximos meses.
            </div>
          )}
        </>
      )}

      {/* Liderança (todos veem) */}
      {lideranca && lideranca.length > 0 && (
        <div style={{ marginBottom:18 }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:17, color:'var(--w)', letterSpacing:2, marginBottom:10 }}>LIDERANÇA</div>
          {lideranca.map(l => (
            <div key={l.id} style={{ background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:10, padding:'12px 15px', display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--cdim)', border:'2px solid var(--cy)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontSize:14, color:'var(--cy)', flexShrink:0 }}>{l.nome?.[0]||'?'}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:9, color:'var(--cy)', letterSpacing:2, textTransform:'uppercase' }}>{cargosArray(l.cargo).join(' · ')}</div>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--w)', marginTop:1 }}>{l.nome}</div>
              </div>
              {(l.tel || (membros||[]).find(m=>m.nome===l.membro_nome)?.tel) && (
                <a href={waLink(l.tel || (membros||[]).find(m=>m.nome===l.membro_nome)?.tel, `Olá ${l.nome}!`)} target="_blank" rel="noopener"
                  style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 11px', background:'rgba(34,197,94,.12)', border:'1px solid rgba(34,197,94,.3)', borderRadius:6, color:'var(--grn)', textDecoration:'none', fontSize:11, fontWeight:600, flexShrink:0 }}>
                  💬 WhatsApp
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Agenda (todos veem) */}
      {proxAgenda.length > 0 && (
        <div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:17, color:'var(--w)', letterSpacing:2, marginBottom:10 }}>PRÓXIMOS EVENTOS</div>
          {proxAgenda.map(ev => {
            const d = new Date(ev.data+'T00:00:00')
            const local = ev.tipo === 'Igreja Local'
            const regional = ev.tipo === 'Evento Regional'
            const dateColor = local ? '#f97316' : 'var(--cy)'
            const dateBg = local ? 'rgba(249,115,22,.1)' : 'var(--cdim)'
            const dateBorder = local ? '1px solid rgba(249,115,22,.35)' : '1px solid var(--cgl)'
            const tipoColor = local ? '#f97316' : regional ? 'var(--g)' : 'var(--g)'
            return (
              <div key={ev.id} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'11px 0', borderBottom:'1px solid var(--bd)' }}>
                <div style={{ background:dateBg, border:dateBorder, borderRadius:8, padding:'5px 9px', textAlign:'center', flexShrink:0, minWidth:46 }}>
                  <div style={{ fontFamily:'var(--font-display)', fontSize:20, color:dateColor, lineHeight:1 }}>{d.getDate()}</div>
                  <div style={{ fontSize:8, color:dateColor, letterSpacing:2, textTransform:'uppercase' }}>{MESES_A[d.getMonth()]}</div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--w)' }}>{ev.titulo}</div>
                  <div style={{ fontSize:11, color:tipoColor, marginTop:2, fontWeight: local ? 600 : 400 }}>
                    {local ? '🏠 Igreja Local' : regional ? '🌐 Evento Regional' : ev.tipo}{ev.hora?' · '+ev.hora:''}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
