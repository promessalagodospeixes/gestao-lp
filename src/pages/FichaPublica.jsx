import { useState } from 'react'
import { sb } from '../lib/supabase.js'

const ESTADO_CIVIL = ['Solteiro(a)', 'Casado(a)', 'Viúvo(a)', 'Divorciado(a)', 'União estável']

const vazio = {
  nome: '', nascimento: '', estado_civil: '', tel: '', email: '', profissao: '',
  cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  batizado: '', batismo_data: '', batismo_local: '', igreja_anterior: '', como_conheceu: '',
  obs: '', lgpd: false,
}

export default function FichaPublica() {
  const [f, setF] = useState(vazio)
  const [estado, setEstado] = useState('') // '' | enviando | ok | erro
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  const buscarCep = async (cep) => {
    const limpo = (cep || '').replace(/\D/g, '')
    if (limpo.length !== 8) return
    try {
      const r = await fetch(`https://viacep.com.br/ws/${limpo}/json/`)
      const d = await r.json()
      if (d.erro) return
      setF((x) => ({
        ...x,
        endereco: d.logradouro || x.endereco,
        bairro: d.bairro || x.bairro,
        cidade: d.localidade || x.cidade,
        uf: d.uf || x.uf,
      }))
    } catch (e) { /* sem internet no CEP: a pessoa preenche na mão */ }
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (!f.lgpd) return
    setEstado('enviando')
    const { lgpd, ...dados } = f
    const { error } = await sb.from('fichas_membro').insert({ dados, status: 'pendente' })
    setEstado(error ? 'erro' : 'ok')
  }

  if (estado === 'ok') {
    return (
      <div style={st.fundo}>
        <div style={{ ...st.caixa, textAlign: 'center' }}>
          <img src="/logo.png" alt="Promessa Lago dos Peixes" style={{ height: 64, margin: '0 auto 18px' }} />
          <div style={{ fontSize: 44, marginBottom: 8 }}>✅</div>
          <h1 style={st.titulo}>Ficha enviada!</h1>
          <p style={{ ...st.sub, marginBottom: 0 }}>
            Obrigado, {f.nome.split(' ')[0]}! Sua ficha chegou à secretaria da igreja e será conferida em breve.
            Que Deus abençoe você.
          </p>
        </div>
      </div>
    )
  }

  const campo = (rot, k, props = {}) => (
    <label style={st.campo}>
      <span style={st.rot}>{rot}{props.required ? ' *' : ''}</span>
      <input style={st.input} value={f[k]} onChange={(e) => set(k, e.target.value)} {...props} />
    </label>
  )

  return (
    <div style={st.fundo}>
      <form onSubmit={enviar} style={st.caixa}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <img src="/logo.png" alt="Promessa Lago dos Peixes" style={{ height: 60, margin: '0 auto 14px' }} />
          <h1 style={st.titulo}>Ficha de Membro</h1>
          <p style={st.sub}>Preencha seus dados. Leva uns 3 minutos e ajuda a igreja a te conhecer e cuidar melhor de você.</p>
        </div>

        <div style={st.secao}>Dados pessoais</div>
        <div style={st.grid}>
          <div style={{ gridColumn: '1 / -1' }}>{campo('Nome completo', 'nome', { required: true, autoComplete: 'name' })}</div>
          {campo('Data de nascimento', 'nascimento', { type: 'date' })}
          <label style={st.campo}>
            <span style={st.rot}>Estado civil</span>
            <select style={st.input} value={f.estado_civil} onChange={(e) => set('estado_civil', e.target.value)}>
              <option value="">— selecione —</option>
              {ESTADO_CIVIL.map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          {campo('WhatsApp / telefone', 'tel', { required: true, type: 'tel', inputMode: 'tel', autoComplete: 'tel', placeholder: '(21) 90000-0000' })}
          {campo('E-mail', 'email', { type: 'email', autoComplete: 'email', placeholder: 'seu@email.com' })}
          <div style={{ gridColumn: '1 / -1' }}>{campo('Profissão', 'profissao')}</div>
        </div>

        <div style={st.secao}>Endereço</div>
        <div style={st.grid}>
          {campo('CEP', 'cep', { inputMode: 'numeric', placeholder: '00000-000', onBlur: (e) => buscarCep(e.target.value) })}
          <div style={{ gridColumn: 'span 2' }}>{campo('Rua / avenida', 'endereco')}</div>
          {campo('Número', 'numero')}
          {campo('Complemento', 'complemento', { placeholder: 'apto, bloco, casa…' })}
          {campo('Bairro', 'bairro')}
          {campo('Cidade', 'cidade')}
          {campo('Estado', 'uf', { maxLength: 2, placeholder: 'RJ' })}
        </div>

        <div style={st.secao}>Vida na igreja</div>
        <div style={st.grid}>
          <label style={st.campo}>
            <span style={st.rot}>Você é batizado(a)?</span>
            <select style={st.input} value={f.batizado} onChange={(e) => set('batizado', e.target.value)}>
              <option value="">— selecione —</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
              <option value="quero">Ainda não, mas quero me batizar</option>
            </select>
          </label>
          {f.batizado === 'sim' && campo('Data do batismo', 'batismo_data', { type: 'date' })}
          {f.batizado === 'sim' && (
            <div style={{ gridColumn: '1 / -1' }}>{campo('Local do batismo (igreja / cidade)', 'batismo_local')}</div>
          )}
          <div style={{ gridColumn: '1 / -1' }}>{campo('Igreja anterior (se houver)', 'igreja_anterior')}</div>
          <div style={{ gridColumn: '1 / -1' }}>{campo('Como você conheceu a Promessa Lago dos Peixes?', 'como_conheceu')}</div>
          <label style={{ ...st.campo, gridColumn: '1 / -1' }}>
            <span style={st.rot}>Algo mais que queira contar</span>
            <textarea style={{ ...st.input, minHeight: 76, resize: 'vertical' }} value={f.obs} onChange={(e) => set('obs', e.target.value)} />
          </label>
        </div>

        <label style={st.lgpd}>
          <input
            type="checkbox"
            checked={f.lgpd}
            onChange={(e) => set('lgpd', e.target.checked)}
            style={{ width: 18, height: 18, accentColor: '#2dd4bf', marginTop: 2, flexShrink: 0 }}
          />
          <span>
            Autorizo a Promessa Lago dos Peixes a guardar estes dados para organização e cuidado pastoral.
            Seus dados <strong>não são compartilhados com ninguém</strong> e você pode pedir correção ou exclusão quando quiser.
          </span>
        </label>

        {estado === 'erro' && (
          <div style={st.erro}>Não conseguimos enviar agora. Confira sua internet e tente novamente.</div>
        )}

        <button
          type="submit"
          disabled={!f.lgpd || !f.nome || !f.tel || estado === 'enviando'}
          style={{ ...st.botao, opacity: (!f.lgpd || !f.nome || !f.tel) ? 0.5 : 1 }}
        >
          {estado === 'enviando' ? 'Enviando…' : 'Enviar minha ficha'}
        </button>

        <div style={{ textAlign: 'center', fontSize: 11.5, color: '#8b949e', marginTop: 14 }}>
          Promessa Lago dos Peixes · Estrada Austin-Queimados, 250 — Nova Iguaçu / RJ
        </div>
      </form>
    </div>
  )
}

const st = {
  fundo: { minHeight: '100vh', background: '#0d1117', padding: '28px 16px', overflowY: 'auto' },
  caixa: { maxWidth: 660, margin: '0 auto', background: '#161b22', border: '1px solid #30363d', borderRadius: 16, padding: 'clamp(20px,4vw,34px)' },
  titulo: { fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-.02em' },
  sub: { fontSize: 13, color: '#8b949e', marginTop: 8, lineHeight: 1.6 },
  secao: { fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#2dd4bf', margin: '22px 0 12px', paddingBottom: 6, borderBottom: '1px solid #30363d' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,190px),1fr))', gap: 12 },
  campo: { display: 'grid', gap: 5 },
  rot: { fontSize: 11, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.05em' },
  input: { background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, padding: '11px 12px', color: '#fff', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%' },
  lgpd: { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5, color: '#8b949e', lineHeight: 1.6, margin: '22px 0 16px', cursor: 'pointer' },
  botao: { width: '100%', background: '#2dd4bf', color: '#04211f', border: 'none', borderRadius: 10, padding: '15px', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  erro: { background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.4)', color: '#f87171', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, marginBottom: 14 },
}
