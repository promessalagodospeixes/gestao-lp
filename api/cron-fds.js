// Cron automático: toda segunda-feira às 8h (Brasília) = 11h UTC
// Envia a escala do próximo FDS para todos os escalados com email cadastrado

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mynektdohwpzfbmgfunp.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15bmVrdGRvaHdwemZibWdmdW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTcwMjQsImV4cCI6MjA5NjMzMzAyNH0.mhQIXbVgWkpVxvcOXs80KIoqSphde9juPLlZJJrkOhs'
const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MESES_A = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

export default async function handler(req, res) {
  const dry = req.query?.dry === '1'
  const token = process.env.RESEND_API_KEY
  if (!token && !dry) return res.status(500).json({ error: 'RESEND_API_KEY não configurado' })

  const agora = new Date()
  // Próximo sábado
  const diaSemana = agora.getDay() // 0=dom, 1=seg...
  const diasAteSab = diaSemana === 6 ? 7 : (6 - diaSemana)
  const proxSab = new Date(agora)
  proxSab.setDate(agora.getDate() + diasAteSab)
  proxSab.setHours(0,0,0,0)
  const proxDom = new Date(proxSab)
  proxDom.setDate(proxSab.getDate() + 1)

  const mes = proxSab.getMonth()    // 0-based
  const ano = proxSab.getFullYear()

  // O domingo pode cair no mês seguinte ao do sábado (virada de mês)
  const domMes = proxDom.getMonth()
  const domAno = proxDom.getFullYear()
  const mesmoMes = domMes === mes && domAno === ano

  // Busca dados do banco
  const [{ data: membros }, { data: escalasArr }, { data: escalasLvArr }, { data: escalaPreg }, { data: escalasEBArr }] = await Promise.all([
    sb.from('membros').select('*'),
    sb.from('escalas').select('*').eq('ano', ano).eq('mes', mes + 1),
    sb.from('escalas_lv').select('*').eq('ano', ano).eq('mes', mes + 1),
    sb.from('escala_preg').select('*'),
    sb.from('escalas_eb').select('*').eq('ano', ano).eq('mes', mes + 1),
  ])
  // Se o domingo é de outro mês, busca as escalas desse mês também
  let escalasDomArr = escalasArr, escalasLvDomArr = escalasLvArr
  if (!mesmoMes) {
    const [{ data: e2 }, { data: lv2 }] = await Promise.all([
      sb.from('escalas').select('*').eq('ano', domAno).eq('mes', domMes + 1),
      sb.from('escalas_lv').select('*').eq('ano', domAno).eq('mes', domMes + 1),
    ])
    escalasDomArr = e2; escalasLvDomArr = lv2
  }

  const membroMap = {}
  ;(membros||[]).forEach(m => { membroMap[m.nome] = m })

  // Índice do sábado no seu mês e do domingo no mês DELE (podem diferir)
  const si = getSabs(mes, ano).findIndex(s => s.getDate() === proxSab.getDate())
  const di = getDoms(domMes, domAno).findIndex(d => d.getDate() === proxDom.getDate())

  if (si < 0) return res.status(200).json({ message: 'Sábado não encontrado no mês' })

  // Monta mapa de pessoa → linhas
  const pessoaLinhas = {}
  const addLinha = (nome, linha) => {
    if (!nome || nome === 'CAFÉ E CONEXÃO') return
    if (!pessoaLinhas[nome]) pessoaLinhas[nome] = []
    pessoaLinhas[nome].push(linha)
  }

  const fmtDt = (d) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
  const FNS = { dir:'Direção', voc:'Vocal Solo', mor:'Mordomia', por:'Portaria', ord:'Ordenado do Dia' }

  // Escala de culto
  const escMap = {}
  ;(escalasArr||[]).forEach(r => { escMap[r.slot] = r })

  const sabSlot = escMap[`sab-${si}`]
  if (sabSlot) {
    const preg = (escalaPreg||[]).find(p=>p.data===proxSab.toISOString().slice(0,10)&&p.culto==='Sábado Manhã')
    if (preg) addLinha(preg.pregador, `${fmtDt(proxSab)} Sáb — Pregação`)
    Object.entries(FNS).forEach(([k,l]) => { if(sabSlot[k]) addLinha(sabSlot[k], `${fmtDt(proxSab)} Sáb — ${l}`) })
  }
  const escDomMap = {}
  ;(escalasDomArr||[]).forEach(r => { escDomMap[r.slot] = r })
  const domSlot = di >= 0 ? escDomMap[`dom-${di}`] : null
  if (domSlot) {
    const preg = (escalaPreg||[]).find(p=>p.data===proxDom.toISOString().slice(0,10)&&p.culto==='Domingo Noite')
    if (preg) addLinha(preg.pregador, `${fmtDt(proxDom)} Dom — Pregação`)
    const FNS_DOM = { dir:'Direção', mor:'Mordomia', por:'Portaria', ord:'Ordenado do Dia' }
    Object.entries(FNS_DOM).forEach(([k,l]) => { if(domSlot[k]) addLinha(domSlot[k], `${fmtDt(proxDom)} Dom — ${l}`) })
  }

  // Escola Bíblica (sábado 9h) — slot é o índice do sábado no mês
  ;(escalasEBArr||[]).filter(r => String(r.slot) === String(si)).forEach(r => {
    if (r.prof) addLinha(r.prof, `${fmtDt(proxSab)} Sáb — 📖 Escola Bíblica: Professor (${r.classe})`)
    if (r.aux) addLinha(r.aux, `${fmtDt(proxSab)} Sáb — 📖 Escola Bíblica: Auxiliar (${r.classe})`)
  })

  // Escala de louvor — apenas os slots do PRÓXIMO FDS (não o mês inteiro)
  const lvRows = [
    ...(escalasLvArr||[]).filter(r => r.slot === `sab-${si}`),
    ...(di >= 0 ? (escalasLvDomArr||[]).filter(r => r.slot === `dom-${di}`) : []),
  ]
  lvRows.forEach(r => {
    const ehSab = r.slot.startsWith('sab')
    const dataFds = ehSab ? proxSab : proxDom
    const labelDia = ehSab ? 'Sáb' : 'Dom'
    let vocal = {}, inst = {}
    try { vocal = typeof r.vocal === 'object' ? (r.vocal||{}) : JSON.parse(r.vocal||'{}') } catch {}
    try { inst = typeof r.instrumental === 'object' ? (r.instrumental||{}) : JSON.parse(r.instrumental||'{}') } catch {}
    const INST_EMOJI = { Teclado:'🎹', Bateria:'🥁', Baixo:'🎸', Guitarra:'🎸', 'Violão':'🎸', Som:'🎚️', 'Telão':'🖥️', 'Mídia':'🎥' }
    Object.values(vocal).forEach(nome => { if(nome) addLinha(nome, `${fmtDt(dataFds)} ${labelDia} — 🎤 Vocal (Louvor)`) })
    Object.entries(inst).forEach(([papel, val]) => {
      if (papel === '_n' || papel === '_vs') return // metadados, não instrumentos
      const arr = Array.isArray(val) ? val : [val]
      arr.forEach(x => { const n = x?.nome||x; if(n && typeof n === 'string') addLinha(n, `${fmtDt(dataFds)} ${labelDia} — ${INST_EMOJI[papel]||'🎸'} ${papel}${x?.fundo?' + Fundo da pregação':''} (Louvor)`) })
    })
  })

  // Envia emails
  const escopoLabel = `FDS ${fmtDt(proxSab)}/${fmtDt(proxDom)} de ${MESES[mes]}`
  let enviados = 0, semEmail = 0

  const pessoas = []
  for (const [nome, linhas] of Object.entries(pessoaLinhas)) {
    const membro = membroMap[nome]
    if (!membro?.email) { semEmail++; continue }
    pessoas.push({ nome, email: membro.email, linhas })
  }

  if (dry) {
    return res.status(200).json({ dry: true, fds: escopoLabel, total: pessoas.length, semEmail, pessoas: pessoas.map(p => ({ nome: p.nome, email: p.email, linhas: p.linhas })) })
  }

  // 1. Envia escala individual para cada membro escalado
  for (const p of pessoas) {
    const assunto = `Sua escala do FDS — ${fmtDt(proxSab)} | Promessa Lago dos Peixes`
    const html = buildFdsEmail(p.nome.split(' ')[0], p.linhas, escopoLabel)
    const ok = await sendResend(token, p.email, assunto, html)
    if (ok) enviados++
  }

  // 2. Lembrete para gestores enviarem a escala via WhatsApp
  const { data: gestoresData } = await sb.from('gestores').select('secretario, vocal, permissoes').limit(1).single()
  const gestoresLembrete = await montarGestoresLembrete(gestoresData, sb)
  const fds = `${fmtDt(proxSab)} (Sáb) e ${fmtDt(proxDom)} (Dom)`
  const assuntoLembrete = `⏰ Lembrete: enviar escala do FDS ${fmtDt(proxSab)} | Promessa Lago dos Peixes`
  for (const g of gestoresLembrete) {
    if (!g.email) continue
    const html = buildLembreteHtml(g.nome, fds)
    await sendResend(token, g.email, assuntoLembrete, html)
  }

  return res.status(200).json({ enviados, semEmail, fds: escopoLabel, lembretesGestores: gestoresLembrete.length })
}

function getSabs(mes, ano) {
  const sabs = []
  const days = new Date(ano, mes + 1, 0).getDate()
  for (let i = 1; i <= days; i++) {
    const d = new Date(ano, mes, i)
    if (d.getDay() === 6) sabs.push(d)
  }
  return sabs
}

function getDoms(mes, ano) {
  const doms = []
  const days = new Date(ano, mes + 1, 0).getDate()
  for (let i = 1; i <= days; i++) {
    const d = new Date(ano, mes, i)
    if (d.getDay() === 0) doms.push(d)
  }
  return doms
}

async function sendResend(token, to, subject, html) {
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Promessa Lago dos Peixes <noreply@promessalagodospeixes.com.br>', to: [to], subject, html }),
    })
    return r.ok
  } catch { return false }
}

function buildFdsEmail(primeiroNome, linhas, escopoLabel) {
  const linhasHtml = linhas.map(l =>
    `<div style="font-size:14px;color:#333;padding:6px 0;border-bottom:1px solid #eee">📅 ${l}</div>`
  ).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,sans-serif">
  <div style="max-width:540px;margin:30px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12)">
    <div style="background:#0d1117;padding:24px;text-align:center">
      <div style="color:#00bcd4;font-size:20px;font-weight:700;letter-spacing:3px;margin-bottom:4px">PROMESSA LAGO DOS PEIXES</div>
      <div style="color:#666;font-size:11px;letter-spacing:1px">Igreja Adventista da Promessa</div>
    </div>
    <div style="padding:28px 24px">
      <p style="font-size:16px;color:#222;margin:0 0 6px">Paz, <strong>${primeiroNome}</strong>!</p>
      <p style="font-size:13px;color:#555;margin:0 0 20px;line-height:1.6">
        Passando para te lembrar que <strong>esse final de semana é você</strong>! Confirme sua presença e fique atento ao horário.
      </p>
      <div style="background:#f8fafc;border-radius:10px;padding:16px;border-left:4px solid #00bcd4;margin-bottom:20px">
        ${linhasHtml}
      </div>
      <p style="font-size:12px;color:#888;margin:0 0 6px">Qualquer dúvida ou imprevisto, entre em contato com a secretaria com antecedência.</p>
      <p style="font-size:12px;color:#888;margin:0">Que Deus abençoe seu serviço!</p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #eee;padding:16px 24px;text-align:center">
      <div style="font-size:11px;color:#aaa">Promessa Lago dos Peixes — Estrada Austin-Queimados, 250 — Nova Iguaçu/RJ</div>
      <div style="font-size:11px;color:#aaa">iaplagodospeixes@gmail.com</div>
    </div>
  </div>
</body>
</html>`
}

// Monta lista de gestores (secretário + vocais) com emails do banco
async function montarGestoresLembrete(gestoresData, sb) {
  if (!gestoresData) return []
  const nomes = new Set()
  if (gestoresData.secretario) nomes.add(gestoresData.secretario)
  try {
    const vocal = Array.isArray(gestoresData.vocal) ? gestoresData.vocal : JSON.parse(gestoresData.vocal || '[]')
    vocal.filter(Boolean).forEach(n => nomes.add(n))
  } catch {}
  if (!nomes.size) return []
  const { data: membros } = await sb.from('membros').select('nome,email,nome_exibicao').in('nome', [...nomes])
  return (membros || []).filter(m => m.email).map(m => ({
    nome: (m.nome_exibicao || m.nome).split(' ')[0],
    email: m.email,
  }))
}

function buildLembreteHtml(nome, fds) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,sans-serif">
  <div style="max-width:540px;margin:30px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12)">
    <div style="background:#0d1117;padding:24px;text-align:center">
      <div style="color:#00bcd4;font-size:20px;font-weight:700;letter-spacing:3px;margin-bottom:4px">PROMESSA LAGO DOS PEIXES</div>
      <div style="color:#666;font-size:11px;letter-spacing:1px">Igreja Adventista da Promessa</div>
    </div>
    <div style="padding:28px 24px">
      <p style="font-size:16px;color:#222;margin:0 0 6px">Paz, <strong>${nome}</strong>!</p>
      <p style="font-size:13px;color:#555;margin:0 0 18px;line-height:1.6">
        Lembrete: o final de semana <strong>${fds}</strong> está chegando. As escalas já foram enviadas automaticamente por e-mail, mas não esqueça de notificar também pelo WhatsApp quem não recebeu.
      </p>
      <div style="background:#f8fafc;border-radius:10px;padding:14px;border-left:4px solid #00bcd4;margin-bottom:20px">
        <div style="font-size:13px;color:#333;font-weight:600;margin-bottom:8px">O que fazer:</div>
        <div style="font-size:13px;color:#555;padding:5px 0;border-bottom:1px solid #eee">✅ Acesse o sistema de gestão</div>
        <div style="font-size:13px;color:#555;padding:5px 0;border-bottom:1px solid #eee">✅ Confira quem está sem e-mail cadastrado</div>
        <div style="font-size:13px;color:#555;padding:5px 0">✅ Envie a escala via WhatsApp para essas pessoas</div>
      </div>
      <p style="font-size:12px;color:#888;margin:0">Que Deus abençoe seu serviço!</p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #eee;padding:16px 24px;text-align:center">
      <div style="font-size:11px;color:#aaa">Promessa Lago dos Peixes — Estrada Austin-Queimados, 250 — Nova Iguaçu/RJ</div>
      <div style="font-size:11px;color:#aaa">iaplagodospeixes@gmail.com</div>
    </div>
  </div>
</body>
</html>`
}
