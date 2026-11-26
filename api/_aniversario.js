// Lógica de aniversário, num módulo compartilhado (arquivo com "_" não vira função
// na Vercel — assim não estouramos o limite de funções). Usado pelo cron diário
// (api/cron-lembretes.js) e pelo botão manual "Parabenizar" (api/db.js).
import { enviarEmail, sleep } from './_resend.js'

// "ECLAIR DE OLIVEIRA FERREIRA" -> "Eclair de Oliveira Ferreira"
export function nomeBonito(nome) {
  const minus = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
  return String(nome || '').toLowerCase().split(/\s+/).map((p, i) =>
    (i > 0 && minus.has(p)) ? p : p.charAt(0).toUpperCase() + p.slice(1)
  ).join(' ')
}

// Aniversariantes de um dia/mês (hora de Brasília), só gente ATIVA.
export function aniversariantesDe(membros, dia, mes, anoAtual) {
  return (membros || []).filter(m => {
    if (m.ativo === false) return false
    if (!m.nascimento) return false
    const [, mm, dd] = String(m.nascimento).slice(0, 10).split('-').map(Number)
    return dd === dia && mm === mes
  }).map(m => {
    const ano = Number(String(m.nascimento).slice(0, 4))
    return { ...m, idade: ano ? anoAtual - ano : null }
  }).sort((a, b) => a.nome.localeCompare(b.nome))
}

export function montarMensagemGrupo(aniversariantes) {
  const nomes = aniversariantes.map(a => nomeBonito(a.nome))
  const lista = nomes.length === 1
    ? nomes[0]
    : nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1]
  return `🎉🎂 *Hoje é dia de festa na Promessa Lago dos Peixes!*\n\n`
    + `Parabéns, *${lista}*! 🥳\n\n`
    + `Que Deus renove as suas forças e derrame muitas bênçãos, saúde e paz sobre a sua vida. `
    + `Toda a família da igreja celebra com você! 🙏🎈`
}

// Pastor (Liderança, cargo com "Pastor") + Secretário (Gestores → e-mail do membro).
export async function destinatariosAdmin(sb) {
  const out = []
  const vistos = new Set()
  const push = (papel, nome, email) => {
    const e = (email || '').trim().toLowerCase()
    if (!e || vistos.has(e)) return
    vistos.add(e); out.push({ papel, nome, email })
  }
  const { data: lideres } = await sb.from('lideranca').select('nome, email, membro_nome, cargo')
  for (const l of (lideres || [])) {
    if (!/pastor/i.test(String(l.cargo || ''))) continue
    let email = l.email
    if (!email && l.membro_nome) {
      const { data } = await sb.from('membros').select('email').eq('nome', l.membro_nome).limit(1)
      email = data?.[0]?.email
    }
    push('Pastor', l.nome || l.membro_nome, email)
  }
  const { data: gest } = await sb.from('gestores').select('secretario').limit(1)
  const nomeSec = gest?.[0]?.secretario
  if (nomeSec) {
    const { data } = await sb.from('membros').select('nome, email').eq('nome', nomeSec).limit(1)
    if (data?.[0]) push('Secretário', data[0].nome, data[0].email)
  }
  return out
}

const CABECA = `
    <div style="background:#0d1117;padding:24px;text-align:center">
      <div style="color:#00bcd4;font-size:20px;font-weight:700;letter-spacing:3px;margin-bottom:4px">PROMESSA LAGO DOS PEIXES</div>
      <div style="color:#666;font-size:11px;letter-spacing:1px">Igreja Adventista da Promessa</div>
    </div>`
const RODAPE = `
    <div style="background:#f8fafc;border-top:1px solid #eee;padding:16px 24px;text-align:center">
      <div style="font-size:11px;color:#aaa">Promessa Lago dos Peixes — Estrada Austin-Queimados, 250 — Nova Iguaçu/RJ</div>
      <div style="font-size:11px;color:#aaa">iaplagodospeixes@gmail.com</div>
    </div>`

export function htmlParabens(a) {
  const primeiro = nomeBonito(a.nome).split(' ')[0]
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,sans-serif">
  <div style="max-width:540px;margin:30px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12)">
    ${CABECA}
    <div style="padding:28px 24px;text-align:center">
      <div style="font-size:46px;line-height:1;margin-bottom:10px">🎂</div>
      <p style="font-size:18px;color:#222;margin:0 0 14px">Paz, <strong>${primeiro}</strong>!</p>
      <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 16px">
        Hoje é um dia especial, e a família da <strong>Promessa Lago dos Peixes</strong> faz questão de
        celebrar com você. Que o Senhor renove as suas forças, derrame saúde, paz e muitas bênçãos
        sobre a sua vida neste novo ano que se inicia.
      </p>
      <div style="background:#f8fafc;border-radius:10px;padding:16px;border-left:4px solid #00bcd4;margin:0 0 18px">
        <div style="font-size:14px;color:#333;font-style:italic">"O Senhor te abençoe e te guarde." — Números 6:24</div>
      </div>
      <p style="font-size:13px;color:#888;margin:0">Com carinho,<br><strong style="color:#555">Promessa Lago dos Peixes</strong></p>
    </div>
    ${RODAPE}
  </div>
</body></html>`
}

export function htmlAviso(nomeAdmin, aniversariantes, msgGrupo) {
  const primeiro = nomeBonito(nomeAdmin).split(' ')[0]
  const linkGrupo = `https://wa.me/?text=${encodeURIComponent(msgGrupo)}`
  const itens = aniversariantes.map(a =>
    `<div style="font-size:14px;color:#333;padding:7px 0;border-bottom:1px solid #eee">🎂 <strong>${nomeBonito(a.nome)}</strong>${a.idade ? ` — ${a.idade} anos` : ''}${a.email ? '' : ' <span style="color:#c0392b;font-size:12px">(sem e-mail — não recebeu parabéns)</span>'}</div>`
  ).join('')
  const plural = aniversariantes.length > 1
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,sans-serif">
  <div style="max-width:540px;margin:30px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12)">
    ${CABECA}
    <div style="padding:28px 24px">
      <p style="font-size:16px;color:#222;margin:0 0 6px">Paz, <strong>${primeiro}</strong>!</p>
      <p style="font-size:13px;color:#555;margin:0 0 16px;line-height:1.6">
        ${plural ? 'Temos aniversariantes' : 'Temos um aniversariante'} hoje na igreja.
        ${plural ? 'Eles já receberam' : 'A pessoa já recebeu'} o e-mail de parabéns.
        Se quiser, toque no botão abaixo para publicar no grupo do WhatsApp:
      </p>
      <div style="background:#f8fafc;border-radius:10px;padding:14px 16px;border-left:4px solid #00bcd4;margin:0 0 20px">
        ${itens}
      </div>
      <a href="${linkGrupo}" style="display:block;text-align:center;background:#22a06b;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 0;border-radius:10px;margin:0 0 10px">📲 Mandar no grupo do WhatsApp</a>
      <p style="font-size:11px;color:#aaa;text-align:center;margin:0 0 4px">Abre o WhatsApp com a mensagem pronta — é só escolher o grupo da igreja e enviar.</p>
    </div>
    ${RODAPE}
  </div>
</body></html>`
}

// Processa os aniversariantes de HOJE: parabeniza cada um e avisa pastor/secretário.
// Usado pelo cron diário. Devolve um resumo. `apenas==='aniversariante'` pula o aviso.
export async function processarAniversariosHoje(sb, token, { apenas = '' } = {}) {
  const hojeBR = new Date(Date.now() - 3 * 3600000)
  const dia = hojeBR.getDate(), mes = hojeBR.getMonth() + 1, anoAtual = hojeBR.getFullYear()
  const { data: membros } = await sb.from('membros').select('nome, email, tel, nascimento, ativo')
  const aniversariantes = aniversariantesDe(membros, dia, mes, anoAtual)
  if (!aniversariantes.length) return { aniversariantes: [], enviados: 0, falhas: [] }

  let enviados = 0
  const falhas = []
  const comEmail = aniversariantes.filter(a => a.email)
  for (let i = 0; i < comEmail.length; i++) {
    const a = comEmail[i]
    const r = await enviarEmail(token, a.email, `🎉 Feliz aniversário, ${nomeBonito(a.nome).split(' ')[0]}!`, htmlParabens(a))
    if (r.ok) enviados++; else falhas.push({ nome: a.nome, email: a.email, motivo: r.motivo })
    if (i < comEmail.length - 1) await sleep(550)
  }

  if (apenas !== 'aniversariante') {
    const msgGrupo = montarMensagemGrupo(aniversariantes)
    const destAdmin = await destinatariosAdmin(sb)
    for (let i = 0; i < destAdmin.length; i++) {
      const d = destAdmin[i]
      const assunto = `🎂 Aniversariante${aniversariantes.length > 1 ? 's' : ''} de hoje — Promessa Lago dos Peixes`
      const r = await enviarEmail(token, d.email, assunto, htmlAviso(d.nome, aniversariantes, msgGrupo))
      if (r.ok) enviados++; else falhas.push({ nome: d.nome, email: d.email, motivo: r.motivo })
      if (i < destAdmin.length - 1) await sleep(550)
    }
  }
  return { aniversariantes: aniversariantes.map(a => a.nome), enviados, falhas }
}
