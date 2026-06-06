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
  'so-sab': 'Só Sábado',
  'so-dom': 'Só Domingo',
  pares: 'Semanas Pares',
  impares: 'Semanas Ímpares',
  livre: 'Livre',
}

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
  const formatted = num.length === 11 ? '55' + num : num
  return `https://wa.me/${formatted}?text=${encodeURIComponent(msg)}`
}
