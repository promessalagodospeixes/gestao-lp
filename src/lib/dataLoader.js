import { dbGet } from './supabase'

export async function loadAllData() {
  const [
    membros, usuarios, funcoes, gestoresArr, lideranca,
    agenda, avisos, musicas, pregacoes, escalaPreg,
    financeiro, escalasArr, escalasEBArr, escalasLvArr, setlists
  ] = await Promise.all([
    dbGet('membros'), dbGet('usuarios'), dbGet('funcoes'), dbGet('gestores'),
    dbGet('lideranca'), dbGet('agenda'), dbGet('avisos'), dbGet('musicas'),
    dbGet('pregacoes'), dbGet('escala_preg'), dbGet('financeiro'),
    dbGet('escalas'), dbGet('escalas_eb'), dbGet('escalas_lv'), dbGet('setlists'),
  ])

  // Normalize membros
  const membrosNorm = membros.map(m => ({
    ...m, maxMes: m.max_mes || 0, obs: m.obs || '', tel: m.tel || '', email: m.email || ''
  }))

  // Normalize funcoes
  const funcoesNorm = funcoes.map(f => ({
    ...f, membros: Array.isArray(f.membros) ? f.membros : (typeof f.membros === 'string' ? JSON.parse(f.membros || '[]') : [])
  }))

  // Normalize gestores
  const gestores = gestoresArr.length ? {
    id: gestoresArr[0].id,
    vocal: Array.isArray(gestoresArr[0].vocal) ? gestoresArr[0].vocal : JSON.parse(gestoresArr[0].vocal || '["","",""]'),
    instrumental: Array.isArray(gestoresArr[0].instrumental) ? gestoresArr[0].instrumental : JSON.parse(gestoresArr[0].instrumental || '["","",""]'),
  } : { vocal: ['', '', ''], instrumental: ['', '', ''] }

  // Normalize agenda
  const agendaNorm = agenda.map(a => ({ ...a, desc: a.descricao || '', hora: a.hora || '' }))

  // Normalize musicas
  const musicasNorm = musicas.map(m => ({
    ...m,
    cat: Array.isArray(m.cat) ? m.cat : (typeof m.cat === 'string' ? JSON.parse(m.cat || '[]') : []),
    tomIg: m.tom_ig || '', cf: m.cifra || '', yt: m.yt || '', letra: m.letra || ''
  }))

  // Normalize pregacoes
  const pregacoesNorm = pregacoes.map(p => ({
    ...p, dt: p.data, cu: p.culto, tm: p.tema || '', sr: p.serie || '',
    rf: p.referencia || '', l1: p.link1 || '', l2: p.link2 || '', ob: p.obs || ''
  }))

  // Normalize escala_preg
  const escalaPregNorm = escalaPreg.map(p => ({
    ...p, tema: p.tema || '', serie: p.serie || ''
  }))

  // Normalize financeiro
  const financeiroNorm = financeiro.map(f => ({
    ...f, desc: f.descricao, cat: f.categoria, valor: parseFloat(f.valor)
  }))

  // Rebuild escalas object from flat DB rows
  const escalas = {}
  escalasArr.forEach(r => {
    const ch = `${r.ano}-${r.mes - 1}`
    if (!escalas[ch]) escalas[ch] = {}
    escalas[ch][r.slot] = { dir: r.dir || '', voc: r.voc || '', mor: r.mor || '', por: r.por || '', ord: r.ord || '' }
  })

  // Rebuild escalasEB
  const escalasEB = {}
  escalasEBArr.forEach(r => {
    const ch = `eb-${r.ano}-${r.mes - 1}`
    if (!escalasEB[ch]) escalasEB[ch] = {}
    const k = `${r.classe}-${r.slot}`
    escalasEB[ch][k] = { prof: r.prof || '', aux: r.aux || '' }
  })

  // Rebuild escalasLv
  const escalasLv = {}
  escalasLvArr.forEach(r => {
    const ch = `lv-${r.ano}-${r.mes - 1}`
    if (!escalasLv[ch]) escalasLv[ch] = {}
    const vocal = typeof r.vocal === 'object' ? r.vocal : JSON.parse(r.vocal || '{}')
    const inst = typeof r.instrumental === 'object' ? r.instrumental : JSON.parse(r.instrumental || '{}')
    Object.entries(vocal).forEach(([k, v]) => { escalasLv[ch][k] = v })
    if (!escalasLv[ch][r.slot]) escalasLv[ch][r.slot] = {}
    escalasLv[ch][r.slot].inst = inst
  })

  // Normalize setlists
  const setlistsNorm = setlists.map(s => ({
    ...s, musicas: Array.isArray(s.musicas) ? s.musicas : JSON.parse(s.musicas || '[]')
  }))

  return {
    membros: membrosNorm,
    usuarios,
    funcoes: funcoesNorm,
    gestores,
    lideranca,
    agenda: agendaNorm,
    avisos,
    musicas: musicasNorm,
    pregacoes: pregacoesNorm,
    escalaPreg: escalaPregNorm,
    financeiro: financeiroNorm,
    escalas,
    escalasEB,
    escalasLv,
    setlists: setlistsNorm,
    devocionais: [],
    respostas: [],
    histMsgs: {},
  }
}
