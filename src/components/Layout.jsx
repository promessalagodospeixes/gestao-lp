import { useState, useEffect } from 'react'
import { useStore } from '../lib/store.jsx'
import { sb } from '../lib/supabase.js'
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
import Solicitacoes from '../pages/Solicitacoes.jsx'
import Auditoria from '../pages/Auditoria.jsx'
import Perfil from '../pages/Perfil.jsx'

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
  solicitacoes: 'SOLICITAÇÕES',
  auditoria: 'AUDITORIA',
  perfil: 'MEU PERFIL',
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
  solicitacoes: Solicitacoes,
  auditoria: Auditoria,
  perfil: Perfil,
}

const LGPD_KEY = 'gestao-lp-lgpd'

export default function Layout() {
  const { state, dispatch } = useStore()
  const [page, setPage] = useState('dashboard')
  const [sideOpen, setSideOpen] = useState(false)
  const [showLgpd, setShowLgpd] = useState(false)
  const user = state.user
  const Page = PAGES[page] || Dashboard

  // Verifica se precisa mostrar modal LGPD
  useEffect(() => {
    if (!user) return
    const jaAceitou = localStorage.getItem(LGPD_KEY) || user.lgpd_aceito
    if (!jaAceitou) setShowLgpd(true)
  }, [user])

  const aceitarLgpd = async () => {
    setShowLgpd(false)
    localStorage.setItem(LGPD_KEY, '1')
    if (user?.id) {
      await sb.from('usuarios').update({ lgpd_aceito: true, lgpd_aceito_em: new Date().toISOString() }).eq('id', user.id)
      dispatch({ type: 'SET_USER', value: { ...user, lgpd_aceito: true } })
    }
  }

  const logout = () => {
    localStorage.removeItem('gestao-lp-user')
    localStorage.removeItem(LGPD_KEY)
    dispatch({ type: 'LOGOUT' })
  }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      {/* Mobile overlay */}
      {sideOpen && (
        <div onClick={() => setSideOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:150 }} />
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
            <button onClick={() => setSideOpen(!sideOpen)} style={styles.menuBtn} className="mobile-only">☰</button>
            <div style={styles.title}>{TITLES[page] || page.toUpperCase()}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button onClick={() => setPage('perfil')} title="Meu Perfil"
              style={{ background:'none', border:'1px solid var(--bd)', borderRadius:6, color:'var(--g)', cursor:'pointer', padding:'4px 9px', fontSize:11, fontFamily:'inherit' }}>
              👤 Perfil
            </button>
            <span style={styles.badge}>{(PERFIL_LABEL[user?.perfil] || '').toUpperCase()}</span>
          </div>
        </div>

        {/* Content */}
        <div className="gestao-content" style={styles.content}>
          <Page />
        </div>
      </div>

      {/* Modal LGPD */}
      {showLgpd && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:14, padding:'28px 24px', maxWidth:480, width:'100%' }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:18, color:'var(--w)', letterSpacing:2, marginBottom:14 }}>🔒 AVISO DE PRIVACIDADE</div>
            <div style={{ fontSize:13, color:'var(--tx)', lineHeight:1.8, marginBottom:18 }}>
              <p style={{ marginBottom:10 }}>
                <strong style={{ color:'var(--w)' }}>Uso de Imagem:</strong> Ao participar das atividades da Igreja Promessa Lago dos Peixes, você concorda que fotos e vídeos poderão ser tirados durante os cultos e eventos para <strong>registro interno</strong> e <strong>divulgação nas redes sociais</strong> da igreja.
              </p>
              <p style={{ marginBottom:10 }}>
                <strong style={{ color:'var(--w)' }}>Dados Pessoais (LGPD):</strong> Seus dados (nome, telefone, e-mail, CPF) são coletados exclusivamente para fins de gestão eclesiástica e comunicação interna. Não compartilhamos seus dados com terceiros.
              </p>
              <p>
                Você pode solicitar a exclusão ou correção dos seus dados a qualquer momento entrando em contato com a secretaria da igreja.
              </p>
            </div>
            <button onClick={aceitarLgpd}
              style={{ background:'var(--cy)', color:'#000', border:'none', borderRadius:8, padding:'11px 20px', fontSize:13, fontWeight:700, cursor:'pointer', width:'100%', fontFamily:'inherit', letterSpacing:1 }}>
              ✅ Entendi e Concordo
            </button>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          :root { --sb-width: 0px !important; }
          .mobile-only { display: flex !important; }
          .gestao-content { padding: 12px !important; }
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
