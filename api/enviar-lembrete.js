// Envia um lembrete específico imediatamente (chamado pelo botão "Enviar agora" no sistema)

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mynektdohwpzfbmgfunp.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15bmVrdGRvaHdwemZibWdmdW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTcwMjQsImV4cCI6MjA5NjMzMzAyNH0.mhQIXbVgWkpVxvcOXs80KIoqSphde9juPLlZJJrkOhs'
const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const token = process.env.RESEND_API_KEY
  if (!token) return res.status(500).json({ error: 'RESEND_API_KEY não configurado' })

  const { id } = req.body
  if (!id) return res.status(400).json({ error: 'id do lembrete é obrigatório' })

  const { data: lem, error } = await sb.from('lembretes').select('*').eq('id', id).single()
  if (error || !lem) return res.status(404).json({ error: 'Lembrete não encontrado' })

  const destinatarios = Array.isArray(lem.destinatarios) ? lem.destinatarios : []
  if (!destinatarios.length) return res.status(200).json({ enviados: 0, message: 'Sem destinatários' })

  // Busca emails atuais do cadastro de membros
  const nomes = destinatarios.map(d => d.nome).filter(Boolean)
  const { data: membrosData } = await sb.from('membros').select('nome, email').in('nome', nomes)
  const emailAtual = Object.fromEntries((membrosData || []).map(m => [m.nome, m.email]))

  let enviados = 0
  const semEmail = []

  for (const dest of destinatarios) {
    const email = emailAtual[dest.nome] || dest.email
    if (!email) { semEmail.push(dest.nome); continue }
    const html = buildLembreteHtml(dest.nome, lem.titulo, lem.mensagem)
    const ok = await sendResend(token, email, lem.titulo, html)
    if (ok) enviados++
  }

  return res.status(200).json({ enviados, semEmail, total: destinatarios.length })
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

function buildLembreteHtml(nome, titulo, mensagem) {
  const primeiroNome = (nome || '').split(' ')[0] || nome
  const mensagemHtml = (mensagem || '').replace(/\n/g, '<br>')
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
      <div style="background:#f8fafc;border-radius:10px;padding:16px;border-left:4px solid #00bcd4;margin:16px 0">
        <div style="font-size:13px;color:#333;line-height:1.7">${mensagemHtml}</div>
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
