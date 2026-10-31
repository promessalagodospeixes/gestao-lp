import { sessaoDaRequisicao } from './_auth.js'
import { createClient } from '@supabase/supabase-js'
import { avisarLideresEventos } from './_lideres-eventos.js'

// Disparo manual do lembrete de eventos para os líderes de ministério.
// Uso: /api/lembrete-lideres          → envia de verdade
//      /api/lembrete-lideres?dry=1    → só mostra quem receberia (não envia)
//      /api/lembrete-lideres?dias=30  → muda a janela (padrão 15)
const SUPABASE_URL = 'https://mynektdohwpzfbmgfunp.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

export default async function handler(req, res) {
  // Cron da Vercel (com segredo) OU um admin logado.
  const segredoCron = process.env.CRON_SECRET
  const auth = req.headers['authorization'] || ''
  const ehCronDaVercel = segredoCron
    ? auth === `Bearer ${segredoCron}`
    : ((req.headers['x-vercel-cron'] || '') !== '' || /vercel-cron/i.test(req.headers['user-agent'] || ''))
  const sessao = sessaoDaRequisicao(req)
  const ehAdmin = ['pastor','secretario'].includes(sessao?.perfil)
  if (!ehCronDaVercel && !ehAdmin) return res.status(401).json({ erro: 'Sem permissão.' })

  const dry = req.query?.dry === '1'
  const dias = req.query?.dias ? Math.max(1, Math.min(90, parseInt(req.query.dias))) : 15
  const token = process.env.RESEND_API_KEY
  if (!token && !dry) return res.status(500).json({ error: 'RESEND_API_KEY não configurado' })

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY)
  try {
    const out = await avisarLideresEventos({ sb, token, dias, dry })
    return res.status(200).json(out)
  } catch (e) {
    return res.status(500).json({ erro: e.message })
  }
}
