import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { PERFIL_LABEL } from '../lib/utils.js'
import Sidebar from './Sidebar.jsx'
import Dashboard from '../pages/Dashboard.jsx'
import EscalaCulto from '../pages/EscalaCulto.jsx'
import EscalaEB from '../pages/EscalaEB.jsx'
import EscalaLouvor from '../pages/EscalaLouvor.jsx'
import Pregacao from '../pages/Pregacao.jsx'
import Musicas from '../pages/Musicas.jsx'
import Devocional from '../pages/Devocional.jsx'
import RegistroFuncoes from '../pages/RegistroFuncoes.jsx'
import Agenda from '../pages/Agenda.jsx'
import Avisos from '../pages/Avisos.jsx'
import Membros from '../pages/Membros.jsx'
import Lideranca from '../pages/Lideranca.jsx'
import Financeiro from '../pages/Financeiro.jsx'
import Usuarios from '../pages/Usuarios.jsx'

const TITLES = {
  dashboard: 'DASHBOARD',
  'escala-culto': 'ESCALA DE CULTO',
  'escala-eb': 'ESCOLA BÍBLICA',
  'escala-louvor': 'EQUIPE DE LOUVOR',
  pregacao: 'PREGAÇÃO',
  musicas: 'MÚSICAS',
  devocional: 'DEVOCIONAL',
  funcoes: 'REGISTRO DE FUNÇÕES',
  agenda: 'AGENDA',
  avisos: 'AVISOS',
  membros: 'MEMBROS',
  lideranca: 'LIDERANÇA',
  financeiro: 'FINANCEIRO',
  usuarios: 'USUÁRIOS',
}

const PAGES = {
  dashboard: Dashboard,
  'escala-culto': EscalaCulto,
  'escala-eb': EscalaEB,
  'escala-louvor': EscalaLouvor,
  pregacao: Pregacao,
  musicas: Musicas,
  devocional: Devocional,
  funcoes: RegistroFuncoes,
  agenda: Agenda,
  avisos: Avisos,
  membros: Membros,
  lideranca: Lideranca,
  financeiro: Financeiro,
  usuarios: Usuarios,
}

export default function Layout() {
  const { state, dispatch } = useStore()
  const [page, setPage] = useState('dashboard')
  const [sideOpen, setSideOpen] = useState(false)
  const user = state.user
  const Page = PAGES[page] || Dashboard

  const logout = () => {
    sessionStorage.removeItem('gestao-lp-user')
    dispatch({ type: 'LOGOUT' })
  }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      {/* Mobile overlay */}
      {sideOpen && (
        <div
          onClick={() => setSideOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:150 }}
        />
      )}

      <div className="no-print">
        <Sidebar
          page={page}
          setPage={(p) => { setPage(p); setSideOpen(false) }}
          user={user}
          logout={logout}
          open={sideOpen}
        />
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', marginLeft:'var(--sb-width, 210px)', overflow:'hidden' }}>
        {/* Topbar */}
        <div className="no-print" style={styles.topbar}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button
              onClick={() => setSideOpen(!sideOpen)}
              style={styles.menuBtn}
              className="mobile-only"
            >☰</button>
            <div style={styles.title}>{TITLES[page] || page.toUpperCase()}</div>
          </div>
          <span style={styles.badge}>{(PERFIL_LABEL[user?.perfil] || '').toUpperCase()}</span>
        </div>

        {/* Content */}
        <div style={styles.content}>
          <Page />
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          :root { --sb-width: 0px !important; }
          .mobile-only { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-only { display: none !important; }
          :root { --sb-width: 210px; }
        }
      `}</style>
    </div>
  )
}

const styles = {
  topbar: { height:48, background:'var(--s1)', borderBottom:'1px solid var(--bd)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', flexShrink:0 },
  title: { fontFamily:'var(--font-display)', fontSize:16, letterSpacing:2, color:'var(--w)' },
  badge: { background:'var(--cy)', color:'#000', fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:99, letterSpacing:1 },
  menuBtn: { background:'none', border:'none', color:'var(--gl)', fontSize:20, cursor:'pointer', padding:'4px 8px 4px 0', alignItems:'center', justifyContent:'center' },
  content: { flex:1, overflowY:'auto', padding:20 },
}
