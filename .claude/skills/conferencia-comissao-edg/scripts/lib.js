// Funções compartilhadas da conferência de comissão da gráfica.
// Conhecimento embutido: comissão = rateio × %; valor cheio vem da descrição
// ("/ R$YYY") ou rateio×Nparcelas; a mesma OS é reusada em meses diferentes
// (agrupar por OS+mês); uma nota pode ser rateada entre várias OS.

const MESES = ['nov', 'dez', 'jan', 'fev', 'mar', 'abr', 'maio', 'jun', 'jul', 'ago', 'set', 'out'];
// Mês da planilha da gráfica -> mês anterior (onde a 1ª parcela deveria estar).
// Regra confirmada pelo Gabriel: cliente paga no mês M -> comissão na planilha ref-M.
const MES_ANTERIOR = { dez:'nov', jan:'dez', fev:'jan', mar:'fev', abr:'mar', maio:'abr', jun:'mai', jul:'jun', ago:'jul', set:'ago', out:'set', nov:'out(sem dados)' };

// Normaliza nome de cliente numa "família" (os nomes diferem entre gráfica e
// Conta Azul). Estenda aqui quando aparecer cliente novo.
function familia(nome) {
  const s = String(nome).toUpperCase();
  if (s.includes('PRINCESA')) return 'Princesa';
  if (s.includes('ADONAI')) return 'Adonai';
  if (s.includes('BARRA OESTE') || s.includes('SUPERMARKET')) return 'Barra Oeste';
  if (s.includes('SUPERPRIX') || s.includes('SUPER PRIX')) return 'Super Prix';
  if (s.includes('TELEX')) return 'Telex';
  if (s.includes('CONVICCAO') || s.includes('CONVICÇÃO')) return 'Convicção';
  if (s.includes('DOM ATAC')) return 'Dom Atacadista';
  if (s.includes('EMEFARMA')) return 'Emefarma';
  if (s.includes('GMB') || s.includes('GASES MEDICINAIS')) return 'GMB';
  if (s.includes('NITER') && s.includes('ATITUDE')) return 'Atitude Niterói';
  if (s.includes('ATITUDE')) return 'Atitude Barra';
  if (s.includes('MISSOES MUNDIAIS') || s.includes('MISSÕES MUNDIAIS') || s.includes('JMM')) return 'JMM';
  if (s.includes('MISSOES NACIONAIS') || s.includes('MISSÕES NACIONAIS') || s.includes('JMN')) return 'JMN';
  if (s.includes('BRITANICA') || s.includes('BRITISH')) return 'British School';
  if (s.includes('CORCOVADO') || s.includes('ALEM')) return 'Corcovado';
  if (s.includes('PROMESSISTA') || s.includes('APPC') || s.includes('PROMESSA')) return 'Promessa';
  if (s.includes('UNIAO BRASILEIRA') || s.includes('MARISTA')) return 'Marista';
  if (s.includes('VAREJO COMERCIAL') || s.includes('COMPETI')) return 'Varejo Móveis';
  if (s.includes('EXPANSAO')) return 'Expansão';
  return 'OUTRO: ' + nome;
}

// Converte "R$ 1.160,00" ou "1,160.00" em número.
function num(v) {
  if (v == null || v === '') return 0;
  let s = String(v).trim().replace(/R\$|\s/g, '');
  // formato brasileiro "1.160,00" -> "1160.00"
  if (/,\d{2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, ''); // formato americano "1,160.00"
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Valor CHEIO do trabalho a partir da descrição de uma linha da gráfica.
// Ex.: "Parcela 2 / 2 - OS N°53879 - R$ 20.254,96 / R$40.509,92" -> 40509.92
// Ex.: "Parcela Nº 2/2" (sem total) -> rateio × 2 (parcelas iguais).
function valorCheio(desc, rateio) {
  const s = String(desc);
  const m = s.match(/\/\s*R\$?\s*([\d.]+,\d{2})\s*$/);
  if (m) return parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
  const p = s.match(/Parcela\s*N?º?\s*(\d+)\s*\/\s*(\d+)/i);
  if (p) return +(rateio * parseInt(p[2])).toFixed(2);
  return rateio;
}

// Extrai "X/N" da descrição (parcela atual / total de parcelas).
function parcela(desc) {
  const p = String(desc).match(/Parcela\s*N?º?\s*(\d+)\s*\/\s*(\d+)/i);
  return p ? p[1] + '/' + p[2] : '1/1';
}

// Duas quantias "casam" dentro de uma tolerância percentual.
function casa(a, b, tolPct) {
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1) < (tolPct || 0.015);
}

module.exports = { MESES, MES_ANTERIOR, familia, num, valorCheio, parcela, casa };
