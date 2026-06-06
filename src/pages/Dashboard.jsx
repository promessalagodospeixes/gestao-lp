import { useStore } from '../lib/store.jsx'
import { MESES_A, fmtBR, nextWeekend, getSabDom, waLink } from '../lib/utils.js'
import { StatCard } from '../components/UI.jsx'

export default function Dashboard() {
  const { state } = useStore()
  const { user, membros, musicas, financeiro, escalas, escalaPreg, lideranca, agenda } = state
  const isAdmin = ['pastor','secretario'].includes(user?.perfil)

  // Saldo do mês atual
  const now = new Date()
  const finMes = financeiro.filter(f => {
    const d = new Date(f.data)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const ent = finMes.filter(f=>f.tipo==='entrada').reduce((a,b)=>a+b.valor,0)
  const sai = finMes.filter(f=>f.tipo==='saida').reduce((a,b)=>a+b.valor,0)
  const saldo = ent - sai

  // Próximo FDS
  const { sab, dom } = nextWeekend()
  const sabKey = `${sab.getFullYear()}-${sab.getMonth()}`
  const si = Math.max(0, getSabDom(sab.getMonth(), sab.getFullYear()).sabs.findIndex(s => s.getDate() === sab.getDate()))
  const eSab = (escalas[sabKey]||{})[`sab-${si}`] || {}
  const domKey = `${dom.getFullYear()}-${dom.getMonth()}`
  const di = Math.max(0, getSabDom(dom.getMonth(), dom.getFullYear()).doms.findIndex(s => s.getDate() === dom.getDate()))
  const eDom = (escalas[domKey]||{})[`dom-${di}`] || {}

  // Pregadores do FDS
  const pregSab = escalaPreg.find(p => p.data === sab.toISOString().slice(0,10) && p.culto === 'Sábado Manhã')
  const pregDom = escalaPreg.find(p => p.data === dom.toISOString().slice(0,10) && p.culto === 'Domingo Noite')

  // Eventos futuros
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const proxAgenda = (agenda||[]).filter(a => new Date(a.data+'T00:00:00') >= hoje).sort((a,b)=>a.data.localeCompare(b.data)).slice(0,4)

  const fnLabels = { dir:'Direção', voc:'Vocal Solo', mor:'Mordomia', por:'Portaria', ord:'Ordenado' }
  const nome = user?.nome || ''

  const EscPrev = ({ esc, data, tipo, preg }) => {
    const fns = tipo === 'sab' ? ['dir','voc','mor','por','ord'] : ['dir','mor','por','ord']
    return (
      <div style={{ background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:10, overflow:'hidden', marginBottom:12 }}>
        <div style={{ background:'var(--s2)', padding:'8px 13px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:12, letterSpacing:2, color:'var(--w)' }}>{tipo==='sab'?'☀ SÁBADO':'🌙 DOMINGO'}</div>
          <div style={{ fontSize:10, color:'var(--cy)' }}>{fmtBR(data)}</div>
        </div>
        <div style={{ padding:'9px 13px' }}>
          {/* Pregador */}
          <div style={{ display:'flex', alignItems:'center', padding:'4px 0', borderBottom:'1px solid var(--bd)', gap:8, fontSize:11, background:'rgba(0,188,212,.05)' }}>
            <div style={{ width:85, fontSize:9, color:'var(--cy)', textTransform:'uppercase', letterSpacing:1, flexShrink:0, fontWeight:700 }}>🎤 Pregador</div>
            <div style={{ color: preg ? 'var(--w)' : 'var(--g)', fontWeight: preg ? 600 : 400 }}>{preg ? preg.pregador : 'Não definido'}</div>
          </div>
          {fns.map(k => {
            const v = esc[k] || ''
            if (!isAdmin && v && v !== nome) return null
            return (
              <div key={k} style={{ display:'flex', alignItems:'center', padding:'4px 0', borderBottom:'1px solid var(--bd)', gap:8, fontSize:11 }}>
                <div style={{ width:85, fontSize:9, color:'var(--g)', textTransform:'uppercase', letterSpacing:1, flexShrink:0 }}>{fnLabels[k]}</div>
                <div style={{ color: v === nome ? 'var(--cy)' : 'var(--tx)', fontWeight: v === nome ? 700 : 500 }}>{v || <span style={{color:'var(--g)'}}>—</span>}</div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Stats */}
      {isAdmin && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:11, marginBottom:18 }}>
          <StatCard label="Membros" value={membros.length} />
          <StatCard label="Músicas" value={musicas.length} />
          <StatCard label={`Saldo ${MESES_A[now.getMonth()]}`} value={'R$'+Math.round(saldo)} color={saldo>=0?'var(--grn)':'var(--red)'} />
        </div>
      )}

      {/* Escalas do FDS */}
      <div style={{ marginBottom:6 }}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:19, color:'var(--w)', letterSpacing:2, marginBottom:12 }}>PRÓXIMO FINAL DE SEMANA</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <EscPrev esc={eSab} data={sab} tipo="sab" preg={pregSab} />
          <EscPrev esc={eDom} data={dom} tipo="dom" preg={pregDom} />
        </div>
      </div>

      {/* Liderança */}
      {lideranca && lideranca.length > 0 && (
        <div style={{ marginBottom:18 }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:19, color:'var(--w)', letterSpacing:2, marginBottom:12 }}>LIDERANÇA</div>
          {lideranca.map(l => (
            <div key={l.id} style={{ background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:10, padding:'12px 15px', display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--cdim)', border:'2px solid var(--cy)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontSize:14, color:'var(--cy)', flexShrink:0 }}>{l.nome[0]}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:9, color:'var(--cy)', letterSpacing:2, textTransform:'uppercase' }}>{l.cargo}</div>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--w)', marginTop:1 }}>{l.nome}</div>
              </div>
              {l.tel && (
                <a href={waLink(l.tel, `Olá ${l.nome}!`)} target="_blank" rel="noopener" style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 11px', background:'rgba(34,197,94,.12)', border:'1px solid rgba(34,197,94,.3)', borderRadius:6, color:'var(--grn)', textDecoration:'none', fontSize:11, fontWeight:600 }}>
                  💬 WhatsApp
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Agenda */}
      {proxAgenda.length > 0 && (
        <div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:19, color:'var(--w)', letterSpacing:2, marginBottom:12 }}>PRÓXIMOS EVENTOS</div>
          {proxAgenda.map(ev => {
            const d = new Date(ev.data+'T00:00:00')
            return (
              <div key={ev.id} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'11px 0', borderBottom:'1px solid var(--bd)' }}>
                <div style={{ background:'var(--cdim)', border:'1px solid var(--cgl)', borderRadius:8, padding:'5px 9px', textAlign:'center', flexShrink:0, minWidth:46 }}>
                  <div style={{ fontFamily:'var(--font-display)', fontSize:20, color:'var(--cy)', lineHeight:1 }}>{d.getDate()}</div>
                  <div style={{ fontSize:8, color:'var(--cy)', letterSpacing:2, textTransform:'uppercase' }}>{MESES_A[d.getMonth()]}</div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--w)' }}>{ev.titulo}</div>
                  <div style={{ fontSize:11, color:'var(--g)', marginTop:2 }}>{ev.tipo}{ev.hora ? ' · '+ev.hora : ''}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
