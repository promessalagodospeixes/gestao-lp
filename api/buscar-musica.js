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
      // Divide pelo atributo e pega cada bloco
      const parts = html.split('data-lyrics-container="true"')
      if (parts.length < 2) return res.status(200).json({ lyrics: null })

      const lyrics = parts.slice(1).map(part => {
        // Pega conteúdo após o fechamento da tag de abertura
        const start = part.indexOf('>') + 1
        const block = part.substring(start)
        return block
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#x27;/g, "'")
          .replace(/&apos;/g, "'")
          .split('\n')
          .map(l => l.trim())
          .filter((l, i, arr) => l || (arr[i-1] && arr[i+1]))
          .join('\n')
          .trim()
      }).filter(Boolean).join('\n\n')

      return res.status(200).json({ lyrics: lyrics || null, url: hit.url })
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
