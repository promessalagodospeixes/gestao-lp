import { dbGet } from './supabase'

export async function loadAllData() {
  const [
    membros, usuarios, funcoes, gestoresArr, lideranca,
    agenda, avisos, musicas, pregacoes, escalaPreg,
    financeiro, escalasArr, escalasEBArr, escalasLvArr, setlists, ocorrencias,
    solicitacoes, devocionaisArr, respostasArr, ministeriosArr, atasArr
  ] = await Promise.all([
    dbGet('membros'), dbGet('usuarios'), dbGet('funcoes'), dbGet('gestores'),
    dbGet('lideranca'), dbGet('agenda'), dbGet('avisos'), dbGet('musicas'),
    dbGet('pregacoes'), dbGet('escala_preg'), dbGet('financeiro'),
    dbGet('escalas'), dbGet('escalas_eb'), dbGet('escalas_lv'), dbGet('setlists'),
    dbGet('ocorrencias'), dbGet('solicitacoes'),
    dbGet('devocionais'), dbGet('devocionais_respostas'),
    dbGet('ministerios'), dbGet('atas'),
  ])

  const membrosNorm = membros.map(m => ({
    ...m, maxMes: m.max_mes || 0, obs: m.obs || '', tel: m.tel || '', email: m.email || ''
  }))

  const funcoesNorm = funcoes.map(f => ({
    ...f,
    membros: Array.isArray(f.membros) ? f.membros : (typeof f.membros === 'string' ? JSON.parse(f.membros || '[]') : []),
    disponibilidades: typeof f.disponibilidades === 'object' && !Array.isArray(f.disponibilidades) ? f.disponibilidades : (typeof f.disponibilidades === 'string' ? JSON.parse(f.disponibilidades || '{}') : {}),
  }))

  const gestores = gestoresArr.length ? {
    id: gestoresArr[0].id,
    vocal: Array.isArray(gestoresArr[0].vocal) ? gestoresArr[0].vocal : JSON.parse(gestoresArr[0].vocal || '["","",""]'),
    instrumental: Array.isArray(gestoresArr[0].instrumental) ? gestoresArr[0].instrumental : JSON.parse(gestoresArr[0].instrumental || '["","",""]'),
    secretario: gestoresArr[0].secretario || '',
    tesoureiro: gestoresArr[0].tesoureiro || '',
    permissoes: (() => { try { const p = gestoresArr[0].permissoes; return (p && typeof p === 'object') ? p : JSON.parse(p || '{}') } catch { return {} } })(),
  } : { vocal: ['', '', ''], instrumental: ['', '', ''], secretario: '', tesoureiro: '', permissoes: {} }

  const agendaNorm = agenda.map(a => ({ ...a, desc: a.descricao || '', hora: a.hora || '' }))

  const musicasNorm = musicas.map(m => ({
    ...m,
    cat: Array.isArray(m.cat) ? m.cat : (typeof m.cat === 'string' ? JSON.parse(m.cat || '[]') : []),
    tomIg: m.tom_ig || '', cf: m.cifra || '', yt: m.yt || '', letra: m.letra || ''
  }))

  const pregacoesNorm = pregacoes.map(p => ({
    ...p, dt: p.data, cu: p.culto, tm: p.tema || '', sr: p.serie || '',
    rf: p.referencia || '', l1: p.link1 || '', l2: p.link2 || '', ob: p.obs || ''
  }))

  const escalaPregNorm = escalaPreg.map(p => ({
    ...p, tema: p.tema || '', serie: p.serie || ''
  }))

  const financeiroNorm = financeiro.map(f => ({
    ...f, desc: f.descricao, cat: f.categoria, valor: parseFloat(f.valor)
  }))

  const escalas = {}
  escalasArr.forEach(r => {
    const ch = `${r.ano}-${r.mes - 1}`
    if (!escalas[ch]) escalas[ch] = {}
    escalas[ch][r.slot] = { dir: r.dir || '', voc: r.voc || '', mor: r.mor || '', por: r.por || '', ord: r.ord || '' }
  })

  const escalasEB = {}
  escalasEBArr.forEach(r => {
    const ch = `eb-${r.ano}-${r.mes - 1}`
    if (!escalasEB[ch]) escalasEB[ch] = {}
    escalasEB[ch][`${r.classe}-${r.slot}`] = { prof: r.prof || '', aux: r.aux || '' }
  })

  const escalasLv = {}
  escalasLvArr.forEach(r => {
    const ch = `lv-${r.ano}-${r.mes - 1}`
    if (!escalasLv[ch]) escalasLv[ch] = {}
    const vocal = typeof r.vocal === 'object' ? r.vocal : JSON.parse(r.vocal || '{}')
    const instRaw = typeof r.instrumental === 'object' ? r.instrumental : JSON.parse(r.instrumental || '{}')
    const nLouvores = instRaw._n || (r.slot.startsWith('sab') ? 4 : 5)
    const vocalSolos = instRaw._vs || {}
    const inst = Object.fromEntries(Object.entries(instRaw).filter(([k]) => k !== '_n' && k !== '_vs'))
    Object.entries(vocal).forEach(([k, v]) => { escalasLv[ch][`${r.slot}-v${k}`] = v })
    if (!escalasLv[ch][r.slot]) escalasLv[ch][r.slot] = {}
    escalasLv[ch][r.slot].inst = inst
    escalasLv[ch][r.slot].nLouvores = nLouvores
    escalasLv[ch][r.slot].vocalSolos = vocalSolos
  })

  const setlistsNorm = setlists.map(s => ({
    ...s, musicas: Array.isArray(s.musicas) ? s.musicas : JSON.parse(s.musicas || '[]')
  }))

  return {
    membros: membrosNorm, usuarios, funcoes: funcoesNorm, gestores,
    lideranca, agenda: agendaNorm, avisos, musicas: musicasNorm,
    pregacoes: pregacoesNorm, escalaPreg: escalaPregNorm,
    financeiro: financeiroNorm, escalas, escalasEB, escalasLv, ocorrencias,
    setlists: setlistsNorm, devocionais: devocionaisArr, respostas: respostasArr,
    ministerios: ministeriosArr.sort((a,b) => a.nome.localeCompare(b.nome)),
    atas: atasArr.map(a => ({
      ...a,
      presentes: Array.isArray(a.presentes) ? a.presentes : JSON.parse(a.presentes || '[]'),
      votacoes: Array.isArray(a.votacoes) ? a.votacoes : JSON.parse(a.votacoes || '[]'),
    })).sort((a,b) => b.data.localeCompare(a.data)),
    histMsgs: {},
    solicitacoes,
  }
}
