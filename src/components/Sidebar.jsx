import { useStore } from '../lib/store.jsx'

const NAV = {
  pastor: [
    { sec: 'Principal', items: [{ id: 'dashboard', ic: '🏠', label: 'Dashboard' }] },
    { sec: 'Escala', items: [
      { id: 'escala-culto', ic: '📋', label: 'Escala de Culto' },
      { id: 'escala-eb', ic: '📖', label: 'Escola Bíblica' },
      { id: 'escala-louvor', ic: '🎵', label: 'Equipe de Louvor' },
      { id: 'pregacao', ic: '🎤', label: 'Pregação' },
    ]},
    { sec: 'Igreja', items: [
      { id: 'musicas', ic: '🎼', label: 'Músicas' },
      { id: 'agenda', ic: '📅', label: 'Agenda' },
      { id: 'avisos', ic: '📢', label: 'Avisos' },
    ]},
    { sec: 'Gestão', items: [
      { id: 'membros', ic: '👥', label: 'Membros' },
      { id: 'funcoes', ic: '⚙️', label: 'Registro de Funções' },
      { id: 'lideranca', ic: '👑', label: 'Liderança' },
      { id: 'financeiro', ic: '💰', label: 'Financeiro' },
      { id: 'usuarios', ic: '🔐', label: 'Usuários' },
    ]},
  ],
  secretario: [
    { sec: 'Principal', items: [{ id: 'dashboard', ic: '🏠', label: 'Dashboard' }] },
    { sec: 'Escala', items: [
      { id: 'escala-culto', ic: '📋', label: 'Escala de Culto' },
      { id: 'escala-eb', ic: '📖', label: 'Escola Bíblica' },
      { id: 'escala-louvor', ic: '🎵', label: 'Equipe de Louvor' },
    ]},
    { sec: 'Igreja', items: [
      { id: 'musicas', ic: '🎼', label: 'Músicas' },
      { id: 'agenda', ic: '📅', label: 'Agenda' },
      { id: 'avisos', ic: '📢', label: 'Avisos' },
    ]},
    { sec: 'Gestão', items: [
      { id: 'membros', ic: '👥', label: 'Membros' },
      { id: 'funcoes', ic: '⚙️', label: 'Registro de Funções' },
      { id: 'lideranca', ic: '👑', label: 'Liderança' },
      { id: 'financeiro', ic: '💰', label: 'Financeiro' },
    ]},
  ],
  'gestor-vocal': [
    { sec: 'Principal', items: [{ id: 'dashboard', ic: '🏠', label: 'Dashboard' }] },
    { sec: 'Louvor', items: [
      { id: 'escala-louvor', ic: '🎵', label: 'Equipe de Louvor' },
      { id: 'musicas', ic: '🎼', label: 'Músicas' },
    ]},
    { sec: 'Igreja', items: [
      { id: 'agenda', ic: '📅', label: 'Agenda' },
      { id: 'avisos', ic: '📢', label: 'Avisos' },
    ]},
  ],
  'gestor-instrumental': [
    { sec: 'Principal', items: [{ id: 'dashboard', ic: '🏠', label: 'Dashboard' }] },
    { sec: 'Louvor', items: [
      { id: 'escala-louvor', ic: '🎵', label: 'Equipe de Louvor' },
      { id: 'musicas', ic: '🎼', label: 'Músicas' },
    ]},
    { sec: 'Igreja', items: [
      { id: 'agenda', ic: '📅', label: 'Agenda' },
      { id: 'avisos', ic: '📢', label: 'Avisos' },
    ]},
  ],
  professor: [
    { sec: 'Principal', items: [{ id: 'dashboard', ic: '🏠', label: 'Dashboard' }] },
    { sec: 'EB', items: [
      { id: 'devocional', ic: '📿', label: 'Devocional' },
      { id: 'escala-eb', ic: '📖', label: 'Escola Bíblica' },
    ]},
    { sec: 'Igreja', items: [
      { id: 'agenda', ic: '📅', label: 'Agenda' },
      { id: 'avisos', ic: '📢', label: 'Avisos' },
    ]},
  ],
  aluno: [
    { sec: 'Principal', items: [{ id: 'dashboard', ic: '🏠', label: 'Dashboard' }] },
    { sec: 'EB', items: [{ id: 'devocional', ic: '📿', label: 'Devocional' }] },
    { sec: 'Igreja', items: [
      { id: 'agenda', ic: '📅', label: 'Agenda' },
      { id: 'avisos', ic: '📢', label: 'Avisos' },
    ]},
  ],
  membro: [
    { sec: 'Principal', items: [{ id: 'dashboard', ic: '🏠', label: 'Dashboard' }] },
    { sec: 'Igreja', items: [
      { id: 'agenda', ic: '📅', label: 'Agenda' },
      { id: 'avisos', ic: '📢', label: 'Avisos' },
    ]},
  ],
}

export default function Sidebar({ page, setPage, user, logout, open }) {
  const menus = NAV[user?.perfil] || NAV.membro

  return (
    <div className={`gestao-sidebar${open ? ' sidebar-open' : ''}`} style={styles.sb}>
      <div style={styles.logo}>
        <div style={styles.logoT1}>GESTÃO LP</div>
        <div style={styles.logoT2}>Promessa Lago dos Peixes</div>
      </div>

      <div style={styles.user}>
        <div style={styles.avatar}>{user?.nome?.[0] || 'U'}</div>
        <div>
          <div style={styles.userName}>{user?.nome}</div>
          <div style={styles.userRole}>{user?.perfil}</div>
        </div>
      </div>

      <nav style={styles.nav}>
        {menus.map(group => (
          <div key={group.sec}>
            <div style={styles.navSec}>{group.sec}</div>
            {group.items.map(item => (
              <div
                key={item.id}
                style={{ ...styles.navItem, ...(page === item.id ? styles.navActive : {}) }}
                onClick={() => setPage(item.id)}
              >
                <span>{item.ic}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div style={styles.bot}>
        <button style={styles.logoutBtn} onClick={logout}>⬅ Sair</button>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .gestao-sidebar {
            transform: translateX(-210px);
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
  sb: { width:210, minWidth:210, background:'var(--s1)', borderRight:'1px solid var(--bd)', display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, bottom:0, zIndex:200, overflowY:'auto', transition:'transform .3s' },
  logo: { padding:'16px 15px 11px', borderBottom:'1px solid var(--bd)' },
  logoT1: { fontFamily:'var(--font-display)', fontSize:20, color:'var(--w)', letterSpacing:2 },
  logoT2: { fontSize:8, color:'var(--cy)', letterSpacing:2, textTransform:'uppercase', marginTop:2 },
  user: { padding:'10px 15px', borderBottom:'1px solid var(--bd)', display:'flex', alignItems:'center', gap:8 },
  avatar: { width:28, height:28, borderRadius:'50%', background:'var(--cy)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#000', flexShrink:0 },
  userName: { fontSize:11, fontWeight:600, color:'var(--w)' },
  userRole: { fontSize:9, color:'var(--cy)', textTransform:'uppercase', letterSpacing:1 },
  nav: { padding:'7px 0', flex:1 },
  navSec: { padding:'7px 15px 2px', fontSize:8, color:'var(--g)', letterSpacing:2, textTransform:'uppercase' },
  navItem: { display:'flex', alignItems:'center', gap:7, padding:'7px 15px', cursor:'pointer', fontSize:12, color:'var(--gl)', transition:'all .15s', borderLeft:'2px solid transparent' },
  navActive: { background:'var(--cdim)', color:'var(--cy)', borderLeftColor:'var(--cy)' },
  bot: { padding:'10px 15px', borderTop:'1px solid var(--bd)' },
  logoutBtn: { width:'100%', padding:6, background:'transparent', border:'1px solid var(--bd)', color:'var(--g)', borderRadius:6, cursor:'pointer', fontSize:11, fontFamily:'inherit', transition:'all .15s' },
}
