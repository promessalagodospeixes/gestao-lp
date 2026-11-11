import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../lib/store.jsx'
import { dbGet, dbInsert, dbDelete, dbUpdate, dbUpsert, dbNotaFoto, emitirRecibos, assinarMes, reabrirMes, estornarRecibo, limparNotasAno } from '../lib/supabase.js'
import { MESES } from '../lib/utils.js'
import { fecharMes, faixaRecibos, porFinalidade, refDoMes, fmt } from '../lib/tesouraria.js'
import { fotoParaDataURL } from '../lib/fotoSite.js'

// Leitor de PDF carregado só quando a pessoa manda imprimir com as notas (as notas
// fiscais costumam ser PDF, e PDF não imprime embutido numa página — vira imagem).
let _pdfjsPromise = null
function carregarPdfJs() {
  if (_pdfjsPromise) return _pdfjsPromise
  _pdfjsPromise = new Promise((res, rej) => {
    if (window.pdfjsLib) return res(window.pdfjsLib)
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    s.onload = () => { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; res(window.pdfjsLib) } catch (e) { rej(e) } }
    s.onerror = () => rej(new Error('Falha ao carregar o leitor de PDF.'))
    document.head.appendChild(s)
  })
  return _pdfjsPromise
}
// Geradores de PDF carregados sob demanda (só quando a pessoa clica em gerar).
let _jspdfP = null
function carregarJsPDF() {
  if (_jspdfP) return _jspdfP
  _jspdfP = new Promise((res, rej) => {
    if (window.jspdf?.jsPDF) return res(window.jspdf.jsPDF)
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    s.onload = () => res(window.jspdf.jsPDF)
    s.onerror = () => rej(new Error('Falha ao carregar o gerador de PDF.'))
    document.head.appendChild(s)
  })
  return _jspdfP
}
let _h2cP = null
function carregarHtml2canvas() {
  if (_h2cP) return _h2cP
  _h2cP = new Promise((res, rej) => {
    if (window.html2canvas) return res(window.html2canvas)
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
    s.onload = () => res(window.html2canvas)
    s.onerror = () => rej(new Error('Falha ao carregar o renderizador.'))
    document.head.appendChild(s)
  })
  return _h2cP
}

// Uma nota (data URL) vira uma lista de imagens: PDF = uma imagem por página; imagem = ela mesma.
async function notaParaImagens(foto) {
  if (!foto) return []
  if (!String(foto).startsWith('data:application/pdf')) return [foto]
  const pdfjs = await carregarPdfJs()
  const bin = atob(foto.split(',')[1]); const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const pdf = await pdfjs.getDocument({ data: bytes }).promise
  const imgs = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const vp = page.getViewport({ scale: 1.2 })
    const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height
    await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise
    imgs.push(cv.toDataURL('image/jpeg', 0.7))
  }
  return imgs
}

// Linhas de assinatura (Tesouraria + Pastor). Quando assinado no sistema, mostra o
// nome e a data; senão, linha em branco para assinar à mão. `a` = {pastorNome,
// pastorData, tesourNome, tesourData}. `compacto` reduz o espaço (usado nas notas).
function BlocoAssinaturas({ a = {}, compacto = false }) {
  const fmtD = (d) => { try { return d ? new Date(d).toLocaleDateString('pt-BR') : null } catch { return null } }
  const col = (papel, nome, data) => (
    <div style={{ flex: 1, textAlign: 'center', padding: '0 18px' }}>
      <div style={{ borderTop: '1px solid #333', marginTop: compacto ? 16 : 16, paddingTop: 3, fontSize: 9.5, fontWeight: 600 }}>{nome || ' '}</div>
      <div style={{ fontSize: 8, color: '#555' }}>{papel}{fmtD(data) ? ` — assinado em ${fmtD(data)}` : ''}</div>
    </div>
  )
  return (
    <div style={{ display: 'flex', gap: 30, marginTop: compacto ? 10 : 8, justifyContent: 'space-around', pageBreakInside: 'avoid' }}>
      {col('Tesouraria', a.tesourNome, a.tesourData)}
      {col('Pastor', a.pastorNome, a.pastorData)}
    </div>
  )
}
import { MonthNav, Btn, Modal, FormGrid, FG, Tag, Empty, Tabs } from '../components/UI.jsx'
import CampoData from '../components/CampoData.jsx'
import { Plus, Trash2, Printer, AlertTriangle, Lock, Unlock, Pencil, Check } from 'lucide-react'

// As categorias que a igreja entende na prestação de contas do fim do ano.
// A explicação aparece na tela para ninguém lançar no lugar errado — a fronteira
// entre Obra e Patrimônio é a que mais confunde.
// As 4 categorias do caixa local (mesmas da prestação de contas anual do pastor).
const FINALIDADES = [
  ['Obra', 'Construção e reforma: aterro, pintura, material, mutirão (inclui a alimentação do mutirão)'],
  ['Eventos', 'Vigília, ceia, culto especial, presentes, lições, ministério infantil — comida, decoração, estrutura'],
  ['Bens', 'Patrimônio que fica: móveis, eletro, corrimão, caixa d’água, estrutura (menos o som)'],
  ['Música', 'Equipe de louvor: som, instrumentos, cabos, microfones, bateria'],
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
  const [notas, setNotas] = useState([])          // notas fiscais (chave/foto) do mês
  const [mesInfo, setMesInfo] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(null)      // 'receb' | 'desp' | 'remessa'
  const [editando, setEditando] = useState(null) // id do registro em edição (null = novo)
  const [form, setForm] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [dizAberto, setDizAberto] = useState(false) // Recebimentos: dízimos ficam recolhidos (privacidade)
  const [grupoAberto, setGrupoAberto] = useState({ sab: false, dom: false }) // ofertas sáb/dom recolhidas
  const [visao, setVisao] = useState('mensal')      // 'mensal' | 'global' (seletor no topo)
  const [verFoto, setVerFoto] = useState(null)      // foto de nota aberta em tela cheia
  const [notasPrint, setNotasPrint] = useState(null) // notas convertidas em imagem p/ imprimir junto
  const [prepNotas, setPrepNotas] = useState(false)
  const [relModal, setRelModal] = useState(false)   // janela "Gerar relatório"
  const [relSel, setRelSel] = useState({ oficial: true, caixa: true, notas: false })

  const ref = refDoMes(ano, mes)
  const fechado = mesInfo?.status === 'fechado'
  const historico = !!mesInfo?.historico  // meses importados: números da planilha
  // Trava de edição: um mês só fica bloqueado quando foi fechado e assinado de
  // verdade (as duas assinaturas). Mês histórico/importado pode ser ajustado.
  const travado = fechado && !historico
  const aviso = (t) => dispatch({ type: 'TOAST', value: t })
  // Assinaturas do mês (preenchidas quando pastor/tesouraria assinam o fechamento).
  const assinaturas = {
    pastorNome: mesInfo?.assinatura_pastor_nome || '',
    pastorData: mesInfo?.assinatura_pastor || null,
    tesourNome: mesInfo?.assinatura_tesoureiro_nome || '',
    tesourData: mesInfo?.assinatura_tesoureiro || null,
  }

  const contasR = useMemo(() => contas.filter(c => c.lado === 'R' && c.papel !== 'baixa' && c.ativo), [contas])
  const contasD = useMemo(() => contas.filter(c => c.lado === 'D' && c.papel !== 'concessao' && c.ativo), [contas])
  const porId = useMemo(() => new Map(contas.map(c => [c.id, c])), [contas])
  const notaDe = useMemo(() => new Map(notas.map(n => [n.despesa_id, n])), [notas])
  const sefazUrl = (ch) => `https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo&nfe=${String(ch || '').replace(/\D/g, '')}`

  // Carrega as notas do mês e transforma em imagem (PDF vira imagem por página).
  // Retorna também quantas falharam, para avisar a pessoa (comum em celular com PDF pesado).
  const carregarNotasImgs = async () => {
    const comNota = despesas.filter(d => { const n = notaDe.get(d.id); return n && n.tem_foto })
    const out = []; let falhas = 0
    for (const d of comNota) {
      let foto = null
      try { foto = await dbNotaFoto(d.id) } catch { falhas++; continue }
      if (!foto) { falhas++; continue }
      let imgs = []
      try { imgs = await notaParaImagens(foto) } catch { falhas++; continue }
      imgs.forEach((img, k) => out.push({ key: `${d.id}-${k}`, descricao: d.descricao, valor: d.valor, data: d.data, img }))
    }
    return { out, falhas, total: comNota.length }
  }

  // Gera o PDF (em PAISAGEM, com o que foi marcado nas caixinhas) e BAIXA o arquivo.
  // Assim funciona igual no celular e no PC — não depende da impressão do navegador.
  const gerarRelatorio = async () => {
    if (!relSel.oficial && !relSel.caixa && !relSel.notas) { aviso('Marque pelo menos uma parte.'); return }
    setPrepNotas(true)
    try {
      const jsPDF = await carregarJsPDF()
      const html2canvas = await carregarHtml2canvas()
      let notas = []
      if (relSel.notas) {
        const { out, falhas, total } = await carregarNotasImgs()
        if (falhas) aviso(`⚠ ${falhas} de ${total} nota(s) não puderam ser preparadas (PDF pesado ou sem internet).`)
        notas = out
        if (!out.length && !relSel.oficial && !relSel.caixa) { aviso('Nenhuma nota com foto/PDF neste mês.'); return }
      }
      setRelModal(false)
      // Mostra as folhas fora da tela (sem display:none) para o html2canvas capturar.
      document.body.classList.add('preparando-pdf')
      await new Promise(r => setTimeout(r, 400))
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight(), M = 8
      let primeira = true
      const addEl = async (sel) => {
        const el = document.querySelector(sel); if (!el) return
        const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#fff', useCORS: true, logging: false })
        let w = W - M * 2, h = canvas.height * (w / canvas.width); if (h > H - M * 2) h = H - M * 2
        if (!primeira) pdf.addPage()
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', M, M, w, h); primeira = false
      }
      if (relSel.oficial) await addEl('.folha-oficial')
      if (relSel.caixa) await addEl('.folha-caixa')
      for (const n of notas) {
        if (!primeira) pdf.addPage()
        pdf.setFontSize(12); try { pdf.setFont(undefined, 'bold') } catch {}
        pdf.text(String(n.descricao || 'Nota fiscal').slice(0, 90), W / 2, M + 5, { align: 'center' })
        pdf.setFontSize(9); try { pdf.setFont(undefined, 'normal') } catch {}
        pdf.text(`${fmt(n.valor)}${n.data ? ' · ' + new Date(n.data + 'T00:00:00').toLocaleDateString('pt-BR') : ''}`, W / 2, M + 10, { align: 'center' })
        const pr = pdf.getImageProperties(n.img)
        const maxW = W - M * 2, maxH = H - M * 2 - 16
        let iw = maxW, ih = pr.height * (iw / pr.width); if (ih > maxH) { ih = maxH; iw = pr.width * (ih / pr.height) }
        pdf.addImage(n.img, 'JPEG', (W - iw) / 2, M + 15, iw, ih); primeira = false
      }
      pdf.save(`relatorio-tesouraria-${ano}-${String(mes + 1).padStart(2, '0')}.pdf`)
    } catch (e) { aviso('⚠ Não consegui gerar o PDF: ' + (e?.message || e)) }
    finally { document.body.classList.remove('preparando-pdf'); setPrepNotas(false) }
  }

  // Abrir a nota: imagem vai na janela (overlay); PDF abre em nova aba (o Chrome não
  // mostra PDF em data: dentro da página — por Blob em aba nova funciona sempre).
  const verNota = (foto) => {
    if (!foto) return
    if (String(foto).startsWith('data:application/pdf')) {
      try {
        const bin = atob(String(foto).split(',')[1]); const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
        const w = window.open(url, '_blank')
        if (!w) { aviso('Permita abrir uma aba nova para ver o PDF.'); setVerFoto(foto) }
        setTimeout(() => URL.revokeObjectURL(url), 60000)
      } catch { setVerFoto(foto) }
    } else {
      setVerFoto(foto)
    }
  }
  const pessoas = (membrosTodos?.length ? membrosTodos : membros) || []

  // Recebimentos separados: dízimo (tem dono, é sigiloso) x oferta (sem dono).
  const dizimosMes = useMemo(() => contrib.filter(c => porId.get(c.conta_id)?.recebe_recibo), [contrib, porId])
  const outrosReceb = useMemo(() => contrib.filter(c => !porId.get(c.conta_id)?.recebe_recibo), [contrib, porId])
  const totalDizMes = useMemo(() => dizimosMes.reduce((a, c) => a + (c.estornado_em ? 0 : Number(c.valor) || 0), 0), [dizimosMes])
  // Ofertas de Sábado e Domingo: recolhidas num total (como o dízimo), para não poluir a tela.
  const contaSab = useMemo(() => contas.find(c => c.lado === 'R' && /Voluntárias de Sábados/i.test(c.nome || '')), [contas])
  const contaDom = useMemo(() => contas.find(c => c.lado === 'R' && /Voluntárias de Domingos/i.test(c.nome || '')), [contas])
  const oferSab = useMemo(() => outrosReceb.filter(c => contaSab && c.conta_id === contaSab.id), [outrosReceb, contaSab])
  const oferDom = useMemo(() => outrosReceb.filter(c => contaDom && c.conta_id === contaDom.id), [outrosReceb, contaDom])
  const oferResto = useMemo(() => outrosReceb.filter(c => !(contaSab && c.conta_id === contaSab.id) && !(contaDom && c.conta_id === contaDom.id)), [outrosReceb, contaSab, contaDom])
  const totalDe = (arr) => arr.reduce((a, c) => a + (c.estornado_em ? 0 : Number(c.valor) || 0), 0)

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
      dbGet('fin_notas', { mes_ref: ref }),
    ]).then(([c, d, dep, m, mAnt, cAnt, dAnt, nt]) => {
      if (!vivo) return
      setContrib(c); setDespesas(d); setDepositos(dep); setMesInfo(m[0] || null); setNotas(nt || [])
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
    setForm({ data: hojeISO(), conta_id: dizimo?.id || contasR[0]?.id, membro_id: '', nome: '', valor: '', recibo: '', forma: 'dinheiro', pro_caixa_local: false, ident_pix: '' })
    setModal('receb')
  }
  const abrirDesp = () => {
    setEditando(null)
    setForm({ data: hojeISO(), conta_id: contasD[0]?.id, descricao: '', valor: '', pago_por: contasD[0]?.paga_por_padrao || 'regiao', finalidade: '', tem_nota: false, chave: '', foto: null, temFoto: false, fotoTocada: false })
    setModal('desp')
  }
  const abrirRemessa = () => {
    setEditando(null)
    setForm({ data: hojeISO(), identificacao: '', valor: '', tipo: 'deposito', natureza: 'avulsa', rem_membro_id: '', rem_nome: '', rem_conta_id: '' })
    setModal('remessa')
  }

  // Abre o mesmo formulário já preenchido, para corrigir em vez de apagar e refazer.
  const editarReceb = (c) => {
    if (c.codigo_recibo) return aviso(`⚠ Recibo ${c.codigo_recibo} já emitido. Só por estorno.`)
    const dep = depositos.find(d => d.contrib_id === c.id)
    setEditando(c.id)
    setForm({
      data: c.data || '', conta_id: c.conta_id, membro_id: c.membro_id ? String(c.membro_id) : '',
      nome: c.nome || '', valor: c.valor ?? '', recibo: c.recibo || '',
      forma: c.forma || 'dinheiro', pro_caixa_local: !!c.pro_caixa_local,
      ident_pix: dep?.identificacao || '',
    })
    setModal('receb')
  }
  const editarDesp = (d) => {
    const nt = notaDe.get(d.id)
    setEditando(d.id)
    setForm({
      data: d.data || '', conta_id: d.conta_id, descricao: d.descricao || '', valor: d.valor ?? '',
      pago_por: d.pago_por || 'regiao', finalidade: d.finalidade || '', tem_nota: !!d.tem_nota,
      chave: nt?.chave || '', foto: null, temFoto: !!nt?.tem_foto, fotoTocada: false,
    })
    setModal('desp')
  }
  const editarRemessa = (d) => {
    // Se a remessa nasceu de um dízimo/oferta (tem contrib_id), traz a natureza junto.
    const cLig = d.contrib_id ? contrib.find(c => c.id === d.contrib_id) : null
    const natureza = !cLig ? 'avulsa' : (porId.get(cLig.conta_id)?.papel === 'dizimo' ? 'dizimo' : 'oferta')
    setEditando(d.id)
    setForm({
      data: d.data || '', identificacao: d.identificacao || '', valor: d.valor ?? '', tipo: d.tipo || 'deposito',
      natureza, rem_membro_id: cLig?.membro_id ? String(cLig.membro_id) : (d.membro_id ? String(d.membro_id) : ''),
      rem_nome: cLig?.nome || '', rem_conta_id: natureza === 'oferta' ? String(cLig.conta_id) : '',
    })
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
    if (travado) return aviso('⚠ Mês fechado e assinado. Reabra para lançar.')
    const valor = parseFloat(String(form.valor).replace(',', '.'))
    if (!valor || valor <= 0) return aviso('⚠ Informe um valor.')
    setSalvando(true)
    // Guarda quando é correção: o mesmo formulário grava por cima em vez de criar.
    const gravar = async (tabela, row, setter, desc) => {
      if (editando) {
        const r = await dbUpdate(tabela, editando, row, `Corrigiu ${desc}`)
        if (r?.erro || r?._err) { aviso(`⚠ ${r.erro || 'Não foi possível salvar.'}`); return false }
        setter(l => l.map(x => (x.id === editando ? { ...x, ...row, id: editando } : x)))
        return editando
      } else {
        const novo = await dbInsert(tabela, row, desc)
        const novoId = novo?.id || Date.now()
        setter(l => [...l, { ...row, id: novoId }])
        return novoId
      }
    }
    // Guarda/atualiza a nota fiscal (chave e/ou foto) ligada a uma despesa.
    const salvarNota = async (despId) => {
      const chave = String(form.chave || '').replace(/\D/g, '')
      const tocouFoto = !!form.fotoTocada    // só mexe na foto se a pessoa realmente trocou/removeu
      const jaTem = notaDe.get(despId)
      if (!chave && !tocouFoto && !jaTem) return
      // Monta a linha SEM a foto por padrão: assim o upsert preserva a foto que já
      // existe no banco. Só manda a foto quando a pessoa trocou ou removeu.
      const nrow = { despesa_id: despId, mes_ref: ref, ano: Number(String(ref).slice(0, 4)), chave: chave || null }
      if (tocouFoto) nrow.foto = form.foto || null
      await dbUpsert('fin_notas', nrow, 'despesa_id')
      // No estado guardamos só o "aviso" (chave + se tem foto), nunca o blob pesado.
      const temFoto = tocouFoto ? !!form.foto : !!jaTem?.tem_foto
      const meta = { despesa_id: despId, mes_ref: ref, ano: Number(String(ref).slice(0, 4)), chave: chave || null, tem_foto: temFoto }
      setNotas(l => [...l.filter(n => n.despesa_id !== despId), meta])
    }
    // Remessa gerada por um recebimento "Pix p/ Região": cria, atualiza ou apaga
    // o depósito ligado, conforme a forma escolhida.
    const sincronizarRemessaDoPix = async (contribId, row, nomePessoa) => {
      const existente = depositos.find(d => d.contrib_id === contribId)
      if (row.forma === 'pix_regiao') {
        const drow = {
          mes_ref: ref, data: row.data, identificacao: String(form.ident_pix || '').trim() || nomePessoa || 'Pix p/ Região',
          valor: row.valor, tipo: 'pix_direto', contrib_id: contribId, membro_id: row.membro_id || null,
          criado_por: user?.id || null,
        }
        if (existente) {
          await dbUpdate('fin_depositos', existente.id, drow, 'Remessa (Pix do dízimo)')
          setDepositos(l => l.map(x => x.id === existente.id ? { ...x, ...drow } : x))
        } else {
          const novo = await dbInsert('fin_depositos', drow, 'Remessa (Pix do dízimo)')
          setDepositos(l => [...l, { ...drow, id: novo?.id || Date.now() }])
        }
      } else if (existente) {
        // deixou de ser Pix p/ Região: a remessa automática não faz mais sentido
        await dbDelete('fin_depositos', existente.id, 'Remessa (Pix do dízimo) removida')
        setDepositos(l => l.filter(x => x.id !== existente.id))
      }
    }
    try {
      if (modal === 'receb') {
        const conta = porId.get(Number(form.conta_id))
        if (conta?.recebe_recibo && !form.membro_id && !String(form.nome).trim()) {
          setSalvando(false); return aviso('⚠ Dízimo precisa do nome de quem contribuiu.')
        }
        if (!form.data) { setSalvando(false); return aviso('⚠ Informe a data.') }
        const nomePessoa = form.membro_id
          ? (pessoas.find(p => String(p.id) === String(form.membro_id))?.nome || '')
          : String(form.nome).trim()
        const row = {
          mes_ref: ref, data: form.data, conta_id: Number(form.conta_id),
          membro_id: form.membro_id ? Number(form.membro_id) : null,
          nome: form.membro_id ? null : (nomePessoa || null),
          valor, recibo: String(form.recibo).trim() || null,
          forma: form.forma, pro_caixa_local: !!form.pro_caixa_local,
          criado_por: user?.id || null,
        }
        const contribId = await gravar('fin_contribuicoes', row, setContrib, `${conta?.nome} ${fmt(valor)} — ${nomePessoa || 'avulso'}`)
        if (!contribId) { setSalvando(false); return }
        // Pix direto p/ Região = já é remessa: gera/atualiza o depósito ligado.
        await sincronizarRemessaDoPix(contribId, row, nomePessoa)
      } else if (modal === 'desp') {
        if (!String(form.descricao).trim()) { setSalvando(false); return aviso('⚠ Descreva a despesa.') }
        const conta = porId.get(Number(form.conta_id))
        const temComprovante = !!(String(form.chave || '').replace(/\D/g, '') || form.foto || form.temFoto)
        const row = {
          mes_ref: ref, data: form.data || null, conta_id: Number(form.conta_id),
          descricao: String(form.descricao).trim(), valor,
          pago_por: form.pago_por, finalidade: form.pago_por === 'local' ? (form.finalidade || null) : null,
          tem_nota: !!form.tem_nota || temComprovante, criado_por: user?.id || null,
        }
        const despId = await gravar('fin_despesas', row, setDespesas, `${conta?.nome} ${fmt(valor)}`)
        if (!despId) { setSalvando(false); return }
        await salvarNota(despId)
      } else {
        // Remessa. Pode ser avulsa (só o envio) ou já ser um dízimo/oferta de
        // alguém — nesse caso gera também o recebimento ligado (forma Pix p/ Região).
        const natureza = form.natureza || 'avulsa'
        const depAtual = editando ? depositos.find(d => d.id === editando) : null
        let contribId = null, ident = String(form.identificacao).trim() || null, membroDep = null

        if (natureza === 'dizimo' || natureza === 'oferta') {
          if (!form.data) { setSalvando(false); return aviso('⚠ Informe a data.') }
          const contaId = natureza === 'dizimo' ? contasR.find(c => c.papel === 'dizimo')?.id : Number(form.rem_conta_id)
          if (!contaId) { setSalvando(false); return aviso('⚠ Escolha a conta da oferta.') }
          const conta = porId.get(contaId)
          if (conta?.recebe_recibo && !form.rem_membro_id && !String(form.rem_nome).trim()) { setSalvando(false); return aviso('⚠ Dízimo precisa do nome de quem contribuiu.') }
          const nomeP = form.rem_membro_id ? (pessoas.find(p => String(p.id) === String(form.rem_membro_id))?.nome || '') : String(form.rem_nome).trim()
          membroDep = form.rem_membro_id ? Number(form.rem_membro_id) : null
          ident = String(form.identificacao || '').trim() || nomeP || null
          const crow = {
            mes_ref: ref, data: form.data, conta_id: contaId, membro_id: membroDep,
            nome: membroDep ? null : (nomeP || null), valor, recibo: null,
            forma: 'pix_regiao', pro_caixa_local: false, criado_por: user?.id || null,
          }
          if (depAtual?.contrib_id) {
            const rc = await dbUpdate('fin_contribuicoes', depAtual.contrib_id, crow, 'Recebimento (remessa)')
            if (rc?.erro || rc?._err) { setSalvando(false); return aviso(`⚠ ${rc.erro || 'Não foi possível salvar.'}`) }
            contribId = depAtual.contrib_id
            setContrib(l => l.map(x => x.id === contribId ? { ...x, ...crow, id: contribId } : x))
          } else {
            const nc = await dbInsert('fin_contribuicoes', crow, 'Recebimento (remessa)')
            contribId = nc?.id || Date.now()
            setContrib(l => [...l, { ...crow, id: contribId }])
          }
        } else if (depAtual?.contrib_id) {
          // virou avulsa: desliga e apaga o recebimento que existia
          await dbUpdate('fin_depositos', depAtual.id, { contrib_id: null }, null)
          await dbDelete('fin_contribuicoes', depAtual.contrib_id, 'Recebimento (remessa) removido')
          setContrib(l => l.filter(x => x.id !== depAtual.contrib_id))
        }

        const row = {
          mes_ref: ref, data: form.data || null, identificacao: ident,
          valor, tipo: form.tipo, contrib_id: contribId, membro_id: membroDep,
          criado_por: user?.id || null,
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
    if (travado) return aviso('⚠ Mês fechado e assinado. Reabra para alterar.')
    if (!confirm(`Apagar ${desc}?`)) return
    // Remessa que é dízimo/oferta: apagar leva o recebimento junto (e vice-versa).
    if (tabela === 'fin_depositos') {
      const dep = depositos.find(d => d.id === id)
      if (dep?.contrib_id) {
        await dbDelete('fin_contribuicoes', dep.contrib_id, desc)
        setContrib(l => l.filter(x => x.id !== dep.contrib_id))
        setDepositos(l => l.filter(x => x.id !== id))
        return
      }
    }
    await dbDelete(tabela, id, desc)
    setter(l => l.filter(x => x.id !== id))
    // Recebimento Pix p/ Região: o banco apaga a remessa em cascata; reflete na tela.
    if (tabela === 'fin_contribuicoes') setDepositos(l => l.filter(d => d.contrib_id !== id))
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
        {!travado && !c.codigo_recibo && (<>
          <Btn variant="outline" size="xs" onClick={() => editarReceb(c)}><Pencil size={13} /></Btn>{' '}
          <Btn variant="danger" size="xs" onClick={() => excluir('fin_contribuicoes', c.id, setContrib, `recebimento de ${nomeDe(c)}`)}><Trash2 size={13} /></Btn>
        </>)}
        {c.codigo_recibo && !c.estornado_em && (
          <Btn variant="outline" size="xs" onClick={() => estornar(c)}>Estornar</Btn>
        )}
      </td>
    </tr>
  )

  // Grupo recolhido (só o total; abre a setinha para ver a discriminação). Usado
  // para Ofertas de Sábado e de Domingo, igual ao dízimo.
  const grupoRecolhido = (key, label, itens) => itens.length === 0 ? null : (
    <>
      <tr style={{ borderTop: '1px solid var(--bd)', cursor: 'pointer', background: grupoAberto[key] ? 'var(--s2)' : 'transparent' }}
        onClick={() => setGrupoAberto(g => ({ ...g, [key]: !g[key] }))}>
        <td style={td}>—</td>
        <td style={{ ...td, fontWeight: 700, color: 'var(--w)' }}>
          <span style={{ color: 'var(--cy)', marginRight: 6 }}>{grupoAberto[key] ? '▾' : '▸'}</span>
          {label} <span style={{ fontWeight: 400, color: 'var(--g)', fontSize: 11.5 }}>({itens.length} lançamento{itens.length > 1 ? 's' : ''} — toque para {grupoAberto[key] ? 'ocultar' : 'ver'})</span>
        </td>
        <td style={td}><Tag color="gray">OFERTA</Tag></td>
        <td style={td}></td>
        <td style={td}></td>
        <td style={{ ...td, fontWeight: 700, color: 'var(--grn)' }}>{fmt(totalDe(itens))}</td>
        <td style={td}></td>
      </tr>
      {grupoAberto[key] && [...itens].sort((a, b) => String(a.data).localeCompare(String(b.data))).map(c => linhaReceb(c, true))}
    </>
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
          <Btn variant="outline" onClick={() => setRelModal(true)}><Printer size={15} /> Relatório</Btn>
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
          Mês importado da planilha oficial — os totais estão travados no valor oficial. Você já pode
          ajustar os lançamentos e o detalhamento do caixa local (a numeração do talão fica como veio).
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
            { id: 'analitico', label: '📊 Analítico' },
            { id: 'config', label: 'Configuração' },
          ]}
        />
      </div>

      {/* ---------------- RECEBIMENTOS ---------------- */}
      {aba === 'receb' && (
        <div className="no-print">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <Btn onClick={abrirReceb} disabled={travado}><Plus size={15} /> Recebimento</Btn>
          </div>
          <div className="table-scroll" style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Data', 'Quem', 'Conta', 'Recibo', 'Forma', 'Valor', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {contrib.length === 0
                  ? <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--g)', padding: 22, fontSize: 13 }}>Nada recebido em {MESES[mes]}.</td></tr>
                  : <>
                    {/* Demais ofertas/entradas: aparecem normalmente */}
                    {[...oferResto].sort((a, b) => String(a.data).localeCompare(String(b.data))).map(c => linhaReceb(c))}

                    {/* Ofertas de Sábado e Domingo: recolhidas num total (abre na setinha) */}
                    {grupoRecolhido('sab', contaSab?.nome || 'Ofertas Voluntárias de Sábados', oferSab)}
                    {grupoRecolhido('dom', contaDom?.nome || 'Ofertas Voluntárias de Domingos', oferDom)}

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
            <Btn onClick={abrirDesp} disabled={travado}><Plus size={15} /> Despesa</Btn>
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
                      <td style={{ ...td, cursor: 'pointer', color: 'var(--cy)', textDecoration: 'underline', textDecorationColor: 'var(--bd)' }} title="Ver lançamento" onClick={() => editarDesp(d)}>{d.descricao}</td>
                      <td style={td}><Tag color="gray">{porId.get(d.conta_id)?.nome || '?'}</Tag></td>
                      <td style={td}><Tag color={d.pago_por === 'local' ? 'cyan' : 'gray'}>{d.pago_por === 'local' ? 'CAIXA LOCAL' : 'REGIÃO'}</Tag></td>
                      <td style={td}>{d.finalidade || '—'}</td>
                      <td style={td}>{(() => {
                        const nt = notaDe.get(d.id)
                        const partes = []
                        if (nt?.chave) partes.push(<a key="k" href={sefazUrl(nt.chave)} target="_blank" rel="noreferrer" title={nt.chave} style={{ color: 'var(--cy)', textDecoration: 'none' }}>🔗 chave</a>)
                        if (nt?.tem_foto) partes.push(<button key="f" title="ver a nota" onClick={async () => { const f = await dbNotaFoto(d.id); if (f) verNota(f); else aviso('⚠ Não consegui carregar a nota.') }} style={{ background: 'none', border: '1px solid var(--bd)', borderRadius: 5, color: 'var(--cy)', fontSize: 11, cursor: 'pointer', padding: '2px 7px' }}>📎 ver</button>)
                        if (partes.length) return <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{partes}</span>
                        return d.pago_por === 'local' ? <span style={{ color: 'var(--yel)' }}>falta</span> : '—'
                      })()}</td>
                      <td style={{ ...td, fontWeight: 600, color: 'var(--red)' }}>{fmt(d.valor)}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{!travado && (<>
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
            <Btn onClick={abrirRemessa} disabled={travado}><Plus size={15} /> Envio</Btn>
          </div>
          <div className="table-scroll" style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Data', 'Identificação', 'Tipo', 'Valor', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {depositos.length === 0
                  ? <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--g)', padding: 22, fontSize: 13 }}>Nada enviado ainda.</td></tr>
                  : [...depositos].sort((a, b) => String(a.data).localeCompare(String(b.data))).map(d => {
                    const cl = d.contrib_id ? contrib.find(c => c.id === d.contrib_id) : null
                    const ehDizimo = cl && porId.get(cl.conta_id)?.papel === 'dizimo'
                    const dono = cl ? nomeDe(cl) : null
                    return (
                    <tr key={d.id} style={{ borderTop: '1px solid var(--bd)' }}>
                      <td style={td}>{d.data ? new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                      <td style={td}>
                        {d.identificacao || '—'}
                        {cl && <span style={{ marginLeft: 6 }}><Tag color={ehDizimo ? 'green' : 'cyan'}>{ehDizimo ? 'DÍZIMO' : 'OFERTA'}{dono && dono !== d.identificacao ? ` · ${dono}` : ''}</Tag></span>}
                      </td>
                      <td style={td}><Tag color="gray">{d.tipo === 'pix_direto' ? 'PIX' : d.tipo}</Tag></td>
                      <td style={{ ...td, fontWeight: 600 }}>{fmt(d.valor)}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{!travado && (<>
                        <Btn variant="outline" size="xs" onClick={() => editarRemessa(d)}><Pencil size={13} /></Btn>{' '}
                        <Btn variant="danger" size="xs" onClick={() => excluir('fin_depositos', d.id, setDepositos, `envio de ${fmt(d.valor)}`)}><Trash2 size={13} /></Btn>
                      </>)}</td>
                    </tr>
                  )})}
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

      {/* ---------------- ANALÍTICO DO MÊS ---------------- */}
      {aba === 'analitico' && (() => {
        const contasRAtivas = contas.filter(c => c.lado === 'R' && c.ativo).sort((a, b) => a.ordem - b.ordem)
        const contasDAtivas = contas.filter(c => c.lado === 'D' && c.ativo).sort((a, b) => a.ordem - b.ordem)
        const entrada = (id) => Number(r.entradasPorConta.get(id) || 0)
        const saida = {}
        despesas.forEach(d => { const g = (saida[d.conta_id] || (saida[d.conta_id] = { regiao: 0, local: 0, total: 0 })); const v = Number(d.valor) || 0; g.total += v; if (d.pago_por === 'local') g.local += v; else g.regiao += v })
        // Oferta é oferta; a "Baixa de Concessão" é lado R, mas NÃO é oferta —
        // é só o espelho do que o caixa local gastou. Fora da soma de ofertas.
        const ofertas = contasRAtivas.filter(c => c.papel !== 'dizimo' && c.papel !== 'baixa').reduce((a, c) => a + entrada(c.id), 0)
        const pc = (v, t) => t ? Math.round(v / t * 100) + '%' : '0%'
        const card = (l, v, cor) => (
          <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 8.5, color: 'var(--g)', letterSpacing: 1.2, textTransform: 'uppercase' }}>{l}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: cor, marginTop: 3 }}>{fmt(v)}</div>
          </div>
        )
        return (
          <div className="no-print">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
              {card('Dízimo bruto', r.dizimoBruto, 'var(--grn)')}
              {card('Ofertas', ofertas, 'var(--grn)')}
              {card('Concessão (5%)', r.concessao, 'var(--cy)')}
              {card('Entradas (TR)', r.totalEntradas, 'var(--grn)')}
              {card('Saídas (TD)', r.totalSaidas, 'var(--red)')}
              {card('Pago pela Região', r.pagoRegiao, 'var(--tx)')}
              {card('Pago pela Igreja', r.pagoLocal, 'var(--cy)')}
              {card('Caixa local', r.saldoCaixa, 'var(--w)')}
            </div>

            <div style={{ fontSize: 11, color: 'var(--g)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Entradas por tipo</div>
            <div className="table-scroll" style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, marginBottom: 18 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Conta', 'Valor', '% do total'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {contasRAtivas.filter(c => entrada(c.id) > 0).map(c => (
                    <tr key={c.id} style={{ borderTop: '1px solid var(--bd)' }}>
                      <td style={td}>{c.nome}</td>
                      <td style={{ ...td, fontWeight: 600, color: 'var(--grn)' }}>{fmt(entrada(c.id))}</td>
                      <td style={{ ...td, color: 'var(--g)' }}>{pc(entrada(c.id), r.totalEntradas)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid var(--bd)' }}>
                    <td style={{ ...td, fontWeight: 700 }}>TOTAL DAS ENTRADAS</td>
                    <td style={{ ...td, fontWeight: 700, color: 'var(--grn)' }}>{fmt(r.totalEntradas)}</td><td style={td}></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ fontSize: 11, color: 'var(--g)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Despesas por categoria — quem pagou</div>
            <div className="table-scroll" style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Categoria', 'Região', 'Igreja local', 'Total'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {contasDAtivas.filter(c => saida[c.id]?.total > 0).map(c => (
                    <tr key={c.id} style={{ borderTop: '1px solid var(--bd)' }}>
                      <td style={td}>{c.nome}</td>
                      <td style={td}>{saida[c.id].regiao ? fmt(saida[c.id].regiao) : '—'}</td>
                      <td style={{ ...td, color: saida[c.id].local ? 'var(--cy)' : 'var(--g)' }}>{saida[c.id].local ? fmt(saida[c.id].local) : '—'}</td>
                      <td style={{ ...td, fontWeight: 600, color: 'var(--red)' }}>{fmt(saida[c.id].total)}</td>
                    </tr>
                  ))}
                  {(() => {
                    // A concessão (5%) entra no total das saídas, mas não é paga pela
                    // Região nem pela Igreja — é retida. Mostrada aqui para a conta fechar.
                    const retida = Math.round((r.totalSaidas - r.pagoRegiao - r.pagoLocal) * 100) / 100
                    if (retida < 0.005) return null
                    return (
                      <tr style={{ borderTop: '1px solid var(--bd)' }}>
                        <td style={td}>Concessão (5% retida na igreja)</td>
                        <td style={td}>—</td>
                        <td style={td}>—</td>
                        <td style={{ ...td, fontWeight: 600, color: 'var(--red)' }}>{fmt(retida)}</td>
                      </tr>
                    )
                  })()}
                  <tr style={{ borderTop: '2px solid var(--bd)' }}>
                    <td style={{ ...td, fontWeight: 700 }}>TOTAL DAS SAÍDAS</td>
                    <td style={{ ...td, fontWeight: 700 }}>{fmt(r.pagoRegiao)}</td>
                    <td style={{ ...td, fontWeight: 700, color: 'var(--cy)' }}>{fmt(r.pagoLocal)}</td>
                    <td style={{ ...td, fontWeight: 700, color: 'var(--red)' }}>{fmt(r.totalSaidas)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {/* ---------------- CONFIGURAÇÃO ---------------- */}
      {aba === 'config' && <Configuracao aviso={aviso} />}

      {/* ---------------- IMPRESSÃO ----------------
          Renderizado direto no <body> (fora do layout com altura fixa/rolagem): senão
          o relatório não ancora no topo da folha e saem páginas em branco. */}
      {createPortal(
        <>
          <RelatorioImpressao
            mes={mes} ano={ano} contas={contas} r={r} recibos={recibos}
            contrib={contrib} nomeDe={nomeDe} depositos={depositos} despesas={despesas} notas={notas}
            mostrar={relSel} assinaturas={assinaturas}
          />
          {notasPrint && notasPrint.length > 0 && (
            <div className="print-mapa">
              {notasPrint.map((n, i) => (
                <div key={n.key} style={{ pageBreakBefore: (i === 0 && !relSel.oficial && !relSel.caixa) ? undefined : 'always', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{n.descricao}</div>
                  <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>
                    {fmt(n.valor)}{n.data ? ` · ${new Date(n.data + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
                  </div>
                  <img src={n.img} alt="nota" style={{ maxWidth: '100%', maxHeight: '165mm', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                  <BlocoAssinaturas a={assinaturas} compacto />
                </div>
              ))}
            </div>
          )}
        </>,
        document.body
      )}

      {/* Janela "Gerar relatório" — escolhe o que vai sair no PDF */}
      {relModal && (
        <Modal title="Gerar relatório" onClose={() => setRelModal(false)}>
          <div style={{ fontSize: 13, color: 'var(--gl)', marginBottom: 10 }}>Marque o que você quer que saia:</div>
          {[
            ['oficial', 'Planilha oficial', 'A folha que vai para a Região'],
            ['caixa', 'Caixa local', 'O detalhamento interno (5% e gastos)'],
            ['notas', 'Notas fiscais', 'Cada nota anexada em uma página'],
          ].map(([k, titulo, dica]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', cursor: 'pointer', borderTop: '1px solid var(--bd)' }}>
              <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={!!relSel[k]} onChange={e => setRelSel(s => ({ ...s, [k]: e.target.checked }))} />
              <div>
                <div style={{ fontSize: 14, color: 'var(--w)', fontWeight: 600 }}>{titulo}</div>
                <div style={{ fontSize: 11.5, color: 'var(--g)' }}>{dica}</div>
              </div>
            </label>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Btn onClick={gerarRelatorio} disabled={prepNotas}><Printer size={15} /> {prepNotas ? 'Gerando…' : 'Baixar PDF'}</Btn>
            <Btn variant="outline" onClick={() => setRelModal(false)}>Cancelar</Btn>
          </div>
        </Modal>
      )}
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
                <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value.toUpperCase() })} placeholder="deixe vazio se for oferta do culto" />
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
            {form.forma === 'pix_regiao' && (
              <FG full><label>Identificação no extrato/Pix (opcional)</label>
                <input value={form.ident_pix || ''} onChange={e => setForm({ ...form, ident_pix: e.target.value.toUpperCase() })} placeholder="nome que aparece no Pix, se for diferente (ex.: conta da filha)" />
                <span style={{ fontSize: 11.5, color: 'var(--g)', marginTop: 4, display: 'block' }}>
                  Vai para a remessa enviada, para o tesoureiro achar no extrato. O valor continua contando para quem contribuiu, acima.
                </span>
              </FG>
            )}
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

          {/* ---- Nota fiscal: chave (link) e/ou foto ---- */}
          <div style={{ marginTop: 14, borderTop: '1px solid var(--bd)', paddingTop: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--g)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Nota fiscal (opcional)</div>
            <label style={{ fontSize: 12, color: 'var(--gl)', display: 'block', marginBottom: 4 }}>Chave de acesso (44 dígitos)</label>
            <input inputMode="numeric" value={form.chave || ''} placeholder="cole aqui a chave de 44 números"
              onChange={e => setForm({ ...form, chave: e.target.value })} />
            {(() => {
              const ch = String(form.chave || '').replace(/\D/g, '')
              if (!ch) return null
              if (ch.length !== 44) return <div style={{ fontSize: 11.5, color: 'var(--yel)', marginTop: 4 }}>A chave tem {ch.length} de 44 dígitos.</div>
              return <a href={`https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo&nfe=${ch}`} target="_blank" rel="noreferrer"
                style={{ fontSize: 11.5, color: 'var(--cy)', marginTop: 4, display: 'inline-block' }}>✓ chave completa — consultar na Sefaz</a>
            })()}

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--gl)', display: 'block', marginBottom: 4 }}>Foto ou PDF da nota (quando não tem chave)</label>
              {form.foto
                ? <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {String(form.foto).startsWith('data:application/pdf')
                      ? <button type="button" onClick={() => verNota(form.foto)} title="abrir o PDF" style={{ width: 54, height: 54, borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--s2)', color: 'var(--cy)', fontSize: 11, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>📄<span style={{ fontSize: 9 }}>PDF</span></button>
                      : <img src={form.foto} alt="nota" title="tocar para ampliar" onClick={() => verNota(form.foto)} style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--bd)', cursor: 'pointer' }} />}
                    <Btn variant="danger" size="xs" onClick={() => setForm({ ...form, foto: null, fotoTocada: true })}>Remover</Btn>
                  </div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {form.temFoto && <div><Btn variant="outline" size="xs" onClick={async () => { const f = await dbNotaFoto(editando); if (f) setForm(fm => ({ ...fm, foto: f })); else aviso('⚠ Não consegui carregar a nota.') }}>📎 Ver nota anexada</Btn></div>}
                    <input type="file" accept="image/*,application/pdf" onChange={async e => {
                      const f = e.target.files?.[0]; if (!f) return
                      aviso('Lendo o arquivo…')
                      try { const d = await fotoParaDataURL(f); setForm(fm => ({ ...fm, foto: d, fotoTocada: true })) }
                      catch { aviso('⚠ Não foi possível ler o arquivo.') }
                    }} />
                  </div>}
            </div>
          </div>

          <div style={{ fontSize: 12, color: 'var(--g)', marginTop: 12 }}>
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
            <FG full><label>O que é essa remessa?</label>
              <select value={form.natureza || 'avulsa'} onChange={e => setForm({ ...form, natureza: e.target.value })}>
                <option value="avulsa">Remessa avulsa (saldo geral)</option>
                <option value="dizimo">Dízimo de uma pessoa</option>
                <option value="oferta">Oferta</option>
              </select>
              <span style={{ fontSize: 11.5, color: 'var(--g)', marginTop: 4, display: 'block' }}>
                Se for dízimo ou oferta, o sistema já lança o recebimento no nome da pessoa — sem digitar duas vezes.
              </span>
            </FG>
            {form.natureza === 'oferta' && (
              <FG full><label>Conta da oferta</label>
                <select value={form.rem_conta_id} onChange={e => setForm({ ...form, rem_conta_id: e.target.value })}>
                  <option value="">— escolher —</option>
                  {contasR.filter(c => c.papel !== 'dizimo').map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </FG>
            )}
            {(form.natureza === 'dizimo' || form.natureza === 'oferta') && (<>
              <FG full><label>Quem contribuiu{form.natureza === 'oferta' ? ' (opcional)' : ''}</label>
                <select value={form.rem_membro_id} onChange={e => setForm({ ...form, rem_membro_id: e.target.value })}>
                  <option value="">— digitar o nome / avulsa —</option>
                  {[...pessoas].sort((a, b) => a.nome.localeCompare(b.nome)).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </FG>
              {!form.rem_membro_id && (
                <FG full><label>Nome (se não for do cadastro)</label>
                  <input value={form.rem_nome} onChange={e => setForm({ ...form, rem_nome: e.target.value.toUpperCase() })} placeholder="nome de quem contribuiu" />
                </FG>
              )}
            </>)}
            <FG full><label>Identificação no extrato{form.natureza === 'avulsa' ? '' : ' (opcional)'}</label>
              <input value={form.identificacao} onChange={e => setForm({ ...form, identificacao: e.target.value.toUpperCase() })}
                placeholder={form.natureza === 'avulsa' ? 'ex.: saldo de julho enviado por Pix' : 'nome que aparece no Pix, se for diferente'} />
              {form.natureza !== 'avulsa' && (
                <span style={{ fontSize: 11.5, color: 'var(--g)', marginTop: 4, display: 'block' }}>
                  É o que o tesoureiro vê no extrato. Se vazio, usa o nome de quem contribuiu.
                </span>
              )}
            </FG>
            <FG><label>Valor (R$)</label><input type="number" step="0.01" inputMode="decimal" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} /></FG>
          </FormGrid>
          <div style={{ fontSize: 12, color: 'var(--g)', marginTop: 10 }}>
            Falta enviar deste mês: <b style={{ color: 'var(--tx)' }}>{fmt(r.faltaRemeter)}</b>
          </div>
        </Modal>
      )}

      {/* Nota em tela cheia — toque fora para fechar. PDF abre no leitor; imagem como foto. */}
      {verFoto && (() => {
        const ehPdf = String(verFoto).startsWith('data:application/pdf')
        return (
          <div onClick={() => setVerFoto(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, cursor: 'zoom-out' }}>
            {ehPdf
              ? <iframe title="nota" src={verFoto} onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 820, height: '90%', border: 'none', borderRadius: 8, background: '#fff' }} />
              : <img src={verFoto} alt="nota" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />}
          </div>
        )
      })()}
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
const META_DIZ = {
  fiel: { label: 'Dizimaram sempre', cor: 'grn' },
  parcial: { label: 'Dizimaram às vezes', cor: 'cy' },
  faltou: { label: 'Faltaram na janela', cor: 'yel' },
  nunca: { label: 'Nunca dizimaram', cor: 'g' },
}
const ORDEM_DIZ = { faltou: 0, parcial: 1, nunca: 2, fiel: 3 }
const subMes = (ym, k) => { let [a, m] = ym.split('-').map(Number); m -= k; while (m <= 0) { m += 12; a-- } return `${a}-${String(m).padStart(2, '0')}` }
const mesesEntre = (d1, d2) => { const [a1, m1] = d1.split('-').map(Number), [a2, m2] = d2.split('-').map(Number); return (a2 - a1) * 12 + (m2 - m1) + 1 }
const brMes = (ym) => ym ? ym.split('-').reverse().join('/') : ''

function VisaoGlobal({ ano }) {
  const { state } = useStore()
  const pessoas = (state.membrosTodos?.length ? state.membrosTodos : state.membros) || []

  const [contrib, setContrib] = useState(null)
  const [despesas, setDespesas] = useState(null)
  const [contas, setContas] = useState(null)
  const [janela, setJanela] = useState('m12')  // m1|m3|m6|m12|m24|ano|tudo|periodo
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
  const mesesComDado = new Set(contrib.filter(c => idsDizimo.has(c.conta_id)).map(c => String(c.mes_ref || '').slice(0, 7)))
  const MES_ATUAL = new Date().toISOString().slice(0, 7)

  // ---- A janela de tempo escolhida define TUDO (panorama + prestação) ----
  let jDe = null, jAte = null, jN = 0, jRot = ''
  if (janela === 'tudo') { jN = mesesComDado.size || 1; jRot = 'em todo o período' }
  else if (janela === 'ano') { jDe = `${anoSel}-01`; jAte = `${anoSel}-12`; jN = [...mesesComDado].filter(m => m >= jDe && m <= jAte).length || 1; jRot = `em ${anoSel}` }
  else if (janela === 'periodo') {
    jDe = de || null; jAte = ate || null
    jN = (de && ate) ? mesesEntre(de, ate) : [...mesesComDado].filter(m => (!de || m >= de) && (!ate || m <= ate)).length || 1
    jRot = `de ${de ? brMes(de) : '…'} a ${ate ? brMes(ate) : '…'}`
  } else {
    // A janela termina no ÚLTIMO mês com dízimo lançado — não no mês atual, que pode
    // estar vazio/incompleto (senão todo mundo "falta" o mês corrente). E jN conta só
    // os meses que REALMENTE têm lançamento, para um mês não carregado não penalizar.
    const k = { m1: 1, m3: 3, m6: 6, m12: 12, m24: 24 }[janela]
    const ultimoDado = [...mesesComDado].sort().reverse()[0] || MES_ATUAL
    jAte = ultimoDado; jDe = subMes(ultimoDado, k - 1)
    jN = [...mesesComDado].filter(m => m >= jDe && m <= jAte).length || 1
    jRot = k === 1 ? 'no último mês' : `nos últimos ${k} meses`
  }
  const naJanela = (mes_ref) => { const ym = String(mes_ref || '').slice(0, 7); return (!jDe || ym >= jDe) && (!jAte || ym <= jAte) }

  // ---- Por membro: quantas vezes e quanto na janela; último de todos os tempos ----
  const porMembro = new Map()
  for (const c of contrib) {
    if (!c.membro_id || c.estornado_em || !idsDizimo.has(c.conta_id)) continue
    const ym = String(c.mes_ref || '').slice(0, 7)
    let g = porMembro.get(c.membro_id); if (!g) { g = { total: 0, meses: new Set(), ultimo: null }; porMembro.set(c.membro_id, g) }
    if (!g.ultimo || ym > g.ultimo) g.ultimo = ym
    if (naJanela(c.mes_ref)) { g.total += Number(c.valor) || 0; g.meses.add(ym) }
  }
  const linhas = pessoas.map(p => {
    const g = porMembro.get(p.id)
    const vezes = g ? g.meses.size : 0
    const grupo = !g || !g.ultimo ? 'nunca' : vezes === 0 ? 'faltou' : (jN && vezes >= jN) ? 'fiel' : 'parcial'
    return { id: p.id, nome: p.nome, ativo: p.ativo, batizado: p.batizado, tel: p.tel, grupo, vezes, total: g ? g.total : 0, ultimo: g?.ultimo || null }
  }).filter(d => (!soAtivos || d.ativo) && (!busca || d.nome.toLowerCase().includes(busca.toLowerCase())))
  const contagem = { fiel: 0, parcial: 0, faltou: 0, nunca: 0 }; for (const d of linhas) contagem[d.grupo]++
  const dica = { fiel: `Dizimaram nos ${jN} meses`, parcial: `Parte dos ${jN} meses`, faltou: `Nada ${jRot}, mas já deram`, nunca: 'Sem nenhum dízimo' }
  const listaP = (filtro === 'todos' ? linhas : linhas.filter(d => d.grupo === filtro))
    .sort((a, b) => (ORDEM_DIZ[a.grupo] - ORDEM_DIZ[b.grupo]) || (b.total - a.total) || a.nome.localeCompare(b.nome))

  // ---- Prestação de contas: o que a igreja investiu do caixa local na janela ----
  const despEscopo = despesas.filter(d => d.pago_por === 'local' && naJanela(d.mes_ref))
  const grupos = porFinalidade(despEscopo)
  const totalInvest = grupos.reduce((a, g) => a + g.total, 0)

  const chip = (id, txt) => (
    <button key={id} onClick={() => setJanela(id)} style={{
      padding: '7px 12px', borderRadius: 8, fontSize: 12.5, cursor: 'pointer',
      border: `1px solid ${janela === id ? 'var(--cy)' : 'var(--bd)'}`,
      background: janela === id ? 'var(--s2)' : 'var(--s1)', color: janela === id ? 'var(--w)' : 'var(--gl)',
    }}>{txt}</button>
  )

  return (
    <div className="no-print">
      {/* Seletor de janela — tudo abaixo oscila com ela */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
        {chip('m1', 'Último mês')}{chip('m3', '3 meses')}{chip('m6', '6 meses')}{chip('m12', '12 meses')}{chip('m24', '24 meses')}
        {chip('ano', 'Ano')}{chip('tudo', 'Tudo')}{chip('periodo', 'Período')}
        {janela === 'ano' && (
          <select value={anoSel} onChange={e => setAnoSel(e.target.value)} style={{ marginLeft: 4 }}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        {janela === 'periodo' && (
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: 'var(--g)' }}>
            de <input type="month" value={de} onChange={e => setDe(e.target.value)} />
            até <input type="month" value={ate} onChange={e => setAte(e.target.value)} />
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--cy)', marginBottom: 14 }}>Janela: <b>{jRot}</b>{jDe && jAte ? ` (${brMes(jDe)} a ${brMes(jAte)})` : ''} — {jN} {jN === 1 ? 'mês' : 'meses'}.</div>

      {/* ===== Panorama dos dizimistas ===== */}
      <div style={{ fontSize: 12.5, color: 'var(--gl)', marginBottom: 12, lineHeight: 1.5 }}>
        Uma leitura do rebanho, não uma cobrança. Muda a janela acima e os números se movem: veja quem dizimou, quantas vezes, e quem faltou no período. O telefone está do lado para procurar a pessoa.
      </div>
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 12 }}>
        {Object.entries(contagem).map(([chave, n]) => {
          const meta = META_DIZ[chave]; const sel = filtro === chave
          return (
            <div key={chave} onClick={() => setFiltro(sel ? 'todos' : chave)}
              style={{ cursor: 'pointer', flex: '1 1 130px', background: sel ? 'var(--s2)' : 'var(--s1)', border: `1px solid ${sel ? 'var(--cy)' : 'var(--bd)'}`, borderRadius: 10, padding: '11px 13px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: `var(--${meta.cor})` }}>{n}</div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--w)', marginTop: 1 }}>{meta.label}</div>
              <div style={{ fontSize: 10, color: 'var(--g)', marginTop: 2, lineHeight: 1.3 }}>{dica[chave]}</div>
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
              <div style={{ width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: `var(--${META_DIZ[d.grupo].cor})` }} />
              <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--w)', fontWeight: 600 }}>{d.nome} {!d.ativo && <span style={{ fontSize: 10, color: 'var(--g)' }}>(inativo)</span>}</div>
                <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 1 }}>
                  {d.grupo === 'nunca'
                    ? (d.batizado ? 'Membro batizado, sem dízimo registrado' : 'Sem dízimo registrado')
                    : `dizimou ${d.vezes} de ${jN} ${jN === 1 ? 'mês' : 'meses'}${d.vezes < jN ? ` · faltou ${jN - d.vezes}` : ''}${d.ultimo ? ` · último ${brMes(d.ultimo)}` : ''}`}
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
        <div style={{ fontSize: 9, color: 'var(--g)', letterSpacing: 2, textTransform: 'uppercase' }}>Investido pela igreja (caixa local) {jRot}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: 'var(--cy)', marginTop: 4 }}>{fmt(totalInvest)}</div>
        <div style={{ fontSize: 11.5, color: 'var(--g)', marginTop: 3 }}>{despEscopo.length} lançamento{despEscopo.length !== 1 ? 's' : ''} · dinheiro do caixa local (concessão)</div>
      </div>
      {!grupos.length ? <Empty text={`A igreja não gastou do caixa local ${jRot}.`} /> : (<>
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
function RelatorioImpressao({ mes, ano, contas, r, recibos, contrib, nomeDe, depositos, despesas = [], notas = [], mostrar = { oficial: true, caixa: true }, assinaturas = {} }) {
  if (!mostrar.oficial && !mostrar.caixa) return null
  const notaDe = new Map(notas.map(n => [n.despesa_id, n]))
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

  const tdp = { padding: '1px 4px', border: '1px solid #bbb', fontSize: 9, lineHeight: 1.2 }
  const num = { ...tdp, textAlign: 'right', whiteSpace: 'nowrap' }

  return (
    <div className="print-mapa">
     <div className="folha-oficial" style={{ display: mostrar.oficial ? undefined : 'none' }}>
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
        <table style={{ flex: '38 1 0', minWidth: 0, borderCollapse: 'collapse' }}>
          <thead><tr><th style={tdp}>Contribuições (Entradas)</th><th style={tdp}>Cód.</th><th style={tdp}>Sub-Totais</th><th style={tdp}>Perc</th></tr></thead>
          <tbody>
            {linhas('R').map(c => (
              <tr key={c.id}><td style={tdp}>{c.nome}</td><td style={tdp}>R {c.codigo}</td>
                <td style={num}>{valor(c) ? fmt(valor(c)) : ''}</td>
                <td style={num}>{perc(valor(c), r.totalEntradas)}</td></tr>
            ))}
            <tr><td style={{ ...tdp, fontWeight: 700 }}>TOTAL DAS ENTRADAS (TR)</td><td style={tdp}></td>
              <td style={{ ...num, fontWeight: 700 }}>{fmt(r.totalEntradas)}</td><td style={num}></td></tr>
            <tr><td style={{ ...tdp, fontWeight: 700 }}>SALDO PARA REMESSA (TR − TD)</td><td style={tdp}></td>
              <td style={{ ...num, fontWeight: 700 }}>{fmt(r.saldoRemessa)}</td>
              <td style={num}>{perc(r.saldoRemessa, r.totalEntradas)}</td></tr>
          </tbody>
        </table>

        {/* saídas */}
        <table style={{ flex: '34 1 0', minWidth: 0, borderCollapse: 'collapse' }}>
          <thead><tr><th style={tdp}>Despesas (Saídas)</th><th style={tdp}>Cód.</th><th style={tdp}>Valor</th><th style={tdp}>Perc</th></tr></thead>
          <tbody>
            {linhas('D').map(c => (
              <tr key={c.id}><td style={tdp}>{c.nome}</td><td style={tdp}>D {c.codigo}</td>
                <td style={num}>{valor(c) ? fmt(valor(c)) : ''}</td>
                <td style={num}>{perc(valor(c), r.totalEntradas)}</td></tr>
            ))}
            <tr><td style={{ ...tdp, fontWeight: 700 }}>TOTAL DAS SAÍDAS (TD)</td><td style={tdp}></td>
              <td style={{ ...num, fontWeight: 700 }}>{fmt(r.totalSaidas)}</td>
              <td style={num}>{perc(r.totalSaidas, r.totalEntradas)}</td></tr>
          </tbody>
        </table>

        {/* dizimistas */}
        <table style={{ flex: '28 1 0', minWidth: 0, borderCollapse: 'collapse' }}>
          <thead><tr><th style={tdp}>DIZIMISTAS</th><th style={tdp}>RECIBO</th><th style={tdp}>VALOR</th></tr></thead>
          <tbody>
            {dizimistas.map(c => (
              <tr key={c.id}><td style={{ ...tdp, textTransform: 'uppercase' }}>{nomeDe(c)}</td><td style={tdp}>{c.recibo || ''}</td>
                <td style={num}>{fmt(c.valor)}</td></tr>
            ))}
            <tr><td style={{ ...tdp, fontWeight: 700 }}>TOTAL</td><td style={tdp}></td>
              <td style={{ ...num, fontWeight: 700 }}>{fmt(r.dizimoBruto)}</td></tr>
          </tbody>
        </table>
      </div>

      {/* rodapé */}
      <div style={{ display: 'flex', gap: 8, marginTop: 5 }}>
        <table style={{ flex: '1 1 0', minWidth: 0, borderCollapse: 'collapse' }}>
          <thead><tr><th style={tdp} colSpan="3">IDENTIFICAÇÃO DOS DEPÓSITOS</th></tr></thead>
          <tbody>
            {depositos.map(d => (
              <tr key={d.id}><td style={tdp}>{d.data ? new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</td>
                <td style={{ ...tdp, textTransform: 'uppercase' }}>{d.identificacao || ''}</td><td style={num}>{fmt(d.valor)}</td></tr>
            ))}
            <tr><td style={{ ...tdp, fontWeight: 700 }} colSpan="2">TOTAL DA REMESSA (TRE)</td>
              <td style={{ ...num, fontWeight: 700 }}>{fmt(r.depositado)}</td></tr>
          </tbody>
        </table>
        <table style={{ flex: '1 1 0', minWidth: 0, borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td style={tdp}>Saldo anterior caixa local</td><td style={num}>{fmt(r.saldoAnterior)}</td></tr>
            <tr><td style={tdp}>Saldo atual caixa local</td><td style={num}>{fmt(r.saldoCaixa)}</td></tr>
            <tr><td style={{ ...tdp, fontWeight: 700 }}>SALDO PARA REMESSA</td><td style={{ ...num, fontWeight: 700 }}>{fmt(r.faltaRemeter)}</td></tr>
            <tr><td style={tdp}>Nº do Recibo Inicial</td><td style={num}>{recibos.inicial}</td></tr>
            <tr><td style={tdp}>Nº do Recibo Final</td><td style={num}>{recibos.final}</td></tr>
            <tr><td style={tdp}>Quantidade de Recibos Utilizados</td><td style={num}>{recibos.quantidade}</td></tr>
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 8, marginTop: 6 }}>1ª Via Convenção · 2ª Via Igreja · 3ª Via Contribuinte</div>
      <BlocoAssinaturas a={assinaturas} />
     </div>

      {/* ============ FOLHA DE DETALHAMENTO (uso interno da igreja) ============ */}
      <div className="folha-caixa" style={{ display: mostrar.caixa ? undefined : 'none', pageBreakBefore: mostrar.oficial ? 'always' : undefined, paddingTop: 8 }}>
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 12 }}>IGREJA PROMESSA — LAGO DOS PEIXES</div>
        <div style={{ textAlign: 'center', fontSize: 10, marginBottom: 2 }}>Detalhamento interno — {mesRotulo}</div>
        <div style={{ textAlign: 'center', fontSize: 8, color: '#555', marginBottom: 10 }}>
          Complementa o relatório oficial acima.
        </div>

        {/* --- Caixa da Concessão (os 5%) --- */}
        <div style={{ fontWeight: 700, fontSize: 10.5, margin: '0 0 4px' }}>1) Caixa da Concessão (os 5% que ficam na igreja)</div>
        <table style={{ width: '60%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <tbody>
            <tr><td style={tdp}>Saldo anterior do caixa local</td><td style={num}>{fmt(r.saldoAnterior)}</td></tr>
            <tr><td style={tdp}>(+) Concessão do mês — 5% do dízimo</td><td style={num}>{fmt(r.concessao)}</td></tr>
            {r.ofertasQueFicam > 0 && <tr><td style={tdp}>(+) Ofertas especiais que ficaram no caixa</td><td style={num}>{fmt(r.ofertasQueFicam)}</td></tr>}
            <tr><td style={tdp}>(−) Baixa — o que o caixa local pagou</td><td style={num}>{fmt(r.baixa)}</td></tr>
            <tr><td style={{ ...tdp, fontWeight: 700 }}>(=) Saldo atual do caixa local</td><td style={{ ...num, fontWeight: 700 }}>{fmt(r.saldoCaixa)}</td></tr>
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
                  <td style={tdp}>{(() => {
                    const nt = notaDe.get(d.id)
                    if (nt?.chave) return <span style={{ fontSize: 6.5, wordBreak: 'break-all' }}>{nt.chave}</span>
                    if (nt?.tem_foto) return 'foto'
                    return d.tem_nota ? 'sim' : '—'
                  })()}</td>
                  <td style={num}>{fmt(d.valor)}</td>
                </tr>
              )))}
              <tr><td style={{ ...tdp, fontWeight: 700 }} colSpan="4">TOTAL PAGO PELO CAIXA LOCAL</td><td style={{ ...num, fontWeight: 700 }}>{fmt(r.pagoLocal)}</td></tr>
            </tbody>
          </table>
        </>}

        {/* --- Quem pagou o quê: Região x Igreja local --- */}
        <div style={{ fontWeight: 700, fontSize: 10.5, margin: '0 0 4px' }}>3) Quem pagou cada despesa</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <table style={{ flex: '1 1 0', minWidth: 0, borderCollapse: 'collapse' }}>
            <thead><tr><th style={tdp}>Pago pela REGIÃO</th><th style={tdp}>Valor</th></tr></thead>
            <tbody>
              {despRegiao.map(d => <tr key={d.id}><td style={tdp}>{d.descricao || nomeConta(d.conta_id)}</td><td style={num}>{fmt(d.valor)}</td></tr>)}
              <tr><td style={{ ...tdp, fontWeight: 700 }}>Subtotal Região</td><td style={{ ...num, fontWeight: 700 }}>{fmt(r.pagoRegiao)}</td></tr>
            </tbody>
          </table>
          <table style={{ flex: '1 1 0', minWidth: 0, borderCollapse: 'collapse' }}>
            <thead><tr><th style={tdp}>Pago pela IGREJA LOCAL (5%)</th><th style={tdp}>Valor</th></tr></thead>
            <tbody>
              {despLocais.length ? despLocais.map(d => <tr key={d.id}><td style={tdp}>{d.descricao || nomeConta(d.conta_id)}</td><td style={num}>{fmt(d.valor)}</td></tr>)
                : <tr><td style={tdp} colSpan="2">Nenhuma despesa paga pelo caixa local neste mês.</td></tr>}
              <tr><td style={{ ...tdp, fontWeight: 700 }}>Subtotal Local</td><td style={{ ...num, fontWeight: 700 }}>{fmt(r.pagoLocal)}</td></tr>
            </tbody>
          </table>
        </div>
        <BlocoAssinaturas a={assinaturas} />
      </div>
    </div>
  )
}

