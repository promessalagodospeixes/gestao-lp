import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { sb } from '../lib/supabase.js'
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

const buscarUsuario = async (login, senha) => {
  const loginTrim = login.trim()
  const digits = soDigitos(loginTrim)

  // 1. Busca na tabela usuarios por login, cpf, tel ou email
  const { data: lista } = await sb.from('usuarios').select('*').eq('senha', senha)
  if (lista?.length) {
    const usu = lista.find(u =>
      u.login === loginTrim ||
      (digits && soDigitos(u.cpf) === digits) ||
      (digits && soDigitos(u.tel) === digits) ||
      (u.email && u.email.toLowerCase() === loginTrim.toLowerCase())
    )
    if (usu) {
      // Verifica se este usuário é gestor (a tabela usuarios pode ter perfil desatualizado)
      let perfil = usu.perfil || 'membro'
      let extraPages = []
      let useCustomNav = false
      if (perfil !== 'pastor') {
        const { data: gestoresData } = await sb.from('gestores').select('*')
        const g = (gestoresData || [])[0]
        const nomeUsu = usu.nome || ''
        if (g?.secretario === nomeUsu) perfil = 'secretario'
        else if (g?.tesoureiro === nomeUsu) perfil = 'tesoureiro'
        else {
          try {
            const vArr = Array.isArray(g?.vocal) ? g.vocal : JSON.parse(g?.vocal || '[]')
            const iArr = Array.isArray(g?.instrumental) ? g.instrumental : JSON.parse(g?.instrumental || '[]')
            if (vArr.filter(Boolean).includes(nomeUsu)) perfil = 'gestor-vocal'
            else if (iArr.filter(Boolean).includes(nomeUsu)) perfil = 'gestor-instrumental'
          } catch { /* mantém perfil */ }
        }
        try {
          const perms = g?.permissoes ? (typeof g.permissoes === 'object' ? g.permissoes : JSON.parse(g.permissoes || '{}')) : {}
          extraPages = perms[nomeUsu] || []
        } catch { extraPages = [] }
        useCustomNav = ['secretario','tesoureiro','gestor-vocal','gestor-instrumental'].includes(perfil) && extraPages.length > 0
      }
      return { ...usu, perfil, extraPages, useCustomNav }
    }
  }

  // 2. Fallback: membros com senha padrão 123456
  if (senha !== '123456') return null
  const { data: membrosData } = await sb.from('membros').select('*')
  const membro = (membrosData || []).find(m => {
    if (digits && soDigitos(m.tel) === digits) return true
    if (digits && soDigitos(m.cpf) === digits) return true
    if (m.email && m.email.toLowerCase() === loginTrim.toLowerCase()) return true
    return false
  })
  if (!membro) return null

  let perfil = 'membro'
  const { data: liderancaData } = await sb.from('lideranca').select('*')
  const lider = (liderancaData || []).find(l => l.membro_nome === membro.nome)
  if (lider) {
    for (const cargo of cargosArray(lider.cargo)) {
      if (CARGO_PERFIL[cargo]) { perfil = CARGO_PERFIL[cargo]; if (perfil === 'pastor') break }
    }
  }

  // Registro de Funções > Gestores: define cargos e permissões extras
  let extraPages = []
  if (perfil !== 'pastor') {
    const { data: gestoresData } = await sb.from('gestores').select('*')
    const g = (gestoresData || [])[0]
    if (g?.secretario === membro.nome) perfil = 'secretario'
    else if (g?.tesoureiro === membro.nome) perfil = 'tesoureiro'
    else {
      try {
        const vArr = Array.isArray(g?.vocal) ? g.vocal : JSON.parse(g?.vocal || '[]')
        const iArr = Array.isArray(g?.instrumental) ? g.instrumental : JSON.parse(g?.instrumental || '[]')
        if (vArr.filter(Boolean).includes(membro.nome)) perfil = 'gestor-vocal'
        else if (iArr.filter(Boolean).includes(membro.nome)) perfil = 'gestor-instrumental'
      } catch { /* mantém perfil */ }
    }
    try {
      const perms = g?.permissoes ? (typeof g.permissoes === 'object' ? g.permissoes : JSON.parse(g.permissoes || '{}')) : {}
      extraPages = perms[membro.nome] || []
    } catch { extraPages = [] }
  }

  // Menu totalmente controlado pelo pastor quando extraPages está configurado
  const useCustomNav = ['secretario','tesoureiro','gestor-vocal','gestor-instrumental'].includes(perfil) && extraPages.length > 0

  const ministerioLider = lider?.ministerio || null

  return { id: membro.id, nome: membro.nome, login: membro.tel, perfil, membro_id: membro.id, lgpd_aceito: membro.lgpd_aceito || false, lgpd_aceito_em: membro.lgpd_aceito_em || null, extraPages, useCustomNav, ministerioLider }
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
        <button style={styles.btn} type="submit" disabled={loading}>
          {loading ? 'ENTRANDO...' : 'ENTRAR'}
        </button>
        <div style={styles.hint}>Primeiro acesso? Use seu telefone cadastrado com a senha <strong>123456</strong></div>
      </form>
    </div>
  )
}

const styles = {
  wrap: { display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg)' },
  box: { background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:14, padding:'36px 32px', width:320, textAlign:'center' },
  logo: { fontFamily:'var(--font-display)', fontSize:36, color:'var(--w)', letterSpacing:4, lineHeight:1 },
  sub: { fontSize:9, color:'var(--cy)', letterSpacing:3, textTransform:'uppercase', marginBottom:28, marginTop:4 },
  input: { display:'block', width:'100%', background:'var(--s2)', border:'1px solid var(--bd)', borderRadius:7, padding:'10px 12px', color:'var(--w)', fontSize:13, marginBottom:10, outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  erro: { color:'var(--red)', fontSize:12, marginBottom:10 },
  btn: { background:'var(--cy)', color:'#000', border:'none', borderRadius:7, padding:10, fontSize:13, fontWeight:700, cursor:'pointer', width:'100%', letterSpacing:1, fontFamily:'inherit', marginBottom:14 },
  hint: { fontSize:10, color:'var(--g)', lineHeight:1.5 },
}
