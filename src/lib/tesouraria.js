// ============================================================
//  As contas da tesouraria, num lugar só.
//
//  Regra da casa (conferida contra julho/2026 da planilha oficial):
//
//  1. Fica na igreja 5% do BRUTO DO DÍZIMO. Isso é a "concessão".
//  2. A concessão sai no relatório oficial (D 3114) e ENTRA no caixa local.
//  3. Quando a igreja paga algo com dinheiro do caixa local, a despesa entra
//     normal do lado das saídas, e lança-se do lado das ENTRADAS uma
//     "Baixa de Concessão" de valor igual. A remessa não muda; o caixa local cai.
//  4. Logo: a baixa é SEMPRE a soma exata das despesas marcadas "pago pelo
//     caixa local". Ela é calculada, nunca digitada.
//  5. Saldo para remessa = total das entradas − total das saídas.
//     Menos o que já foi depositado = o que ainda falta mandar.
//
//  Nada aqui inventa número: tudo sai dos lançamentos.
// ============================================================

export const PERC_CONCESSAO = 0.05

const n = (v) => Number(v) || 0
export const arred = (v) => Math.round((n(v) + Number.EPSILON) * 100) / 100

export const fmt = (v) =>
  n(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Primeiro dia do mês, no formato do banco (aaaa-mm-01). */
export const refDoMes = (ano, mes) =>
  `${ano}-${String(mes + 1).padStart(2, '0')}-01`

/**
 * Fecha as contas de um mês.
 *
 * @param {object} p
 * @param {Array}  p.contas         plano de contas (fin_contas)
 * @param {Array}  p.contribuicoes  do mês
 * @param {Array}  p.despesas       do mês
 * @param {Array}  p.depositos      do mês
 * @param {number} p.saldoAnterior  saldo do caixa local no fim do mês passado
 */
export function fecharMes({ contas = [], contribuicoes = [], despesas = [], depositos = [], saldoAnterior = 0 }) {
  const porId = new Map(contas.map((c) => [c.id, c]))
  const achaPapel = (papel, lado) => contas.find((c) => c.papel === papel && c.lado === lado)

  const contaDizimo = achaPapel('dizimo', 'R')
  const contaConcessao = achaPapel('concessao', 'D')
  const contaBaixa = achaPapel('baixa', 'R')

  // ---------- ENTRADAS: somadas a partir das contribuições ----------
  const entradasPorConta = new Map()
  for (const c of contribuicoes) {
    entradasPorConta.set(c.conta_id, arred(n(entradasPorConta.get(c.conta_id)) + n(c.valor)))
  }

  const dizimoBruto = contaDizimo ? n(entradasPorConta.get(contaDizimo.id)) : 0
  const concessao = arred(dizimoBruto * PERC_CONCESSAO)

  // ---------- SAÍDAS ----------
  const saidasPorConta = new Map()
  let pagoLocal = 0
  let pagoRegiao = 0
  for (const d of despesas) {
    saidasPorConta.set(d.conta_id, arred(n(saidasPorConta.get(d.conta_id)) + n(d.valor)))
    if (d.pago_por === 'local') pagoLocal = arred(pagoLocal + n(d.valor))
    else pagoRegiao = arred(pagoRegiao + n(d.valor))
  }

  // A baixa é o espelho do que o caixa local pagou.
  const baixa = pagoLocal
  if (contaBaixa) entradasPorConta.set(contaBaixa.id, baixa)
  // A concessão é uma saída do relatório, calculada — não é despesa de ninguém.
  if (contaConcessao) saidasPorConta.set(contaConcessao.id, concessao)

  const totalEntradas = arred([...entradasPorConta.values()].reduce((a, b) => a + n(b), 0))
  const totalSaidas = arred([...saidasPorConta.values()].reduce((a, b) => a + n(b), 0))
  const saldoRemessa = arred(totalEntradas - totalSaidas)

  // ---------- CAIXA LOCAL ----------
  // O que alimenta o caixa local são os 5% do dízimo. Eventualmente uma oferta
  // especial também fica — mas isso é decidido em CADA lançamento (pro_caixa_local),
  // nunca pela conta. A conta só sugere a marcação na hora de lançar.
  const ofertasQueFicam = arred(
    contribuicoes.filter((c) => c.pro_caixa_local).reduce((a, c) => a + n(c.valor), 0)
  )
  const entraNoCaixa = arred(concessao + ofertasQueFicam)
  const saldoCaixa = arred(n(saldoAnterior) + entraNoCaixa - baixa)

  // ---------- REMESSA ----------
  const depositado = arred(depositos.reduce((a, d) => a + n(d.valor), 0))
  const faltaRemeter = arred(saldoRemessa - depositado)

  // ---------- CONFERÊNCIAS ----------
  const avisos = []
  const semRecibo = contribuicoes.filter(
    (c) => porId.get(c.conta_id)?.recebe_recibo && !String(c.recibo || '').trim()
  )
  if (semRecibo.length) {
    avisos.push(`${semRecibo.length} contribuição(ões) de dízimo sem número de recibo.`)
  }
  const semNome = contribuicoes.filter(
    (c) => porId.get(c.conta_id)?.recebe_recibo && !c.membro_id && !String(c.nome || '').trim()
  )
  if (semNome.length) {
    avisos.push(`${semNome.length} dízimo(s) sem o nome de quem contribuiu.`)
  }
  const dupes = recibosRepetidos(contribuicoes)
  if (dupes.length) avisos.push(`Recibo repetido: ${dupes.join(', ')}.`)

  const semNota = despesas.filter((d) => d.pago_por === 'local' && !d.tem_nota)
  if (semNota.length) {
    avisos.push(`${semNota.length} despesa(s) do caixa local sem nota fiscal — a Região exige a nota.`)
  }
  if (saldoCaixa < 0) avisos.push('O caixa local ficou negativo. Confira as despesas marcadas como locais.')

  return {
    dizimoBruto, concessao, baixa,
    pagoLocal, pagoRegiao,
    entradasPorConta, saidasPorConta,
    totalEntradas, totalSaidas, saldoRemessa,
    saldoAnterior: arred(saldoAnterior), entraNoCaixa, ofertasQueFicam, saldoCaixa,
    depositado, faltaRemeter,
    avisos,
  }
}

/** Recibos usados mais de uma vez no mesmo mês. */
export function recibosRepetidos(contribuicoes = []) {
  const conta = new Map()
  for (const c of contribuicoes) {
    for (const r of String(c.recibo || '').split('/').map((x) => x.trim()).filter(Boolean)) {
      conta.set(r, (conta.get(r) || 0) + 1)
    }
  }
  return [...conta.entries()].filter(([, q]) => q > 1).map(([r]) => r)
}

/** Faixa de recibos usada no mês: menor, maior e quantos. */
export function faixaRecibos(contribuicoes = []) {
  const nums = []
  for (const c of contribuicoes) {
    for (const r of String(c.recibo || '').split('/').map((x) => x.trim()).filter(Boolean)) {
      const v = parseInt(r, 10)
      if (!Number.isNaN(v)) nums.push(v)
    }
  }
  if (!nums.length) return { inicial: '', final: '', quantidade: 0 }
  nums.sort((a, b) => a - b)
  return { inicial: String(nums[0]), final: String(nums[nums.length - 1]), quantidade: nums.length }
}

/**
 * O detalhamento do caixa local agrupado por finalidade — é o que ele apresenta
 * à igreja no fim do ano ("investimos X em obra, X em evento").
 */
export function porFinalidade(despesas = []) {
  const g = new Map()
  for (const d of despesas.filter((x) => x.pago_por === 'local')) {
    const k = String(d.finalidade || '').trim() || 'Sem finalidade'
    if (!g.has(k)) g.set(k, { finalidade: k, total: 0, itens: [] })
    const linha = g.get(k)
    linha.total = arred(linha.total + n(d.valor))
    linha.itens.push(d)
  }
  return [...g.values()].sort((a, b) => b.total - a.total)
}
