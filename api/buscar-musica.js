export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { artista = '', nome = '', busca, genius_q } = req.query

  // Modo autocomplete não usado mais (voltou para iTunes no frontend)
  if (busca) return res.status(200).json({ sugestoes: [] })

  const q = nome || genius_q || ''
  if (!q) return res.status(400).json({ error: 'Missing query' })

  // Busca letra, YouTube e cifra em paralelo
  const [lyrics, yt, cf] = await Promise.all([
    buscarLetraCompleto(artista, q),
    buscarYouTube(`${artista} ${q}`.trim()),
    buscarCifraClub(artista, q),
  ])

  return res.status(200).json({ lyrics: lyrics || null, yt: yt || null, cf: cf || null })
}

// Sugestões do Vagalume — só aparecem músicas que TÊM letra
async function buscarSugestoes(q) {
  try {
    const enc = encodeURIComponent(q)
    // Busca na página de resultados do Vagalume
    const r = await fetch(`https://www.vagalume.com.br/search/index.php?q=${enc}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(6000)
    })
    const html = await r.text()
    // Extrai links de música: /artista/musica.html
    const matches = [...html.matchAll(/href="(\/[a-z0-9-]+\/[a-z0-9-]+\.html)"/g)]
    const vistos = new Set()
    const resultados = []
    for (const m of matches) {
      const path = m[1]
      if (vistos.has(path)) continue
      vistos.add(path)
      // Extrai artista e música do path: /aline-barros/autor-da-vida.html
      const partes = path.replace('.html','').split('/').filter(Boolean)
      if (partes.length < 2) continue
      const artistaSlug = partes[0]
      const musicaSlug = partes[1]
      const toLabel = (s) => s.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
      resultados.push({ nome: toLabel(musicaSlug), artista: toLabel(artistaSlug), url: `https://www.vagalume.com.br${path}` })
      if (resultados.length >= 8) break
    }
    return resultados
  } catch { return [] }
}

// Decodifica entidades HTML: &amp; &#39; &#x27; &quot; &nbsp; etc.
function decodeHtml(str) {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

// Remove sufixos que atrapalham a busca: (Ao Vivo), [Acústico], feat. X, etc.
function limparNome(nome) {
  return nome
    .replace(/\s*[\(\[][^\)\]]*[\)\]]/g, '') // remove parênteses/colchetes e conteúdo
    .replace(/\s*-\s*(ao vivo|acustico|acústico|playback|instrumental|remix|cover|live|versão.*)/gi, '')
    .replace(/\s*feat\.?.*/gi, '')
    .trim()
}

async function buscarLetraCompleto(artista, nome) {
  const nomeLimpo = limparNome(nome)
  // Se artista tem múltiplos (& ou ,), tenta cada um
  const artistas = artista
    ? [...new Set([artista, ...artista.split(/[&,]/).map(a => a.trim()).filter(a => a.length > 2)])]
    : ['']

  for (const art of artistas) {
    const [vag, ovh] = await Promise.all([
      buscarVagalume(art, nomeLimpo),
      buscarLetra(art, nomeLimpo),
    ])
    if (vag) return vag
    if (ovh) return ovh
    const letras = await buscarLetras(art, nomeLimpo)
    if (letras) return letras
  }
  // Tenta só com o nome (sem artista)
  const soNome = await buscarVagalume('', nomeLimpo) || await buscarLetra('', nomeLimpo)
  if (soNome) return soNome
  if (process.env.GENIUS_TOKEN) return await buscarGenius(`${artistas[0]} ${nomeLimpo}`.trim(), process.env.GENIUS_TOKEN)
  return null
}

// Vagalume — tenta API primeiro, depois raspa a página
async function buscarVagalume(artista, nome) {
  try {
    const q = encodeURIComponent(`${artista} ${nome}`.trim())
    const r = await fetch(`https://api.vagalume.com.br/search.php?apikey=guest&q=${q}`, {
      signal: AbortSignal.timeout(6000)
    })
    const d = await r.json()
    // Tenta letra direta da API
    const letra = d?.mus?.[0]?.text || d?.mus?.[0]?.lyrics
    if (letra && letra.length > 20) return letra.trim()
    // Fallback: raspa a página do Vagalume
    const songUrl = d?.mus?.[0]?.url
    if (songUrl) return await rasparVagalume(songUrl)
    // Tenta construir URL diretamente com slug
    // Apostrofos e aspas são REMOVIDOS (não viram hífen): Minh'alma → minhalma
    const slug = (s) => s.toLowerCase()
      .replace(/[''`]/g, '')           // remove apóstrofos antes de tudo
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
      .replace(/[^a-z0-9]+/g, '-')    // não-alfanumérico → hífen
      .replace(/^-|-$/g, '')           // remove hífens das extremidades
    const urlDireta = `https://www.vagalume.com.br/${slug(artista)}/${slug(nome)}.html`
    return await rasparVagalume(urlDireta)
  } catch { return null }
}

async function rasparVagalume(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(7000)
    })
    if (!r.ok) return null
    const html = await r.text()
    const jsonMatch = html.match(/"lyrics"\s*:\s*"((?:[^"\\]|\\.)*)"/i) ||
                      html.match(/,l\s*:\s*"((?:[^"\\]|\\.)*)"/i) ||
                      html.match(/track_text['"]\s*:\s*['"]([^'"]{20,})['"]/i)
    if (jsonMatch) {
      const raw = decodeHtml(jsonMatch[1].replace(/\\n/g,'\n').replace(/\\r/g,'').replace(/\\'/g,"'").replace(/\\"/g,'"').replace(/\\\\/g,'\\'))
      if (raw.length > 20) return raw.trim()
    }
    const m = html.match(/<div[^>]+id=["']?lyrics["']?[^>]*>([\s\S]*?)<\/div>/i)
    if (m) {
      const t = decodeHtml(m[1].replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'')).trim()
      if (t.length > 20) return t
    }
    return null
  } catch { return null }
}

// letras.mus.br — tenta URL direta primeiro, depois busca
async function buscarLetras(artista, nome) {
  const slug = (s) => s.toLowerCase().replace(/[''`]/g,'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
  // Tenta URL direta
  const urlDireta = `https://www.letras.mus.br/${slug(artista)}/${slug(nome)}/`
  const direta = await rasparLetras(urlDireta)
  if (direta) return direta
  // Busca nos resultados
  try {
    const q = encodeURIComponent(`${artista} ${nome}`.trim())
    const sr = await fetch(`https://www.letras.mus.br/pesquisar/?q=${q}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(6000)
    })
    const html = await sr.text()
    const urlMatch = html.match(/href="(\/[a-z0-9-]+\/[a-z0-9-]+\/)"/)
    if (!urlMatch) return null
    return await rasparLetras(`https://www.letras.mus.br${urlMatch[1]}`)
  } catch { return null }
}

async function rasparLetras(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(6000)
    })
    if (!r.ok) return null
    const html = await r.text()
    const m = html.match(/<div[^>]+class="[^"]*lyric-original[^"]*"[^>]*>([\s\S]*?)<\/div>/) ||
              html.match(/<div[^>]+class="[^"]*cnt-lrc[^"]*"[^>]*>([\s\S]*?)<\/div>/)
    if (!m) return null
    const t = decodeHtml(m[1].replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'')).trim()
    return t.length > 20 ? t : null
  } catch { return null }
}

// Busca link da cifra no Cifra Club — tenta URL direta primeiro
async function buscarCifraClub(artista, nome) {
  const slug = (s) => s.toLowerCase().replace(/[''`]/g,'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
  const nomeLimpo = limparNome(nome)
  const artPrincipal = artista.split(/[&,]/)[0].trim()

  // Tenta URL direta
  const urlDireta = `https://www.cifraclub.com.br/${slug(artPrincipal)}/${slug(nomeLimpo)}/`
  try {
    const r = await fetch(urlDireta, { method:'HEAD', signal: AbortSignal.timeout(5000) })
    if (r.ok) return urlDireta
  } catch {}

  // Busca simples
  try {
    const q = encodeURIComponent(`${artPrincipal} ${nomeLimpo}`)
    const r = await fetch(`https://www.cifraclub.com.br/busca/?q=${q}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(7000)
    })
    const html = await r.text()
    // Categorias a ignorar
    const skip = /^\/(estilos|busca|top|cifras|videos|artistas|albuns|tabs|pro|playlist|usuario)\//
    for (const m of html.matchAll(/href="(\/[a-z0-9][a-z0-9-]+\/[a-z0-9][a-z0-9-]+\/)"/g)) {
      if (!skip.test(m[1])) return `https://www.cifraclub.com.br${m[1]}`
    }
    return null
  } catch { return null }
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
