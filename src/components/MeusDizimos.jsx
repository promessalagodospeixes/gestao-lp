import { useEffect, useMemo, useState } from 'react'
import { meusDizimos } from '../lib/supabase.js'
import { MESES } from '../lib/utils.js'
import { fmt } from '../lib/tesouraria.js'
import { Btn, Modal, Empty, Tag } from './UI.jsx'
import { FileText, Printer } from 'lucide-react'

// ============================================================
//  O que a pessoa vê do próprio dízimo.
//
//  Só aparece o que já foi conferido e validado pela tesouraria — enquanto o
//  mês está aberto, nada aparece aqui, para ninguém ver número que ainda pode
//  mudar. Oferta não entra: oferta não tem dono.
// ============================================================
export default function MeusDizimos({ nome }) {
  const [lista, setLista] = useState(null)
  const [config, setConfig] = useState(null)
  const [recibo, setRecibo] = useState(null)

  useEffect(() => {
    meusDizimos().then(r => { setLista(r?.dados || []); setConfig(r?.config || null) })
  }, [])

  // Agrupa por ano e por mês, do mais novo para o mais velho.
  const anos = useMemo(() => {
    const g = new Map()
    for (const c of lista || []) {
      const ano = String(c.mes_ref || c.data || '').slice(0, 4)
      const mes = Number(String(c.mes_ref || c.data || '').slice(5, 7)) - 1
      if (!g.has(ano)) g.set(ano, { ano, total: 0, meses: new Map() })
      const a = g.get(ano)
      a.total += Number(c.valor) || 0
      if (!a.meses.has(mes)) a.meses.set(mes, { mes, total: 0, itens: [] })
      const m = a.meses.get(mes)
      m.total += Number(c.valor) || 0
      m.itens.push(c)
    }
    return [...g.values()]
      .sort((a, b) => b.ano.localeCompare(a.ano))
      .map(a => ({ ...a, meses: [...a.meses.values()].sort((x, y) => y.mes - x.mes) }))
  }, [lista])

  if (lista === null) {
    return <div style={{ padding: 26, textAlign: 'center', color: 'var(--g)', fontSize: 13 }}>Carregando…</div>
  }

  if (!lista.length) {
    return (
      <div>
        <Empty icon="📄" text="Você ainda não tem dízimo registrado." />
        <div style={{ fontSize: 12, color: 'var(--g)', textAlign: 'center', marginTop: -8 }}>
          Os lançamentos aparecem aqui depois que a tesouraria fecha o mês.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--gl)', marginBottom: 14 }}>
        Aqui está o registro do que você entregou. Cada linha tem um recibo com
        código próprio — toque em <b>Recibo</b> para abrir e imprimir.
      </div>

      {anos.map(a => (
        <div key={a.ano} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, gap: 12 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--w)' }}>{a.ano}</span>
            <span style={{ fontSize: 13, color: 'var(--cy)', fontWeight: 700 }}>{fmt(a.total)}</span>
          </div>

          {a.meses.map(m => (
            <div key={m.mes} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, gap: 12 }}>
                <b style={{ fontSize: 13, color: 'var(--w)' }}>{MESES[m.mes]}</b>
                <b style={{ fontSize: 13, color: 'var(--tx)' }}>{fmt(m.total)}</b>
              </div>
              {m.itens.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid var(--bd)', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--tx)' }}>
                      {c.data ? new Date(c.data + 'T00:00:00').toLocaleDateString('pt-BR') : MESES[m.mes]}
                      <span style={{ color: 'var(--g)', marginLeft: 8 }}>{fmt(c.valor)}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--g)', marginTop: 2, wordBreak: 'break-all' }}>{c.codigo_recibo}</div>
                  </div>
                  <Btn size="xs" variant="outline" onClick={() => setRecibo(c)}><FileText size={13} /> Recibo</Btn>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}

      {recibo && (
        <Modal title="Recibo" onClose={() => setRecibo(null)}
          footer={<><Btn variant="outline" onClick={() => setRecibo(null)}>Fechar</Btn>
            <Btn onClick={() => window.print()}><Printer size={15} /> Imprimir</Btn></>}>
          <ReciboFolha c={recibo} nome={nome} config={config} />
        </Modal>
      )}
    </div>
  )
}

// A folha do recibo. Fica com fundo branco e letra preta mesmo no tema escuro,
// porque ela existe para ser impressa e guardada.
function ReciboFolha({ c, nome, config }) {
  const linha = { display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #e2e2e2', fontSize: 12.5, gap: 12 }
  const rot = { color: '#666' }
  const val = { color: '#111', fontWeight: 600, textAlign: 'right' }

  return (
    <div className="print-area" style={{ background: '#fff', color: '#111', padding: 18, borderRadius: 8 }}>
      <div style={{ textAlign: 'center', borderBottom: '2px solid #111', paddingBottom: 9, marginBottom: 11 }}>
        <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>
          {config?.convencao_nome || 'CONVENÇÃO REGIONAL RIO DE JANEIRO E ESPÍRITO SANTO DAS IGREJAS'}
        </div>
        <div style={{ fontSize: 10.5, color: '#444', marginTop: 2 }}>CNPJ {config?.convencao_cnpj || '30.228.769/0001-22'}</div>
        <div style={{ fontSize: 12, fontWeight: 700, marginTop: 5 }}>
          {config?.igreja_codigo || '511'} — {config?.igreja_nome || 'LAGO DOS PEIXES - RJ'}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8, letterSpacing: 1 }}>RECIBO DE DÍZIMO</div>
      </div>

      <div style={{ textAlign: 'center', margin: '12px 0' }}>
        <div style={{ fontSize: 9.5, color: '#666', letterSpacing: 1.5 }}>VALOR</div>
        <div style={{ fontSize: 27, fontWeight: 800 }}>{fmt(c.valor)}</div>
      </div>

      <div style={linha}><span style={rot}>Recebemos de</span><span style={val}>{nome || '—'}</span></div>
      <div style={linha}><span style={rot}>Data</span><span style={val}>{c.data ? new Date(c.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</span></div>
      <div style={linha}><span style={rot}>Competência</span>
        <span style={val}>{MESES[Number(String(c.mes_ref).slice(5, 7)) - 1]} de {String(c.mes_ref).slice(0, 4)}</span></div>
      <div style={linha}><span style={rot}>Forma</span>
        <span style={val}>{c.forma === 'pix_regiao' ? 'Pix para a Região' : c.forma === 'pix' ? 'Pix' : c.forma}</span></div>
      <div style={linha}><span style={rot}>Nº do recibo</span><span style={val}>{c.recibo || '—'}</span></div>
      <div style={{ ...linha, borderBottom: 'none' }}><span style={rot}>Pastor</span><span style={val}>{config?.pastor_nome || '—'}</span></div>
      <div style={{ ...linha, borderBottom: 'none' }}><span style={rot}>Tesouraria</span><span style={val}>{config?.tesoureiro_nome || '—'}</span></div>

      <div style={{ marginTop: 13, padding: 9, background: '#f4f4f4', borderRadius: 6, textAlign: 'center' }}>
        <div style={{ fontSize: 9, color: '#666', letterSpacing: 1.5 }}>CÓDIGO DE VERIFICAÇÃO</div>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, wordBreak: 'break-all', marginTop: 2 }}>{c.codigo_recibo}</div>
      </div>

      <div style={{ fontSize: 9.5, color: '#666', marginTop: 10, lineHeight: 1.5, textAlign: 'center' }}>
        Este código é único e pertence somente a este recibo. Emitido pelo sistema
        da igreja em {c.validado_em ? new Date(c.validado_em).toLocaleDateString('pt-BR') : '—'}.
      </div>
    </div>
  )
}
