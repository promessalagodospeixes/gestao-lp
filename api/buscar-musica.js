export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { genius_q } = req.query

  // Busca letra via Genius API
  if (genius_q) {
    const token = process.env.GENIUS_TOKEN
    if (!token) return res.status(500).json({ error: 'GENIUS_TOKEN not configured' })
    try {
      // 1. Busca a música no Genius
      const searchRes = await fetch(`https://api.genius.com/search?q=${encodeURIComponent(genius_q)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const searchData = await searchRes.json()
      const hit = searchData.response?.hits?.[0]?.result
      if (!hit) return res.status(200).json({ lyrics: null })

      // 2. Busca a página da letra
      const pageRes = await fetch(hit.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
      const html = await pageRes.text()

      // 3. Extrai o conteúdo dos containers de letra
      const matches = [...html.matchAll(/data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/g)]
      const lyrics = matches
        .map(m => m[1]
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .trim()
        )
        .filter(Boolean)
        .join('\n\n')

      return res.status(200).json({ lyrics: lyrics || null })
    } catch (error) {
      return res.status(500).json({ error: error.message })
    }
  }

  return res.status(400).json({ error: 'Missing query' })
}

// Note: Run this SQL in Supabase if disponibilidades column doesn't exist:
// ALTER TABLE funcoes ADD COLUMN IF NOT EXISTS disponibilidades JSONB DEFAULT '{}';

// SQL para criar a tabela de ocorrências (rodar no SQL Editor do Supabase, se ainda não existir):
// CREATE TABLE IF NOT EXISTS ocorrencias (
//   id BIGSERIAL PRIMARY KEY,
//   ano INTEGER, mes INTEGER, slot TEXT,
//   funcao TEXT, nome_original TEXT, substituto TEXT, motivo TEXT,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
