import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { getToken } from '../lib/supabase.js'

// Aparece no primeiro acesso de quem ainda usa a senha padrão (123456).
export default function TrocarSenha() {
  const { dispatch } = useStore()
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [conf, setConf] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const salvar = async (e) => {
    e.preventDefault()
    setErro('')
    if (nova !== conf) { setErro('As duas senhas novas não são iguais.'); return }
    if (nova.length < 6) { setErro('A senha precisa ter pelo menos 6 caracteres.'); return }
    setSalvando(true)
    try {
      const r = await fetch('/api/senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ senhaAtual: atual, senhaNova: nova }),
      })
      const resp = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(resp.erro || 'Não foi possível trocar a senha.'); setSalvando(false); return }
      const u = JSON.parse(localStorage.getItem('gestao-lp-user') || '{}')
      const novoUser = { ...u, trocar_senha: false }
      localStorage.setItem('gestao-lp-user', JSON.stringify(novoUser))
      dispatch({ type: 'SET_USER', value: novoUser })
      dispatch({ type: 'TOAST', value: '🔒 Senha criada! Agora só você tem acesso à sua conta.' })
    } catch (err) {
      setErro('Erro de conexão. Tente de novo.')
    }
    setSalvando(false)
  }

  return (
    <div style={st.fundo}>
      <form style={st.caixa} onSubmit={salvar}>
        <img src="/logo.png" alt="Promessa Lago dos Peixes" style={{ width: 190, margin: '0 auto 18px', display: 'block', borderRadius: 8 }} />
        <div style={st.titulo}>Crie a sua senha</div>
        <p style={st.texto}>
          Por segurança, cada pessoa agora tem a própria senha — a senha padrão <strong>123456</strong> não vale mais.
          Escolha uma senha só sua para continuar.
        </p>
        <input style={st.input} type="password" placeholder="Senha atual (a que você usou para entrar)"
          value={atual} onChange={(e) => setAtual(e.target.value)} autoComplete="current-password" />
        <input style={st.input} type="password" placeholder="Nova senha (mínimo 6 caracteres)"
          value={nova} onChange={(e) => setNova(e.target.value)} autoComplete="new-password" />
        <input style={st.input} type="password" placeholder="Repita a nova senha"
          value={conf} onChange={(e) => setConf(e.target.value)} autoComplete="new-password" />
        {erro && <div style={st.erro}>{erro}</div>}
        <button style={st.botao} type="submit" disabled={salvando || !atual || !nova || !conf}>
          {salvando ? 'Salvando…' : 'Salvar minha senha'}
        </button>
        <p style={st.dica}>Anote num lugar seguro. Se esquecer, o pastor ou a secretaria conseguem redefinir para você.</p>
      </form>
    </div>
  )
}

const st = {
  fundo: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 },
  caixa: { background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 16, padding: '30px 26px', width: '100%', maxWidth: 420 },
  titulo: { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--w)', textAlign: 'center' },
  texto: { fontSize: 13, color: 'var(--tx)', lineHeight: 1.7, margin: '10px 0 20px', textAlign: 'center' },
  input: { width: '100%', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 9, padding: '12px 13px', color: 'var(--w)', fontSize: 14, fontFamily: 'inherit', marginBottom: 10, outline: 'none' },
  erro: { background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.4)', color: 'var(--red)', borderRadius: 8, padding: '9px 12px', fontSize: 12.5, marginBottom: 10 },
  botao: { width: '100%', background: 'var(--cy)', color: '#04211f', border: 'none', borderRadius: 10, padding: 14, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  dica: { fontSize: 11.5, color: 'var(--g)', textAlign: 'center', marginTop: 14, lineHeight: 1.6 },
}
