// Busca a imagem de capa (og:image) de um post/reel público do Instagram
// e devolve a própria imagem — o editor do site salva uma cópia no Storage.

export default async function handler(req, res) {
  const url = req.query?.url
  let u
  try { u = new URL(url) } catch { return res.status(400).json({ error: 'url inválida' }) }
  if (!/(^|\.)instagram\.com$/.test(u.hostname)) {
    return res.status(400).json({ error: 'só links do instagram.com' })
  }

  try {
    const pagina = await fetch(u.toString(), {
      headers: { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' },
      redirect: 'follow',
    })
    const html = await pagina.text()
    const m = html.match(/property="og:image"\s+content="([^"]+)"/) || html.match(/content="([^"]+)"\s+property="og:image"/)
    if (!m) return res.status(404).json({ error: 'capa não encontrada — o post é público?' })

    const imgUrl = m[1].replace(/&amp;/g, '&')
    const img = await fetch(imgUrl)
    if (!img.ok) return res.status(502).json({ error: 'falha ao baixar a imagem' })
    const buf = Buffer.from(await img.arrayBuffer())
    res.setHeader('Content-Type', img.headers.get('content-type') || 'image/jpeg')
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).send(buf)
  } catch (e) {
    console.error('insta-capa', e)
    return res.status(500).json({ error: 'erro ao buscar a capa' })
  }
}
