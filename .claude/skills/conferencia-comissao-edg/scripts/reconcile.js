#!/usr/bin/env node
// CONCILIAÇÃO AUTOMÁTICA: cruza o que a EDG comissionou (planilha da gráfica)
// com o que o Gabriel vendeu (Conta Azul, vendedor EDG). Mantém um controle
// interno (control.json) pra não re-perguntar o que já foi resolvido, e gera a
// lista de cobrança em Excel.
//
// Uso: node reconcile.js <grafica.json> <ca_edg.json> [control.json] [saida.xlsx]
//
// Ideias-chave (aprendidas na marra):
//  - O total por cliente (vendido vs comissionado) é a visão MAIS confiável;
//    o casamento item-a-item tem falso-positivo por fragmentação.
//  - Um trabalho vira várias OS/notas; casar por valor cheio, 1:1, sem
//    consumir "somas de 2" (isso gera coincidência espúria).
//  - Padrão de furo real: cliente com só "Parcela 2/2" e o mês da "1/2" vazio.

const XLSX = require('xlsx');
const fs = require('fs');
const { MES_ANTERIOR, familia, casa } = require('./lib');

const [gPath, caPath, ctrlPath = 'control.json', outXlsx = 'cobranca.xlsx'] = process.argv.slice(2);
if (!gPath || !caPath) { console.error('Uso: node reconcile.js grafica.json ca_edg.json [control.json] [cobranca.xlsx]'); process.exit(1); }

const G = JSON.parse(fs.readFileSync(gPath, 'utf8'));
const ca = JSON.parse(fs.readFileSync(caPath, 'utf8'));
const control = fs.existsSync(ctrlPath) ? JSON.parse(fs.readFileSync(ctrlPath, 'utf8')) : {};
const ORD = ['out','nov','dez','jan','fev','mar','abr','maio','jun','jul','ago','set'];

// ---- 1. Peças da gráfica agrupadas por OS+mês (a OS é reusada entre meses) ----
const byOSm = {};
G.forEach(x => { const k = x.os + '|' + x.mes; (byOSm[k] = byOSm[k] || []).push(x); });
const pecas = Object.values(byOSm).map(it => {
  const perDoc = {}; it.forEach(x => { perDoc[x.doc] = x.cheio; });
  return {
    os: it[0].os, fam: it[0].familia, mes: it[0].mes, parcela: it[0].parcela,
    pago: +it.reduce((s, x) => s + x.rateio, 0).toFixed(2),   // rateio efetivamente comissionado
    cheio: +Object.values(perDoc).reduce((s, v) => s + v, 0).toFixed(2),
    pct: it[0].pct, used: false,
  };
});

// ---- 2. Visão por cliente: vendido vs comissionado ----
// Alinha a janela: só conta como "vendido" o orçamento que teria comissão DENTRO
// do período das planilhas que temos. A comissão sai ~1-2 meses depois da venda,
// então a janela de venda comparável = [1ª data de comissão − 75d, última − 15d].
function dataComissao(d) { const m = String(d).match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; }
const datasComm = G.map(x => dataComissao(x.data)).filter(Boolean).sort((a, b) => a - b);
const D = 86400000;
const pct = q => datasComm[Math.min(datasComm.length - 1, Math.floor(q * datasComm.length))]; // percentil (robusto a outliers)
const iniVenda = datasComm.length ? new Date(pct(0.05) - 75 * D) : new Date('2000-01-01');
const fimVenda = datasComm.length ? new Date(pct(0.95) - 15 * D) : new Date('2100-01-01');
const naJanela = o => { const dt = new Date(o.d); return dt >= iniVenda && dt <= fimVenda; };
const gPorFam = {}; G.forEach(x => { gPorFam[x.familia] = (gPorFam[x.familia] || 0) + x.rateio; });
const vendPorFam = {};
ca.prop.filter(o => o.s === 'Aprovado' && naJanela(o)).forEach(o => { const f = familia(o.c); vendPorFam[f] = (vendPorFam[f] || 0) + o.t; });
console.log(`=== VISÃO POR CLIENTE (vendido vs comissionado; janela de venda ${iniVenda.toISOString().slice(0,10)} a ${fimVenda.toISOString().slice(0,10)}) ===`);
const fams = [...new Set([...Object.keys(gPorFam), ...Object.keys(vendPorFam)])].filter(f => !f.startsWith('OUTRO')).sort();
let tv = 0, tc = 0;
fams.forEach(f => {
  const v = vendPorFam[f] || 0, g = gPorFam[f] || 0, gap = v - g; tv += v; tc += g;
  const flag = gap > 3000 && gap > v * 0.15 ? '  <= vendeu bem mais (investigar)' : '';
  console.log(`  ${f.padEnd(16)} vendido R$${v.toFixed(0).padStart(9)} | comissionado R$${g.toFixed(0).padStart(9)} | gap R$${gap.toFixed(0).padStart(8)}${flag}`);
});
console.log(`  ${''.padEnd(16)} vendido R$${tv.toFixed(0).padStart(9)} | comissionado R$${tc.toFixed(0).padStart(9)} | gap R$${(tv - tc).toFixed(0).padStart(8)}`);
console.log('  (Obs: total é só um "cheiro". Cliente de alto volume/recorrente, como Princesa, dá gap ruidoso por timing. Confie no alerta de parcela e nos suspeitos abaixo.)');

// ---- 3. Padrão "só parcela 2/2" (parcela-1 sistematicamente pulada) ----
console.log('\n=== ALERTA: clientes onde só aparece "Parcela 2/2" (1ª metade pode ter sido pulada) ===');
const porFamPecas = {}; pecas.forEach(p => { (porFamPecas[p.fam] = porFamPecas[p.fam] || []).push(p); });
Object.entries(porFamPecas).forEach(([f, arr]) => {
  const so2de2 = arr.filter(p => /^2\/2$/.test(p.parcela));
  const tem1de2 = arr.some(p => /^1\/2$/.test(p.parcela));
  if (so2de2.length && !tem1de2) {
    let base = 0, com = 0, verif = true, meses = new Set();
    so2de2.forEach(p => { const mp = MES_ANTERIOR[p.mes]; meses.add(mp); if (String(mp).includes('sem dados')) verif = false; base += p.pago; com += p.pago * p.pct / 100; });
    console.log(`  ${f}: ${so2de2.length} trabalho(s) só com 2/2. 1ª metade deveria estar em [${[...meses].join(', ')}]. Base faltante ~R$${base.toFixed(2)} => comissão ~R$${com.toFixed(2)}${verif ? '' : ' (parte anterior aos dados, confira planilhas antigas)'}`);
  }
});

// ---- 4. Casamento 1:1 por valor cheio (determinístico, antigo->novo) ----
const C = ca.prop.filter(o => o.s === 'Aprovado').map(o => ({ d: o.d, n: String(o.n), c: o.c, fam: familia(o.c), t: +o.t.toFixed(2), used: false }))
  .sort((a, b) => a.d.localeCompare(b.d));
const fat = ca.sale.filter(o => o.s === 'Faturado').map(o => ({ fam: familia(o.c), t: +o.t.toFixed(2) }));
const faturouSozinho = o => fat.some(f => f.fam === o.fam && casa(f.t, o.t));
C.forEach(o => { const i = pecas.findIndex(p => !p.used && p.fam === o.fam && casa(p.cheio, o.t)); if (i >= 0) { pecas[i].used = true; o.used = true; } });
// aviso de "trabalho dividido em 2 OS" (sem consumir peça)
const ehSplit = o => { const gs = pecas.filter(p => p.fam === o.fam); for (let i = 0; i < gs.length; i++) for (let j = i + 1; j < gs.length; j++) if (casa(gs[i].cheio + gs[j].cheio, o.t, 0.004)) return true; return false; };
const existeValor = o => pecas.some(p => p.fam === o.fam && casa(p.cheio, o.t));

// ---- 5. Suspeitos (não casaram) + grau de confiança + controle ----
const hoje = ca.geradoEm || '';
const susp = [];
C.filter(o => !o.used && o.fam !== 'OUTRO' && !o.fam.startsWith('OUTRO')).forEach(o => {
  const prev = control[o.n];
  if (prev && (prev.status === 'resolvido' || prev.status === 'comissionado')) return; // já tratado
  const recente = o.d >= '2026-04-01';    // ajuste a data conforme o mês corrente
  const antigo = o.d < '2025-10-01';
  const split = ehSplit(o), existe = existeValor(o);
  let pri, conf;
  if (antigo) { pri = '4-Anterior aos dados'; conf = 'Anterior aos dados da gráfica — confira planilhas antigas'; }
  else if (recente) { pri = '3-Recente'; conf = 'Recente — comissão pode cair no mês seguinte'; }
  else if (split) { pri = '2-Média'; conf = 'Provável pagamento DIVIDIDO em 2 OS — confira as notas'; }
  else if (existe) { pri = '2-Média'; conf = 'Valor existe na gráfica; pode ser tempo/parcela — confira'; }
  else { pri = '1-ALTA'; conf = 'Valor NUNCA comissionado nesse cliente'; }
  susp.push({ Prioridade: pri, Cliente: o.fam, Data: o.d.split('-').reverse().join('/'), 'Orçamento': o.n, Valor: o.t, Análise: conf, Obs: faturouSozinho(o) ? 'Você pode ter faturado (há nota igual)' : '' });
  control[o.n] = { status: prev && prev.status ? prev.status : 'pendente', cliente: o.fam, valor: o.t, data: o.d, analise: conf };
});
susp.sort((a, b) => a.Prioridade.localeCompare(b.Prioridade) || b.Valor - a.Valor);

// marca comissionados no controle
C.filter(o => o.used).forEach(o => { control[o.n] = { status: 'comissionado', cliente: o.fam, valor: o.t, data: o.d }; });
fs.writeFileSync(ctrlPath, JSON.stringify(control, null, 1));

const byP = {}; susp.forEach(s => byP[s.Prioridade] = (byP[s.Prioridade] || 0) + 1);
console.log(`\n=== SUSPEITOS (vendido sem comissão casada, ainda abertos) — ${susp.length} ===`);
console.log('  ' + JSON.stringify(byP));
console.log('  Prioridade 1-ALTA são os mais prováveis. Confirme cada um pela ferramenta buscar.js com as notas.');
susp.filter(s => s.Prioridade[0] === '1').forEach(s => console.log(`   ALTA  ${s.Cliente.padEnd(14)} ${s.Data} #${s.Orçamento} R$${s.Valor.toFixed(2)}${s.Obs ? '  [' + s.Obs + ']' : ''}`));

// ---- 6. Excel da cobrança ----
const ws = XLSX.utils.json_to_sheet(susp);
ws['!cols'] = [{ wch: 22 }, { wch: 15 }, { wch: 11 }, { wch: 12 }, { wch: 12 }, { wch: 48 }, { wch: 34 }];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Suspeitos');
XLSX.writeFile(wb, outXlsx);
console.log(`\nCobrança salva em ${outXlsx} | controle atualizado em ${ctrlPath}`);
