export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { genius_q, artista, nome } = req.query

  // Busca direta por artista + nome (novo endpoint preferido)
  if (artista && nome) {
    const lyrics = await buscarLetra(artista, nome)
    if (lyrics) return res.status(200).json({ lyrics })
    // Fallback: tenta sem artista
    const lyrics2 = await buscarLetra('', nome)
    if (lyrics2) return res.status(200).json({ lyrics: lyrics2 })
    return res.status(200).json({ lyrics: null })
  }

  // Compatibilidade com chamada antiga (genius_q = "artista nome")
  if (genius_q) {
    const partes = genius_q.trim().split(' ')
    const meio = Math.ceil(partes.length / 2)
    const art = partes.slice(0, meio).join(' ')
    const tit = partes.slice(meio).join(' ')
    const lyrics = await buscarLetra(art, tit) || await buscarLetra('', genius_q)
    if (lyrics) return res.status(200).json({ lyrics })

    // Fallback Genius (se token configurado)
    const token = process.env.GENIUS_TOKEN
    if (token) {
      const gl = await buscarGenius(genius_q, token)
      if (gl) return res.status(200).json({ lyrics: gl })
    }
    return res.status(200).json({ lyrics: null })
  }

  return res.status(400).json({ error: 'Missing query' })
}

// lyrics.ovh — gratuito, sem autenticação
async function buscarLetra(artista, nome) {
  try {
    const a = encodeURIComponent((artista || '').trim())
    const n = encodeURIComponent(nome.trim())
    const url = artista
      ? `https://api.lyrics.ovh/v1/${a}/${n}`
      : `https://api.lyrics.ovh/v1/-/${n}`
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!r.ok) return null
    const d = await r.json()
    const letra = d.lyrics?.trim()
    return letra && letra.length > 20 ? letra : null
  } catch { return null }
}

// Genius scraping como último recurso
async function buscarGenius(q, token) {
  try {
    const sr = await fetch(`https://api.genius.com/search?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(6000)
    })
    const sd = await sr.json()
    const hit = sd.response?.hits?.[0]?.result
    if (!hit) return null

    const pr = await fetch(hit.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(8000)
    })
    const html = await pr.text()
    const parts = html.split('data-lyrics-container="true"')
    if (parts.length < 2) return null

    const lyrics = parts.slice(1).map(part => {
      const block = part.substring(part.indexOf('>') + 1)
      return block
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
        .split('\n').map(l => l.trim())
        .filter((l, i, arr) => l || (arr[i-1] && arr[i+1]))
        .join('\n').trim()
    }).filter(Boolean).join('\n\n')

    return lyrics || null
  } catch { return null }
}
