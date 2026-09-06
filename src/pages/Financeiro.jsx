import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbGet, dbInsert, dbDelete, dbUpdate } from '../lib/supabase.js'
import { MESES } from '../lib/utils.js'
import { fecharMes, faixaRecibos, porFinalidade, refDoMes, fmt } from '../lib/tesouraria.js'
import { MonthNav, Btn, Modal, FormGrid, FG, Tag, Empty, Tabs } from '../components/UI.jsx'
import CampoData from '../components/CampoData.jsx'
import { Plus, Trash2, Printer, AlertTriangle, Lock } from 'lucide-react'

const FINALIDADES = [
  'Obra', 'Evento', 'Ceia', 'Ministério Infantil', 'Louvor', 'Manutenção',
  'Evangelismo', 'Literatura', 'Patrimônio', 'Assistência Social', 'Outro',
]

const hojeISO = () => new Date().toLocaleDateString('sv')

export default function Financeiro() {
  const { state, dispatch } = useStore()
  const { membros, membrosTodos, user } = state
  const agora = new Date()

  const [mes, setMes] = useState(agora.getMonth())
  const [ano, setAno] = useState(agora.getFullYear())
  const [aba, setAba] = useState('receb')

  const [contas, setContas] = useState([])
  const [contrib, setContrib] = useState([])
  const [despesas, setDespesas] = useState([])
  const [depositos, setDepositos] = useState([])
  const [mesInfo, setMesInfo] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(null)   // 'receb' | 'desp' | 'remessa'
  const [form, setForm] = useState({})
  const [salvando, setSalvando] = useState(false)

  const ref = refDoMes(ano, mes)
  const fechado = mesInfo?.status === 'fechado'
  const aviso = (t) => dispatch({ type: 'TOAST', value: t })

  const contasR = useMemo(() => contas.filter(c => c.lado === 'R' && c.papel !== 'baixa' && c.ativo), [contas])
  const contasD = useMemo(() => contas.filter(c => c.lado === 'D' && c.papel !== 'concessao' && c.ativo), [contas])
  const porId = useMemo(() => new Map(contas.map(c => [c.id, c])), [contas])
  const pessoas = (membrosTodos?.length ? membrosTodos : membros) || []

  // ---- carregar ----
  useEffect(() => { dbGet('fin_contas').then(l => setContas(l.sort((a, b) => a.ordem - b.ordem))) }, [])

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    Promise.all([
      dbGet('fin_contribuicoes', { mes_ref: ref }),
      dbGet('fin_despesas', { mes_ref: ref }),
      dbGet('fin_depositos', { mes_ref: ref }),
      dbGet('fin_meses', { ref }),
    ]).then(([c, d, dep, m]) => {
      if (!vivo) return
      setContrib(c); setDespesas(d); setDepositos(dep); setMesInfo(m[0] || null)
      setCarregando(false)
    })
    return () => { vivo = false }
  }, [ref])

  const chM = (d) => { let m = mes + d, a = ano; if (m > 11) { m = 0; a++ } if (m < 0) { m = 11; a-- } setMes(m); setAno(a) }

  // Saldo do caixa local no fim do mês anterior. Guardado no próprio mês para
  // não precisar recalcular o histórico inteiro toda vez que a tela abre.
  const saldoAnterior = Number(mesInfo?.saldo_caixa_anterior) || 0

  const r = useMemo(
    () => fecharMes({ contas, contribuicoes: contrib, despesas, depositos, saldoAnterior }),
    [contas, contrib, despesas, depositos, saldoAnterior]
  )
  const recibos = useMemo(() => faixaRecibos(contrib), [contrib])

  // ---- gravar ----
  const abrirReceb = () => {
    const dizimo = contasR.find(c => c.papel === 'dizimo')
    setForm({ data: hojeISO(), conta_id: dizimo?.id || contasR[0]?.id, membro_id: '', nome: '', valor: '', recibo: '', forma: 'dinheiro', pro_caixa_local: false })
    setModal('receb')
  }
  const abrirDesp = () => {
    setForm({ data: hojeISO(), conta_id: contasD[0]?.id, descricao: '', valor: '', pago_por: contasD[0]?.paga_por_padrao || 'regiao', finalidade: '', tem_nota: false })
    setModal('desp')
  }
  const abrirRemessa = () => {
    setForm({ data: hojeISO(), identificacao: '', valor: '', tipo: 'deposito' })
    setModal('remessa')
  }

  const trocarContaDesp = (id) => {
    const c = porId.get(Number(id))
    setForm(f => ({ ...f, conta_id: Number(id), pago_por: c?.paga_por_padrao || f.pago_por }))
  }
  const trocarContaReceb = (id) => {
    const c = porId.get(Number(id))
    setForm(f => ({ ...f, conta_id: Number(id), pro_caixa_local: !!c?.alimenta_caixa }))
  }

  const salvar = async () => {
    if (fechado) return aviso('⚠ Mês fechado. Reabra para lançar.')
    const valor = parseFloat(String(form.valor).replace(',', '.'))
    if (!valor || valor <= 0) return aviso('⚠ Informe um valor.')
    setSalvando(true)
    try {
      if (modal === 'receb') {
        const conta = porId.get(Number(form.conta_id))
        if (conta?.recebe_recibo && !form.membro_id && !String(form.nome).trim()) {
          setSalvando(false); return aviso('⚠ Dízimo precisa do nome de quem contribuiu.')
        }
        const nomePessoa = form.membro_id
          ? (pessoas.find(p => String(p.id) === String(form.membro_id))?.nome || '')
          : String(form.nome).trim()
        const row = {
          mes_ref: ref, data: form.data || ref, conta_id: Number(form.conta_id),
          membro_id: form.membro_id ? Number(form.membro_id) : null,
          nome: form.membro_id ? null : (nomePessoa || null),
          valor, recibo: String(form.recibo).trim() || null,
          forma: form.forma, pro_caixa_local: !!form.pro_caixa_local,
          criado_por: user?.id || null,
        }
        const novo = await dbInsert('fin_contribuicoes', row, `${conta?.nome} ${fmt(valor)} — ${nomePessoa || 'avulso'}`)
        setContrib(l => [...l, { ...row, id: novo?.id || Date.now() }])
      } else if (modal === 'desp') {
        if (!String(form.descricao).trim()) { setSalvando(false); return aviso('⚠ Descreva a despesa.') }
        const conta = porId.get(Number(form.conta_id))
        const row = {
          mes_ref: ref, data: form.data || null, conta_id: Number(form.conta_id),
          descricao: String(form.descricao).trim(), valor,
          pago_por: form.pago_por, finalidade: form.pago_por === 'local' ? (form.finalidade || null) : null,
          tem_nota: !!form.tem_nota, criado_por: user?.id || null,
        }
        const novo = await dbInsert('fin_despesas', row, `${conta?.nome} ${fmt(valor)}`)
        setDespesas(l => [...l, { ...row, id: novo?.id || Date.now() }])
      } else {
        const row = {
          mes_ref: ref, data: form.data || null,
          identificacao: String(form.identificacao).trim() || null,
          valor, tipo: form.tipo, criado_por: user?.id || null,
        }
        const novo = await dbInsert('fin_depositos', row, `Remessa ${fmt(valor)}`)
        setDepositos(l => [...l, { ...row, id: novo?.id || Date.now() }])
      }
      setModal(null); aviso('Lançado.')
    } finally { setSalvando(false) }
  }

  const excluir = async (tabela, id, setter, desc) => {
    if (fechado) return aviso('⚠ Mês fechado. Reabra para alterar.')
    if (!confirm(`Apagar ${desc}?`)) return
    await dbDelete(tabela, id, desc)
    setter(l => l.filter(x => x.id !== id))
  }

  // ---- fechar / reabrir o mês ----
  const alternarFechamento = async () => {
    if (fechado) {
      if (!confirm('Reabrir o mês para alterar os lançamentos?')) return
      const m = await dbUpdate('fin_meses', mesInfo.id, { status: 'aberto', fechado_em: null }, `Reabriu ${MESES[mes]}/${ano}`)
      setMesInfo(m || { ...mesInfo, status: 'aberto' })
      return aviso('Mês reaberto.')
    }
    if (r.avisos.length && !confirm(`Há ${r.avisos.length} aviso(s) em aberto. Fechar assim mesmo?`)) return
    const dados = {
      ref, status: 'fechado', saldo_caixa_anterior: saldoAnterior,
      recibo_inicial: recibos.inicial, recibo_final: recibos.final,
      fechado_em: new Date().toISOString(), fechado_por: user?.id || null,
    }
    const m = mesInfo
      ? await dbUpdate('fin_meses', mesInfo.id, dados, `Fechou ${MESES[mes]}/${ano}`)
      : await dbInsert('fin_meses', dados, `Fechou ${MESES[mes]}/${ano}`)
    setMesInfo(m || { ...dados, id: mesInfo?.id })
    aviso('Mês fechado.')
  }

  const nomeDe = (c) => c.membro_id
    ? (pessoas.find(p => String(p.id) === String(c.membro_id))?.nome || '(membro removido)')
    : (c.nome || '—')

  const th = { background: 'var(--s2)', padding: '8px 12px', textAlign: 'left', fontSize: 9, fontWeight: 600, color: 'var(--g)', letterSpacing: 1.5, textTransform: 'uppercase' }
  const td = { padding: '9px 12px', fontSize: 12.5 }

  if (carregando) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--g)', fontSize: 13 }}>Carregando…</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <MonthNav month={mes} year={ano} onPrev={() => chM(-1)} onNext={() => chM(1)} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {fechado && <Tag color="green">MÊS FECHADO</Tag>}
          <Btn variant="outline" onClick={() => window.print()}><Printer size={15} /> Imprimir</Btn>
          <Btn variant={fechado ? 'outline' : 'cyan'} onClick={alternarFechamento}>
            <Lock size={15} /> {fechado ? 'Reabrir mês' : 'Fechar mês'}
          </Btn>
        </div>
      </div>

      {/* resumo sempre visível */}
      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
        {[
          ['Entradas (TR)', fmt(r.totalEntradas), 'var(--grn)'],
          ['Saídas (TD)', fmt(r.totalSaidas), 'var(--red)'],
          ['Saldo p/ remessa', fmt(r.saldoRemessa), 'var(--cy)'],
          ['Falta remeter', fmt(r.faltaRemeter), r.faltaRemeter > 0.005 ? 'var(--yel)' : 'var(--grn)'],
          ['Caixa local', fmt(r.saldoCaixa), 'var(--w)'],
        ].map(([l, v, c]) => (
          <div key={l} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 8.5, color: 'var(--g)', letterSpacing: 1.5, textTransform: 'uppercase' }}>{l}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: c, marginTop: 3 }}>{v}</div>
          </div>
        ))}
      </div>

      {!!r.avisos.length && (
        <div className="no-print" style={{ background: 'rgba(216,162,74,.10)', border: '1px solid rgba(216,162,74,.35)', borderRadius: 10, padding: '10px 13px', marginBottom: 14 }}>
          {r.avisos.map((a, i) => (
            <div key={i} style={{ fontSize: 12.5, color: 'var(--yel)', display: 'flex', gap: 7, alignItems: 'flex-start', marginTop: i ? 5 : 0 }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {a}
            </div>
          ))}
        </div>
      )}

      <div className="no-print">
        <Tabs
          active={aba} onChange={setAba}
          tabs={[
            { id: 'receb', label: `Recebimentos (${contrib.length})` },
            { id: 'desp', label: `Despesas (${despesas.length})` },
            { id: 'remessa', label: `Remessa (${depositos.length})` },
            { id: 'caixa', label: 'Caixa Local' },
          ]}
        />
      </div>

      {/* ---------------- RECEBIMENTOS ---------------- */}
      {aba === 'receb' && (
        <div className="no-print">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <Btn onClick={abrirReceb} disabled={fechado}><Plus size={15} /> Recebimento</Btn>
          </div>
          <div className="table-scroll" style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Data', 'Quem', 'Conta', 'Recibo', 'Forma', 'Valor', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {contrib.length === 0
                  ? <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--g)', padding: 22, fontSize: 13 }}>Nada recebido em {MESES[mes]}.</td></tr>
                  : [...contrib].sort((a, b) => String(a.data).localeCompare(String(b.data))).map(c => (
                    <tr key={c.id} style={{ borderTop: '1px solid var(--bd)' }}>
                      <td style={td}>{c.data ? new Date(c.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                      <td style={td}>{nomeDe(c)}</td>
                      <td style={td}>
                        <Tag color="gray">{porId.get(c.conta_id)?.nome || '?'}</Tag>
                        {c.pro_caixa_local && <span style={{ marginLeft: 6 }}><Tag color="cyan">fica no caixa</Tag></span>}
                      </td>
                      <td style={td}>{c.recibo || '—'}</td>
                      <td style={td}>{c.forma === 'pix_regiao' ? 'Pix p/ Região' : c.forma}</td>
                      <td style={{ ...td, fontWeight: 600, color: 'var(--grn)' }}>{fmt(c.valor)}</td>
                      <td style={td}>{!fechado && <Btn variant="danger" size="xs" onClick={() => excluir('fin_contribuicoes', c.id, setContrib, `recebimento de ${nomeDe(c)}`)}><Trash2 size={13} /></Btn>}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {recibos.quantidade > 0 && (
            <div style={{ fontSize: 12, color: 'var(--g)', marginTop: 9 }}>
              Recibos usados: <b style={{ color: 'var(--tx)' }}>{recibos.inicial} a {recibos.final}</b> — {recibos.quantidade} no total.
            </div>
          )}
        </div>
      )}

      {/* ---------------- DESPESAS ---------------- */}
      {aba === 'desp' && (
        <div className="no-print">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: 'var(--g)' }}>
              Região pagou <b style={{ color: 'var(--tx)' }}>{fmt(r.pagoRegiao)}</b> · Caixa local pagou <b style={{ color: 'var(--tx)' }}>{fmt(r.pagoLocal)}</b>
            </div>
            <Btn onClick={abrirDesp} disabled={fechado}><Plus size={15} /> Despesa</Btn>
          </div>
          <div className="table-scroll" style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Data', 'Descrição', 'Conta', 'Quem pagou', 'Finalidade', 'NF', 'Valor', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {despesas.length === 0
                  ? <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--g)', padding: 22, fontSize: 13 }}>Nenhuma despesa em {MESES[mes]}.</td></tr>
                  : [...despesas].sort((a, b) => String(a.data).localeCompare(String(b.data))).map(d => (
                    <tr key={d.id} style={{ borderTop: '1px solid var(--bd)' }}>
                      <td style={td}>{d.data ? new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                      <td style={td}>{d.descricao}</td>
                      <td style={td}><Tag color="gray">{porId.get(d.conta_id)?.nome || '?'}</Tag></td>
                      <td style={td}><Tag color={d.pago_por === 'local' ? 'cyan' : 'gray'}>{d.pago_por === 'local' ? 'CAIXA LOCAL' : 'REGIÃO'}</Tag></td>
                      <td style={td}>{d.finalidade || '—'}</td>
                      <td style={td}>{d.pago_por === 'local' ? (d.tem_nota ? '✓' : <span style={{ color: 'var(--yel)' }}>falta</span>) : '—'}</td>
                      <td style={{ ...td, fontWeight: 600, color: 'var(--red)' }}>{fmt(d.valor)}</td>
                      <td style={td}>{!fechado && <Btn variant="danger" size="xs" onClick={() => excluir('fin_despesas', d.id, setDespesas, `despesa "${d.descricao}"`)}><Trash2 size={13} /></Btn>}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- REMESSA ---------------- */}
      {aba === 'remessa' && (
        <div className="no-print">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: 'var(--g)' }}>
              Devido à Região <b style={{ color: 'var(--tx)' }}>{fmt(r.saldoRemessa)}</b> · já enviado <b style={{ color: 'var(--tx)' }}>{fmt(r.depositado)}</b>
              {r.faltaRemeter > 0.005 && <> · <b style={{ color: 'var(--yel)' }}>falta {fmt(r.faltaRemeter)}</b></>}
            </div>
            <Btn onClick={abrirRemessa} disabled={fechado}><Plus size={15} /> Envio</Btn>
          </div>
          <div className="table-scroll" style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Data', 'Identificação', 'Tipo', 'Valor', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {depositos.length === 0
                  ? <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--g)', padding: 22, fontSize: 13 }}>Nada enviado ainda.</td></tr>
                  : [...depositos].sort((a, b) => String(a.data).localeCompare(String(b.data))).map(d => (
                    <tr key={d.id} style={{ borderTop: '1px solid var(--bd)' }}>
                      <td style={td}>{d.data ? new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                      <td style={td}>{d.identificacao || '—'}</td>
                      <td style={td}><Tag color="gray">{d.tipo === 'pix_direto' ? 'PIX' : d.tipo}</Tag></td>
                      <td style={{ ...td, fontWeight: 600 }}>{fmt(d.valor)}</td>
                      <td style={td}>{!fechado && <Btn variant="danger" size="xs" onClick={() => excluir('fin_depositos', d.id, setDepositos, `envio de ${fmt(d.valor)}`)}><Trash2 size={13} /></Btn>}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 12, color: 'var(--g)', marginTop: 9 }}>
            A remessa de um mês costuma ser paga no mês seguinte — use a data real do envio.
            O lançamento continua contando para {MESES[mes]}.
          </div>
        </div>
      )}

      {/* ---------------- CAIXA LOCAL ---------------- */}
      {aba === 'caixa' && (
        <div className="no-print">
          <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: 16, marginBottom: 14 }}>
            {[
              ['Saldo do mês anterior', r.saldoAnterior, 'var(--tx)'],
              ['+ Concessão (5% do dízimo de ' + fmt(r.dizimoBruto) + ')', r.concessao, 'var(--grn)'],
              ...(r.ofertasQueFicam ? [['+ Ofertas que ficaram na igreja', r.ofertasQueFicam, 'var(--grn)']] : []),
              ['− Gasto pela igreja (baixa de concessão)', -r.baixa, 'var(--red)'],
            ].map(([l, v, c]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, gap: 12 }}>
                <span style={{ color: 'var(--gl)' }}>{l}</span>
                <span style={{ color: c, fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(v)}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--bd)', marginTop: 8, paddingTop: 10, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--w)' }}>Saldo atual do caixa local</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--cy)' }}>{fmt(r.saldoCaixa)}</span>
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--g)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
            No que a igreja gastou — por finalidade
          </div>
          {porFinalidade(despesas).length === 0
            ? <Empty text="A igreja não gastou do caixa local neste mês." />
            : porFinalidade(despesas).map(g => (
              <div key={g.finalidade} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: 13, marginBottom: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 12 }}>
                  <b style={{ fontSize: 13, color: 'var(--w)' }}>{g.finalidade}</b>
                  <b style={{ fontSize: 13, color: 'var(--cy)', whiteSpace: 'nowrap' }}>{fmt(g.total)}</b>
                </div>
                {g.itens.map(i => (
                  <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--gl)', padding: '2px 0', gap: 12 }}>
                    <span>{i.descricao}</span><span style={{ whiteSpace: 'nowrap' }}>{fmt(i.valor)}</span>
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}

      {/* ---------------- IMPRESSÃO: relatório oficial ---------------- */}
      <RelatorioImpressao
        mes={mes} ano={ano} contas={contas} r={r} recibos={recibos}
        contrib={contrib} nomeDe={nomeDe} depositos={depositos}
      />

      {/* ---------------- MODAIS ---------------- */}
      {modal === 'receb' && (
        <Modal title="Recebimento" onClose={() => setModal(null)}
          footer={<><Btn variant="outline" onClick={() => setModal(null)}>Cancelar</Btn><Btn onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Btn></>}>
          <FormGrid>
            <FG><label>Data</label><CampoData valor={form.data} onChange={v => setForm({ ...form, data: v })} /></FG>
            <FG><label>Conta</label>
              <select value={form.conta_id} onChange={e => trocarContaReceb(e.target.value)}>
                {contasR.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </FG>
            <FG full><label>Quem contribuiu</label>
              <select value={form.membro_id} onChange={e => setForm({ ...form, membro_id: e.target.value })}>
                <option value="">— digitar o nome / oferta avulsa —</option>
                {[...pessoas].sort((a, b) => a.nome.localeCompare(b.nome)).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </FG>
            {!form.membro_id && (
              <FG full><label>Nome (se não for do cadastro)</label>
                <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="deixe vazio se for oferta do culto" />
              </FG>
            )}
            <FG><label>Valor (R$)</label><input type="number" step="0.01" inputMode="decimal" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} /></FG>
            <FG><label>Nº do recibo</label><input value={form.recibo} onChange={e => setForm({ ...form, recibo: e.target.value })} placeholder="ex.: 41013" /></FG>
            <FG><label>Forma</label>
              <select value={form.forma} onChange={e => setForm({ ...form, forma: e.target.value })}>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">Pix para a igreja</option>
                <option value="pix_regiao">Pix direto para a Região</option>
                <option value="transferencia">Transferência</option>
                <option value="cheque">Cheque</option>
              </select>
            </FG>
            <FG><label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', marginTop: 20 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={!!form.pro_caixa_local} onChange={e => setForm({ ...form, pro_caixa_local: e.target.checked })} />
              Esse valor fica no caixa local
            </label></FG>
          </FormGrid>
        </Modal>
      )}

      {modal === 'desp' && (
        <Modal title="Despesa" onClose={() => setModal(null)}
          footer={<><Btn variant="outline" onClick={() => setModal(null)}>Cancelar</Btn><Btn onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Btn></>}>
          <FormGrid>
            <FG><label>Data</label><CampoData valor={form.data} onChange={v => setForm({ ...form, data: v })} /></FG>
            <FG><label>Conta</label>
              <select value={form.conta_id} onChange={e => trocarContaDesp(e.target.value)}>
                {contasD.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </FG>
            <FG full><label>Descrição</label><input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="ex.: cimento para a obra do corredor" /></FG>
            <FG><label>Valor (R$)</label><input type="number" step="0.01" inputMode="decimal" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} /></FG>
            <FG><label>Quem pagou</label>
              <select value={form.pago_por} onChange={e => setForm({ ...form, pago_por: e.target.value })}>
                <option value="regiao">Região</option>
                <option value="local">Caixa local (concessão)</option>
              </select>
            </FG>
            {form.pago_por === 'local' && (<>
              <FG><label>Finalidade (para a prestação de contas)</label>
                <select value={form.finalidade} onChange={e => setForm({ ...form, finalidade: e.target.value })}>
                  <option value="">— escolher —</option>
                  {FINALIDADES.map(f => <option key={f}>{f}</option>)}
                </select>
              </FG>
              <FG><label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', marginTop: 20 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={!!form.tem_nota} onChange={e => setForm({ ...form, tem_nota: e.target.checked })} />
                Tenho a nota fiscal
              </label></FG>
            </>)}
          </FormGrid>
          <div style={{ fontSize: 12, color: 'var(--g)', marginTop: 10 }}>
            O que a igreja paga do caixa local vira automaticamente a “Baixa de Concessão” no relatório.
            Você não precisa lançar isso à mão.
          </div>
        </Modal>
      )}

      {modal === 'remessa' && (
        <Modal title="Envio para a Região" onClose={() => setModal(null)}
          footer={<><Btn variant="outline" onClick={() => setModal(null)}>Cancelar</Btn><Btn onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Btn></>}>
          <FormGrid>
            <FG><label>Data do envio</label><CampoData valor={form.data} onChange={v => setForm({ ...form, data: v })} /></FG>
            <FG><label>Tipo</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                <option value="deposito">Depósito</option>
                <option value="pix_direto">Pix</option>
                <option value="cheque">Cheque</option>
                <option value="acerto">Acerto mensal</option>
              </select>
            </FG>
            <FG full><label>Identificação</label><input value={form.identificacao} onChange={e => setForm({ ...form, identificacao: e.target.value })} placeholder="ex.: saldo de julho enviado por Pix" /></FG>
            <FG><label>Valor (R$)</label><input type="number" step="0.01" inputMode="decimal" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} /></FG>
          </FormGrid>
          <div style={{ fontSize: 12, color: 'var(--g)', marginTop: 10 }}>
            Falta enviar deste mês: <b style={{ color: 'var(--tx)' }}>{fmt(r.faltaRemeter)}</b>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ============================================================
//  A folha que vai para a Convenção — só aparece na impressão.
// ============================================================
function RelatorioImpressao({ mes, ano, contas, r, recibos, contrib, nomeDe, depositos }) {
  const linhas = (lado) => contas.filter(c => c.lado === lado && c.ativo).sort((a, b) => a.ordem - b.ordem)
  const valor = (c) => c.lado === 'R' ? r.entradasPorConta.get(c.id) : r.saidasPorConta.get(c.id)
  const perc = (v, tot) => tot ? Math.round((Number(v) || 0) / tot * 100) + '%' : '0%'
  const ultimo = new Date(ano, mes + 1, 0).getDate()
  const dizimistas = contrib.filter(c => contas.find(x => x.id === c.conta_id)?.recebe_recibo)

  const tdp = { padding: '2px 5px', border: '1px solid #bbb', fontSize: 9 }
  const num = { ...tdp, textAlign: 'right', whiteSpace: 'nowrap' }

  return (
    <div className="print-mapa">
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 12 }}>
        CONVENÇÃO REGIONAL RIO DE JANEIRO E ESPÍRITO SANTO DAS IGREJAS
      </div>
      <div style={{ textAlign: 'center', fontSize: 10, marginBottom: 6 }}>CNPJ Nº 30.228.769/0001-22</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 8 }}>
        <span><b>PERÍODO:</b> 01/{String(mes + 1).padStart(2, '0')}/{ano} a {ultimo}/{String(mes + 1).padStart(2, '0')}/{ano}</span>
        <span><b>511 - LAGO DOS PEIXES - RJ</b></span>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        {/* entradas */}
        <table style={{ width: '38%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={tdp}>Contribuições (Entradas)</th><th style={tdp}>Cód.</th><th style={tdp}>Sub-Totais</th><th style={tdp}>Perc</th></tr></thead>
          <tbody>
            {linhas('R').map(c => (
              <tr key={c.id}><td style={tdp}>{c.nome}</td><td style={tdp}>R {c.codigo}</td>
                <td style={num}>{valor(c) ? Number(valor(c)).toFixed(2) : ''}</td>
                <td style={num}>{perc(valor(c), r.totalEntradas)}</td></tr>
            ))}
            <tr><td style={{ ...tdp, fontWeight: 700 }}>TOTAL DAS ENTRADAS (TR)</td><td style={tdp}></td>
              <td style={{ ...num, fontWeight: 700 }}>{r.totalEntradas.toFixed(2)}</td><td style={num}></td></tr>
            <tr><td style={{ ...tdp, fontWeight: 700 }}>SALDO PARA REMESSA (TR − TD)</td><td style={tdp}></td>
              <td style={{ ...num, fontWeight: 700 }}>{r.saldoRemessa.toFixed(2)}</td>
              <td style={num}>{perc(r.saldoRemessa, r.totalEntradas)}</td></tr>
          </tbody>
        </table>

        {/* saídas */}
        <table style={{ width: '34%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={tdp}>Despesas (Saídas)</th><th style={tdp}>Cód.</th><th style={tdp}>Valor</th><th style={tdp}>Perc</th></tr></thead>
          <tbody>
            {linhas('D').map(c => (
              <tr key={c.id}><td style={tdp}>{c.nome}</td><td style={tdp}>D {c.codigo}</td>
                <td style={num}>{valor(c) ? Number(valor(c)).toFixed(2) : ''}</td>
                <td style={num}>{perc(valor(c), r.totalEntradas)}</td></tr>
            ))}
            <tr><td style={{ ...tdp, fontWeight: 700 }}>TOTAL DAS SAÍDAS (TD)</td><td style={tdp}></td>
              <td style={{ ...num, fontWeight: 700 }}>{r.totalSaidas.toFixed(2)}</td>
              <td style={num}>{perc(r.totalSaidas, r.totalEntradas)}</td></tr>
          </tbody>
        </table>

        {/* dizimistas */}
        <table style={{ width: '28%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={tdp}>DIZIMISTAS</th><th style={tdp}>RECIBO</th><th style={tdp}>VALOR</th></tr></thead>
          <tbody>
            {dizimistas.map(c => (
              <tr key={c.id}><td style={tdp}>{nomeDe(c)}</td><td style={tdp}>{c.recibo || ''}</td>
                <td style={num}>{Number(c.valor).toFixed(2)}</td></tr>
            ))}
            <tr><td style={{ ...tdp, fontWeight: 700 }}>TOTAL</td><td style={tdp}></td>
              <td style={{ ...num, fontWeight: 700 }}>{r.dizimoBruto.toFixed(2)}</td></tr>
          </tbody>
        </table>
      </div>

      {/* rodapé */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <table style={{ width: '50%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={tdp} colSpan="3">IDENTIFICAÇÃO DOS DEPÓSITOS</th></tr></thead>
          <tbody>
            {depositos.map(d => (
              <tr key={d.id}><td style={tdp}>{d.data ? new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</td>
                <td style={tdp}>{d.identificacao || ''}</td><td style={num}>{Number(d.valor).toFixed(2)}</td></tr>
            ))}
            <tr><td style={{ ...tdp, fontWeight: 700 }} colSpan="2">TOTAL DA REMESSA (TRE)</td>
              <td style={{ ...num, fontWeight: 700 }}>{r.depositado.toFixed(2)}</td></tr>
          </tbody>
        </table>
        <table style={{ width: '50%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td style={tdp}>Saldo anterior caixa local</td><td style={tdp}>3114</td><td style={num}>{r.saldoAnterior.toFixed(2)}</td></tr>
            <tr><td style={tdp}>Saldo atual caixa local</td><td style={tdp}>3114</td><td style={num}>{r.saldoCaixa.toFixed(2)}</td></tr>
            <tr><td style={{ ...tdp, fontWeight: 700 }}>SALDO PARA REMESSA</td><td style={tdp}></td>
              <td style={{ ...num, fontWeight: 700 }}>{r.faltaRemeter.toFixed(2)}</td></tr>
            <tr><td style={tdp}>Nº do Recibo Inicial</td><td style={tdp} colSpan="2">{recibos.inicial}</td></tr>
            <tr><td style={tdp}>Nº do Recibo Final</td><td style={tdp} colSpan="2">{recibos.final}</td></tr>
            <tr><td style={tdp}>Quantidade de Recibos Utilizados</td><td style={tdp} colSpan="2">{recibos.quantidade}</td></tr>
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 8, marginTop: 6 }}>1ª Via Convenção · 2ª Via Igreja · 3ª Via Contribuinte</div>
    </div>
  )
}
