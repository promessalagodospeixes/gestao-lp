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
// Remove o código do país (55) quando presente, para comparar telefones
// independente de o usuário digitar/colar com ou sem o +55 na frente
const normTel = (s) => {
  const d = soDigitos(s)
  return d.length > 11 ? d.slice(-11) : d
}

const buscarUsuario = async (login, senha) => {
  const loginTrim = login.trim()
  const digits = normTel(loginTrim)

  // 1. Busca na tabela usuarios por login, cpf, tel ou email
  const { data: lista } = await sb.from('usuarios').select('*').eq('senha', senha)
  if (lista?.length) {
    const usu = lista.find(u =>
      u.login === loginTrim ||
      (digits && soDigitos(u.cpf) === digits) ||
      (digits && normTel(u.tel) === digits) ||
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
        let ebTurmasP1 = null
        try {
          const perms = g?.permissoes ? (typeof g.permissoes === 'object' ? g.permissoes : JSON.parse(g.permissoes || '{}')) : {}
          extraPages = perms[nomeUsu] || []
          const ebList = Array.isArray(perms['~eb~']) ? perms['~eb~'] : []
          if (ebList.includes(nomeUsu) && !extraPages.includes('escala-eb')) extraPages = [...extraPages, 'escala-eb']
          ebTurmasP1 = perms[`~eb~${nomeUsu}`] || null
        } catch { extraPages = [] }
        useCustomNav = ['secretario','tesoureiro','gestor-vocal','gestor-instrumental'].includes(perfil)
      }
      return { ...usu, ...(ebTurmasP1 ? { ebTurmas: ebTurmasP1 } : {}), perfil, extraPages, useCustomNav }
    }
  }

  // 2. Fallback: membros — senha própria do cadastro (tela "Meu Perfil"),
  // ou a padrão 123456 se o membro nunca alterou a senha
  const { data: membrosData } = await sb.from('membros').select('*')
  const membro = (membrosData || []).find(m => {
    if (digits && normTel(m.tel) === digits) return true
    if (digits && soDigitos(m.cpf) === digits) return true
    if (m.email && m.email.toLowerCase() === loginTrim.toLowerCase()) return true
    return false
  })
  if (!membro) return null
  const senhaCorreta = membro.senha || '123456'
  if (senha !== senhaCorreta) return null

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
  let ebTurmas = null
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
      const ebList = Array.isArray(perms['~eb~']) ? perms['~eb~'] : []
      if (ebList.includes(membro.nome) && !extraPages.includes('escala-eb')) extraPages = [...extraPages, 'escala-eb']
      ebTurmas = perms[`~eb~${membro.nome}`] || null
    } catch { extraPages = [] }
  }

  const useCustomNav = ['secretario','tesoureiro','gestor-vocal','gestor-instrumental'].includes(perfil)

  const ministerioLider = lider?.ministerio || null

  return { id: membro.id, nome: membro.nome, login: membro.tel, perfil, membro_id: membro.id, lgpd_aceito: membro.lgpd_aceito || false, lgpd_aceito_em: membro.lgpd_aceito_em || null, extraPages, useCustomNav, ministerioLider, ebTurmas }
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
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
        <div style={styles.hint}>Primeiro acesso? Use seu telefone cadastrado com a senha <strong>123456</strong></div>
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
}
