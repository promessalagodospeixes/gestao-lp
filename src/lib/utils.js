export const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
export const MESES_A = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
export const DIAS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

export const PERFIL_LABEL = {
  pastor: 'Pastor',
  secretario: 'Secretário',
  'gestor-vocal': 'Gestor Vocal',
  'gestor-instrumental': 'Gestor Instrumental',
  professor: 'Professor EB',
  aluno: 'Aluno EB',
  membro: 'Membro',
}

export const DISP_LABEL = {
  semanal: 'Semanal',
  'quinzenal-sab': 'Quinzenal Sáb',
  'quinzenal-dom': 'Quinzenal Dom',
  'quinzenal-alt': 'Quinzenal Alt',
  mensal: 'Mensal',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  livre: 'Livre',
}

export const DISP_OPTS = [
  ['semanal','Semanal'],
  ['quinzenal-sab','Quinzenal Sábados'],
  ['quinzenal-dom','Quinzenal Domingos'],
  ['quinzenal-alt','Quinzenal Alternado'],
  ['mensal','Mensal'],
  ['bimestral','Bimestral'],
  ['trimestral','Trimestral'],
  ['livre','Livre'],
]

export const fmtBR = (d) => {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d + 'T00:00:00') : d
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export const getSabDom = (month, year) => {
  const sabs = [], doms = []
  const days = new Date(year, month + 1, 0).getDate()
  for (let i = 1; i <= days; i++) {
    const d = new Date(year, month, i)
    if (d.getDay() === 6) sabs.push(d)
    if (d.getDay() === 0) doms.push(d)
  }
  return { sabs, doms }
}

// Check if date is first Saturday of the month (Café e Conexão)
export const isCafeConexao = (date) => {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date
  if (d.getDay() !== 6) return false
  // First saturday = day <= 7
  return d.getDate() <= 7
}

export const nextWeekend = () => {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  let d = new Date(hoje)
  while (d.getDay() !== 6 && d.getDay() !== 0) d.setDate(d.getDate() + 1)
  const sab = d.getDay() === 6 ? d : new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)
  const dom = new Date(sab.getFullYear(), sab.getMonth(), sab.getDate() + 1)
  return { sab, dom }
}

export const isAdmin = (user) => ['pastor', 'secretario'].includes(user?.perfil)
export const isPastor = (user) => user?.perfil === 'pastor'

export const waLink = (tel, msg) => {
  const num = (tel || '').replace(/\D/g, '')
  const formatted = num.length === 11 ? '55' + num : num.length === 10 ? '55' + num : num
  return `https://wa.me/${formatted}?text=${encodeURIComponent(msg)}`
}

// Normalize string for accent-insensitive search
export const normalizar = (str) => {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// Always uppercase names
export const toUpperName = (str) => (str || '').toUpperCase()

// WhatsApp messages for escala
export const MSG_ESCALA = [
  (nome, escala) => `Paz, ${nome}! 🙏\n\nSó passando pra te avisar que esse mês contamos com a sua participação. Veja abaixo os dias em que você está escalado(a):\n\n${escala}\n\nQualquer dúvida ou necessidade de troca, fale com a gente. Que Deus abençoe seu serviço! 🕊`,
  (nome, escala) => `Olá, ${nome}! 😊\n\nQue bom contar com você esse mês. Segue abaixo sua participação na escala:\n\n${escala}\n\nEstamos juntos! Qualquer coisa é só chamar. 🙌`,
  (nome, escala) => `Oi, ${nome}! 🌟\n\nPassando pra compartilhar sua escala desse mês. É uma alegria servir junto com você:\n\n${escala}\n\nConte com nossas orações. Deus abençoe seu serviço! 🕊`,
]

export const MSG_PREG = (nome, data, tema, serie, linkYt, linkRec, obs) => {
  let msg = `Paz, ${nome}! 🙏\n\nVocê está confirmado(a) para pregar no dia ${data}.\n`
  if (serie) msg += `\n📚 Série: ${serie}`
  if (tema) msg += `\n🎤 Tema: ${tema}`
  if (linkYt) msg += `\n▶ YouTube: ${linkYt}`
  if (linkRec) msg += `\n📎 Material: ${linkRec}`
  if (obs) msg += `\n\n📝 ${obs}`
  msg += `\n\nQue Deus te use poderosamente! 🙌`
  return msg
}
