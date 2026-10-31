// Lembrete semanal para os LÍDERES de ministério: os eventos da Agenda que são
// do ministério deles e acontecem nos próximos N dias (padrão 15).
// Roda junto com o robô de terça (cron-fds) e também pode ser disparado manualmente.
import { enviarEmail, sleep } from './_resend.js'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const norm  = (s) => (s||'').toString().trim().toLowerCase()

// Retorna { enviados, semEmail:[{ministerio,lider}], semLider:[{ministerio,titulo,data}], lideres:[...] }
export async function avisarLideresEventos({ sb, token, agora = new Date(), dias = 15, dry = false }) {
  const hoje = new Date(agora); hoje.setHours(0,0,0,0)
  const limite = new Date(hoje); limite.setDate(hoje.getDate() + dias)

  const [{ data: agenda }, { data: lideranca }, { data: membros }] = await Promise.all([
    sb.from('agenda').select('*'),
    sb.from('lideranca').select('*'),
    sb.from('membros').select('nome,email,nome_exibicao'),
  ])

  const membroEmail = {}
  ;(membros||[]).forEach(m => { membroEmail[m.nome] = m.email || null })

  // Índice: ministério (normalizado) → líder { nome, email, ministerio }
  // O contato vem SEMPRE do cadastro do membro vinculado (fonte única, sempre atual).
  // Sem membro vinculado = sem vínculo de verdade: não inventa e-mail de outro lugar.
  const liderDe = {}
  ;(lideranca||[]).forEach(l => {
    if (!l.ministerio) return
    const email = l.membro_nome ? membroEmail[l.membro_nome] : null
    liderDe[norm(l.ministerio)] = { nome: l.nome, email: email || null, ministerio: l.ministerio }
  })

  // Eventos do ministério dentro da janela
  const eventos = (agenda||[])
    .filter(e => e.ministerio)
    .filter(e => {
      const d = new Date(e.data + 'T00:00:00')
      return d >= hoje && d <= limite
    })
    .sort((a,b) => a.data.localeCompare(b.data))

  // Agrupa por líder (pela chave do e-mail; se não tem e-mail, registra como pendência)
  const porLider = {}            // email → { nome, ministerios:Set, eventos:[] }
  const semEmail = []            // líderes com evento mas sem e-mail
  const semLider = []            // eventos de ministério sem líder cadastrado
  const jaSemEmail = new Set()

  for (const ev of eventos) {
    const lider = liderDe[norm(ev.ministerio)]
    if (!lider) { semLider.push({ ministerio: ev.ministerio, titulo: ev.titulo, data: ev.data }); continue }
    if (!lider.email) {
      if (!jaSemEmail.has(norm(ev.ministerio))) { semEmail.push({ ministerio: ev.ministerio, lider: lider.nome }); jaSemEmail.add(norm(ev.ministerio)) }
      continue
    }
    if (!porLider[lider.email]) porLider[lider.email] = { nome: lider.nome, ministerios: new Set(), eventos: [] }
    porLider[lider.email].ministerios.add(ev.ministerio)
    porLider[lider.email].eventos.push(ev)
  }

  const lideres = Object.entries(porLider).map(([email, v]) => ({
    email, nome: v.nome, ministerios: [...v.ministerios], eventos: v.eventos,
  }))

  if (dry) return { dry: true, dias, enviados: 0, total: lideres.length, semEmail, semLider, lideres: lideres.map(l => ({ nome: l.nome, email: l.email, ministerios: l.ministerios, eventos: l.eventos.map(e => `${e.data} ${e.titulo}`) })) }

  let enviados = 0
  for (let i = 0; i < lideres.length; i++) {
    const l = lideres[i]
    const assunto = `📋 Eventos do seu ministério — próximos dias | Promessa Lago dos Peixes`
    const html = buildLiderEmail(primeiroNome(l.nome), l.ministerios, l.eventos)
    const r = await enviarEmail(token, l.email, assunto, html)
    if (r.ok) enviados++
    if (i < lideres.length - 1) await sleep(550)
  }

  return { enviados, total: lideres.length, dias, semEmail, semLider }
}

function primeiroNome(nome) { return (nome||'').split(' ')[0] || nome || '' }

function fmtLinha(ev) {
  const d = new Date(ev.data + 'T00:00:00')
  const dia = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
  const partes = [`${dia} (${DIAS[d.getDay()]})`]
  if (ev.hora) partes.push(`às ${ev.hora}`)
  let linha = partes.join(' ') + ` — <strong>${ev.titulo}</strong>`
  const extras = []
  if (ev.localidade) extras.push(`📍 ${ev.localidade}`)
  if (ev.descricao) extras.push(ev.descricao)
  return { principal: linha, sub: extras.join(' · ') }
}

function buildLiderEmail(primeiro, ministerios, eventos) {
  const linhasHtml = eventos.map(ev => {
    const { principal, sub } = fmtLinha(ev)
    return `<div style="padding:9px 0;border-bottom:1px solid #eee">
        <div style="font-size:14px;color:#333">📅 ${principal}</div>
        ${sub ? `<div style="font-size:12px;color:#888;margin-top:2px">${sub}</div>` : ''}
      </div>`
  }).join('')
  const minTxt = ministerios.length === 1 ? ministerios[0] : ministerios.join(' e ')
  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,sans-serif">
  <div style="max-width:540px;margin:30px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12)">
    <div style="background:#0d1117;padding:24px;text-align:center">
      <div style="color:#00bcd4;font-size:20px;font-weight:700;letter-spacing:3px;margin-bottom:4px">PROMESSA LAGO DOS PEIXES</div>
      <div style="color:#666;font-size:11px;letter-spacing:1px">Igreja Adventista da Promessa</div>
    </div>
    <div style="padding:28px 24px">
      <p style="font-size:16px;color:#222;margin:0 0 6px">Paz, <strong>${primeiro}</strong>!</p>
      <p style="font-size:13px;color:#555;margin:0 0 18px;line-height:1.6">
        Como líder do <strong>${minTxt}</strong>, aqui estão os eventos do seu ministério que estão chegando. Fique atento para se preparar e organizar a equipe.
      </p>
      <div style="background:#f8fafc;border-radius:10px;padding:16px;border-left:4px solid #00bcd4;margin-bottom:20px">
        ${linhasHtml}
      </div>
      <p style="font-size:12px;color:#888;margin:0 0 6px">Precisa mudar alguma coisa? Acesse o sistema de gestão, em <strong>Agenda</strong>.</p>
      <p style="font-size:12px;color:#888;margin:0">Que Deus abençoe sua liderança!</p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #eee;padding:16px 24px;text-align:center">
      <div style="font-size:11px;color:#aaa">Promessa Lago dos Peixes — Estrada Austin-Queimados, 250 — Nova Iguaçu/RJ</div>
      <div style="font-size:11px;color:#aaa">iaplagodospeixes@gmail.com</div>
    </div>
  </div>
</body>
</html>`
}
