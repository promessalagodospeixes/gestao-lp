import { useState, useEffect } from 'react'
import { useStore } from '../lib/store.jsx'
import { sb } from '../lib/supabase.js'
import { PERFIL_LABEL } from '../lib/utils.js'
import { Menu, User } from 'lucide-react'
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
import Ocorrencias from '../pages/Ocorrencias.jsx'
import Atas from '../pages/Atas.jsx'
import Perfil from '../pages/Perfil.jsx'

const TITLES = {
  dashboard: 'Dashboard',
  'escala-culto': 'Escala de Culto',
  'escala-eb': 'Escola Bíblica',
  'escala-louvor': 'Equipe de Louvor',
  pregacao: 'Pregação',
  musicas: 'Músicas',
  devocional: 'Devocional',
  funcoes: 'Registro de Funções',
  agenda: 'Agenda',
  avisos: 'Avisos',
  membros: 'Membros',
  lideranca: 'Liderança',
  financeiro: 'Financeiro',
  usuarios: 'Usuários',
  solicitacoes: 'Solicitações',
  auditoria: 'Auditoria',
  ocorrencias: 'Ocorrências',
  atas: 'Atas',
  perfil: 'Meu Perfil',
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
  ocorrencias: Ocorrencias,
  atas: Atas,
  perfil: Perfil,
}

const LGPD_KEY = 'gestao-lp-lgpd'

export default function Layout() {
  const { state, dispatch } = useStore()
  const [page, setPage_] = useState(() => localStorage.getItem('gestao-lp-page') || 'dashboard')
  const setPage = (p) => { setPage_(p); localStorage.setItem('gestao-lp-page', p) }
  const [sideOpen, setSideOpen] = useState(false)
  const [showLgpd, setShowLgpd] = useState(false)
  const user = state.user
  const Page = PAGES[page] || Dashboard

  // Verifica se precisa mostrar modal LGPD — baseado no banco, não no dispositivo
  useEffect(() => {
    if (!user) return
    if (!user.lgpd_aceito) setShowLgpd(true)
  }, [user?.id])

  const aceitarLgpd = async () => {
    const agora = new Date().toISOString()
    setShowLgpd(false)
    const novoUser = { ...user, lgpd_aceito: true, lgpd_aceito_em: agora }
    dispatch({ type: 'SET_USER', value: novoUser })
    localStorage.setItem('gestao-lp-user', JSON.stringify(novoUser))
    // Salva no banco (tabela membros)
    if (user?.membro_id) {
      await sb.from('membros').update({ lgpd_aceito: true, lgpd_aceito_em: agora }).eq('id', user.membro_id)
    }
  }

  const logout = () => {
    localStorage.removeItem('gestao-lp-user')
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

      <div style={{ flex:1, display:'flex', flexDirection:'column', marginLeft:'var(--sb-width, 232px)', overflow:'hidden' }}>
        {/* Topbar */}
        <div className="no-print" style={styles.topbar}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={() => setSideOpen(!sideOpen)} style={styles.menuBtn} className="mobile-only"><Menu size={20} strokeWidth={2} /></button>
            <div style={styles.title}>{TITLES[page] || page}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button onClick={() => setPage('perfil')} title="Meu Perfil" style={styles.perfilBtn}>
              <User size={16} strokeWidth={1.75} /> Perfil
            </button>
            <span style={styles.badge}>{PERFIL_LABEL[user?.perfil] || ''}</span>
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
          <div style={{ background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:16, padding:'28px 24px', maxWidth:480, width:'100%' }}>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:18, color:'var(--w)', letterSpacing:'-.01em', marginBottom:14 }}>Aviso de Privacidade</div>
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
              style={{ background:'var(--cy)', color:'#04211f', border:'none', borderRadius:10, padding:'12px 20px', fontSize:13, fontWeight:800, cursor:'pointer', width:'100%', fontFamily:'inherit' }}>
              Entendi e Concordo
            </button>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          :root { --sb-width: 0px !important; }
          .mobile-only { display: flex !important; }
          .gestao-content { padding: 14px !important; }
        }
        @media (min-width: 769px) {
          .mobile-only { display: none !important; }
          :root { --sb-width: 232px; }
        }
      `}</style>
    </div>
  )
}

const styles = {
  topbar: { height:64, background:'var(--s1)', borderBottom:'1px solid var(--bd)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', flexShrink:0 },
  title: { fontFamily:'var(--font-display)', fontWeight:800, fontSize:21, letterSpacing:'-.015em', color:'var(--w)' },
  perfilBtn: { display:'flex', alignItems:'center', gap:8, height:38, padding:'0 14px', background:'transparent', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, color:'var(--gl)', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit' },
  badge: { display:'flex', alignItems:'center', height:38, background:'var(--cdim)', color:'var(--cy)', fontSize:12, fontWeight:700, padding:'0 13px', borderRadius:10, letterSpacing:'.02em' },
  menuBtn: { background:'none', border:'none', color:'var(--gl)', cursor:'pointer', padding:'4px 4px 4px 0', alignItems:'center', justifyContent:'center' },
  content: { flex:1, overflowY:'auto', padding:24 },
}
