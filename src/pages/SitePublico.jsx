import { useEffect, useRef, useState } from 'react'
import { sb } from '../lib/supabase.js'
import { useStore } from '../lib/store.jsx'
import { Globe, Upload, Trash2, Plus, ArrowUp, ArrowDown, Save, ExternalLink } from 'lucide-react'

// Valores padrão — iguais aos que o site usa quando não há nada salvo
const PADRAO = {
  links: {
    whatsPastor: '5521970250597',
    whatsTesouraria: '5521982936289',
    instagram: 'https://instagram.com/promessalagodospeixes',
    pregacoes: 'https://instagram.com/promessalagodospeixes',
    email: 'iaplagodospeixes@gmail.com',
  },
  fotosCapa: [],
  galeria: [],
  familia: [],
  reels: [],
  mensagens: [],
  celulas: [],
}

const REEL_VAZIO = { titulo: '', meta: '', url: '', poster: '' }
const MSG_VAZIA = { titulo: '', meta: '', url: '' }
const CEL_VAZIA = { nome: '', publico: '', horario: '', endereco: '', lider: '', mapa: '' }

export default function SitePublico() {
  const { dispatch } = useStore()
  const [cfg, setCfg] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const upRef = useRef({})

  useEffect(() => {
    sb.from('site_config').select('config').eq('id', 1).single().then(({ data }) => {
      setCfg({ ...PADRAO, ...(data?.config || {}), links: { ...PADRAO.links, ...(data?.config?.links || {}) } })
    })
  }, [])

  if (!cfg) return <div style={{ color: 'var(--g)', fontSize: 13 }}>Carregando…</div>

  const toast = (m) => dispatch({ type: 'TOAST', value: m })

  const salvar = async () => {
    setSalvando(true)
    const { error } = await sb.from('site_config').upsert({ id: 1, config: cfg, updated_at: new Date().toISOString() })
    setSalvando(false)
    if (error) { toast('Erro ao salvar: ' + error.message); return }
    toast('✅ Site atualizado! As mudanças já estão no ar.')
  }

  // Converte HEIC (iPhone) pra JPEG e comprime qualquer foto antes de subir
  const prepararFoto = async (file) => {
    let blob = file
    const nome = (file.name || '').toLowerCase()
    const ehHeic = file.type === 'image/heic' || file.type === 'image/heif' || nome.endsWith('.heic') || nome.endsWith('.heif')
    if (ehHeic) {
      toast('Convertendo foto do iPhone…')
      const { default: heic2any } = await import('heic2any')
      const conv = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
      blob = Array.isArray(conv) ? conv[0] : conv
    }
    // redimensiona pra no máximo 1600px e comprime (site fica leve)
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
    } catch (e) { /* se não conseguir processar, sobe como veio */ }
    return blob
  }

  const upload = async (file, pasta) => {
    if (!file) return null
    let blob
    try {
      blob = await prepararFoto(file)
    } catch (e) {
      toast('Não consegui converter essa foto. Tente exportar como JPEG.')
      return null
    }
    const path = `${pasta}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
    const { error } = await sb.storage.from('site').upload(path, blob, { upsert: true, cacheControl: '31536000', contentType: 'image/jpeg' })
    if (error) { toast('Erro no upload: ' + error.message); return null }
    return sb.storage.from('site').getPublicUrl(path).data.publicUrl
  }

  // helpers de lista
  const setLista = (chave, fn) => setCfg((c) => ({ ...c, [chave]: fn([...(c[chave] || [])]) }))
  const addFoto = (chave, pasta) => async (e) => {
    const arquivos = [...e.target.files]
    e.target.value = ''
    for (const f of arquivos) {
      const url = await upload(f, pasta)
      if (url) setLista(chave, (l) => [...l, url])
    }
  }
  const mover = (chave, i, delta) => setLista(chave, (l) => {
    const j = i + delta
    if (j < 0 || j >= l.length) return l
    const c = [...l]; [c[i], c[j]] = [c[j], c[i]]; return c
  })
  const remover = (chave, i) => setLista(chave, (l) => l.filter((_, k) => k !== i))
  const editarItem = (chave, i, campo, valor) => setLista(chave, (l) => {
    const c = [...l]; c[i] = { ...c[i], [campo]: valor }; return c
  })

  const FotosGrid = ({ chave, pasta, dica }) => (
    <div>
      <div style={st.fotosGrid}>
        {(cfg[chave] || []).map((url, i) => (
          <div key={i} style={st.fotoCard}>
            <img src={url} alt="" style={st.fotoImg} />
            <div style={st.fotoAcoes}>
              <button style={st.miniBtn} onClick={() => mover(chave, i, -1)} title="Mover para trás"><ArrowUp size={13} /></button>
              <button style={st.miniBtn} onClick={() => mover(chave, i, 1)} title="Mover para frente"><ArrowDown size={13} /></button>
              <button style={{ ...st.miniBtn, color: 'var(--red)' }} onClick={() => remover(chave, i)} title="Remover"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        <label style={st.fotoAdd}>
          <Upload size={18} strokeWidth={1.75} />
          <span style={{ fontSize: 11.5, fontWeight: 600 }}>Adicionar foto</span>
          <input type="file" accept="image/*,.heic,.heif" multiple style={{ display: 'none' }} onChange={addFoto(chave, pasta)} />
        </label>
      </div>
      {dica && <div style={st.dica}>{dica}</div>}
    </div>
  )

  const campo = (label, valor, onChange, placeholder = '') => (
    <label style={st.campo}>
      <span style={st.campoLabel}>{label}</span>
      <input style={st.input} value={valor || ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )

  return (
    <div style={{ maxWidth: 980, display: 'grid', gap: 18 }}>
      <div style={st.topo}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Globe size={20} strokeWidth={1.75} style={{ color: 'var(--cy)' }} />
          <div>
            <div style={{ fontWeight: 800, color: 'var(--w)', fontSize: 15 }}>Editor do Site Público</div>
            <div style={{ fontSize: 12, color: 'var(--g)' }}>O que você salvar aqui aparece em promessalagodospeixes.com.br</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="https://promessalagodospeixes.com.br" target="_blank" rel="noopener noreferrer" style={st.btnGhost}>
            <ExternalLink size={14} /> Ver o site
          </a>
          <button onClick={salvar} disabled={salvando} style={st.btnSalvar}>
            <Save size={15} /> {salvando ? 'Salvando…' : 'Salvar e publicar'}
          </button>
        </div>
      </div>

      {/* Links */}
      <div style={st.card}>
        <div style={st.cardTitulo}>🔗 Links e contatos</div>
        <div style={st.grid2}>
          {campo('WhatsApp do pastor (só números, com 55)', cfg.links.whatsPastor, (v) => setCfg((c) => ({ ...c, links: { ...c.links, whatsPastor: v.replace(/\D/g, '') } })), '5521970250597')}
          {campo('WhatsApp da tesouraria (só números, com 55)', cfg.links.whatsTesouraria, (v) => setCfg((c) => ({ ...c, links: { ...c.links, whatsTesouraria: v.replace(/\D/g, '') } })), '5521982936289')}
          {campo('Instagram (link completo)', cfg.links.instagram, (v) => setCfg((c) => ({ ...c, links: { ...c.links, instagram: v } })))}
          {campo('Link "Ver todas as pregações"', cfg.links.pregacoes, (v) => setCfg((c) => ({ ...c, links: { ...c.links, pregacoes: v } })), 'Instagram ou canal do YouTube')}
          {campo('E-mail da igreja', cfg.links.email, (v) => setCfg((c) => ({ ...c, links: { ...c.links, email: v } })))}
        </div>
      </div>

      {/* Fotos de capa */}
      <div style={st.card}>
        <div style={st.cardTitulo}>🖼️ Fotos de capa (carrossel do topo)</div>
        <FotosGrid chave="fotosCapa" pasta="capa" dica="Fotos deitadas (paisagem) funcionam melhor. Se a lista ficar vazia, o site usa as 2 fotos originais." />
      </div>

      {/* Galeria */}
      <div style={st.card}>
        <div style={st.cardTitulo}>📷 Galeria "Nossa gente"</div>
        <FotosGrid chave="galeria" pasta="galeria" dica="A 1ª e a última aparecem grandes (deitadas); as do meio aparecem quadradas. Se vazia, o site usa as fotos atuais." />
      </div>

      {/* Família pastoral */}
      <div style={st.card}>
        <div style={st.cardTitulo}>👨‍👩‍👧‍👦 Fotos da família pastoral (carrossel da seção Liderança)</div>
        <FotosGrid chave="familia" pasta="familia" dica="Ideal: 4 fotos deitadas. Se vazia, o site usa fotos genéricas da igreja." />
      </div>

      {/* Reels */}
      <div style={st.card}>
        <div style={st.cardTitulo}>🎬 Reels (seção Vídeos)</div>
        {(cfg.reels || []).map((r, i) => (
          <div key={i} style={st.item}>
            <div style={st.itemFoto}>
              {r.poster ? <img src={r.poster} alt="" style={st.fotoImg} /> : <span style={{ fontSize: 10, color: 'var(--g)' }}>capa</span>}
              <label style={st.itemUpload}>
                <Upload size={12} />
                <input type="file" accept="image/*,.heic,.heif" style={{ display: 'none' }} onChange={async (e) => {
                  const url = await upload(e.target.files[0], 'reels'); e.target.value = ''
                  if (url) editarItem('reels', i, 'poster', url)
                }} />
              </label>
            </div>
            <div style={{ flex: 1, display: 'grid', gap: 8 }}>
              <div style={st.grid2}>
                {campo('Título', r.titulo, (v) => editarItem('reels', i, 'titulo', v), 'Louvor ao vivo')}
                {campo('Legenda', r.meta, (v) => editarItem('reels', i, 'meta', v), 'Reel · equipe de louvor')}
              </div>
              {campo('Link do reel', r.url, (v) => editarItem('reels', i, 'url', v), 'https://www.instagram.com/reel/…')}
            </div>
            <div style={st.itemAcoes}>
              <button style={st.miniBtn} onClick={() => mover('reels', i, -1)}><ArrowUp size={13} /></button>
              <button style={st.miniBtn} onClick={() => mover('reels', i, 1)}><ArrowDown size={13} /></button>
              <button style={{ ...st.miniBtn, color: 'var(--red)' }} onClick={() => remover('reels', i)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        <button style={st.btnAdd} onClick={() => setLista('reels', (l) => [...l, { ...REEL_VAZIO }])}><Plus size={14} /> Adicionar reel</button>
        <div style={st.dica}>Se a lista ficar vazia, o site mostra os 6 reels de exemplo.</div>
      </div>

      {/* Mensagens */}
      <div style={st.card}>
        <div style={st.cardTitulo}>🎙️ Pregações (seção Mensagens)</div>
        {(cfg.mensagens || []).map((m, i) => (
          <div key={i} style={st.item}>
            <div style={{ flex: 1, display: 'grid', gap: 8 }}>
              <div style={st.grid2}>
                {campo('Título da mensagem', m.titulo, (v) => editarItem('mensagens', i, 'titulo', v), 'Onde começa uma igreja?')}
                {campo('Pregador / referência', m.meta, (v) => editarItem('mensagens', i, 'meta', v), 'Pr. Gabriel Pereira · Atos 2')}
              </div>
              {campo('Link (Instagram, YouTube, Drive…)', m.url, (v) => editarItem('mensagens', i, 'url', v))}
            </div>
            <div style={st.itemAcoes}>
              <button style={st.miniBtn} onClick={() => mover('mensagens', i, -1)}><ArrowUp size={13} /></button>
              <button style={st.miniBtn} onClick={() => mover('mensagens', i, 1)}><ArrowDown size={13} /></button>
              <button style={{ ...st.miniBtn, color: 'var(--red)' }} onClick={() => remover('mensagens', i)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        <button style={st.btnAdd} onClick={() => setLista('mensagens', (l) => [...l, { ...MSG_VAZIA }])}><Plus size={14} /> Adicionar pregação</button>
      </div>

      {/* Células */}
      <div style={st.card}>
        <div style={st.cardTitulo}>🏠 Células nos lares</div>
        {(cfg.celulas || []).map((c, i) => (
          <div key={i} style={st.item}>
            <div style={{ flex: 1, display: 'grid', gap: 8 }}>
              <div style={st.grid2}>
                {campo('Nome da célula', c.nome, (v) => editarItem('celulas', i, 'nome', v), 'Célula Vida Nova')}
                {campo('Público', c.publico, (v) => editarItem('celulas', i, 'publico', v), 'Famílias / Jovens / Adultos')}
              </div>
              <div style={st.grid2}>
                {campo('Dia e horário', c.horario, (v) => editarItem('celulas', i, 'horario', v), 'Quinta, 19h30')}
                {campo('Anfitrião', c.lider, (v) => editarItem('celulas', i, 'lider', v), 'Família Botelho')}
              </div>
              {campo('Endereço', c.endereco, (v) => editarItem('celulas', i, 'endereco', v), 'Rua, número — bairro')}
              {campo('Link do Google Maps (opcional)', c.mapa, (v) => editarItem('celulas', i, 'mapa', v))}
            </div>
            <div style={st.itemAcoes}>
              <button style={st.miniBtn} onClick={() => mover('celulas', i, -1)}><ArrowUp size={13} /></button>
              <button style={st.miniBtn} onClick={() => mover('celulas', i, 1)}><ArrowDown size={13} /></button>
              <button style={{ ...st.miniBtn, color: 'var(--red)' }} onClick={() => remover('celulas', i)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        <button style={st.btnAdd} onClick={() => setLista('celulas', (l) => [...l, { ...CEL_VAZIA }])}><Plus size={14} /> Adicionar célula</button>
        <div style={st.dica}>Se a lista ficar vazia, o site mostra as 3 células de exemplo.</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 30 }}>
        <button onClick={salvar} disabled={salvando} style={st.btnSalvar}>
          <Save size={15} /> {salvando ? 'Salvando…' : 'Salvar e publicar'}
        </button>
      </div>
    </div>
  )
}

const st = {
  topo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' },
  card: { background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 14, padding: 18 },
  cardTitulo: { fontWeight: 800, color: 'var(--w)', fontSize: 14, marginBottom: 14 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: 10 },
  campo: { display: 'grid', gap: 5 },
  campoLabel: { fontSize: 11, fontWeight: 700, color: 'var(--g)', textTransform: 'uppercase', letterSpacing: '.05em' },
  input: { background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 9, padding: '9px 11px', color: 'var(--w)', fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%' },
  fotosGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10 },
  fotoCard: { position: 'relative', aspectRatio: '4/3', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--bd)', background: 'var(--bg)' },
  fotoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  fotoAcoes: { position: 'absolute', right: 4, top: 4, display: 'flex', gap: 4 },
  fotoAdd: { aspectRatio: '4/3', borderRadius: 10, border: '1.5px dashed var(--bd)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--g)', cursor: 'pointer' },
  miniBtn: { width: 26, height: 26, borderRadius: 7, border: '1px solid var(--bd)', background: 'rgba(10,14,18,.85)', color: 'var(--gl)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  item: { display: 'flex', gap: 12, alignItems: 'flex-start', border: '1px solid var(--bd)', borderRadius: 12, padding: 12, marginBottom: 10 },
  itemFoto: { position: 'relative', width: 84, aspectRatio: '9/16', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--bd)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  itemUpload: { position: 'absolute', right: 3, bottom: 3, width: 24, height: 24, borderRadius: 6, background: 'rgba(10,14,18,.85)', border: '1px solid var(--bd)', color: 'var(--gl)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  itemAcoes: { display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 },
  btnAdd: { display: 'flex', alignItems: 'center', gap: 7, background: 'transparent', border: '1.5px dashed var(--bd)', borderRadius: 10, padding: '9px 14px', color: 'var(--gl)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit' },
  btnSalvar: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--cy)', color: '#04211f', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  btnGhost: { display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--bd)', borderRadius: 10, padding: '10px 14px', color: 'var(--gl)', fontSize: 12.5, fontWeight: 600 },
  dica: { fontSize: 11.5, color: 'var(--g)', marginTop: 10 },
}
