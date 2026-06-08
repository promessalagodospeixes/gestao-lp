import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { sb } from '../lib/supabase.js'
import { loadAllData } from '../lib/dataLoader.js'

const CARGO_PERFIL = {
  'Pastor': 'pastor',
  'Secretário': 'secretario',
  'Gestor Vocal': 'gestor-vocal',
  'Gestor Instrumental': 'gestor-instrumental',
  'Professor': 'professor',
}

const soDigitos = (s) => (s || '').replace(/\D/g, '')

// Try usuarios table first, then membros by phone (default password 123456)
const buscarUsuario = async (login, senha) => {
  const { data: usu } = await sb.from('usuarios').select('*').eq('login', login).eq('senha', senha).maybeSingle()
  if (usu) return usu

  const tel = soDigitos(login)
  if (!tel || senha !== '123456') return null

  const { data: membrosData } = await sb.from('membros').select('*')
  const membro = (membrosData || []).find(m => soDigitos(m.tel) === tel)
  if (!membro) return null

  let perfil = 'membro'
  const { data: liderancaData } = await sb.from('lideranca').select('*')
  const lider = (liderancaData || []).find(l => l.nome === membro.nome)
  if (lider && CARGO_PERFIL[lider.cargo]) perfil = CARGO_PERFIL[lider.cargo]

  return { id: membro.id, nome: membro.nome, login: membro.tel, perfil, membro_id: membro.id }
}

export default function Login() {
  const { dispatch } = useStore()
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!login || !senha) return
    setLoading(true)
    setErro(false)
    try {
      const data = await buscarUsuario(login.trim(), senha)
      if (!data) { setErro(true); setLoading(false); return }
      sessionStorage.setItem('gestao-lp-user', JSON.stringify(data))
      dispatch({ type: 'SET_LOADING', value: true })
      const allData = await loadAllData()
      dispatch({ type: 'LOAD_ALL', data: allData })
      dispatch({ type: 'SET_USER', value: data })
    } catch (e) {
      console.error(e)
      setErro(true)
    }
    setLoading(false)
  }

  return (
    <div style={styles.wrap}>
      <form style={styles.box} onSubmit={handleLogin}>
        <div style={styles.logo}>GESTÃO LP</div>
        <div style={styles.sub}>Promessa Lago dos Peixes</div>
        <input
          style={styles.input}
          type="text"
          placeholder="Usuário ou telefone cadastrado"
          value={login}
          onChange={e => setLogin(e.target.value)}
          autoComplete="username"
        />
        <input
          style={styles.input}
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={e => setSenha(e.target.value)}
          autoComplete="current-password"
        />
        {erro && <div style={styles.erro}>Usuário ou senha incorretos.</div>}
        <button style={styles.btn} type="submit" disabled={loading}>
          {loading ? 'ENTRANDO...' : 'ENTRAR'}
        </button>
      </form>
    </div>
  )
}

const styles = {
  wrap: { display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg)' },
  box: { background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:14, padding:'36px 32px', width:310, textAlign:'center' },
  logo: { fontFamily:'var(--font-display)', fontSize:36, color:'var(--w)', letterSpacing:4, lineHeight:1 },
  sub: { fontSize:9, color:'var(--cy)', letterSpacing:3, textTransform:'uppercase', marginBottom:28, marginTop:4 },
  input: { display:'block', width:'100%', background:'var(--s2)', border:'1px solid var(--bd)', borderRadius:7, padding:'10px 12px', color:'var(--w)', fontSize:13, marginBottom:10, outline:'none', fontFamily:'inherit' },
  erro: { color:'var(--red)', fontSize:12, marginBottom:10 },
  btn: { background:'var(--cy)', color:'#000', border:'none', borderRadius:7, padding:10, fontSize:13, fontWeight:700, cursor:'pointer', width:'100%', letterSpacing:1, fontFamily:'inherit' },
}
