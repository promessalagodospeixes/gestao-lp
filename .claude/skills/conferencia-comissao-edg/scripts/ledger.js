#!/usr/bin/env node
// CONTROLE ETERNO DE COMISSÕES — uma linha por material/orçamento, status
// acumulado mês a mês. Todo mês: acrescenta vendas novas do Conta Azul e dá
// baixa no que o novo relatório da gráfica pagou, marcando o que ficou pendente
// e há quantos meses. NÃO precisa reanalisar tudo — o estado fica salvo.
//
// Uso: node ledger.js <grafica_all.json> <ca_edg.json> [Controle.xlsx]
//   grafica_all.json = TODAS as linhas da gráfica (todos os meses já lidos)
//   ca_edg.json      = orçamentos EDG do Conta Azul (o que foi vendido)
//
// Preserva anotações humanas: se já existe a planilha, mantém as colunas
// "Cobrado?" e "Obs (você)" que o Gabriel tiver preenchido, casando por Orçamento.

const XLSX = require('xlsx');
const fs = require('fs');
const { familia, casa } = require('./lib');

const [gPath, caPath, outXlsx = 'Controle de Comissoes EDG.xlsx'] = process.argv.slice(2);
if (!gPath || !caPath) { console.error('Uso: node ledger.js grafica_all.json ca_edg.json [Controle.xlsx]'); process.exit(1); }

const G = JSON.parse(fs.readFileSync(gPath, 'utf8'));
const ca = JSON.parse(fs.readFileSync(caPath, 'utf8'));
const ORD = ['nov','dez','jan','fev','mar','abr','maio','jun','jul','ago','set','out'];
const hoje = ca.geradoEm ? new Date(ca.geradoEm) : new Date('2026-08-01');

// Peças da gráfica por OS+mês (a OS se repete entre meses)
const byOSm = {};
G.forEach(x => { const k = x.os + '|' + x.mes; (byOSm[k] = byOSm[k] || []).push(x); });
const pecas = Object.values(byOSm).map(it => {
  const perDoc = {}; it.forEach(x => { perDoc[x.doc] = x.cheio; });
  return {
    os: it[0].os, fam: it[0].familia, mes: it[0].mes, parcela: it[0].parcela,
    cheio: +Object.values(perDoc).reduce((s, v) => s + v, 0).toFixed(2),
    pago: +it.reduce((s, x) => s + x.rateio, 0).toFixed(2),
    com: +it.reduce((s, x) => s + x.comissao, 0).toFixed(2),
    pct: it[0].pct, used: false,
  };
});

// Orçamentos vendidos (EDG, aprovados), do mais antigo pro mais novo
const orc = ca.prop.filter(o => o.s === 'Aprovado')
  .map(o => ({ d: o.d, n: String(o.n), cli: o.c, fam: familia(o.c), valor: +o.t.toFixed(2) }))
  .filter(o => !o.fam.startsWith('OUTRO'))
  .sort((a, b) => a.d.localeCompare(b.d));

// meses (aprox) de defasagem: venda -> comissão cai ~1-2 meses depois
function mesesAtras(dISO) {
  const d = new Date(dISO);
  return Math.round((hoje - d) / (30 * 86400000));
}

// Acha subconjunto de peças (por índices GLOBAIS em `pecas`, não usadas) cuja
// soma de `cheio` ~= alvo. Prefere menos peças. Resolve pagamento picado em
// 3,4,5+ OS — o furo do casamento 1:1. Devolve array de índices globais.
function subsetSoma(idxFam, alvo, tol) {
  const idx = idxFam.filter(i => !pecas[i].used).sort((a, b) => pecas[b].cheio - pecas[a].cheio);
  const t = alvo * (tol || 0.006);
  let melhor = null;
  function rec(pos, acc, sum) {
    if (melhor) return;
    if (acc.length && Math.abs(sum - alvo) <= t) { melhor = acc.slice(); return; }
    if (sum - alvo > t) return;                  // ordenado desc: já passou
    if (pos >= idx.length || acc.length >= 8) return;
    rec(pos + 1, acc.concat(idx[pos]), sum + pecas[idx[pos]].cheio);
    rec(pos + 1, acc, sum);
  }
  rec(0, [], 0);
  return melhor;
}
const GRANDE = f => pecas.filter(p => p.fam === f).length > 40; // Princesa: muitas peças
const linhas = orc.map(o => {
  let status, recebida = 0, meses = [], falta = 0, pctAplicado = '', obs = '';
  const idxFam = pecas.map((p, i) => i).filter(i => pecas[i].fam === o.fam);
  const i = idxFam.find(k => !pecas[k].used && casa(pecas[k].cheio, o.valor));
  if (i !== undefined) {                         // casamento direto por valor cheio
    const p = pecas[i]; p.used = true; recebida = p.com; meses = [p.mes]; pctAplicado = p.pct;
    if (/^2\/2$/.test(p.parcela)) { status = 'PARCIAL (só 2ª parcela)'; falta = +(p.com).toFixed(2); obs = '1ª parcela não entrou'; }
    else status = 'Pago';
  } else {
    // soma de vários OS. Princesa (muitas peças): só pares. Outros: subset até 8.
    let sp = null;
    if (GRANDE(o.fam)) {
      const liv = idxFam.filter(k => !pecas[k].used);
      for (let a = 0; a < liv.length && !sp; a++) for (let b = a + 1; b < liv.length; b++)
        if (casa(pecas[liv[a]].cheio + pecas[liv[b]].cheio, o.valor, 0.004)) { sp = [liv[a], liv[b]]; break; }
    } else sp = subsetSoma(idxFam, o.valor);
    if (sp) {
      const ps = sp.map(k => pecas[k]); ps.forEach(p => p.used = true);
      recebida = +ps.reduce((s, p) => s + p.com, 0).toFixed(2); meses = [...new Set(ps.map(p => p.mes))]; pctAplicado = ps[0].pct;
      status = ps.length > 1 ? 'Pago (' + ps.length + ' OS)' : 'Pago';
    } else {
      // pago parcelado (X/N): subconjunto soma ~1/3 ou ~1/2 do valor?
      let parc = null;
      if (!GRANDE(o.fam)) for (const N of [3, 2]) { const s = subsetSoma(idxFam, o.valor / N); if (s) { parc = s; break; } }
      if (parc) {
        const ps = parc.map(k => pecas[k]); ps.forEach(p => p.used = true);
        recebida = +ps.reduce((s, p) => s + p.com, 0).toFixed(2); meses = [...new Set(ps.map(p => p.mes))]; pctAplicado = ps[0].pct;
        status = 'PARCIAL (em parcelas)'; falta = +(o.valor * (ps[0].pct || 2) / 100 - recebida).toFixed(2); obs = 'faltam parcelas';
      } else {
        const m = mesesAtras(o.d);
        if (m <= 1) status = 'Aguardando (venda recente)';
        else if (o.d < '2025-10-01') status = 'Anterior aos dados';
        else { status = 'ATRASADO ' + m + ' meses'; obs = 'vendido e sem comissão'; }
      }
    }
  }
  meses.sort((a, b) => ORD.indexOf(a) - ORD.indexOf(b));
  return {
    Cliente: o.fam, 'Orçamento': o.n, 'Data venda': o.d.split('-').reverse().join('/'),
    'Valor cheio (R$)': o.valor, '% (aplicado gráfica)': pctAplicado === '' ? '' : pctAplicado,
    'Comissão recebida (R$)': +recebida.toFixed(2), 'Mês(es) pago': meses.join(', '),
    'Status': status, 'Falta (R$)': +falta.toFixed(2), 'Cobrado?': '', 'Obs (você)': obs,
  };
});

// Preserva "Cobrado?" e "Obs (você)" se a planilha já existir
if (fs.existsSync(outXlsx)) {
  try {
    const old = XLSX.utils.sheet_to_json(XLSX.readFile(outXlsx).Sheets['Controle']);
    const prev = {}; old.forEach(r => { prev[r['Orçamento']] = r; });
    linhas.forEach(l => { const p = prev[l['Orçamento']]; if (p) { if (p['Cobrado?']) l['Cobrado?'] = p['Cobrado?']; if (p['Obs (você)']) l['Obs (você)'] = p['Obs (você)']; } });
  } catch (e) { console.warn('(não consegui mesclar planilha antiga: ' + e.message + ')'); }
}

// resumo
const res = {}; linhas.forEach(l => { const k = /Pago/.test(l.Status) ? 'Pago' : /PARCIAL/.test(l.Status) ? 'Parcial' : /ATRASADO/.test(l.Status) ? 'Atrasado' : /Aguardando/.test(l.Status) ? 'Aguardando' : 'Outro'; res[k] = (res[k] || 0) + 1; });
const totalFalta = linhas.reduce((s, l) => s + l['Falta (R$)'], 0) + linhas.filter(l => /ATRASADO/.test(l.Status)).reduce((s, l) => s + l['Valor cheio (R$)'] * (l['% (aplicado gráfica)'] || 2) / 100, 0);

// Excel
const ws = XLSX.utils.json_to_sheet(linhas);
ws['!cols'] = [{ wch: 16 }, { wch: 11 }, { wch: 12 }, { wch: 15 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 24 }, { wch: 12 }, { wch: 10 }, { wch: 28 }];
ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: linhas.length, c: 10 } }) };
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Controle');
XLSX.writeFile(wb, outXlsx);

console.log('CONTROLE gerado:', outXlsx);
console.log('Linhas (materiais):', linhas.length, '| resumo:', JSON.stringify(res));
console.log('\nATRASADOS (vendido, comissão não entrou):');
linhas.filter(l => /ATRASADO|PARCIAL/.test(l.Status)).sort((a,b)=>b['Valor cheio (R$)']-a['Valor cheio (R$)']).forEach(l => console.log(`  ${l.Cliente.padEnd(14)} #${l['Orçamento']} ${l['Data venda']} R$${l['Valor cheio (R$)'].toFixed(2).padStart(10)} — ${l.Status}`));
