// Registra no banco cada disparo de e-mail, pra o sistema mostrar "já enviado".
const SUPABASE_URL = 'https://mynektdohwpzfbmgfunp.supabase.co'
// Chave de servidor: a publica nao le mais nada desde que o banco foi fechado (RLS).
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

export async function registrarEnvio(dados) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/envios_email`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        tipo: dados.tipo || 'outro',
        escopo: dados.escopo || null,
        ref: dados.ref || null,
        detalhe: dados.detalhe || null,
        enviados: dados.enviados || 0,
        sem_email: dados.semEmail || 0,
        erros: dados.erros || 0,
        pessoas: dados.pessoas || null,
        origem: dados.origem || 'manual',
        usuario: dados.usuario || null,
      }),
    })
  } catch (e) {
    // registro é secundário: nunca pode derrubar o envio de e-mail
    console.error('registrarEnvio falhou:', e.message)
  }
}
