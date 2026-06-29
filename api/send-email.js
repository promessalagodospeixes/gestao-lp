const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const token = process.env.RESEND_API_KEY
  if (!token) return res.status(500).json({ error: 'RESEND_API_KEY não configurado' })

  const { pessoas, tipo, mes, ano, escopo } = req.body
  // pessoas = [{ nome, email, linhas: ['Sábado 05/07 — Direção', ...] }]

  if (!pessoas?.length) return res.status(400).json({ error: 'Nenhuma pessoa informada' })

  const tipoLabel = { culto:'Escala de Culto', eb:'Escola Bíblica', louvor:'Equipe de Louvor' }[tipo] || 'Escala'
  const mesLabel = MESES[mes] || ''
  const escopoLabel = escopo === 'fds' ? 'Próximo Final de Semana' : escopo === 'dia' ? 'Escalação do Dia' : `${mesLabel} ${ano}`

  let enviados = 0, erros = [], semEmail = 0

  for (const p of pessoas) {
    if (!p.email) { semEmail++; continue }
    const assunto = `${tipoLabel} — ${escopoLabel} | Promessa Lago dos Peixes`
    const html = buildEmailHtml(p.nome, p.linhas, tipoLabel, escopoLabel)
    const ok = await sendResend(token, p.email, assunto, html)
    if (ok) enviados++
    else erros.push(p.nome)
  }

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

function buildEmailHtml(nome, linhas, tipoLabel, escopoLabel) {
  const primeiroNome = nome.split(' ')[0]
  const linhasHtml = linhas.map(l =>
    `<div style="font-size:14px;color:#333;padding:6px 0;border-bottom:1px solid #eee">${l}</div>`
  ).join('')

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
      <p style="font-size:13px;color:#666;margin:0 0 20px">
        Segue sua <strong>${tipoLabel}</strong> — <strong>${escopoLabel}</strong>:
      </p>

      <div style="background:#f8fafc;border-radius:10px;padding:16px;border-left:4px solid #00bcd4;margin-bottom:20px">
        ${linhasHtml}
      </div>

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
