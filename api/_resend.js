// Envio de e-mail pelo Resend, num lugar só, com rede de segurança:
// - repete automaticamente quando o Resend recusa por limite de velocidade (429)
//   ou erro temporário (5xx), com espera crescente;
// - devolve o MOTIVO da falha, para o sistema registrar e mostrar.
// O plano grátis do Resend limita ~2 envios/segundo — por isso o ritmo importa.

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const REMETENTE = 'Promessa Lago dos Peixes <noreply@promessalagodospeixes.com.br>'

export async function enviarEmail(token, to, subject, html, tentativas = 3) {
  let motivo = 'falhou'
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: REMETENTE, to: [to], subject, html }),
      })
      if (r.ok) return { ok: true }
      const corpo = await r.text().catch(() => '')
      motivo = `HTTP ${r.status}${corpo ? ' — ' + corpo.slice(0, 140) : ''}`
      // 429 (limite) ou 5xx (instabilidade): espera e tenta de novo.
      // 4xx (e-mail inválido, recusado): não adianta repetir.
      if (r.status === 429 || r.status >= 500) { await sleep(1200 * (i + 1)); continue }
      return { ok: false, motivo }
    } catch (e) {
      motivo = e?.message || 'erro de rede'
      await sleep(800 * (i + 1))
    }
  }
  return { ok: false, motivo }
}

// Envia uma lista de {to, subject, html, nome} em ritmo seguro (um a cada ~550ms),
// repetindo os que o Resend recusar. Devolve { enviados, falhas:[{nome,email,motivo}] }.
export async function enviarLote(token, itens, ritmoMs = 550) {
  let enviados = 0
  const falhas = []
  for (let i = 0; i < itens.length; i++) {
    const it = itens[i]
    const r = await enviarEmail(token, it.to, it.subject, it.html)
    if (r.ok) enviados++
    else falhas.push({ nome: it.nome || null, email: it.to, motivo: r.motivo })
    if (i < itens.length - 1) await sleep(ritmoMs)
  }
  return { enviados, falhas }
}
