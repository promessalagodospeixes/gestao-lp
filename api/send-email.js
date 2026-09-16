import { sessaoDaRequisicao, criarToken } from './_auth.js'
import { registrarEnvio } from './_registrar-envio.js'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const BASE_URL = 'https://gestao.promessalagodospeixes.com.br'

// Botões de confirmar presença — um par por culto (Sábado/Domingo).
// Só nos envios do FIM DE SEMANA / do dia (não no mensal). A data sai das
// próprias linhas (têm dd/mm/aaaa); o culto vem do dia da semana.
function confirmarDaPessoa(nome, linhas) {
  const datas = new Set()
  for (const l of (linhas || [])) {
    const txt = typeof l === 'string' ? l : (l?.texto || '')
    const m = txt.match(/(\d{2})\/(\d{2})\/(\d{4})/)
    if (m) datas.add(`${m[3]}-${m[2]}-${m[1]}`) // aaaa-mm-dd
  }
  const out = []
  for (const data of datas) {
    const [a, mm, dd] = data.split('-').map(Number)
    const dow = new Date(a, mm - 1, dd).getDay() // 6=sáb, 0=dom
    const culto = dow === 6 ? 'Sábado Manhã' : dow === 0 ? 'Domingo Noite' : null
    if (!culto) continue // confirmar só nos cultos padrão
    const tk = criarToken({ k: 'conf', nome, data, culto }, 24 * 8)
    const url = (r) => `${BASE_URL}/api/atualizar?conf=${encodeURIComponent(tk)}&r=${r}`
    out.push({ rotulo: dow === 6 ? 'Sábado' : 'Domingo', sim: url('sim'), nao: url('nao') })
  }
  return out
}

export default async function handler(req, res) {
  // Só quem está logado no sistema dispara e-mail em nome da igreja
  if (!sessaoDaRequisicao(req)) return res.status(401).json({ erro: 'Sem permissão para enviar e-mails.' })
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const token = process.env.RESEND_API_KEY
  if (!token) return res.status(500).json({ error: 'RESEND_API_KEY não configurado' })

  const { pessoas, tipo, mes, ano, escopo, usuario } = req.body
  // pessoas = [{ nome, email, linhas: ['Sábado 05/07 — Direção', ...] }]

  if (!pessoas?.length) return res.status(400).json({ error: 'Nenhuma pessoa informada' })

  const tipoLabel = { culto:'Escala de Culto', eb:'Escola Bíblica', louvor:'Equipe de Louvor' }[tipo] || 'Escala'
  const mesLabel = MESES[mes] || ''
  const escopoLabel = escopo === 'fds' ? 'Próximo Final de Semana' : escopo === 'dia' ? 'Escalação do Dia' : `${mesLabel} ${ano}`

  let enviados = 0, erros = [], semEmail = 0

  const isLembrete = escopo === 'fds'
  for (const p of pessoas) {
    if (!p.email) { semEmail++; continue }
    const assunto = isLembrete
      ? `🔔 Lembrete: você está escalado(a) esse FDS | Promessa Lago dos Peixes`
      : `${tipoLabel} — ${escopoLabel} | Promessa Lago dos Peixes`
    // Botões de confirmar no envio do fim de semana / do dia — e sempre na
    // pregação (o pregador recebe só a data que vai pregar, não um mês de funções).
    // Nunca no envio MENSAL da escala de culto/louvor (regra do Gabriel).
    const comBotao = escopo === 'fds' || escopo === 'dia' || tipo === 'pregacao'
    const confirmar = comBotao ? confirmarDaPessoa(p.nome, p.linhas) : []
    const html = buildEmailHtml(p.nome, p.linhas, tipoLabel, escopoLabel, isLembrete, confirmar)
    const ok = await sendResend(token, p.email, assunto, html)
    if (ok) enviados++
    else erros.push(p.nome)
  }

  await registrarEnvio({
    tipo: tipo || 'outro',
    escopo: escopo || 'mes',
    ref: escopo === 'mes' || !escopo ? `${ano}-${(mes ?? 0) + 1}` : new Date().toISOString().slice(0, 10),
    detalhe: escopoLabel,
    enviados,
    semEmail,
    erros: erros.length,
    pessoas: pessoas.filter(p => p.email).map(p => p.nome),
    origem: 'manual',
    usuario: usuario || null,
  })

  return res.status(200).json({ enviados, erros, semEmail })
}

async function sendResend(token, to, subject, html) {
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Promessa Lago dos Peixes <noreply@promessalagodospeixes.com.br>',
        to: [to],
        subject,
        html,
      }),
    })
    return r.ok
  } catch { return false }
}

const escapar = (t) => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

function buildEmailHtml(nome, linhas, tipoLabel, escopoLabel, isLembrete = false, confirmar = []) {
  const primeiroNome = nome.split(' ')[0]

  const confirmarHtml = confirmar.length ? `
      <div style="margin:0 0 20px">
        <p style="font-size:13px;color:#222;font-weight:700;margin:0 0 10px">Você vai poder?</p>
        ${confirmar.map(c => `
        <div style="margin-bottom:10px">
          ${confirmar.length > 1 ? `<div style="font-size:12px;color:#888;margin-bottom:5px">${c.rotulo}</div>` : ''}
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%"><tr>
            <td style="padding-right:5px;width:50%">
              <a href="${c.sim}" style="display:block;text-align:center;background:#22a06b;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 0;border-radius:9px">✅ Confirmo</a>
            </td>
            <td style="padding-left:5px;width:50%">
              <a href="${c.nao}" style="display:block;text-align:center;background:#eef1f4;color:#444;text-decoration:none;font-size:14px;font-weight:700;padding:12px 0;border-radius:9px">Não vou poder</a>
            </td>
          </tr></table>
        </div>`).join('')}
      </div>` : ''
  // Cada item pode ser um texto simples ou { texto, extras:[{rotulo, valor, url}] }
  const linhasHtml = linhas.map(l => {
    if (typeof l === 'string') {
      return `<div style="font-size:14px;color:#333;padding:6px 0;border-bottom:1px solid #eee">📅 ${escapar(l)}</div>`
    }
    const extras = (l.extras || []).filter(e => e && e.valor).map(e => {
      const val = e.url
        ? `<a href="${escapar(e.valor)}" style="color:#0b7285;word-break:break-all">${escapar(e.valor)}</a>`
        : escapar(e.valor).replace(/\n/g, '<br>')
      return `<div style="font-size:13px;color:#555;padding:3px 0 0 20px;line-height:1.5"><strong style="color:#333">${escapar(e.rotulo)}:</strong> ${val}</div>`
    }).join('')
    return `<div style="padding:8px 0;border-bottom:1px solid #eee"><div style="font-size:14px;color:#333">📅 ${escapar(l.texto)}</div>${extras}</div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,sans-serif">
  <div style="max-width:540px;margin:30px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12)">

    <!-- Header -->
    <div style="background:#0d1117;padding:24px;text-align:center">
      <div style="color:#00bcd4;font-size:20px;font-weight:700;letter-spacing:3px;margin-bottom:4px">PROMESSA LAGO DOS PEIXES</div>
      <div style="color:#666;font-size:11px;letter-spacing:1px">Igreja Adventista da Promessa</div>
    </div>

    <!-- Body -->
    <div style="padding:28px 24px">
      <p style="font-size:16px;color:#222;margin:0 0 6px">Paz, <strong>${primeiroNome}</strong>!</p>
      ${isLembrete
        ? `<p style="font-size:13px;color:#555;margin:0 0 20px;line-height:1.6">Passando para te lembrar que <strong>esse final de semana é você</strong>! Confirme sua presença e fique atento ao horário.</p>`
        : `<p style="font-size:13px;color:#555;margin:0 0 20px;line-height:1.6">Segue sua escala de <strong>${tipoLabel}</strong> para <strong>${escopoLabel}</strong>. Guarde as datas e confirme sua disponibilidade.</p>`
      }

      <div style="background:#f8fafc;border-radius:10px;padding:16px;border-left:4px solid #00bcd4;margin-bottom:20px">
        ${linhasHtml}
      </div>
      ${confirmarHtml}

      <p style="font-size:12px;color:#888;margin:0 0 6px">
        Qualquer dúvida ou necessidade de troca, entre em contato com a secretaria da igreja.
      </p>
      <p style="font-size:12px;color:#888;margin:0">
        Que Deus abençoe seu serviço!
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #eee;padding:16px 24px;text-align:center">
      <div style="font-size:11px;color:#aaa">Promessa Lago dos Peixes</div>
      <div style="font-size:11px;color:#aaa">Estrada Austin-Queimados, 250 — Nova Iguaçu/RJ</div>
      <div style="font-size:11px;color:#aaa;margin-top:2px">iaplagodospeixes@gmail.com</div>
    </div>
  </div>
</body>
</html>`
}
