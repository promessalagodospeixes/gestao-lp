import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbGet, dbInsert, dbDelete, dbUpdate, emitirRecibos, assinarMes, reabrirMes, estornarRecibo } from '../lib/supabase.js'
import { MESES } from '../lib/utils.js'
import { fecharMes, faixaRecibos, porFinalidade, refDoMes, fmt } from '../lib/tesouraria.js'
import { MonthNav, Btn, Modal, FormGrid, FG, Tag, Empty, Tabs } from '../components/UI.jsx'
import CampoData from '../components/CampoData.jsx'
import { Plus, Trash2, Printer, AlertTriangle, Lock, Unlock, Pencil, Check } from 'lucide-react'

// As categorias que a igreja entende na prestação de contas do fim do ano.
// A explicação aparece na tela para ninguém lançar no lugar errado — a fronteira
// entre Obra e Patrimônio é a que mais confunde.
const FINALIDADES = [
  ['Obra', 'Cimento, areia, pedra, tinta, ferramenta — o que vira parede'],
  ['Patrimônio', 'Bens que ficam: guitarra, projetor, tela de LED, computador'],
  ['Evento', 'Vigília, programação, congresso — comida, decoração, estrutura'],
  ['Ceia', 'O que a igreja paga da ceia (a decoração; os elementos são da Região)'],
  ['Ministério Infantil', 'Material, lembrança, lanche das crianças'],
  ['Louvor', 'Corda, palheta, cabo, manutenção de instrumento'],
  ['Manutenção', 'Conserto e reposição do que já existe'],
  ['Evangelismo', 'Panfleto, banner, ação de rua'],
  ['Literatura', 'Bíblia, revista, livro'],
  ['Assistência Social', 'Cesta básica, ajuda a família'],
  ['Outro', 'Quando nenhuma das de cima serve'],
]
const NOMES_FINALIDADE = FINALIDADES.map(([n]) => n)

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
  const [modal, setModal] = useState(null)      // 'receb' | 'desp' | 'remessa'
  const [editando, setEditando] = useState(null) // id do registro em edição (null = novo)
  const [form, setForm] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [dizAberto, setDizAberto] = useState(false) // Recebimentos: dízimos ficam recolhidos (privacidade)
  const [visao, setVisao] = useState('mensal')      // 'mensal' | 'global' (seletor no topo)

  const ref = refDoMes(ano, mes)
  const fechado = mesInfo?.status === 'fechado'
  const historico = !!mesInfo?.historico  // 2023/2024: números travados, sem detalhe do caixa local
  const aviso = (t) => dispatch({ type: 'TOAST', value: t })

  const contasR = useMemo(() => contas.filter(c => c.lado === 'R' && c.papel !== 'baixa' && c.ativo), [contas])
  const contasD = useMemo(() => contas.filter(c => c.lado === 'D' && c.papel !== 'concessao' && c.ativo), [contas])
  const porId = useMemo(() => new Map(contas.map(c => [c.id, c])), [contas])
  const pessoas = (membrosTodos?.length ? membrosTodos : membros) || []

  // Recebimentos separados: dízimo (tem dono, é sigiloso) x oferta (sem dono).
  const dizimosMes = useMemo(() => contrib.filter(c => porId.get(c.conta_id)?.recebe_recibo), [contrib, porId])
  const outrosReceb = useMemo(() => contrib.filter(c => !porId.get(c.conta_id)?.recebe_recibo), [contrib, porId])
  const totalDizMes = useMemo(() => dizimosMes.reduce((a, c) => a + (c.estornado_em ? 0 : Number(c.valor) || 0), 0), [dizimosMes])

  // ---- carregar ----
  useEffect(() => { dbGet('fin_contas').then(l => setContas(l.sort((a, b) => a.ordem - b.ordem))) }, [])

  const [saldoHerdado, setSaldoHerdado] = useState(null) // saldo puxado do mês anterior

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    setSaldoHerdado(null)
    // Mês anterior (para puxar o saldo do caixa local automaticamente)
    const pm = mes === 0 ? 11 : mes - 1
    const pa = mes === 0 ? ano - 1 : ano
    const refAnt = refDoMes(pa, pm)
    Promise.all([
      dbGet('fin_contribuicoes', { mes_ref: ref }),
      dbGet('fin_despesas', { mes_ref: ref }),
      dbGet('fin_depositos', { mes_ref: ref }),
      dbGet('fin_meses', { ref }),
      dbGet('fin_meses', { ref: refAnt }),
      dbGet('fin_contribuicoes', { mes_ref: refAnt }),
      dbGet('fin_despesas', { mes_ref: refAnt }),
    ]).then(([c, d, dep, m, mAnt, cAnt, dAnt]) => {
      if (!vivo) return
      setContrib(c); setDespesas(d); setDepositos(dep); setMesInfo(m[0] || null)
      // O saldo que fecha o mês anterior é a abertura deste. Calculado na hora,
      // a partir do próprio mês anterior — assim a corrente nunca fica presa.
      if (mAnt[0]) {
        const fechAnt = fecharMes({
          contas, contribuicoes: cAnt, despesas: dAnt, depositos: [],
          saldoAnterior: Number(mAnt[0].saldo_caixa_anterior) || 0,
        })
        setSaldoHerdado(fechAnt.saldoCaixa)
      } else {
        setSaldoHerdado(null) // não há mês anterior no sistema (começo do histórico)
      }
      setCarregando(false)
    })
    return () => { vivo = false }
  }, [ref, contas])

  const chM = (d) => { let m = mes + d, a = ano; if (m > 11) { m = 0; a++ } if (m < 0) { m = 11; a-- } setMes(m); setAno(a) }

  // Saldo do caixa local no início do mês. Prioridade:
  // 1) o que já ficou gravado neste mês (mês antigo/importado ou já assinado);
  // 2) senão, o saldo que fechou o mês anterior — puxado automaticamente.
  const saldoAnterior = mesInfo?.saldo_caixa_anterior != null
    ? Number(mesInfo.saldo_caixa_anterior)
    : (saldoHerdado || 0)

  const r = useMemo(
    () => fecharMes({ contas, contribuicoes: contrib, despesas, depositos, saldoAnterior, historico }),
    [contas, contrib, despesas, depositos, saldoAnterior, historico]
  )
  const recibos = useMemo(() => faixaRecibos(contrib), [contrib])

  // ---- gravar ----
  const abrirReceb = () => {
    const dizimo = contasR.find(c => c.papel === 'dizimo')
    setEditando(null)
    setForm({ data: hojeISO(), conta_id: dizimo?.id || contasR[0]?.id, membro_id: '', nome: '', valor: '', recibo: '', forma: 'dinheiro', pro_caixa_local: false })
    setModal('receb')
  }
  const abrirDesp = () => {
    setEditando(null)
    setForm({ data: hojeISO(), conta_id: contasD[0]?.id, descricao: '', valor: '', pago_por: contasD[0]?.paga_por_padrao || 'regiao', finalidade: '', tem_nota: false })
    setModal('desp')
  }
  const abrirRemessa = () => {
    setEditando(null)
    setForm({ data: hojeISO(), identificacao: '', valor: '', tipo: 'deposito' })
    setModal('remessa')
  }

  // Abre o mesmo formulário já preenchido, para corrigir em vez de apagar e refazer.
  const editarReceb = (c) => {
    if (c.codigo_recibo) return aviso(`⚠ Recibo ${c.codigo_recibo} já emitido. Só por estorno.`)
    setEditando(c.id)
    setForm({
      data: c.data || '', conta_id: c.conta_id, membro_id: c.membro_id ? String(c.membro_id) : '',
      nome: c.nome || '', valor: c.valor ?? '', recibo: c.recibo || '',
      forma: c.forma || 'dinheiro', pro_caixa_local: !!c.pro_caixa_local,
    })
    setModal('receb')
  }
  const editarDesp = (d) => {
    setEditando(d.id)
    setForm({
      data: d.data || '', conta_id: d.conta_id, descricao: d.descricao || '', valor: d.valor ?? '',
      pago_por: d.pago_por || 'regiao', finalidade: d.finalidade || '', tem_nota: !!d.tem_nota,
    })
    setModal('desp')
  }
  const editarRemessa = (d) => {
    setEditando(d.id)
    setForm({ data: d.data || '', identificacao: d.identificacao || '', valor: d.valor ?? '', tipo: d.tipo || 'deposito' })
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
    // Guarda quando é correção: o mesmo formulário grava por cima em vez de criar.
    const gravar = async (tabela, row, setter, desc) => {
      if (editando) {
        const r = await dbUpdate(tabela, editando, row, `Corrigiu ${desc}`)
        if (r?.erro || r?._err) { aviso(`⚠ ${r.erro || 'Não foi possível salvar.'}`); return false }
        setter(l => l.map(x => (x.id === editando ? { ...x, ...row, id: editando } : x)))
      } else {
        const novo = await dbInsert(tabela, row, desc)
        setter(l => [...l, { ...row, id: novo?.id || Date.now() }])
      }
      return true
    }
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
        if (!(await gravar('fin_contribuicoes', row, setContrib, `${conta?.nome} ${fmt(valor)} — ${nomePessoa || 'avulso'}`))) { setSalvando(false); return }
      } else if (modal === 'desp') {
        if (!String(form.descricao).trim()) { setSalvando(false); return aviso('⚠ Descreva a despesa.') }
        const conta = porId.get(Number(form.conta_id))
        const row = {
          mes_ref: ref, data: form.data || null, conta_id: Number(form.conta_id),
          descricao: String(form.descricao).trim(), valor,
          pago_por: form.pago_por, finalidade: form.pago_por === 'local' ? (form.finalidade || null) : null,
          tem_nota: !!form.tem_nota, criado_por: user?.id || null,
        }
        if (!(await gravar('fin_despesas', row, setDespesas, `${conta?.nome} ${fmt(valor)}`))) { setSalvando(false); return }
      } else {
        const row = {
          mes_ref: ref, data: form.data || null,
          identificacao: String(form.identificacao).trim() || null,
          valor, tipo: form.tipo, criado_por: user?.id || null,
        }
        if (!(await gravar('fin_depositos', row, setDepositos, `Remessa ${fmt(valor)}`))) { setSalvando(false); return }
      }
      setModal(null); aviso(editando ? 'Corrigido.' : 'Lançado.'); setEditando(null)
    } finally { setSalvando(false) }
  }

  const estornar = async (c) => {
    const motivo = prompt(`Estornar o recibo ${c.codigo_recibo}?\n\nEle deixa de contar, mas fica no histórico e no cadastro da pessoa como cancelado. Escreva o motivo:`)
    if (motivo === null) return
    if (String(motivo).trim().length < 5) return aviso('⚠ Escreva o motivo.')
    const res = await estornarRecibo(c.id, motivo)
    if (res?.erro) return aviso(`⚠ ${res.erro}`)
    setContrib(l => l.map(x => (x.id === c.id ? { ...x, ...res.contribuicao } : x)))
    aviso('Recibo estornado.')
  }

  const excluir = async (tabela, id, setter, desc) => {
    if (fechado) return aviso('⚠ Mês fechado. Reabra para alterar.')
    if (!confirm(`Apagar ${desc}?`)) return
    await dbDelete(tabela, id, desc)
    setter(l => l.filter(x => x.id !== id))
  }

  // ---- assinar / reabrir o mês ----
  // Duas assinaturas, como na ata: o tesoureiro confere, o pastor aprova.
  // Só com as duas o mês fecha e os recibos são emitidos.
  const ehPastor = user?.perfil === 'pastor'
  const minhaAssinatura = ehPastor ? mesInfo?.assinatura_pastor : mesInfo?.assinatura_tesoureiro
  const faltaSo = mesInfo && (ehPastor ? mesInfo.assinatura_tesoureiro : mesInfo.assinatura_pastor) && !minhaAssinatura

  const assinar = async () => {
    if (r.avisos.length && !confirm(`Há ${r.avisos.length} aviso(s) em aberto. Assinar assim mesmo?`)) return

    // Se a minha assinatura é a que falta, o mês fecha agora — e os recibos nascem.
    const semCodigo = contrib.filter(c => porId.get(c.conta_id)?.recebe_recibo && !c.codigo_recibo).length
    if (faltaSo && semCodigo && !confirm(
      `Sua assinatura é a última. Ao assinar, o mês fecha e o sistema emite ${semCodigo} recibo(s) — ` +
      `cada um com código próprio, que a pessoa passa a ver no cadastro dela.\n\n` +
      `Depois disso esses lançamentos não podem mais ser apagados nem ter o valor alterado.\n\nAssinar e fechar?`
    )) return

    // Garante que o mês existe e guarda o saldo de abertura antes de assinar.
    if (!mesInfo) {
      const novo = await dbInsert('fin_meses', { ref, status: 'aberto', saldo_caixa_anterior: saldoAnterior }, `Abriu ${MESES[mes]}/${ano}`)
      if (novo?.id) setMesInfo(novo)
    }

    const res = await assinarMes(ref)
    if (res?.erro) return aviso(`⚠ ${res.erro}`)
    setMesInfo(res.mes)

    if (res.fechou) {
      const em = await emitirRecibos(ref)
      if (em?.erro) return aviso(`⚠ ${em.erro}`)
      setContrib(await dbGet('fin_contribuicoes', { mes_ref: ref }))
      aviso(`Mês fechado. ${em?.gerados || 0} recibo(s) emitido(s).`)
    } else {
      aviso(`Assinado. Falta a assinatura ${ehPastor ? 'do tesoureiro' : 'do pastor'}.`)
    }
  }

  const reabrir = async () => {
    const motivo = prompt('Por que precisa reabrir este mês?\n\nFica registrado na auditoria e as duas assinaturas são apagadas.')
    if (motivo === null) return
    if (String(motivo).trim().length < 5) return aviso('⚠ Escreva o motivo.')
    const res = await reabrirMes(ref, motivo)
    if (res?.erro) return aviso(`⚠ ${res.erro}`)
    setMesInfo(res.mes)
    aviso('Mês reaberto. As duas assinaturas foram apagadas.')
  }

  const nomeDe = (c) => c.membro_id
    ? (pessoas.find(p => String(p.id) === String(c.membro_id))?.nome || '(membro removido)')
    : (c.nome || '—')

  const th = { background: 'var(--s2)', padding: '8px 12px', textAlign: 'left', fontSize: 9, fontWeight: 600, color: 'var(--g)', letterSpacing: 1.5, textTransform: 'uppercase' }
  const td = { padding: '9px 12px', fontSize: 12.5 }

  // Uma linha de recebimento — serve para ofertas e para os dízimos quando abertos.
  const linhaReceb = (c, indent = false) => (
    <tr key={c.id} style={{ borderTop: '1px solid var(--bd)', opacity: c.estornado_em ? 0.5 : 1 }}>
      <td style={td}>{c.data ? new Date(c.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
      <td style={{ ...td, paddingLeft: indent ? 28 : 12, textDecoration: c.estornado_em ? 'line-through' : 'none' }}>{nomeDe(c)}</td>
      <td style={td}>
        <Tag color="gray">{porId.get(c.conta_id)?.nome || '?'}</Tag>
        {c.pro_caixa_local && <span style={{ marginLeft: 6 }}><Tag color="cyan">fica no caixa</Tag></span>}
        {c.estornado_em && <span style={{ marginLeft: 6 }}><Tag color="red">ESTORNADO</Tag></span>}
      </td>
      <td style={td}>{c.recibo || '—'}</td>
      <td style={td}>{c.forma === 'pix_regiao' ? 'Pix p/ Região' : c.forma}</td>
      <td style={{ ...td, fontWeight: 600, color: c.estornado_em ? 'var(--g)' : 'var(--grn)' }}>{fmt(c.valor)}</td>
      <td style={{ ...td, whiteSpace: 'nowrap' }}>
        {!fechado && !c.codigo_recibo && (<>
          <Btn variant="outline" size="xs" onClick={() => editarReceb(c)}><Pencil size={13} /></Btn>{' '}
          <Btn variant="danger" size="xs" onClick={() => excluir('fin_contribuicoes', c.id, setContrib, `recebimento de ${nomeDe(c)}`)}><Trash2 size={13} /></Btn>
        </>)}
        {c.codigo_recibo && !c.estornado_em && (
          <Btn variant="outline" size="xs" onClick={() => estornar(c)}>Estornar</Btn>
        )}
      </td>
    </tr>
  )

  if (carregando) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--g)', fontSize: 13 }}>Carregando…</div>

  return (
    <div>
      <div className="no-print" style={{ marginBottom: 14 }}>
        <Tabs active={visao} onChange={setVisao}
          tabs={[{ id: 'mensal', label: '📅 Visão Mensal' }, { id: 'global', label: '🌎 Visão Global' }]} />
      </div>

      {visao === 'global' && <VisaoGlobal ano={ano} />}

      {visao === 'mensal' && (<>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <MonthNav month={mes} year={ano} onPrev={() => chM(-1)} onNext={() => chM(1)}
          onSetMonth={setMes} onSetYear={setAno} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {historico && <Tag color="gray">HISTÓRICO</Tag>}
          {!historico && fechado && <Tag color="green">MÊS FECHADO</Tag>}
          <Btn variant="outline" onClick={() => window.print()}><Printer size={15} /> Imprimir</Btn>
          {!historico && (fechado
            ? (ehPastor
              ? <Btn variant="outline" onClick={reabrir}><Unlock size={15} /> Reabrir mês</Btn>
              : null)
            : (minhaAssinatura
              ? <Tag color="green">VOCÊ JÁ ASSINOU</Tag>
              : <Btn onClick={assinar}><Check size={15} /> Assinar como {ehPastor ? 'Pastor' : 'Tesouraria'}</Btn>))}
        </div>
      </div>

      {/* resumo sempre visível */}
      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
        {[
          ['Entradas (TR)', fmt(r.totalEntradas), 'var(--grn)', 'receb'],
          ['Saídas (TD)', fmt(r.totalSaidas), 'var(--red)', 'desp'],
          ['Saldo p/ remessa', fmt(r.saldoRemessa), 'var(--cy)', 'remessa'],
          ['Falta remeter', fmt(r.faltaRemeter), r.faltaRemeter > 0.005 ? 'var(--yel)' : 'var(--grn)', 'remessa'],
          ['Caixa local', fmt(r.saldoCaixa), 'var(--w)', 'caixa'],
        ].map(([l, v, c, destino]) => (
          <div key={l} onClick={() => destino && setAba(destino)} title={destino ? `Abrir ${l}` : undefined}
            style={{ background: aba === destino ? 'var(--s2)' : 'var(--s1)', border: `1px solid ${aba === destino ? 'var(--cy)' : 'var(--bd)'}`, borderRadius: 10, padding: 12, textAlign: 'center', cursor: destino ? 'pointer' : 'default' }}>
            <div style={{ fontSize: 8.5, color: 'var(--g)', letterSpacing: 1.5, textTransform: 'uppercase' }}>{l}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: c, marginTop: 3 }}>{v}</div>
          </div>
        ))}
      </div>

      {historico && (
        <div className="no-print" style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '10px 13px', marginBottom: 14, fontSize: 12.5, color: 'var(--gl)', display: 'flex', gap: 7, alignItems: 'flex-start' }}>
          <Lock size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          Mês histórico — números travados da planilha oficial, antes da gestão detalhada.
          Sem lançamento avulso e sem detalhamento do caixa local (isso começa em 2025).
        </div>
      )}

      {/* Quem já assinou e quem falta — igual à ata */}
      {!historico && <div className="no-print" style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          ['Tesouraria', mesInfo?.assinatura_tesoureiro, mesInfo?.assinatura_tesoureiro_nome],
          ['Pastor', mesInfo?.assinatura_pastor, mesInfo?.assinatura_pastor_nome],
        ].map(([papel, quando, quem]) => (
          <div key={papel} style={{
            flex: '1 1 160px', background: 'var(--s1)', borderRadius: 10, padding: '10px 13px',
            border: `1px solid ${quando ? 'rgba(52,179,122,.4)' : 'var(--bd)'}`,
          }}>
            <div style={{ fontSize: 8.5, color: 'var(--g)', letterSpacing: 1.5, textTransform: 'uppercase' }}>{papel}</div>
            {quando ? (
              <>
                <div style={{ fontSize: 12.5, color: 'var(--grn)', fontWeight: 600, marginTop: 2 }}>✓ Assinado</div>
                <div style={{ fontSize: 10.5, color: 'var(--g)', marginTop: 1 }}>
                  {quem ? `${quem} · ` : ''}{new Date(quando).toLocaleDateString('pt-BR')}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--g)', marginTop: 4 }}>Aguardando…</div>
            )}
          </div>
        ))}
      </div>}

      {fechado && !ehPastor && (
        <div className="no-print" style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '10px 13px', marginBottom: 14, fontSize: 12.5, color: 'var(--gl)', display: 'flex', gap: 7, alignItems: 'flex-start' }}>
          <Lock size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          Mês fechado e assinado pelos dois. Se precisar ajustar, fale com o pastor — só ele reabre.
        </div>
      )}

      {mesInfo?.reaberto_em && !fechado && (
        <div className="no-print" style={{ background: 'rgba(216,162,74,.10)', border: '1px solid rgba(216,162,74,.35)', borderRadius: 10, padding: '10px 13px', marginBottom: 14, fontSize: 12.5, color: 'var(--yel)' }}>
          Reaberto por {mesInfo.reaberto_por_nome || 'pastor'} em {new Date(mesInfo.reaberto_em).toLocaleDateString('pt-BR')} — {mesInfo.reaberto_motivo}
        </div>
      )}

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
            { id: 'dizimistas', label: 'Dizimistas do mês' },
            { id: 'config', label: 'Configuração' },
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
                  : <>
                    {/* Ofertas e demais entradas: aparecem normalmente */}
                    {[...outrosReceb].sort((a, b) => String(a.data).localeCompare(String(b.data))).map(c => linhaReceb(c))}

                    {/* Dízimo: recolhido num total. Nomes só aparecem se você abrir. */}
                    {dizimosMes.length > 0 && (
                      <tr style={{ borderTop: '1px solid var(--bd)', cursor: 'pointer', background: dizAberto ? 'var(--s2)' : 'transparent' }}
                        onClick={() => setDizAberto(v => !v)}>
                        <td style={td}>—</td>
                        <td style={{ ...td, fontWeight: 700, color: 'var(--w)' }}>
                          <span style={{ color: 'var(--cy)', marginRight: 6 }}>{dizAberto ? '▾' : '▸'}</span>
                          Dízimo <span style={{ fontWeight: 400, color: 'var(--g)', fontSize: 11.5 }}>({dizimosMes.length} contribuinte{dizimosMes.length > 1 ? 's' : ''} — toque para {dizAberto ? 'ocultar' : 'ver'})</span>
                        </td>
                        <td style={td}><Tag color="gray">DÍZIMOS</Tag></td>
                        <td style={td}></td>
                        <td style={td}></td>
                        <td style={{ ...td, fontWeight: 700, color: 'var(--grn)' }}>{fmt(totalDizMes)}</td>
                        <td style={td}></td>
                      </tr>
                    )}
                    {/* Detalhe dos dízimos (nomes) — só quando aberto */}
                    {dizAberto && [...dizimosMes].sort((a, b) => nomeDe(a).localeCompare(nomeDe(b))).map(c => linhaReceb(c, true))}
                  </>}
              </tbody>
            </table>
          </div>
          {recibos.quantidade > 0 && (
            <div style={{ fontSize: 12, color: 'var(--g)', marginTop: 9 }}>
              Recibos usados: <b style={{ color: 'var(--tx)' }}>{recibos.inicial} a {recibos.final}</b> — {recibos.quantidade} no total{recibos.origem === 'sistema' ? ' (numeração do sistema)' : ' (talão de papel)'}.
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
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{!fechado && (<>
                        <Btn variant="outline" size="xs" onClick={() => editarDesp(d)}><Pencil size={13} /></Btn>{' '}
                        <Btn variant="danger" size="xs" onClick={() => excluir('fin_despesas', d.id, setDespesas, `despesa "${d.descricao}"`)}><Trash2 size={13} /></Btn>
                      </>)}</td>
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
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{!fechado && (<>
                        <Btn variant="outline" size="xs" onClick={() => editarRemessa(d)}><Pencil size={13} /></Btn>{' '}
                        <Btn variant="danger" size="xs" onClick={() => excluir('fin_depositos', d.id, setDepositos, `envio de ${fmt(d.valor)}`)}><Trash2 size={13} /></Btn>
                      </>)}</td>
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

      {/* ---------------- DIZIMISTAS DO MÊS ---------------- */}
      {aba === 'dizimistas' && (
        <div className="no-print">
          <div style={{ fontSize: 12.5, color: 'var(--g)', marginBottom: 10 }}>
            Quem dizimou em <b style={{ color: 'var(--tx)' }}>{MESES[mes]} de {ano}</b> —
            <b style={{ color: 'var(--tx)' }}> {dizimosMes.length}</b> {dizimosMes.length === 1 ? 'pessoa' : 'pessoas'},
            total <b style={{ color: 'var(--grn)' }}>{fmt(totalDizMes)}</b>.
            <span style={{ marginLeft: 6 }}>Para ver quem esfriou ou parou de dizimar, use a <b style={{ color: 'var(--cy)' }}>Visão Global</b>.</span>
          </div>
          {dizimosMes.length === 0
            ? <Empty text={`Ninguém dizimou em ${MESES[mes]}.`} />
            : <div className="table-scroll" style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Dizimista', 'Recibo', 'Valor'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {[...dizimosMes].sort((a, b) => nomeDe(a).localeCompare(nomeDe(b))).map(c => (
                    <tr key={c.id} style={{ borderTop: '1px solid var(--bd)', opacity: c.estornado_em ? 0.5 : 1 }}>
                      <td style={{ ...td, textDecoration: c.estornado_em ? 'line-through' : 'none' }}>{nomeDe(c)}{c.estornado_em && <span style={{ marginLeft: 6 }}><Tag color="red">ESTORNADO</Tag></span>}</td>
                      <td style={td}>{c.recibo || '—'}</td>
                      <td style={{ ...td, fontWeight: 600, color: c.estornado_em ? 'var(--g)' : 'var(--grn)' }}>{fmt(c.valor)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid var(--bd)' }}>
                    <td style={{ ...td, fontWeight: 700 }}>TOTAL</td><td style={td}></td>
                    <td style={{ ...td, fontWeight: 700, color: 'var(--grn)' }}>{fmt(totalDizMes)}</td>
                  </tr>
                </tbody>
              </table>
            </div>}
        </div>
      )}

      {/* ---------------- CONFIGURAÇÃO ---------------- */}
      {aba === 'config' && <Configuracao aviso={aviso} />}

      {/* ---------------- IMPRESSÃO: relatório oficial ---------------- */}
      <RelatorioImpressao
        mes={mes} ano={ano} contas={contas} r={r} recibos={recibos}
        contrib={contrib} nomeDe={nomeDe} depositos={depositos} despesas={despesas}
      />
      </>)}

      {/* ---------------- MODAIS ---------------- */}
      {modal === 'receb' && (
        <Modal title={editando ? "Corrigir recebimento" : "Recebimento"} onClose={() => { setModal(null); setEditando(null) }}
          footer={<><Btn variant="outline" onClick={() => { setModal(null); setEditando(null) }}>Cancelar</Btn><Btn onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Btn></>}>
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
            <FG><label>Nº do talão de papel (opcional)</label><input value={form.recibo} onChange={e => setForm({ ...form, recibo: e.target.value })} placeholder="deixe vazio se não usar talão" /><span style={{ fontSize: 11.5, color: 'var(--g)', marginTop: 4, display: 'block' }}>O número do recibo do sistema é gerado sozinho ao fechar o mês.</span></FG>
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
        <Modal title={editando ? "Corrigir despesa" : "Despesa"} onClose={() => { setModal(null); setEditando(null) }}
          footer={<><Btn variant="outline" onClick={() => { setModal(null); setEditando(null) }}>Cancelar</Btn><Btn onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Btn></>}>
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
              <FG><label>Categoria (para a prestação de contas)</label>
                <select value={form.finalidade} onChange={e => setForm({ ...form, finalidade: e.target.value })}>
                  <option value="">— escolher —</option>
                  {NOMES_FINALIDADE.map(f => <option key={f}>{f}</option>)}
                </select>
                {form.finalidade && (
                  <span style={{ fontSize: 11.5, color: 'var(--g)', marginTop: 4, display: 'block' }}>
                    {FINALIDADES.find(([n]) => n === form.finalidade)?.[1]}
                  </span>
                )}
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
        <Modal title={editando ? "Corrigir envio" : "Envio para a Região"} onClose={() => { setModal(null); setEditando(null) }}
          footer={<><Btn variant="outline" onClick={() => { setModal(null); setEditando(null) }}>Cancelar</Btn><Btn onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Btn></>}>
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
//  Configuração da tesouraria.
//
//  O que sai impresso no recibo e, principalmente, a numeração —
//  que é da igreja, não da Região.
// ============================================================
function Configuracao({ aviso }) {
  const [cfg, setCfg] = useState(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { dbGet('fin_config').then(l => setCfg(l[0] || null)) }, [])
  if (!cfg) return <div style={{ padding: 30, textAlign: 'center', color: 'var(--g)', fontSize: 13 }}>Carregando…</div>

  const campo = (k, v) => setCfg({ ...cfg, [k]: v })

  const salvar = async () => {
    const n = parseInt(cfg.proximo_recibo, 10)
    if (!n || n < 1) return aviso('⚠ O próximo número precisa ser um número.')
    setSalvando(true)
    await dbUpdate('fin_config', cfg.id, {
      igreja_codigo: cfg.igreja_codigo, igreja_nome: cfg.igreja_nome,
      convencao_nome: cfg.convencao_nome, convencao_cnpj: cfg.convencao_cnpj,
      pastor_nome: cfg.pastor_nome, tesoureiro_nome: cfg.tesoureiro_nome,
      proximo_recibo: n,
    }, 'Configuração da tesouraria')
    setSalvando(false)
    aviso('Configuração salva.')
  }

  const exemplo = `${cfg.igreja_codigo}-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(cfg.proximo_recibo).padStart(6, '0')}-XXXX`

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--g)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>
          Numeração dos recibos
        </div>
        <FormGrid>
          <FG full>
            <label>Próximo número a ser emitido</label>
            <input type="number" value={cfg.proximo_recibo} onChange={e => campo('proximo_recibo', e.target.value)} />
            <span style={{ fontSize: 11.5, color: 'var(--g)', marginTop: 5, display: 'block', lineHeight: 1.5 }}>
              Numeração <b>própria da igreja</b>, com 6 dígitos — de propósito fora da faixa
              do talão da Região, para nunca bater com o número de outra igreja.
              O talão de papel continua sendo anotado à parte, enquanto a Região pedir.
            </span>
          </FG>
        </FormGrid>
        <div style={{ marginTop: 12, padding: 11, background: 'var(--s2)', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'var(--g)', letterSpacing: 1.5 }}>O PRÓXIMO RECIBO SAI ASSIM</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--cy)', marginTop: 3, wordBreak: 'break-all' }}>{exemplo}</div>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--yel)', marginTop: 10, display: 'flex', gap: 7, alignItems: 'flex-start' }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          Só mexa aqui antes de emitir o primeiro recibo. Depois de emitido, número não volta atrás.
        </div>
      </div>

      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--g)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>
          O que sai impresso no recibo
        </div>
        <FormGrid>
          <FG><label>Código da igreja</label><input value={cfg.igreja_codigo || ''} onChange={e => campo('igreja_codigo', e.target.value)} /></FG>
          <FG><label>Nome da igreja</label><input value={cfg.igreja_nome || ''} onChange={e => campo('igreja_nome', e.target.value)} /></FG>
          <FG full><label>Convenção</label><input value={cfg.convencao_nome || ''} onChange={e => campo('convencao_nome', e.target.value)} /></FG>
          <FG><label>CNPJ da Convenção</label><input value={cfg.convencao_cnpj || ''} onChange={e => campo('convencao_cnpj', e.target.value)} /></FG>
          <FG><label>Pastor</label><input value={cfg.pastor_nome || ''} onChange={e => campo('pastor_nome', e.target.value)} /></FG>
          <FG full><label>Tesouraria</label><input value={cfg.tesoureiro_nome || ''} onChange={e => campo('tesoureiro_nome', e.target.value)} /></FG>
        </FormGrid>
        <div style={{ marginTop: 14 }}>
          <Btn onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Btn>
        </div>
      </div>
    </div>
  )
}

// ============================================================
//  Visão Global — a leitura de "todos os tempos" ou de um período.
//
//  É aqui que se enxerga o retrato grande: quem esfriou ou parou de
//  dizimar (com o telefone do lado), quanto cada pessoa deu no período
//  escolhido, e a prestação de contas do que a igreja investiu.
//  Tudo fora do mês — o mensal é só o mês, isto é o panorama.
// ============================================================
const GRUPOS_DIZ = {
  ativos: { label: 'Dizimando', cor: 'grn', dica: 'Deram nos últimos 2 meses' },
  esfriando: { label: 'Esfriando', cor: 'yel', dica: 'Davam, mas há 3 a 5 meses não dão' },
  pararam: { label: 'Pararam', cor: 'red', dica: 'Há 6 meses ou mais não dão' },
  nunca: { label: 'Nunca dizimaram', cor: 'g', dica: 'Sem nenhum dízimo registrado' },
}
const ORDEM_DIZ = { pararam: 0, esfriando: 1, nunca: 2, ativos: 3 }

function VisaoGlobal({ ano }) {
  const { state } = useStore()
  const pessoas = (state.membrosTodos?.length ? state.membrosTodos : state.membros) || []

  const [contrib, setContrib] = useState(null)
  const [despesas, setDespesas] = useState(null)
  const [contas, setContas] = useState(null)
  const [escopo, setEscopo] = useState('total')  // 'total' | 'ano' | 'periodo'
  const [anoSel, setAnoSel] = useState(String(ano))
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [aberta, setAberta] = useState(null)
  const [filtro, setFiltro] = useState('todos')
  const [soAtivos, setSoAtivos] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    let vivo = true
    Promise.all([dbGet('fin_contribuicoes'), dbGet('fin_despesas'), dbGet('fin_contas')])
      .then(([c, d, k]) => { if (vivo) { setContrib(c); setDespesas(d); setContas(k) } })
    return () => { vivo = false }
  }, [])

  if (!contrib || !despesas || !contas) return <div style={{ padding: 30, textAlign: 'center', color: 'var(--g)', fontSize: 13 }}>Carregando o histórico…</div>

  const idsDizimo = new Set(contas.filter(k => k.recebe_recibo).map(k => k.id))
  const anos = [...new Set([...contrib, ...despesas].map(x => String(x.mes_ref || '').slice(0, 4)).filter(Boolean))].sort().reverse()

  const noEscopo = (mes_ref) => {
    const ym = String(mes_ref || '').slice(0, 7)
    if (escopo === 'ano') return ym.slice(0, 4) === anoSel
    if (escopo === 'periodo') { if (de && ym < de) return false; if (ate && ym > ate) return false; return true }
    return true // total
  }
  const rotulo = escopo === 'total' ? 'de todos os tempos' : escopo === 'ano' ? `em ${anoSel}` : `no período${de ? ` de ${de.split('-').reverse().join('/')}` : ''}${ate ? ` até ${ate.split('-').reverse().join('/')}` : ''}`

  // ---- Panorama: total/meses no escopo; recência (esfriou/parou) é sempre de hoje ----
  const MES_ATUAL = new Date().toISOString().slice(0, 7)
  const mesesAtras = (ym) => { if (!ym) return Infinity; const [a, m] = ym.split('-').map(Number); const [aa, mm] = MES_ATUAL.split('-').map(Number); return (aa - a) * 12 + (mm - m) }
  const porMembro = new Map()
  for (const c of contrib) {
    if (!c.membro_id || c.estornado_em || !idsDizimo.has(c.conta_id)) continue
    const ym = String(c.mes_ref || '').slice(0, 7)
    let g = porMembro.get(c.membro_id); if (!g) { g = { total: 0, meses: new Set(), ultimo: null }; porMembro.set(c.membro_id, g) }
    if (!g.ultimo || ym > g.ultimo) g.ultimo = ym
    if (noEscopo(c.mes_ref)) { g.total += Number(c.valor) || 0; g.meses.add(ym) }
  }
  const classificar = (ultimo) => { if (!ultimo) return 'nunca'; const d = mesesAtras(ultimo); if (d <= 2) return 'ativos'; if (d <= 5) return 'esfriando'; return 'pararam' }
  const linhas = pessoas.map(p => {
    const g = porMembro.get(p.id)
    return { id: p.id, nome: p.nome, ativo: p.ativo, batizado: p.batizado, tel: p.tel, grupo: classificar(g?.ultimo), total: g ? g.total : 0, meses: g ? g.meses.size : 0, ultimo: g?.ultimo || null }
  }).filter(d => (!soAtivos || d.ativo) && (!busca || d.nome.toLowerCase().includes(busca.toLowerCase())))
  const contagem = { ativos: 0, esfriando: 0, pararam: 0, nunca: 0 }; for (const d of linhas) contagem[d.grupo]++
  const listaP = (filtro === 'todos' ? linhas : linhas.filter(d => d.grupo === filtro))
    .sort((a, b) => (ORDEM_DIZ[a.grupo] - ORDEM_DIZ[b.grupo]) || (b.total - a.total) || a.nome.localeCompare(b.nome))

  // ---- Prestação de contas: o que a igreja investiu do caixa local no escopo ----
  const despEscopo = despesas.filter(d => d.pago_por === 'local' && noEscopo(d.mes_ref))
  const grupos = porFinalidade(despEscopo)
  const totalInvest = grupos.reduce((a, g) => a + g.total, 0)

  const btnEscopo = (id, txt) => (
    <button onClick={() => setEscopo(id)} style={{
      padding: '7px 13px', borderRadius: 8, fontSize: 12.5, cursor: 'pointer',
      border: `1px solid ${escopo === id ? 'var(--cy)' : 'var(--bd)'}`,
      background: escopo === id ? 'var(--s2)' : 'var(--s1)', color: escopo === id ? 'var(--w)' : 'var(--gl)',
    }}>{txt}</button>
  )

  return (
    <div className="no-print">
      {/* Seletor de escopo */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        {btnEscopo('total', 'Todos os tempos')}
        {btnEscopo('ano', 'Anual')}
        {btnEscopo('periodo', 'Período personalizado')}
        {escopo === 'ano' && (
          <select value={anoSel} onChange={e => setAnoSel(e.target.value)} style={{ marginLeft: 4 }}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        {escopo === 'periodo' && (
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: 'var(--g)' }}>
            de <input type="month" value={de} onChange={e => setDe(e.target.value)} />
            até <input type="month" value={ate} onChange={e => setAte(e.target.value)} />
          </span>
        )}
      </div>

      {/* ===== Panorama dos dizimistas ===== */}
      <div style={{ fontSize: 11, color: 'var(--g)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Panorama dos dizimistas — valores {rotulo}</div>
      <div style={{ fontSize: 12.5, color: 'var(--gl)', marginBottom: 12, lineHeight: 1.5 }}>
        Uma leitura do rebanho, não uma cobrança: quem sustentava e parou pode estar passando por algo. O telefone está do lado para você procurar a pessoa.
      </div>
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 12 }}>
        {Object.entries(contagem).map(([chave, n]) => {
          const meta = GRUPOS_DIZ[chave]; const sel = filtro === chave
          return (
            <div key={chave} onClick={() => setFiltro(sel ? 'todos' : chave)}
              style={{ cursor: 'pointer', flex: '1 1 130px', background: sel ? 'var(--s2)' : 'var(--s1)', border: `1px solid ${sel ? 'var(--cy)' : 'var(--bd)'}`, borderRadius: 10, padding: '11px 13px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: `var(--${meta.cor})` }}>{n}</div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--w)', marginTop: 1 }}>{meta.label}</div>
              <div style={{ fontSize: 10, color: 'var(--g)', marginTop: 2, lineHeight: 1.3 }}>{meta.dica}</div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input placeholder="Procurar nome…" value={busca} onChange={e => setBusca(e.target.value)} style={{ flex: '1 1 180px' }} />
        <select value={soAtivos ? 'sim' : 'nao'} onChange={e => setSoAtivos(e.target.value === 'sim')} style={{ flex: '0 1 200px' }}>
          <option value="sim">Só membros ativos</option>
          <option value="nao">Todos do cadastro</option>
        </select>
      </div>
      {listaP.length === 0 ? <Empty text="Ninguém neste grupo." /> : (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
          {listaP.map((d, i) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderTop: i ? '1px solid var(--bd)' : 'none', flexWrap: 'wrap' }}>
              <div style={{ width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: `var(--${GRUPOS_DIZ[d.grupo].cor})` }} />
              <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--w)', fontWeight: 600 }}>{d.nome} {!d.ativo && <span style={{ fontSize: 10, color: 'var(--g)' }}>(inativo)</span>}</div>
                <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 1 }}>
                  {d.ultimo ? `${d.meses} mês(es) no período · último em ${d.ultimo.split('-').reverse().join('/')}` : (d.batizado ? 'Membro batizado, sem dízimo registrado' : 'Frequentador')}
                </div>
              </div>
              {d.total > 0 && <div style={{ fontSize: 12.5, color: 'var(--tx)', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(d.total)}</div>}
              {d.tel && <a href={`https://wa.me/55${String(d.tel).replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--cy)', textDecoration: 'none', whiteSpace: 'nowrap' }}>WhatsApp</a>}
            </div>
          ))}
        </div>
      )}

      {/* ===== Prestação de contas ===== */}
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: 16, marginBottom: 14, textAlign: 'center' }}>
        <div style={{ fontSize: 9, color: 'var(--g)', letterSpacing: 2, textTransform: 'uppercase' }}>Investido pela igreja (caixa local) {rotulo}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: 'var(--cy)', marginTop: 4 }}>{fmt(totalInvest)}</div>
        <div style={{ fontSize: 11.5, color: 'var(--g)', marginTop: 3 }}>{despEscopo.length} lançamento{despEscopo.length !== 1 ? 's' : ''} · dinheiro do caixa local (concessão)</div>
      </div>
      {!grupos.length ? <Empty text={`A igreja não gastou do caixa local ${rotulo}.`} /> : (<>
        <div style={{ fontSize: 11, color: 'var(--g)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Toque numa categoria para abrir o detalhe</div>
        {grupos.map(g => {
          const aberto = aberta === g.finalidade
          const fatia = totalInvest ? Math.round(g.total / totalInvest * 100) : 0
          return (
            <div key={g.finalidade} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
              <div onClick={() => setAberta(aberto ? null : g.finalidade)} style={{ padding: '13px 15px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: aberto ? 'var(--s2)' : 'transparent' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--w)' }}>{g.finalidade}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--g)', marginTop: 2 }}>{g.itens.length} item{g.itens.length > 1 ? 'ns' : ''} · {fatia}% do total</div>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--cy)', whiteSpace: 'nowrap' }}>{fmt(g.total)}</div>
              </div>
              <div style={{ height: 3, background: 'var(--s3)' }}><div style={{ height: '100%', width: `${fatia}%`, background: 'var(--cy)' }} /></div>
              {aberto && (
                <div style={{ padding: '10px 15px 14px' }}>
                  {[...g.itens].sort((a, b) => String(a.data || a.mes_ref).localeCompare(String(b.data || b.mes_ref))).map(i => (
                    <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', borderTop: '1px solid var(--bd)', fontSize: 12.5 }}>
                      <span style={{ color: 'var(--tx)' }}>
                        <span style={{ color: 'var(--g)', marginRight: 7 }}>{i.data ? new Date(i.data + 'T00:00:00').toLocaleDateString('pt-BR') : MESES[Number(String(i.mes_ref).slice(5, 7)) - 1]}</span>
                        {i.descricao}
                        {!i.tem_nota && <span style={{ color: 'var(--yel)', marginLeft: 7, fontSize: 11 }}>sem NF</span>}
                      </span>
                      <span style={{ whiteSpace: 'nowrap', color: 'var(--tx)' }}>{fmt(i.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </>)}
    </div>
  )
}

// ============================================================
//  A folha que vai para a Convenção — só aparece na impressão.
// ============================================================
function RelatorioImpressao({ mes, ano, contas, r, recibos, contrib, nomeDe, depositos, despesas = [] }) {
  const linhas = (lado) => contas.filter(c => c.lado === lado && c.ativo).sort((a, b) => a.ordem - b.ordem)
  const valor = (c) => c.lado === 'R' ? r.entradasPorConta.get(c.id) : r.saidasPorConta.get(c.id)
  const perc = (v, tot) => tot ? Math.round((Number(v) || 0) / tot * 100) + '%' : '0%'
  const ultimo = new Date(ano, mes + 1, 0).getDate()
  const dizimistas = contrib.filter(c => contas.find(x => x.id === c.conta_id)?.recebe_recibo)
  const mesRotulo = new Date(ano, mes, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const nomeConta = (id) => contas.find(c => c.id === id)?.nome || ''
  const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Detalhamento: despesas separadas por quem pagou, e o caixa da concessão (5%).
  const despLocais = despesas.filter(d => d.pago_por === 'local')
  const despRegiao = despesas.filter(d => d.pago_por !== 'local')
  const finalidades = porFinalidade(despesas)

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

      {/* ============ FOLHA DE DETALHAMENTO (uso interno da igreja) ============ */}
      <div style={{ pageBreakBefore: 'always', paddingTop: 8 }}>
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 12 }}>IGREJA PROMESSA — LAGO DOS PEIXES</div>
        <div style={{ textAlign: 'center', fontSize: 10, marginBottom: 2 }}>Detalhamento interno — {mesRotulo}</div>
        <div style={{ textAlign: 'center', fontSize: 8, color: '#555', marginBottom: 10 }}>
          Complementa o relatório oficial acima. Não é enviado à Região.
        </div>

        {/* --- Caixa da Concessão (os 5%) --- */}
        <div style={{ fontWeight: 700, fontSize: 10.5, margin: '0 0 4px' }}>1) Caixa da Concessão (os 5% que ficam na igreja)</div>
        <table style={{ width: '60%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <tbody>
            <tr><td style={tdp}>Saldo anterior do caixa local</td><td style={num}>{brl(r.saldoAnterior)}</td></tr>
            <tr><td style={tdp}>(+) Concessão do mês — 5% do dízimo</td><td style={num}>{brl(r.concessao)}</td></tr>
            {r.ofertasQueFicam > 0 && <tr><td style={tdp}>(+) Ofertas especiais que ficaram no caixa</td><td style={num}>{brl(r.ofertasQueFicam)}</td></tr>}
            <tr><td style={tdp}>(−) Baixa — o que o caixa local pagou</td><td style={num}>{brl(r.baixa)}</td></tr>
            <tr><td style={{ ...tdp, fontWeight: 700 }}>(=) Saldo atual do caixa local</td><td style={{ ...num, fontWeight: 700 }}>{brl(r.saldoCaixa)}</td></tr>
          </tbody>
        </table>

        {/* --- No que o caixa local foi gasto, por finalidade --- */}
        {despLocais.length > 0 && <>
          <div style={{ fontWeight: 700, fontSize: 10.5, margin: '0 0 4px' }}>2) No que o caixa local (5%) foi gasto</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
            <thead><tr><th style={tdp}>Finalidade</th><th style={tdp}>Descrição</th><th style={tdp}>Data</th><th style={tdp}>Nota</th><th style={tdp}>Valor</th></tr></thead>
            <tbody>
              {finalidades.map(g => g.itens.map((d, i) => (
                <tr key={d.id}>
                  <td style={tdp}>{i === 0 ? g.finalidade : ''}</td>
                  <td style={tdp}>{d.descricao || nomeConta(d.conta_id)}</td>
                  <td style={tdp}>{d.data ? new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</td>
                  <td style={tdp}>{d.tem_nota ? 'sim' : '—'}</td>
                  <td style={num}>{brl(d.valor)}</td>
                </tr>
              )))}
              <tr><td style={{ ...tdp, fontWeight: 700 }} colSpan="4">TOTAL PAGO PELO CAIXA LOCAL</td><td style={{ ...num, fontWeight: 700 }}>{brl(r.pagoLocal)}</td></tr>
            </tbody>
          </table>
        </>}

        {/* --- Quem pagou o quê: Região x Igreja local --- */}
        <div style={{ fontWeight: 700, fontSize: 10.5, margin: '0 0 4px' }}>3) Quem pagou cada despesa</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <table style={{ width: '50%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={tdp}>Pago pela REGIÃO</th><th style={tdp}>Valor</th></tr></thead>
            <tbody>
              {despRegiao.map(d => <tr key={d.id}><td style={tdp}>{d.descricao || nomeConta(d.conta_id)}</td><td style={num}>{brl(d.valor)}</td></tr>)}
              <tr><td style={{ ...tdp, fontWeight: 700 }}>Subtotal Região</td><td style={{ ...num, fontWeight: 700 }}>{brl(r.pagoRegiao)}</td></tr>
            </tbody>
          </table>
          <table style={{ width: '50%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={tdp}>Pago pela IGREJA LOCAL (5%)</th><th style={tdp}>Valor</th></tr></thead>
            <tbody>
              {despLocais.length ? despLocais.map(d => <tr key={d.id}><td style={tdp}>{d.descricao || nomeConta(d.conta_id)}</td><td style={num}>{brl(d.valor)}</td></tr>)
                : <tr><td style={tdp} colSpan="2">Nenhuma despesa paga pelo caixa local neste mês.</td></tr>}
              <tr><td style={{ ...tdp, fontWeight: 700 }}>Subtotal Local</td><td style={{ ...num, fontWeight: 700 }}>{brl(r.pagoLocal)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
