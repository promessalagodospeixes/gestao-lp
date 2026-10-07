import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { setToken } from '../lib/supabase.js'
import { loadAllData } from '../lib/dataLoader.js'
import { logAudit } from '../lib/auditoria.js'
import { cargosArray } from '../lib/utils.js'

const CARGO_PERFIL = {
  'Pastor': 'pastor',
  'Secretário': 'secretario',
  'Secretário(a)': 'secretario',
  'Tesoureiro(a)': 'tesoureiro',
  'Gestor Vocal': 'gestor-vocal',
  'Gestor Instrumental': 'gestor-instrumental',
  'Professor': 'professor',
}

const soDigitos = (s) => (s || '').replace(/\D/g, '')
// Remove o código do país (55) quando presente, para comparar telefones
// independente de o usuário digitar/colar com ou sem o +55 na frente
const normTel = (s) => {
  const d = soDigitos(s)
  return d.length > 11 ? d.slice(-11) : d
}

export default function Login() {
  const { dispatch } = useStore()
  const tokenReset = new URLSearchParams(window.location.search).get('reset')
  const [modo, setModo] = useState(tokenReset ? 'redefinir' : 'login') // login | esqueci | redefinir
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')
  const [erro, setErro] = useState(false)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const limparResetUrl = () => window.history.replaceState({}, '', window.location.pathname)

  // "Esqueci minha senha": pede o link de redefinição (resposta sempre genérica).
  const pedirReset = async (e) => {
    e.preventDefault()
    if (!login.trim()) return
    setLoading(true); setErro(false); setMsg('')
    try {
      await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'esqueci', login: login.trim() }) })
    } catch (e) { /* ignora: resposta é sempre genérica */ }
    setMsg('Se houver um cadastro com esse dado e um e-mail, enviamos um link para redefinir a senha. Verifique sua caixa de entrada (e o spam).')
    setLoading(false)
  }

  // Redefinir a senha a partir do link recebido por e-mail.
  const redefinir = async (e) => {
    e.preventDefault()
    if (!senha || senha.length < 6) { setErro('A senha precisa de pelo menos 6 caracteres.'); return }
    if (senha !== senha2) { setErro('As senhas não conferem.'); return }
    setLoading(true); setErro(false); setMsg('')
    try {
      const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'redefinir', token: tokenReset, senhaNova: senha }) })
      const resp = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(resp.erro || 'Não foi possível redefinir. O link pode ter expirado.'); setLoading(false); return }
      limparResetUrl()
      setModo('login'); setSenha(''); setSenha2('')
      setMsg('✅ Senha alterada! Entre com a sua nova senha.')
    } catch (e) { setErro('Erro ao redefinir.') }
    setLoading(false)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!login || !senha) return
    setLoading(true)
    setErro(false)
    try {
      const r = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: login.trim(), senha }),
      })
      const resp = await r.json().catch(() => ({}))
      if (!r.ok || !resp.usuario) { setErro(resp.erro || true); setLoading(false); return }
      const data = resp.usuario
      setToken(resp.token)
      await logAudit(data, 'LOGIN', `Acesso ao sistema via ${login.trim()}`)
      localStorage.setItem('gestao-lp-user', JSON.stringify(data))
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

  // ── Redefinir senha (veio do link do e-mail) ──
  if (modo === 'redefinir') {
    return (
      <div style={styles.wrap}>
        <form style={styles.box} onSubmit={redefinir}>
          <img src="/logo.png" alt="Promessa Lago dos Peixes" style={{width:220,marginBottom:8,borderRadius:8}} />
          <div style={{fontSize:14,fontWeight:700,color:'var(--w)',marginBottom:4}}>Criar nova senha</div>
          <div style={{...styles.hint,marginBottom:14}}>Escolha uma senha nova (mínimo 6 caracteres).</div>
          <input style={styles.input} type="password" placeholder="Nova senha" value={senha} onChange={e=>setSenha(e.target.value)} autoComplete="new-password" />
          <input style={styles.input} type="password" placeholder="Repita a nova senha" value={senha2} onChange={e=>setSenha2(e.target.value)} autoComplete="new-password" />
          {erro && <div style={styles.erro}>{erro}</div>}
          <button style={styles.btn} type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar nova senha'}</button>
          <button type="button" onClick={()=>{limparResetUrl();setModo('login');setErro(false)}} style={styles.link}>Voltar ao login</button>
        </form>
      </div>
    )
  }

  // ── Esqueci minha senha ──
  if (modo === 'esqueci') {
    return (
      <div style={styles.wrap}>
        <form style={styles.box} onSubmit={pedirReset}>
          <img src="/logo.png" alt="Promessa Lago dos Peixes" style={{width:220,marginBottom:8,borderRadius:8}} />
          <div style={{fontSize:14,fontWeight:700,color:'var(--w)',marginBottom:4}}>Esqueci minha senha</div>
          <div style={{...styles.hint,marginBottom:14}}>Digite seu CPF, telefone ou e-mail. Enviaremos um link de redefinição para o e-mail cadastrado.</div>
          <input style={styles.input} type="text" placeholder="CPF, telefone ou e-mail" value={login} onChange={e=>setLogin(e.target.value)} autoComplete="username" />
          {msg && <div style={{...styles.hint,color:'var(--grn)',marginBottom:10}}>{msg}</div>}
          <button style={styles.btn} type="submit" disabled={loading}>{loading ? 'Enviando...' : 'Enviar link'}</button>
          <button type="button" onClick={()=>{setModo('login');setMsg('');setErro(false)}} style={styles.link}>Voltar ao login</button>
        </form>
      </div>
    )
  }

  // ── Login normal ──
  return (
    <div style={styles.wrap}>
      <form style={styles.box} onSubmit={handleLogin}>
        <img src="/logo.png" alt="Promessa Lago dos Peixes" style={{width:220,marginBottom:8,borderRadius:8}} />
        <input
          style={styles.input}
          type="text"
          placeholder="CPF, telefone ou e-mail"
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
        {erro && <div style={styles.erro}>CPF, telefone, e-mail ou senha incorretos.</div>}
        {msg && <div style={{...styles.hint,color:'var(--grn)',marginBottom:10}}>{msg}</div>}
        <button style={styles.btn} type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
        <button type="button" onClick={()=>{setModo('esqueci');setErro(false);setMsg('')}} style={styles.link}>Esqueci minha senha</button>
      </form>
    </div>
  )
}

const styles = {
  wrap: { display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg)' },
  box: { background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:16, padding:'36px 32px', width:320, textAlign:'center', boxShadow:'0 10px 40px rgba(0,0,0,.35)' },
  logo: { fontFamily:'var(--font-display)', fontSize:36, color:'var(--w)', letterSpacing:4, lineHeight:1 },
  sub: { fontSize:9, color:'var(--cy)', letterSpacing:3, textTransform:'uppercase', marginBottom:28, marginTop:4 },
  input: { display:'block', width:'100%', background:'var(--s2)', border:'1px solid var(--bd)', borderRadius:12, padding:'11px 14px', color:'var(--w)', fontSize:13, marginBottom:10, outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  erro: { color:'var(--red)', fontSize:12, marginBottom:10 },
  btn: { background:'var(--cy)', color:'#000', border:'none', borderRadius:12, padding:11, fontSize:13, fontWeight:700, cursor:'pointer', width:'100%', letterSpacing:'-.01em', fontFamily:'inherit', marginBottom:14 },
  hint: { fontSize:10, color:'var(--g)', lineHeight:1.5 },
  link: { background:'none', border:'none', color:'var(--cy)', fontSize:12, cursor:'pointer', fontFamily:'inherit', textDecoration:'underline', padding:'4px 0', marginTop:2 },
}
