// Reusable UI components
import { useEffect } from 'react'

export function Card({ children, style }) {
  return <div style={{ background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:14, overflow:'hidden', marginBottom:14, ...style }}>{children}</div>
}

export function CardHeader({ title, subtitle, actions }) {
  return (
    <div style={{ background:'var(--s2)', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid var(--bd)' }}>
      <div>
        <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, letterSpacing:'-.01em', color:'var(--w)' }}>{title}</div>
        {subtitle && <div style={{ fontSize:11, color:'var(--g)', marginTop:2 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display:'flex', gap:6 }}>{actions}</div>}
    </div>
  )
}

export function CardBody({ children, style }) {
  return <div style={{ padding:'13px 16px', ...style }}>{children}</div>
}

export function FuncaoRow({ label, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--bd)', gap:12 }}>
      <div style={{ fontSize:10.5, fontWeight:600, color:'var(--g)', letterSpacing:'.3px', textTransform:'uppercase', width:96, flexShrink:0, lineHeight:1.3 }}>{label}</div>
      <div style={{ flex:1 }}>{children}</div>
    </div>
  )
}

export function Btn({ children, onClick, variant='cyan', size='sm', style, disabled }) {
  const variants = {
    cyan: { background:'var(--cy)', color:'#04211f', border:'none' },
    outline: { background:'transparent', color:'var(--gl)', border:'1px solid rgba(255,255,255,.12)' },
    danger: { background:'transparent', color:'var(--red)', border:'1px solid rgba(239,91,91,.4)' },
    green: { background:'var(--grn)', color:'#04211f', border:'none' },
    wa: { background:'rgba(52,179,122,.12)', color:'#4ecb93', border:'1px solid rgba(52,179,122,.35)' },
  }
  const sizes = {
    xs: { padding:'5px 10px', fontSize:11 },
    sm: { padding:'8px 13px', fontSize:12.5 },
    md: { padding:'9px 16px', fontSize:13 },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ fontFamily:'inherit', fontWeight:700, borderRadius:9, whiteSpace:'nowrap', cursor:disabled?'not-allowed':'pointer', opacity:disabled?.6:1, display:'inline-flex', alignItems:'center', gap:6, transition:'all .15s', ...variants[variant], ...sizes[size], ...style }}
    >
      {children}
    </button>
  )
}

export function BtnGroup({ children }) {
  return <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>{children}</div>
}

export function SecHeader({ title, actions }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
      <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:18, color:'var(--w)', letterSpacing:'-.01em' }}>{title}</div>
      {actions}
    </div>
  )
}

export function MonthNav({ month, year, onPrev, onNext }) {
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <button onClick={onPrev} style={navBtn}>‹</button>
      <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, color:'var(--w)', letterSpacing:'-.01em', minWidth:150, textAlign:'center' }}>{MESES[month]} {year}</div>
      <button onClick={onNext} style={navBtn}>›</button>
    </div>
  )
}
const navBtn = { background:'var(--s2)', border:'1px solid rgba(255,255,255,.1)', color:'var(--w)', width:32, height:32, borderRadius:9, cursor:'pointer', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center' }

export function Tag({ children, color='gray' }) {
  const colors = {
    cyan: { background:'var(--cdim)', color:'var(--cy)', border:'1px solid var(--cgl)' },
    gray: { background:'rgba(255,255,255,.06)', color:'var(--gl)', border:'1px solid rgba(255,255,255,.08)' },
    green: { background:'rgba(52,179,122,.12)', color:'#4ecb93', border:'1px solid rgba(52,179,122,.3)' },
    yellow: { background:'rgba(216,162,74,.12)', color:'var(--yel)', border:'1px solid rgba(216,162,74,.3)' },
    red: { background:'rgba(239,91,91,.12)', color:'var(--red)', border:'1px solid rgba(239,91,91,.3)' },
    orange: { background:'rgba(216,162,74,.12)', color:'var(--yel)', border:'1px solid rgba(216,162,74,.3)' },
  }
  return <span style={{ display:'inline-block', padding:'3px 9px', borderRadius:7, fontSize:10, fontWeight:700, letterSpacing:'.3px', textTransform:'uppercase', margin:1, ...colors[color] }}>{children}</span>
}

export function FormGrid({ children }) {
  // usa classe .form-grid (index.css) para colapsar em 1 coluna no celular
  return <div className="form-grid">{children}</div>
}

export function FG({ children, full, style }) {
  return <div style={{ display:'flex', flexDirection:'column', gap:5, ...(full ? { gridColumn:'1/-1' } : {}), ...style }}>{children}</div>
}

export function Modal({ id, title, onClose, children, footer, wide }) {
  useEffect(() => {
    const el = document.querySelector('.gestao-content')
    const saved = el?.scrollTop ?? 0
    return () => { if (el) requestAnimationFrame(() => { el.scrollTop = saved }) }
  }, [])
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
  ov: { position:'fixed', inset:0, background:'rgba(0,0,0,.7)', backdropFilter:'blur(2px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500 },
  mo: { background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:16, padding:24, width:520, maxWidth:'96vw', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 30px 70px -30px rgba(0,0,0,.7)' },
  hdr: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 },
  htitle: { fontFamily:'var(--font-display)', fontWeight:800, fontSize:18, letterSpacing:'-.01em', color:'var(--w)' },
  close: { background:'none', border:'none', color:'var(--g)', fontSize:17, cursor:'pointer', padding:3 },
}

export function Empty({ icon, text }) {
  return (
    <div style={{ textAlign:'center', padding:'40px 18px', color:'var(--g)' }}>
      <div style={{ fontSize:34, marginBottom:10, opacity:.7 }}>{icon}</div>
      <p style={{ fontSize:13 }}>{text}</p>
    </div>
  )
}

export function Divider() {
  return <div style={{ height:1, background:'var(--bd)', margin:'14px 0' }} />
}

export function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:14, padding:'18px 20px' }}>
      <div style={{ fontSize:12, color:'var(--g)', letterSpacing:'.2px', fontWeight:600 }}>{label}</div>
      <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:32, color:color||'var(--w)', lineHeight:1.1, marginTop:6, letterSpacing:'-.02em' }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:'var(--g)', marginTop:3 }}>{sub}</div>}
    </div>
  )
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display:'flex', borderBottom:'1px solid var(--bd)', marginBottom:16, gap:2 }}>
      {tabs.map(t => (
        <div
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{ padding:'9px 15px', fontSize:12.5, fontWeight:600, cursor:'pointer', borderBottom:`2px solid ${active===t.id?'var(--cy)':'transparent'}`, color:active===t.id?'var(--cy)':'var(--g)', transition:'all .15s' }}
        >
          {t.label}
        </div>
      ))}
    </div>
  )
}
