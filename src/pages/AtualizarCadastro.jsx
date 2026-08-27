import { useState } from 'react'
import { cpfValido, cpfMascara } from '../lib/utils.js'
import CampoData from '../components/CampoData.jsx'

// Link pessoal (/atualizar?c=TOKEN). Só mostra os dados depois que a pessoa
// acerta a própria data de nascimento — o link sozinho não revela nada.
const ESTADO_CIVIL = ['Solteiro(a)', 'Casado(a)', 'União Estável', 'Divorciado(a)', 'Viúvo(a)']
const ESCOLARIDADE = ['Analfabeto', 'Ensino Fundamental Incompleto', 'Ensino Fundamental Completo',
  'Ensino Médio Incompleto', 'Ensino Médio Completo', 'Superior Incompleto', 'Superior Completo', 'Pós-graduação']

const token = new URLSearchParams(window.location.search).get('c') || ''

export default function AtualizarCadastro() {
  const [fase, setFase] = useState('porta') // porta | ficha | pronto
  const [nasc, setNasc] = useState('')
  const [nome, setNome] = useState('')
  const [f, setF] = useState({})
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [resumo, setResumo] = useState(null)

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const cpfRuim = String(f.cpf || '').replace(/\D/g, '').length === 11 && !cpfValido(f.cpf)

  const chamar = (corpo) => fetch('/api/atualizar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, nascimento: nasc, ...corpo }),
  }).then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => ({})) }))

  const abrir = async (e) => {
    e.preventDefault()
    setErro(''); setOcupado(true)
    const { ok, d } = await chamar({ acao: 'abrir' })
    setOcupado(false)
    if (!ok) { setErro(d.erro || 'Não foi possível abrir.'); return }
    setNome(d.nome || ''); setF(d.dados || {}); setFase('ficha')
  }

  const salvar = async (e) => {
    e.preventDefault()
    if (cpfRuim) { setErro('Esse CPF não confere.'); return }
    setErro(''); setOcupado(true)
    const dados = { ...f, cpf: String(f.cpf || '').replace(/\D/g, '') }
    const { ok, d } = await chamar({ acao: 'salvar', dados })
    setOcupado(false)
    if (!ok) { setErro(d.erro || 'Não foi possível enviar.'); return }
    setResumo(d); setFase('pronto')
  }

  if (!token) return <Aviso titulo="Link inválido" texto="Peça um novo link à secretaria da igreja." />

  if (fase === 'pronto') {
    return (
      <Aviso
        icone="✅"
        titulo={resumo?.semMudanca ? 'Tudo certo!' : 'Recebemos!'}
        texto={resumo?.semMudanca
          ? 'Você não mudou nada — seu cadastro já estava correto. Obrigado por conferir!'
          : `Obrigado, ${(nome || '').split(' ')[0]}! ${resumo?.total === 1 ? 'Sua correção foi enviada' : `Suas ${resumo?.total} correções foram enviadas`} para a secretaria conferir. Este link já pode ser fechado.`}
      />
    )
  }

  if (fase === 'porta') {
    return (
      <div style={st.fundo}>
        <form onSubmit={abrir} style={{ ...st.caixa, maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <img src="/logo.png" alt="Promessa Lago dos Peixes" style={{ height: 58, margin: '0 auto 14px' }} />
            <h1 style={st.titulo}>Confira seu cadastro</h1>
            <p style={st.sub}>
              A igreja está atualizando os dados dos membros. Para ver os seus, confirme sua
              <strong> data de nascimento</strong> — assim ninguém além de você consegue abrir.
            </p>
          </div>
          <label style={st.campo}>
            <span style={st.rot}>Sua data de nascimento</span>
            <span style={{ fontSize: 11.5, color: '#8b949e', marginBottom: 2 }}>Digite só os números, ex.: 07 05 1968</span>
            <CampoData valor={nasc} onChange={setNasc} estilo={st.input}
              estiloErro={{ borderColor: '#f85149' }} autoFocus />
          </label>
          {erro && <div style={st.erro}>{erro}</div>}
          <button type="submit" disabled={!nasc || ocupado} style={{ ...st.botao, opacity: (!nasc || ocupado) ? 0.5 : 1 }}>
            {ocupado ? 'Conferindo…' : 'Ver meu cadastro'}
          </button>
          <p style={st.rodape}>Este link é só seu e vale por 3 dias.</p>
        </form>
      </div>
    )
  }

  const campo = (rot, k, props = {}) => (
    <label style={st.campo}>
      <span style={st.rot}>{rot}</span>
      <input style={st.input} value={f[k] || ''} onChange={(e) => set(k, e.target.value)} {...props} />
    </label>
  )
  const escolha = (rot, k, opcoes) => (
    <label style={st.campo}>
      <span style={st.rot}>{rot}</span>
      <select style={st.input} value={f[k] || ''} onChange={(e) => set(k, e.target.value)}>
        <option value="">— selecione —</option>
        {opcoes.map((x) => <option key={x.v ?? x} value={x.v ?? x}>{x.t ?? x}</option>)}
      </select>
    </label>
  )

  return (
    <div style={st.fundo}>
      <form onSubmit={salvar} style={st.caixa}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img src="/logo.png" alt="Promessa Lago dos Peixes" style={{ height: 58, margin: '0 auto 14px' }} />
          <h1 style={st.titulo}>Olá, {(nome || '').split(' ')[0]}!</h1>
          <p style={st.sub}>Confira o que está errado ou faltando, corrija e envie. Só isso.</p>
        </div>

        <div style={st.secao}>Data de nascimento</div>
        <div style={st.grid}>
          <label style={st.campo}>
            <span style={st.rot}>Sua data de nascimento</span>
            <CampoData valor={f.nascimento} onChange={(v) => set('nascimento', v)} estilo={st.input}
              estiloErro={{ borderColor: '#f85149' }} />
            <span style={{ fontSize: 11.5, color: '#8b949e', marginTop: 5, display: 'block', lineHeight: 1.5 }}>
              Se a data que você usou para entrar está errada, <strong>corrija aqui</strong> — a secretaria acerta no cadastro.
            </span>
          </label>
        </div>

        <div style={st.secao}>Contato</div>
        <div style={st.grid}>
          {campo('WhatsApp / telefone', 'tel', { type: 'tel', inputMode: 'tel', placeholder: '(21) 90000-0000' })}
          {campo('E-mail', 'email', { type: 'email', placeholder: 'seu@email.com' })}
        </div>

        <div style={st.secao}>Documentos e dados pessoais</div>
        <div style={st.grid}>
          <label style={st.campo}>
            <span style={st.rot}>CPF</span>
            <input style={{ ...st.input, ...(cpfRuim ? { borderColor: '#f85149' } : {}) }}
              value={cpfMascara(f.cpf || '')} onChange={(e) => set('cpf', e.target.value.replace(/\D/g, '').slice(0, 11))}
              inputMode="numeric" placeholder="000.000.000-00" />
            {cpfRuim && <span style={{ fontSize: 11, color: '#f85149', marginTop: 4, display: 'block' }}>Esse CPF não confere.</span>}
          </label>
          {campo('RG', 'rg')}
          {campo('Órgão emissor', 'rg_emissor', { placeholder: 'DETRAN, IFP/RJ…' })}
          {escolha('Estado civil', 'estado_civil', ESTADO_CIVIL)}
          {campo('Naturalidade', 'naturalidade', { placeholder: 'Cidade onde nasceu' })}
          {campo('Profissão', 'profissao')}
          <div style={{ gridColumn: '1 / -1' }}>{escolha('Escolaridade', 'escolaridade', ESCOLARIDADE)}</div>
          {campo('Nome da mãe', 'nome_mae')}
          {campo('Nome do pai', 'nome_pai')}
        </div>

        <div style={st.secao}>Endereço</div>
        <div style={st.grid}>
          {campo('CEP', 'cep', { inputMode: 'numeric', placeholder: '00000-000' })}
          <div style={{ gridColumn: 'span 2' }}>{campo('Rua / avenida', 'endereco')}</div>
          {campo('Número', 'numero')}
          {campo('Complemento', 'complemento', { placeholder: 'apto, bloco, casa…' })}
          {campo('Bairro', 'bairro')}
          {campo('Cidade', 'cidade')}
          {campo('Estado', 'uf', { maxLength: 2, placeholder: 'RJ' })}
        </div>

        <div style={st.secao}>Vida na igreja</div>
        <div style={st.grid}>
          {escolha('Você é batizado?', 'batizado', [{ v: 'sim', t: 'Sim' }, { v: 'nao', t: 'Não' }])}
          <label style={st.campo}>
            <span style={st.rot}>Data do batismo</span>
            <CampoData valor={f.batismo_data} onChange={(v) => set('batismo_data', v)} estilo={st.input}
              estiloErro={{ borderColor: '#f85149' }} />
          </label>
          {campo('Local do batismo', 'batismo_local')}
          {campo('Igreja anterior', 'igreja_anterior')}
        </div>

        {erro && <div style={st.erro}>{erro}</div>}
        <button type="submit" disabled={ocupado || cpfRuim} style={{ ...st.botao, opacity: (ocupado || cpfRuim) ? 0.5 : 1 }}>
          {ocupado ? 'Enviando…' : 'Salvar e enviar'}
        </button>
        <p style={st.rodape}>
          A secretaria confere e aplica as correções. Depois de enviar, este link se encerra.
        </p>
      </form>
    </div>
  )
}

function Aviso({ icone, titulo, texto }) {
  return (
    <div style={st.fundo}>
      <div style={{ ...st.caixa, maxWidth: 420, textAlign: 'center' }}>
        <img src="/logo.png" alt="Promessa Lago dos Peixes" style={{ height: 60, margin: '0 auto 16px' }} />
        {icone && <div style={{ fontSize: 44, marginBottom: 8 }}>{icone}</div>}
        <h1 style={st.titulo}>{titulo}</h1>
        <p style={{ ...st.sub, marginBottom: 0 }}>{texto}</p>
      </div>
    </div>
  )
}

const st = {
  fundo: { minHeight: '100vh', background: '#0d1117', padding: '24px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
  caixa: { background: '#161b22', border: '1px solid #30363d', borderRadius: 16, padding: '28px 22px', width: '100%', maxWidth: 620 },
  titulo: { fontSize: 22, fontWeight: 800, color: '#f0f6fc', margin: 0 },
  sub: { fontSize: 13.5, color: '#8b949e', lineHeight: 1.65, margin: '10px 0 0' },
  secao: { fontSize: 10.5, fontWeight: 800, color: '#2dd4bf', textTransform: 'uppercase', letterSpacing: '.07em', margin: '20px 0 10px', paddingBottom: 6, borderBottom: '1px solid #30363d' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))', gap: 12 },
  campo: { display: 'flex', flexDirection: 'column', gap: 5 },
  rot: { fontSize: 11.5, color: '#8b949e', fontWeight: 600 },
  input: { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: 9, padding: '11px 12px', color: '#f0f6fc', fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  erro: { background: 'rgba(248,81,73,.1)', border: '1px solid rgba(248,81,73,.4)', color: '#f85149', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, margin: '16px 0 0' },
  botao: { width: '100%', background: '#2dd4bf', color: '#04211f', border: 'none', borderRadius: 10, padding: 15, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', marginTop: 20 },
  rodape: { textAlign: 'center', fontSize: 11.5, color: '#8b949e', marginTop: 14, lineHeight: 1.6 },
}
