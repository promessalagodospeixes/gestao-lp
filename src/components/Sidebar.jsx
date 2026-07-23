import { useStore } from '../lib/store.jsx'
import { primeiroUltimo } from '../lib/utils.js'
import {
  LayoutDashboard, CalendarCheck2, BookOpen, Music4, Mic2, Disc3,
  CalendarDays, Megaphone, HeartHandshake, Users, SlidersHorizontal, Crown,
  Wallet, UserCog, Inbox, FileText, TriangleAlert, ClipboardList, LogOut
} from 'lucide-react'

// Ícone por id de página (substitui os emojis)
const ICONS = {
  dashboard: LayoutDashboard,
  'escala-culto': CalendarCheck2,
  'escala-eb': BookOpen,
  'escala-louvor': Music4,
  pregacao: Mic2,
  musicas: Disc3,
  agenda: CalendarDays,
  avisos: Megaphone,
  devocional: HeartHandshake,
  membros: Users,
  funcoes: SlidersHorizontal,
  lideranca: Crown,
  financeiro: Wallet,
  usuarios: UserCog,
  solicitacoes: Inbox,
  atas: FileText,
  ocorrencias: TriangleAlert,
  auditoria: ClipboardList,
}

const SOLIC_BASE = { id: 'solicitacoes', label: 'Solicitações' }

// Catálogo completo de páginas (para resolver extraPages do usuário)
const ALL_ITEMS = [
  { id:'dashboard', label:'Dashboard' },
  { id:'escala-culto', label:'Escala de Culto' },
  { id:'escala-eb', label:'Escola Bíblica' },
  { id:'escala-louvor', label:'Equipe de Louvor' },
  { id:'pregacao', label:'Pregação' },
  { id:'musicas', label:'Músicas' },
  { id:'agenda', label:'Agenda' },
  { id:'avisos', label:'Avisos' },
  { id:'membros', label:'Membros' },
  { id:'funcoes', label:'Registro de Funções' },
  { id:'lideranca', label:'Liderança' },
  { id:'financeiro', label:'Financeiro' },
  { id:'devocional', label:'Devocional' },
]

function buildNav(user) {
  const extra = user?.extraPages || []
  const perfil = user?.perfil

  // Secretário, tesoureiro e gestores: menu construído EXCLUSIVAMENTE
  // a partir do que está configurado em Gestores. Sem hardcoded.
  if (['secretario','tesoureiro','gestor-vocal','gestor-instrumental'].includes(perfil)) {
    const dashboard = ALL_ITEMS.find(i => i.id === 'dashboard')
    const items = extra.map(id => ALL_ITEMS.find(i => i.id === id)).filter(Boolean)
    const allItems = [dashboard, ...items.filter(i => i.id !== 'dashboard')]
    return [{ sec: 'Menu', items: allItems }]
  }

  const base = NAV[perfil] || NAV.membro
  if (!extra.length) return base
  const existing = new Set(base.flatMap(g => g.items.map(i => i.id)))
  const extraItems = extra.map(id => ALL_ITEMS.find(i => i.id === id)).filter(i => i && !existing.has(i.id))
  if (!extraItems.length) return base
  return [...base, { sec: 'Acesso Extra', items: extraItems }]
}

const NAV = {
  pastor: [
    { sec: 'Principal', items: [{ id: 'dashboard', label: 'Dashboard' }] },
    { sec: 'Escala', items: [
      { id: 'escala-culto', label: 'Escala de Culto' },
      { id: 'escala-eb', label: 'Escola Bíblica' },
      { id: 'escala-louvor', label: 'Equipe de Louvor' },
      { id: 'pregacao', label: 'Pregação' },
    ]},
    { sec: 'Igreja', items: [
      { id: 'musicas', label: 'Músicas' },
      { id: 'agenda', label: 'Agenda' },
      { id: 'avisos', label: 'Avisos' },
    ]},
    { sec: 'EB', items: [
      { id: 'devocional', label: 'Devocional' },
    ]},
    { sec: 'Gestão', items: [
      { id: 'membros', label: 'Membros' },
      { id: 'funcoes', label: 'Registro de Funções' },
      { id: 'lideranca', label: 'Liderança' },
      { id: 'financeiro', label: 'Financeiro' },
      { id: 'usuarios', label: 'Usuários' },
      SOLIC_BASE,
      { id: 'atas', label: 'Atas' },
      { id: 'ocorrencias', label: 'Ocorrências' },
      { id: 'auditoria', label: 'Auditoria' },
    ]},
  ],
  secretario: [
    { sec: 'Principal', items: [{ id: 'dashboard', label: 'Dashboard' }] },
    { sec: 'Escala', items: [
      { id: 'escala-culto', label: 'Escala de Culto' },
      { id: 'escala-eb', label: 'Escola Bíblica' },
      { id: 'escala-louvor', label: 'Equipe de Louvor' },
      { id: 'pregacao', label: 'Pregação' },
    ]},
    { sec: 'Igreja', items: [
      { id: 'musicas', label: 'Músicas' },
      { id: 'agenda', label: 'Agenda' },
      { id: 'avisos', label: 'Avisos' },
    ]},
    { sec: 'EB', items: [
      { id: 'devocional', label: 'Devocional' },
    ]},
    { sec: 'Gestão', items: [
      { id: 'membros', label: 'Membros' },
      { id: 'funcoes', label: 'Registro de Funções' },
      { id: 'lideranca', label: 'Liderança' },
      { id: 'financeiro', label: 'Financeiro' },
      { ...SOLIC_BASE, label: 'Minhas Solicitações' },
      { id: 'atas', label: 'Atas' },
      { id: 'ocorrencias', label: 'Ocorrências' },
      { id: 'auditoria', label: 'Auditoria' },
    ]},
  ],
  tesoureiro: [
    { sec: 'Principal', items: [{ id: 'dashboard', label: 'Dashboard' }] },
    { sec: 'Gestão', items: [
      { id: 'financeiro', label: 'Financeiro' },
    ]},
    { sec: 'Igreja', items: [
      { id: 'musicas', label: 'Músicas' },
      { id: 'agenda', label: 'Agenda' },
      { id: 'avisos', label: 'Avisos' },
    ]},
  ],
  'gestor-vocal': [
    { sec: 'Principal', items: [{ id: 'dashboard', label: 'Dashboard' }] },
    { sec: 'Louvor', items: [
      { id: 'escala-louvor', label: 'Equipe de Louvor' },
      { id: 'musicas', label: 'Músicas' },
    ]},
    { sec: 'Igreja', items: [
      { id: 'agenda', label: 'Agenda' },
      { id: 'avisos', label: 'Avisos' },
    ]},
  ],
  'gestor-instrumental': [
    { sec: 'Principal', items: [{ id: 'dashboard', label: 'Dashboard' }] },
    { sec: 'Louvor', items: [
      { id: 'escala-louvor', label: 'Equipe de Louvor' },
      { id: 'musicas', label: 'Músicas' },
    ]},
    { sec: 'Igreja', items: [
      { id: 'agenda', label: 'Agenda' },
      { id: 'avisos', label: 'Avisos' },
    ]},
  ],
  professor: [
    { sec: 'Principal', items: [{ id: 'dashboard', label: 'Dashboard' }] },
    { sec: 'EB', items: [
      { id: 'devocional', label: 'Devocional' },
      { id: 'escala-eb', label: 'Escola Bíblica' },
    ]},
    { sec: 'Igreja', items: [
      { id: 'musicas', label: 'Músicas' },
      { id: 'agenda', label: 'Agenda' },
      { id: 'avisos', label: 'Avisos' },
    ]},
  ],
  aluno: [
    { sec: 'Principal', items: [{ id: 'dashboard', label: 'Dashboard' }] },
    { sec: 'EB', items: [{ id: 'devocional', label: 'Devocional' }] },
    { sec: 'Igreja', items: [
      { id: 'musicas', label: 'Músicas' },
      { id: 'agenda', label: 'Agenda' },
      { id: 'avisos', label: 'Avisos' },
    ]},
  ],
  membro: [
    { sec: 'Principal', items: [{ id: 'dashboard', label: 'Dashboard' }] },
    { sec: 'Igreja', items: [
      { id: 'musicas', label: 'Músicas' },
      { id: 'agenda', label: 'Agenda' },
      { id: 'avisos', label: 'Avisos' },
    ]},
  ],
}

export default function Sidebar({ page, setPage, user, logout, open }) {
  const { state } = useStore()
  const menus = buildNav(user)
  const pendentes = user?.perfil === 'pastor'
    ? (state.solicitacoes||[]).filter(s=>s.status==='pendente').length
    : (state.solicitacoes||[]).filter(s=>s.status==='pendente'&&s.solicitante_id===user?.id).length

  return (
    <div className={`gestao-sidebar${open ? ' sidebar-open' : ''}`} style={styles.sb}>
      <div style={styles.logo}>
        <img src="/logo.png" alt="Promessa Lago dos Peixes" style={{width:'100%',maxWidth:170,borderRadius:6,display:'block'}} />
      </div>

      <div style={styles.user}>
        <div style={styles.avatar}>{user?.nome?.[0] || 'U'}</div>
        <div style={{minWidth:0}}>
          <div style={styles.userName}>{user?.nome_exibicao || primeiroUltimo(user?.nome)}</div>
          <div style={styles.userRole}>{user?.perfil}</div>
        </div>
      </div>

      <nav style={styles.nav}>
        {menus.map(group => (
          <div key={group.sec}>
            <div style={styles.navSec}>{group.sec}</div>
            {group.items.map(item => {
              const Ic = ICONS[item.id]
              const active = page === item.id
              return (
                <div
                  key={item.id}
                  style={{ ...styles.navItem, ...(active ? styles.navActive : {}) }}
                  onClick={() => setPage(item.id)}
                >
                  {Ic && <Ic size={18} strokeWidth={1.75} style={{flexShrink:0}} />}
                  <span style={{flex:1}}>{item.label}</span>
                  {item.id === 'solicitacoes' && pendentes > 0 && (
                    <span style={styles.navBadge}>{pendentes}</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </nav>

      <div style={styles.bot}>
        <button style={styles.logoutBtn} onClick={logout}><LogOut size={15} strokeWidth={1.75} /> Sair</button>
      </div>

      <style>{`
        .gestao-sidebar .nav-active-marker {}
        @media (max-width: 768px) {
          .gestao-sidebar {
            transform: translateX(-232px);
            box-shadow: none;
          }
          .gestao-sidebar.sidebar-open {
            transform: translateX(0) !important;
            box-shadow: 4px 0 24px rgba(0,0,0,.5);
          }
        }
      `}</style>
    </div>
  )
}

const styles = {
  sb: { width:232, minWidth:232, background:'var(--s1)', borderRight:'1px solid var(--bd)', display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, bottom:0, zIndex:200, overflowY:'auto', transition:'transform .3s' },
  logo: { padding:'18px 16px 14px', borderBottom:'1px solid var(--bd)' },
  user: { padding:'12px 16px', borderBottom:'1px solid var(--bd)', display:'flex', alignItems:'center', gap:10 },
  avatar: { width:32, height:32, borderRadius:'50%', background:'#1c2732', color:'var(--cy)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, flexShrink:0 },
  userName: { fontSize:13, fontWeight:700, color:'var(--w)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  userRole: { fontSize:11, color:'var(--g)', textTransform:'capitalize' },
  nav: { padding:'8px 0', flex:1 },
  navSec: { padding:'14px 16px 4px', fontSize:10.5, fontWeight:700, color:'#5b646e', letterSpacing:'.13em', textTransform:'uppercase' },
  navItem: { display:'flex', alignItems:'center', gap:11, padding:'9px 12px', margin:'1px 8px', borderRadius:10, cursor:'pointer', fontSize:13.5, fontWeight:500, color:'var(--gl)', transition:'all .15s' },
  navBadge: { background:'var(--red)', color:'#fff', fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:99, minWidth:16, textAlign:'center' },
  navActive: { background:'var(--cdim)', color:'var(--cy)', fontWeight:600, boxShadow:'inset 3px 0 0 var(--cy)' },
  bot: { padding:'12px 16px', borderTop:'1px solid var(--bd)' },
  logoutBtn: { width:'100%', padding:'9px', background:'transparent', border:'1px solid rgba(255,255,255,.1)', color:'var(--g)', borderRadius:9, cursor:'pointer', fontSize:12.5, fontWeight:600, fontFamily:'inherit', transition:'all .15s', display:'flex', alignItems:'center', justifyContent:'center', gap:7 },
}
