// Reusable UI components

export function Card({ children, style }) {
  return <div style={{ background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:10, overflow:'hidden', marginBottom:12, ...style }}>{children}</div>
}

export function CardHeader({ title, subtitle, actions }) {
  return (
    <div style={{ background:'var(--s2)', padding:'9px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid var(--bd)' }}>
      <div>
        <div style={{ fontFamily:'var(--font-display)', fontSize:13, letterSpacing:2, color:'var(--w)' }}>{title}</div>
        {subtitle && <div style={{ fontSize:10, color:'var(--cy)', marginTop:1 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display:'flex', gap:6 }}>{actions}</div>}
    </div>
  )
}

export function CardBody({ children, style }) {
  return <div style={{ padding:'11px 14px', ...style }}>{children}</div>
}

export function FuncaoRow({ label, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--bd)', gap:9 }}>
      <div style={{ fontSize:9, fontWeight:600, color:'var(--g)', letterSpacing:'1px', textTransform:'uppercase', width:90, flexShrink:0, lineHeight:1.3 }}>{label}</div>
      <div style={{ flex:1 }}>{children}</div>
    </div>
  )
}

export function Btn({ children, onClick, variant='cyan', size='sm', style, disabled }) {
  const variants = {
    cyan: { background:'var(--cy)', color:'#000', border:'none' },
    outline: { background:'transparent', color:'var(--gl)', border:'1px solid var(--bd)' },
    danger: { background:'transparent', color:'var(--red)', border:'1px solid var(--red)' },
    green: { background:'var(--grn)', color:'#000', border:'none' },
    wa: { background:'rgba(34,197,94,.15)', color:'var(--grn)', border:'1px solid rgba(34,197,94,.3)' },
  }
  const sizes = {
    xs: { padding:'4px 9px', fontSize:10 },
    sm: { padding:'6px 12px', fontSize:12 },
    md: { padding:'8px 16px', fontSize:13 },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ fontFamily:'inherit', fontWeight:600, borderRadius:7, cursor:disabled?'not-allowed':'pointer', opacity:disabled?.6:1, display:'inline-flex', alignItems:'center', gap:5, transition:'all .15s', ...variants[variant], ...sizes[size], ...style }}
    >
      {children}
    </button>
  )
}

export function BtnGroup({ children }) {
  return <div style={{ display:'flex', gap:7, flexWrap:'wrap', alignItems:'center' }}>{children}</div>
}

export function SecHeader({ title, actions }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:8 }}>
      <div style={{ fontFamily:'var(--font-display)', fontSize:19, color:'var(--w)', letterSpacing:2 }}>{title}</div>
      {actions}
    </div>
  )
}

export function MonthNav({ month, year, onPrev, onNext }) {
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <button onClick={onPrev} style={navBtn}>‹</button>
      <div style={{ fontFamily:'var(--font-display)', fontSize:17, color:'var(--w)', letterSpacing:2, minWidth:170, textAlign:'center' }}>{MESES[month].toUpperCase()} {year}</div>
      <button onClick={onNext} style={navBtn}>›</button>
    </div>
  )
}
const navBtn = { background:'var(--s2)', border:'1px solid var(--bd)', color:'var(--w)', width:26, height:26, borderRadius:6, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center' }

export function Tag({ children, color='gray' }) {
  const colors = {
    cyan: { background:'var(--cdim)', color:'var(--cy)', border:'1px solid var(--cgl)' },
    gray: { background:'#2a2a2a', color:'var(--gl)' },
    green: { background:'rgba(34,197,94,.1)', color:'var(--grn)' },
    yellow: { background:'rgba(245,158,11,.1)', color:'var(--yel)' },
    red: { background:'rgba(239,68,68,.1)', color:'var(--red)' },
    orange: { background:'rgba(249,115,22,.12)', color:'#f97316', border:'1px solid rgba(249,115,22,.3)' },
  }
  return <span style={{ display:'inline-block', padding:'2px 7px', borderRadius:99, fontSize:9, fontWeight:600, letterSpacing:1, textTransform:'uppercase', margin:1, ...colors[color] }}>{children}</span>
}

export function FormGrid({ children }) {
  return <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>{children}</div>
}

export function FG({ children, full, style }) {
  return <div style={{ display:'flex', flexDirection:'column', gap:4, ...(full ? { gridColumn:'1/-1' } : {}), ...style }}>{children}</div>
}

export function Modal({ id, title, onClose, children, footer, wide }) {
  return (
    <div style={styles.ov} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...styles.mo, ...(wide ? { width:580 } : {}) }}>
        <div style={styles.hdr}>
          <div style={styles.htitle}>{title}</div>
          <button style={styles.close} onClick={onClose}>✕</button>
        </div>
        {children}
        {footer && <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:18 }}>{footer}</div>}
      </div>
    </div>
  )
}
const styles = {
  ov: { position:'fixed', inset:0, background:'rgba(0,0,0,.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500 },
  mo: { background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:13, padding:22, width:520, maxWidth:'96vw', maxHeight:'92vh', overflowY:'auto' },
  hdr: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 },
  htitle: { fontFamily:'var(--font-display)', fontSize:19, letterSpacing:2, color:'var(--w)' },
  close: { background:'none', border:'none', color:'var(--g)', fontSize:17, cursor:'pointer', padding:3 },
}

export function Empty({ icon, text }) {
  return (
    <div style={{ textAlign:'center', padding:'36px 18px', color:'var(--g)' }}>
      <div style={{ fontSize:38, marginBottom:9 }}>{icon}</div>
      <p style={{ fontSize:13 }}>{text}</p>
    </div>
  )
}

export function Divider() {
  return <div style={{ height:1, background:'var(--bd)', margin:'14px 0' }} />
}

export function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:10, padding:15 }}>
      <div style={{ fontSize:9, color:'var(--g)', letterSpacing:2, textTransform:'uppercase' }}>{label}</div>
      <div style={{ fontFamily:'var(--font-display)', fontSize:30, color:color||'var(--cy)', lineHeight:1.1, marginTop:2 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'var(--g)', marginTop:1 }}>{sub}</div>}
    </div>
  )
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display:'flex', borderBottom:'1px solid var(--bd)', marginBottom:16 }}>
      {tabs.map(t => (
        <div
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{ padding:'8px 14px', fontSize:12, fontWeight:500, cursor:'pointer', borderBottom:`2px solid ${active===t.id?'var(--cy)':'transparent'}`, color:active===t.id?'var(--cy)':'var(--g)', transition:'all .15s' }}
        >
          {t.label}
        </div>
      ))}
    </div>
  )
}
