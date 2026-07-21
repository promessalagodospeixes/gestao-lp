#!/usr/bin/env node
// FERRAMENTA CASO-A-CASO (a mais confiável). Quando o Gabriel manda as notas
// ou o valor de um trabalho, procura na planilha da gráfica se/onde entrou.
//
// Uso:  node buscar.js <grafica.json> <termo> [termo2 ...]
//   termo pode ser um número de NOTA (ex: 7818) ou um VALOR (ex: 8242 ou 8242,00).
//
// Ex.: node buscar.js grafica.json 7818 7816 122 123
//      node buscar.js grafica.json 8242 8622

const fs = require('fs');
const { num } = require('./lib');

const linhas = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const termos = process.argv.slice(3);
if (!termos.length) { console.error('Informe notas ou valores a procurar.'); process.exit(1); }

function linha(x) {
  return `    [${x.mes}] ${x.familia} | OS${x.os} nota ${x.doc} parc ${x.parcela} | rateio R$${x.rateio.toFixed(2)} × ${x.pct}% = R$${x.comissao.toFixed(2)}`;
}
for (const t of termos) {
  const valor = num(t);
  const semDoc = d => String(d).replace(/-1$/, '');
  // 1) por NOTA exata (específico e confiável)
  const porNota = linhas.filter(x => semDoc(x.doc) === String(t) || String(x.doc) === String(t));
  // 2) por VALOR aproximado (só p/ valores ≥ 500, senão vira ruído)
  const porValor = valor >= 500
    ? linhas.filter(x => Math.abs(x.titulo - valor) < 2 || Math.abs(x.rateio - valor) < 2 || Math.abs(x.cheio - valor) < 2)
    : [];
  console.log(`\n### "${t}" ###`);
  if (porNota.length) {
    console.log(`  ✅ por NOTA exata (${porNota.length}):`);
    porNota.forEach(x => console.log(linha(x)));
    console.log(`     comissão nessa nota: R$${porNota.reduce((s, x) => s + x.comissao, 0).toFixed(2)}`);
  } else {
    console.log('  ❌ nota não encontrada em nenhum mês.');
  }
  if (porValor.length) {
    console.log(`  ~ por VALOR ≈ R$${valor} (${porValor.length}) — confira se é o trabalho certo:`);
    porValor.forEach(x => console.log(linha(x)));
  } else if (valor >= 500) {
    console.log(`  ❌ nenhum lançamento com valor ≈ R$${valor}.`);
  }
}
