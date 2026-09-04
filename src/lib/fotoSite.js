// Upload de fotos do site — converte HEIC do iPhone, comprime e envia pelo servidor.
// O navegador não fala direto com o Storage: senão qualquer um trocaria as fotos da igreja.
import { getToken } from './supabase.js'

const paraBase64 = (blob) => new Promise((res, rej) => {
  const fr = new FileReader()
  fr.onload = () => res(String(fr.result).split(',')[1] || '')
  fr.onerror = rej
  fr.readAsDataURL(blob)
})

async function prepararFoto(file) {
  let blob = file
  const nome = (file.name || '').toLowerCase()
  const ehHeic = file.type === 'image/heic' || file.type === 'image/heif' || nome.endsWith('.heic') || nome.endsWith('.heif')
  if (ehHeic) {
    try {
      const { heicTo } = await import('heic-to')
      blob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 })
    } catch (e1) {
      const { default: heic2any } = await import('heic2any')
      const conv = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
      blob = Array.isArray(conv) ? conv[0] : conv
    }
  }
  try {
    const bmp = await createImageBitmap(blob)
    const MAX = 1600
    const escala = Math.min(1, MAX / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * escala), h = Math.round(bmp.height * escala)
    const cv = document.createElement('canvas')
    cv.width = w; cv.height = h
    cv.getContext('2d').drawImage(bmp, 0, 0, w, h)
    const jpg = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.85))
    if (jpg) return jpg
  } catch (e) { /* sobe como veio */ }
  return blob
}

export async function uploadFotoSite(file, pasta) {
  if (!file) return null
  const blob = await prepararFoto(file)
  const base64 = await paraBase64(blob)
  const r = await fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ acao: 'foto', pasta, base64 }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || !d.url) throw new Error(d.erro || 'Não foi possível enviar a foto.')
  return d.url
}
