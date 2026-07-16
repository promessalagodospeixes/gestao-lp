import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { sb } from '../lib/supabase.js'
import { logAudit } from '../lib/auditoria.js'
import { primeiroUltimo } from '../lib/utils.js'
import { Btn, FormGrid, FG } from '../components/UI.jsx'

export default function Perfil() {
  const { state, dispatch } = useStore()
  const { user } = state
  const { membros } = state
  const membroAtual = (membros||[]).find(m => (user?.membro_id && m.id === user.membro_id) || m.nome === user?.nome)

  const [form, setForm] = useState({
    nome_exibicao: membroAtual?.nome_exibicao || user?.nome_exibicao || '',
    tel:   membroAtual?.tel   || '',
    email: membroAtual?.email || '',
    senhaAtual: '',
    senhaNova: '',
    senhaConf: '',
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')

  const salvar = async () => {
    setErro(''); setOk('')
    if (!membroAtual?.id) { setErro('Membro não encontrado. Contacte o administrador.'); return }

    // Validações de senha
    if (form.senhaNova || form.senhaConf) {
      if (form.senhaNova !== form.senhaConf) { setErro('As senhas novas não conferem.'); return }
      if (form.senhaNova.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
      if (!form.senhaAtual) { setErro('Informe a senha atual para alterar.'); return }
      // Senha correta é a senha cadastrada no membro, ou '123456' se nunca foi alterada
      const senhaCorreta = membroAtual?.senha || '123456'
      if (form.senhaAtual !== senhaCorreta) { setErro('Senha atual incorreta.'); return }
    }

    setSaving(true)
    const updates = {
      tel: form.tel || null,
      email: form.email || null,
      nome_exibicao: form.nome_exibicao || null,
    }
    if (form.senhaNova) updates.senha = form.senhaNova

    // Tudo vai para a tabela membros
    const { error } = await sb.from('membros').update(updates).eq('id', membroAtual.id)
    if (error) { console.error('Erro Supabase:', error); setErro(`Erro: ${error.message}`); setSaving(false); return }

    const mbsAtualizados = (membros||[]).map(m => m.id === membroAtual.id ? {...m, ...updates} : m)
    dispatch({ type: 'SET', key: 'membros', value: mbsAtualizados })

    // Atualiza user na sessão
    const novoUser = { ...user, ...updates }
    localStorage.setItem('gestao-lp-user', JSON.stringify(novoUser))
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
        <div style={{ fontFamily:'var(--font-display)', fontSize:13, color:'var(--cy)', letterSpacing:2, marginBottom:14 }}>NOME DE EXIBIÇÃO</div>
        <FormGrid>
          <FG full>
            <label>Como seu nome aparece nas escalas</label>
            <input value={form.nome_exibicao} onChange={e=>setForm({...form,nome_exibicao:e.target.value})} placeholder={primeiroUltimo(user?.nome)} />
            <div style={{fontSize:10,color:'var(--g)',marginTop:4}}>
              💡 Sugestão automática: <strong style={{color:'var(--cy)'}}>{primeiroUltimo(user?.nome)}</strong> — deixe em branco para usar essa, ou escreva como preferir (ex: <em>Gabriel Azeredo</em>)
            </div>
          </FG>
        </FormGrid>

        <div style={{ fontFamily:'var(--font-display)', fontSize:13, color:'var(--cy)', letterSpacing:2, margin:'18px 0 14px' }}>DADOS DE CONTATO</div>
        <FormGrid>
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

      {/* Termos aceitos */}
      <div style={{ background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:10, padding:'18px 16px', marginTop:16 }}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:13, color:'var(--cy)', letterSpacing:2, marginBottom:12 }}>AVISO DE PRIVACIDADE ACEITO</div>
        {user?.lgpd_aceito
          ? <>
              <div style={{ fontSize:11, color:'var(--grn)', marginBottom:12, fontWeight:600 }}>
                ✅ Aceito em {user.lgpd_aceito_em ? new Date(user.lgpd_aceito_em).toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : 'data não registrada'}
              </div>
              <div style={{ fontSize:12, color:'var(--tx)', lineHeight:1.8, background:'var(--s2)', borderRadius:8, padding:'12px 14px' }}>
                <p style={{ marginBottom:8 }}><strong style={{ color:'var(--w)' }}>Uso de Imagem:</strong> Ao participar das atividades da Igreja Promessa Lago dos Peixes, você concorda que fotos e vídeos poderão ser tirados durante os cultos e eventos para registro interno e divulgação nas redes sociais da igreja.</p>
                <p style={{ marginBottom:8 }}><strong style={{ color:'var(--w)' }}>Dados Pessoais (LGPD):</strong> Seus dados (nome, telefone, e-mail, CPF) são coletados exclusivamente para fins de gestão eclesiástica e comunicação interna. Não compartilhamos seus dados com terceiros.</p>
                <p>Você pode solicitar a exclusão ou correção dos seus dados a qualquer momento entrando em contato com a secretaria da igreja.</p>
              </div>
            </>
          : <div style={{ fontSize:12, color:'var(--g)' }}>Você ainda não aceitou o aviso de privacidade.</div>
        }
      </div>
    </div>
  )
}
