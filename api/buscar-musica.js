export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { artista = '', nome = '', genius_q } = req.query
  const q = nome || genius_q || ''
  if (!q) return res.status(400).json({ error: 'Missing query' })

  // Busca letra e YouTube em paralelo
  const [lyrics, yt] = await Promise.all([
    buscarLetraCompleto(artista, q),
    buscarYouTube(`${artista} ${q}`.trim()),
  ])

  return res.status(200).json({ lyrics: lyrics || null, yt: yt || null })
}

async function buscarLetraCompleto(artista, nome) {
  return (
    await buscarLetra(artista, nome) ||
    await buscarLetra('', nome) ||
    (process.env.GENIUS_TOKEN ? await buscarGenius(`${artista} ${nome}`.trim(), process.env.GENIUS_TOKEN) : null)
  )
}

// Busca primeiro resultado do YouTube sem API key
async function buscarYouTube(q) {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q + ' letra')}`
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(7000)
    })
    const html = await r.text()
    // Extrai o primeiro videoId do JSON embutido na página
    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/)
    if (match) return `https://www.youtube.com/watch?v=${match[1]}`
    return null
  } catch { return null }
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
