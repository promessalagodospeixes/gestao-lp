import { useEffect, useMemo, useState } from 'react'
import { panoramaDizimistas } from '../lib/supabase.js'
import { fmt } from '../lib/tesouraria.js'
import { Empty, Tag } from './UI.jsx'

// ============================================================
//  Quem dízima, quem parou, quem nunca deu.
//
//  O objetivo aqui não é cobrar — é o pastor entender o rebanho:
//  quem sustentava e sumiu (pode ser dificuldade, mágoa, afastamento),
//  quem nunca deu (pode nem ser dízimo — pode ser pastoreio).
//  Por isso mostra o telefone junto: dá para procurar a pessoa.
// ============================================================

const MES_ATUAL = new Date().toISOString().slice(0, 7)
const mesesAtras = (ym, n) => {
  if (!ym) return Infinity
  const [a, m] = ym.split('-').map(Number)
  const [aa, mm] = MES_ATUAL.split('-').map(Number)
  return (aa - a) * 12 + (mm - m)
}

const GRUPOS = {
  ativos:   { label: 'Dizimando',      cor: 'green', dica: 'Deram nos últimos 2 meses' },
  esfriando:{ label: 'Esfriando',      cor: 'yellow', dica: 'Davam, mas há 3 a 5 meses não dão' },
  pararam:  { label: 'Pararam',        cor: 'red', dica: 'Davam antes, mas há 6 meses ou mais não dão' },
  nunca:    { label: 'Nunca dizimaram', cor: 'gray', dica: 'Sem nenhum dízimo registrado' },
}

function classificar(d) {
  if (!d.ultimo_mes) return 'nunca'
  const g = mesesAtras(d.ultimo_mes, 1)
  if (g <= 2) return 'ativos'
  if (g <= 5) return 'esfriando'
  return 'pararam'
}

export default function PanoramaDizimistas() {
  const [dados, setDados] = useState(null)
  const [filtro, setFiltro] = useState('todos')      // grupo
  const [quem, setQuem] = useState('ativos_igreja')  // ativos da igreja x todos
  const [busca, setBusca] = useState('')

  useEffect(() => { panoramaDizimistas().then(r => setDados(r?.dados || [])) }, [])

  const classificados = useMemo(
    () => (dados || []).map(d => ({ ...d, grupo: classificar(d) })),
    [dados]
  )

  const base = useMemo(() => classificados.filter(d => {
    if (quem === 'ativos_igreja' && !d.ativo) return false
    if (busca && !d.nome.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  }), [classificados, quem, busca])

  const contagem = useMemo(() => {
    const c = { ativos: 0, esfriando: 0, pararam: 0, nunca: 0 }
    for (const d of base) c[d.grupo]++
    return c
  }, [base])

  const lista = useMemo(() => {
    const l = filtro === 'todos' ? base : base.filter(d => d.grupo === filtro)
    const ordem = { pararam: 0, esfriando: 1, nunca: 2, ativos: 3 }
    return [...l].sort((a, b) =>
      (ordem[a.grupo] - ordem[b.grupo]) || (b.total - a.total) || a.nome.localeCompare(b.nome))
  }, [base, filtro])

  if (dados === null) return <div style={{ padding: 30, textAlign: 'center', color: 'var(--g)', fontSize: 13 }}>Carregando o histórico…</div>

  const cardStat = ([chave, n]) => {
    const g = GRUPOS[chave]
    const sel = filtro === chave
    return (
      <div key={chave} onClick={() => setFiltro(sel ? 'todos' : chave)}
        style={{
          cursor: 'pointer', flex: '1 1 130px', background: sel ? 'var(--s2)' : 'var(--s1)',
          border: `1px solid ${sel ? 'var(--cy)' : 'var(--bd)'}`, borderRadius: 10, padding: '11px 13px',
        }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: `var(--${g.cor === 'gray' ? 'g' : g.cor === 'green' ? 'grn' : g.cor === 'yellow' ? 'yel' : 'red'})` }}>{n}</div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--w)', marginTop: 1 }}>{g.label}</div>
        <div style={{ fontSize: 10, color: 'var(--g)', marginTop: 2, lineHeight: 1.3 }}>{g.dica}</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--gl)', marginBottom: 12, lineHeight: 1.5 }}>
        Uma leitura do rebanho, não uma cobrança: quem sustentava e parou pode estar passando por
        algo. O telefone está aqui do lado para você procurar a pessoa.
      </div>

      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 12 }}>
        {Object.entries(contagem).map(cardStat)}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input placeholder="Procurar nome…" value={busca} onChange={e => setBusca(e.target.value)}
          style={{ flex: '1 1 180px' }} />
        <select value={quem} onChange={e => setQuem(e.target.value)} style={{ flex: '0 1 200px' }}>
          <option value="ativos_igreja">Só membros ativos</option>
          <option value="todos">Todos do cadastro</option>
        </select>
      </div>

      {filtro !== 'todos' && (
        <div style={{ fontSize: 12, color: 'var(--g)', marginBottom: 8 }}>
          Mostrando <b style={{ color: 'var(--tx)' }}>{GRUPOS[filtro].label}</b> — toque no cartão de novo para ver todos.
        </div>
      )}

      {lista.length === 0 ? <Empty text="Ninguém neste grupo." /> : (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, overflow: 'hidden' }}>
          {lista.map((d, i) => (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px',
              borderTop: i ? '1px solid var(--bd)' : 'none', flexWrap: 'wrap',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: `var(--${GRUPOS[d.grupo].cor === 'gray' ? 'g' : GRUPOS[d.grupo].cor === 'green' ? 'grn' : GRUPOS[d.grupo].cor === 'yellow' ? 'yel' : 'red'})` }} />
              <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--w)', fontWeight: 600 }}>
                  {d.nome} {!d.ativo && <span style={{ fontSize: 10, color: 'var(--g)' }}>(inativo)</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 1 }}>
                  {d.ultimo_mes
                    ? `${d.meses_com_dizimo} mês(es) · último em ${d.ultimo_mes.split('-').reverse().join('/')}`
                    : (d.batizado ? 'Membro batizado, sem dízimo registrado' : 'Frequentador')}
                </div>
              </div>
              {d.total > 0 && <div style={{ fontSize: 12.5, color: 'var(--tx)', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(d.total)}</div>}
              {d.tel && (
                <a href={`https://wa.me/55${String(d.tel).replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, color: 'var(--cy)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  WhatsApp
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 12, lineHeight: 1.5 }}>
        Conta só o dízimo ligado a uma pessoa do cadastro. Oferta não entra (não tem dono).
        Recibo estornado também não conta.
      </div>
    </div>
  )
}
