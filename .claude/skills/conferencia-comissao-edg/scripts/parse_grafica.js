#!/usr/bin/env node
// Lê TODAS as planilhas de comissão da gráfica de uma pasta e gera um JSON
// estruturado (uma entrada por linha da planilha).
//
// Uso:  node parse_grafica.js <pasta-com-os-xlsx> <saida.json>
// Ex.:  node parse_grafica.js "C:/Users/gabri/Downloads" grafica.json
//
// Reconhece arquivos tipo "GRANDES POSSIBILIDADES ... ref <mes>.xlsx".
// Colunas esperadas: Vendedor | Nº OS | Nº Pedido | Cliente | Documento |
//   Descrição | R$ Título | R$ Rateio OS | % Comissão | R$ Comissão | Data | Situação.

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { num, valorCheio, parcela, familia } = require('./lib');

const dir = process.argv[2];
const out = process.argv[3] || 'grafica.json';
if (!dir) { console.error('Informe a pasta com os .xlsx'); process.exit(1); }

// Descobre o mês pelo nome do arquivo ("ref jan", "ref maio", ...).
function mesDoArquivo(nome) {
  const m = nome.toLowerCase().match(/ref\s*([a-zç]+)/);
  return m ? m[1].replace('ç', 'c') : 'desconhecido';
}

const arquivos = fs.readdirSync(dir).filter(f =>
  /comissao/i.test(f) && /\.xlsx$/i.test(f) && !f.startsWith('~$'));

const linhas = [];
for (const f of arquivos) {
  const mes = mesDoArquivo(f);
  const wb = XLSX.readFile(path.join(dir, f));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  const hi = rows.findIndex(r => r.includes('Vendedor'));
  if (hi < 0) { console.warn('  (sem cabeçalho "Vendedor": ' + f + ')'); continue; }
  let n = 0;
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || (!r[1] && !r[5])) continue;
    if (String(r[0]).toLowerCase().includes('total')) continue;
    const rateio = num(r[7]);
    linhas.push({
      mes,
      os: String(r[1]).replace(/[,.]/g, ''),
      cliente: r[3],
      familia: familia(r[3]),
      doc: String(r[4]),
      desc: String(r[5]).replace(/\n/g, ' '),
      titulo: num(r[6]),
      rateio,
      pct: num(r[8]),
      comissao: num(r[9]),
      cheio: valorCheio(r[5], rateio),
      parcela: parcela(r[5]),
      data: r[10],
      situacao: String(r[11]).trim(),
    });
    n++;
  }
  console.log(`  ${f}  ->  mês ${mes}, ${n} linhas`);
}

fs.writeFileSync(out, JSON.stringify(linhas, null, 1));
console.log(`\nOK: ${linhas.length} linhas de ${arquivos.length} planilhas -> ${out}`);
