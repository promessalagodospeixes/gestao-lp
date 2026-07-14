// Cron automático: toda segunda-feira às 8h (Brasília) = 11h UTC
// Envia lembrete ao secretário e gestores de louvor para enviar a escala do próximo FDS

const DESTINATARIOS = [
  { nome: 'Davi',    email: 'daviluizfrazao10@gmail.com' },
  { nome: 'Caio',   email: 'apocaiolipse@gmail.com' },
  { nome: 'Vitória', email: 'agathavitoria1213@gmail.com' },
]

export default async function handler(req, res) {
  const token = process.env.RESEND_API_KEY
  if (!token) return res.status(500).json({ error: 'RESEND_API_KEY não configurado' })

  const agora = new Date()
  const diasAteSab = agora.getDay() === 6 ? 7 : (6 - agora.getDay())
  const proxSab = new Date(agora)
  proxSab.setDate(agora.getDate() + diasAteSab)
  const proxDom = new Date(proxSab)
  proxDom.setDate(proxSab.getDate() + 1)

  const fmtDt = (d) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
  const fds = `${fmtDt(proxSab)} (Sáb) e ${fmtDt(proxDom)} (Dom)`

  const assunto = `⏰ Lembrete: enviar escala do FDS ${fmtDt(proxSab)} | Promessa Lago dos Peixes`

  let enviados = 0
  for (const dest of DESTINATARIOS) {
    if (!dest.email) continue
    const html = buildLembreteHtml(dest.nome, fds)
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Promessa Lago dos Peixes <noreply@promessalagodospeixes.com.br>',
          to: [dest.email],
          subject: assunto,
          html,
        }),
      })
      if (r.ok) enviados++
    } catch { /* segue */ }
  }

  return res.status(200).json({ enviados, total: DESTINATARIOS.filter(d => d.email).length, fds })
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
      <p style="font-size:14px;color:#555;margin:0 0 20px;line-height:1.6">
        Este é um lembrete automático: o final de semana <strong>${fds}</strong> está chegando e as pessoas escaladas ainda precisam ser notificadas.
      </p>

      <div style="background:#f8fafc;border-radius:10px;padding:18px;border-left:4px solid #00bcd4;margin-bottom:24px">
        <div style="font-size:13px;color:#333;font-weight:600;margin-bottom:8px">📋 O que precisa ser feito:</div>
        <div style="font-size:13px;color:#555;padding:5px 0;border-bottom:1px solid #eee">✅ Acesse o sistema de gestão</div>
        <div style="font-size:13px;color:#555;padding:5px 0;border-bottom:1px solid #eee">✅ Vá em <strong>Escala de Culto</strong>, <strong>Equipe de Louvor</strong> e <strong>Escola Bíblica</strong></div>
        <div style="font-size:13px;color:#555;padding:5px 0">✅ Envie a escala via WhatsApp ou e-mail para os escalados do FDS</div>
      </div>

      <p style="font-size:12px;color:#888;margin:0">
        Que Deus abençoe seu serviço na secretaria!
      </p>
    </div>

    <div style="background:#f8fafc;border-top:1px solid #eee;padding:16px 24px;text-align:center">
      <div style="font-size:11px;color:#aaa">Promessa Lago dos Peixes — Estrada Austin-Queimados, 250 — Nova Iguaçu/RJ</div>
      <div style="font-size:11px;color:#aaa">iaplagodospeixes@gmail.com</div>
    </div>
  </div>
</body>
</html>`
}
