import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { sb } from '../lib/supabase.js'
import { logAudit } from '../lib/auditoria.js'
import { primeiroUltimo } from '../lib/utils.js'
import { Btn, FormGrid, FG } from '../components/UI.jsx'

export default function Perfil() {
  const { state, dispatch } = useStore()
  const { user } = state
  const [form, setForm] = useState({
    cpf: user?.cpf || '',
    tel: user?.tel || '',
    email: user?.email || '',
    senhaAtual: '',
    senhaNova: '',
    senhaConf: '',
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')

  const salvar = async () => {
    setErro(''); setOk('')

    // Validações de senha
    if (form.senhaNova || form.senhaConf) {
      if (form.senhaNova !== form.senhaConf) { setErro('As senhas novas não conferem.'); return }
      if (form.senhaNova.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
      if (!form.senhaAtual) { setErro('Informe a senha atual para alterar.'); return }
      // Verificar senha atual
      const { data } = await sb.from('usuarios').select('id').eq('id', user.id).eq('senha', form.senhaAtual).maybeSingle()
      if (!data) { setErro('Senha atual incorreta.'); return }
    }

    setSaving(true)
    const updates = { cpf: form.cpf || null, tel: form.tel || null, email: form.email || null }
    if (form.senhaNova) updates.senha = form.senhaNova

    const { error } = await sb.from('usuarios').update(updates).eq('id', user.id)
    if (error) { setErro('Erro ao salvar. Tente novamente.'); setSaving(false); return }

    // Atualiza user na sessão
    const novoUser = { ...user, ...updates }
    sessionStorage.setItem('gestao-lp-user', JSON.stringify(novoUser))
    dispatch({ type: 'SET_USER', value: novoUser })
    await logAudit(user, 'PERFIL_ATUALIZADO', 'Usuário atualizou seus dados de perfil')

    setSaving(false)
    setForm(f => ({ ...f, senhaAtual: '', senhaNova: '', senhaConf: '' }))
    setOk('✅ Dados salvos com sucesso!')
    dispatch({ type: 'TOAST', value: '✅ Perfil atualizado!' })
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontFamily:'var(--font-display)', fontSize:22, color:'var(--w)', letterSpacing:2, marginBottom:20 }}>MEU PERFIL</div>

      {/* Info não editável */}
      <div style={{ background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:10, padding:'14px 16px', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:44, height:44, borderRadius:'50%', background:'var(--cy)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:'#000', flexShrink:0 }}>
            {user?.nome?.[0] || 'U'}
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--w)' }}>{primeiroUltimo(user?.nome)}</div>
            <div style={{ fontSize:10, color:'var(--cy)', textTransform:'uppercase', letterSpacing:1, marginTop:2 }}>{user?.perfil}</div>
          </div>
        </div>
      </div>

      {/* Formulário */}
      <div style={{ background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:10, padding:'18px 16px' }}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:13, color:'var(--cy)', letterSpacing:2, marginBottom:14 }}>DADOS DE CONTATO</div>
        <FormGrid>
          <FG><label>CPF</label><input value={form.cpf} onChange={e=>setForm({...form,cpf:e.target.value})} placeholder="000.000.000-00" /></FG>
          <FG><label>Telefone / WhatsApp</label><input value={form.tel} onChange={e=>setForm({...form,tel:e.target.value})} placeholder="21 99999-9999" /></FG>
          <FG full><label>E-mail</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="seu@email.com" /></FG>
        </FormGrid>

        <div style={{ fontFamily:'var(--font-display)', fontSize:13, color:'var(--cy)', letterSpacing:2, margin:'18px 0 14px' }}>ALTERAR SENHA</div>
        <div style={{ fontSize:11, color:'var(--g)', marginBottom:10 }}>Preencha apenas se quiser alterar a senha.</div>
        <FormGrid>
          <FG full><label>Senha Atual</label><input type="password" value={form.senhaAtual} onChange={e=>setForm({...form,senhaAtual:e.target.value})} autoComplete="current-password" /></FG>
          <FG><label>Nova Senha</label><input type="password" value={form.senhaNova} onChange={e=>setForm({...form,senhaNova:e.target.value})} autoComplete="new-password" /></FG>
          <FG><label>Confirmar Nova Senha</label><input type="password" value={form.senhaConf} onChange={e=>setForm({...form,senhaConf:e.target.value})} autoComplete="new-password" /></FG>
        </FormGrid>

        {erro && <div style={{ color:'var(--red)', fontSize:12, marginTop:8, marginBottom:4 }}>⚠ {erro}</div>}
        {ok  && <div style={{ color:'var(--gr)', fontSize:12, marginTop:8, marginBottom:4 }}>{ok}</div>}

        <div style={{ marginTop:14 }}>
          <Btn onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : '💾 Salvar Alterações'}</Btn>
        </div>
      </div>
    </div>
  )
}
