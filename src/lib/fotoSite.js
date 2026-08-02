// Upload de fotos pro bucket público "site" — converte HEIC do iPhone e comprime.
import { sb } from './supabase.js'

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
  const path = `${pasta}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  const { error } = await sb.storage.from('site').upload(path, blob, { upsert: true, cacheControl: '31536000', contentType: 'image/jpeg' })
  if (error) throw new Error(error.message)
  return sb.storage.from('site').getPublicUrl(path).data.publicUrl
}
