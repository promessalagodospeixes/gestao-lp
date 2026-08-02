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
    facebook: 'https://facebook.com/promessalagodospeixes',
    pregacoes: 'https://instagram.com/promessalagodospeixes',
    email: 'iaplagodospeixes@gmail.com',
  },
  textos: {},
  horarios: [],
  ministerios: [],
  fotosCapa: [],
  galeria: [],
  familia: [],
  reels: [],
  mensagens: [],
  celulas: [],
}

// Textos editáveis do site — chave, rótulo, texto padrão e se é caixa grande
const TEXTOS_CAMPOS = [
  { k: 'badge', label: 'Selo da capa', padrao: 'Austin · Nova Iguaçu / RJ · desde 1988' },
  { k: 'heroTitulo', label: 'Título da capa (parte normal)', padrao: 'Aqui você não é visita. É' },
  { k: 'heroDestaque', label: 'Palavra em destaque (itálico)', padrao: 'esperado' },
  { k: 'heroSub', label: 'Subtítulo da capa', padrao: 'Somos a Promessa Lago dos Peixes: uma igreja viva, jovem e de portas abertas, que existe para cuidar, amar e priorizar pessoas.', grande: true },
  { k: 'novoTitulo', label: 'Título "Primeira visita"', padrao: 'Venha como está. Nós iremos caminhar com você.' },
  { k: 'novoTexto', label: 'Texto "Primeira visita"', padrao: 'Ninguém precisa se encaixar num molde para entrar aqui. Se for sua primeira vez, avise a gente no WhatsApp: alguém vai te receber na porta, te apresentar a igreja e sentar com você.', grande: true },
  { k: 'sobreTitulo', label: 'Título "Quem Somos"', padrao: 'Uma igreja que nasceu de um chamado dentro de um trem.' },
  { k: 'videosTitulo', label: 'Título da seção de vídeos', padrao: 'Conheça um pouco da nossa igreja antes mesmo de vir.' },
  { k: 'mensagensTitulo', label: 'Título da seção de pregações', padrao: 'Pregações para ouvir durante a semana' },
  { k: 'mensagensTexto', label: 'Texto da seção de pregações', padrao: 'Publicamos os trechos e as mensagens completas nas redes. Toque em qualquer uma para assistir.', grande: true },
  { k: 'fotosTitulo', label: 'Título da página Fotos', padrao: '38 anos de vidas, batismos e comunhão' },
  { k: 'fotosTexto', label: 'Texto da página Fotos', padrao: 'Cada foto aqui é de um sábado, de uma célula, de um café com a vizinhança. Igreja é gente.', grande: true },
  { k: 'contribuaTexto', label: 'Texto da página Contribua', padrao: 'Dízimos e ofertas são atos voluntários de amor e adoração. Cada recurso é investido com responsabilidade…', grande: true },
  { k: 'pixExibicao', label: 'PIX — como aparece no site', padrao: '30.228.769/0001-22' },
  { k: 'pixCopia', label: 'PIX — chave que o botão copia (só números)', padrao: '30228769000122' },
  { k: 'endereco', label: 'Endereço', padrao: 'Estrada Austin-Queimados, 250' },
  { k: 'cidade', label: 'Cidade / CEP', padrao: 'Austin, Nova Iguaçu / RJ — CEP 26086-295' },
  { k: 'referencia', label: 'Referência do endereço', padrao: 'Referência: Mercado do Beto na esquina, ao lado da Águas do Rio.', grande: true },
]

const PASTOR_CAMPOS = [
  { k: 'pastorNome', label: 'Nome do pastor', padrao: 'Pr. Gabriel Azeredo Pereira' },
  { k: 'pastorEsposa', label: 'Esposa', padrao: 'Pâmela Pereira' },
  { k: 'pastorFilhos', label: 'Filhos', padrao: 'Gabriel Filho, Nicolas e Zoe' },
  { k: 'pastorBio1', label: 'Apresentação (1º parágrafo)', padrao: 'Pastor da Promessa Lago dos Peixes. Conduz a igreja no ensino da Palavra e no louvor…', grande: true },
  { k: 'pastorBio2', label: 'Apresentação (2º parágrafo)', padrao: 'A família pastoral vive a igreja junto com a igreja: no culto, na célula, na visita e no café da esquina.', grande: true },
]

const HOR_VAZIO = { dia: '', hora: '', desc: '' }
const MIN_VAZIO = { nome: '', lider: '', desc: '' }

// Textos padrão COMPLETOS — pré-preenchem os campos pra editar só uma palavra
const TEXTOS_PADRAO = {
  badge: 'Austin · Nova Iguaçu / RJ · desde 1988',
  heroTitulo: 'Aqui você não é visita. É',
  heroDestaque: 'esperado',
  heroSub: 'Somos a Promessa Lago dos Peixes: uma igreja viva, jovem e de portas abertas, que existe para cuidar, amar e priorizar pessoas.',
  novoTitulo: 'Venha como está. Nós iremos caminhar com você.',
  novoTexto: 'Ninguém precisa se encaixar num molde para entrar aqui. Se for sua primeira vez, avise a gente no WhatsApp: alguém vai te receber na porta, te apresentar a igreja e sentar com você.',
  sobreTitulo: 'Uma igreja que nasceu de um chamado dentro de um trem.',
  videosTitulo: 'Conheça um pouco da nossa igreja antes mesmo de vir.',
  mensagensTitulo: 'Pregações para ouvir durante a semana',
  mensagensTexto: 'Publicamos os trechos e as mensagens completas nas redes. Toque em qualquer uma para assistir.',
  fotosTitulo: '38 anos de vidas, batismos e comunhão',
  fotosTexto: 'Cada foto aqui é de um sábado, de uma célula, de um café com a vizinhança. Igreja é gente.',
  pastorNome: 'Pr. Gabriel Azeredo Pereira',
  pastorEsposa: 'Pâmela Pereira',
  pastorFilhos: 'Gabriel Filho, Nicolas e Zoe',
  pastorBio1: 'Pastor da Promessa Lago dos Peixes. Conduz a igreja no ensino da Palavra e no louvor, e caminha de perto com cada família — do primeiro café ao batismo. A porta da casa pastoral está aberta para conversar, orar e ouvir.',
  pastorBio2: 'A família pastoral vive a igreja junto com a igreja: no culto, na célula, na visita e no café da esquina.',
  contribuaTexto: 'Dízimos e ofertas são atos voluntários de amor e adoração. Cada recurso é investido com responsabilidade: no cuidado do templo, nas missões local e externa, no auxílio às necessidades dos irmãos, no apoio à família pastoral e no cuidado de outras igrejas.',
  pixExibicao: '30.228.769/0001-22',
  pixCopia: '30228769000122',
  endereco: 'Estrada Austin-Queimados, 250',
  cidade: 'Austin, Nova Iguaçu / RJ — CEP 26086-295',
  referencia: 'Referência: Mercado do Beto na esquina, ao lado da Águas do Rio.',
}

const SITE = 'https://promessalagodospeixes.com.br'
const LISTAS_PADRAO = {
  horarios: [
    { dia: 'Sábado', hora: '9h', desc: 'Escola Bíblica' },
    { dia: 'Sábado', hora: '10h30', desc: 'Culto da Família' },
    { dia: 'Domingo', hora: '18h', desc: 'Culto de Celebração' },
    { dia: 'Terça', hora: '19h30', desc: 'Reunião de oração' },
  ],
  ministerios: [
    { nome: 'Louvor', lider: 'Eclair Campos e Vitória Vicente', desc: 'Adoração que conduz a igreja à presença de Deus, com equipe vocal e instrumental. Liderança do Pr. Gabriel Pereira, com Eclair Campos (instrumental) e Vitória Vicente (vocal).' },
    { nome: 'Escola Bíblica', lider: 'Rosilene e equipe de professores', desc: 'Todo sábado às 9h, com classes por faixa etária — da Nave (crianças) à classe de adultos. Palavra ensinada com profundidade e amor.' },
    { nome: 'Crianças e Família', lider: 'Equipe da Nave', desc: 'As crianças aprendem desde cedo a alegria de congregar. Na Escola Bíblica têm classes próprias; no culto, adoramos todos juntos, em família.' },
    { nome: 'Jovens e Adolescentes', lider: 'Liderança de jovens', desc: 'Classes bíblicas próprias, células durante a semana e um encontro mensal para viver a fé com a galera.' },
    { nome: 'Mulheres e Homens', lider: 'Liderança dos departamentos', desc: 'Encontros, reuniões e visitas — cuidado com os da fé e atenção especial a quem ainda está conhecendo Cristo.' },
    { nome: 'Café e Conexão', lider: 'Equipe de acolhimento', desc: 'Uma manhã por mês a igreja abre as portas para um café com a comunidade de Lago dos Peixes, em Austin. Proximidade, escuta e acolhimento.' },
    { nome: 'Intercessão', lider: 'Equipe de oração', desc: 'Orações semanais às terças-feiras, pela igreja e pela vizinhança. Todo pedido de oração é levado a essas reuniões.' },
    { nome: 'Sonoplastia e Comunicação', lider: 'Equipe de comunicação', desc: 'Técnica, registros e conteúdo: preparando o ambiente do culto e levando o acolhimento da igreja pelas mídias.' },
    { nome: 'Secretaria', lider: 'Secretaria da igreja', desc: 'Cuida dos registros, das atas e do cadastro dos membros — a memória e a organização da igreja em dia.' },
    { nome: 'Tesouraria', lider: 'Tesouraria da igreja', desc: 'Administra dízimos, ofertas e o cuidado com o templo, com transparência e prestação de contas.' },
  ],
  reels: [
    { titulo: 'Um encontro na Promessa', meta: 'Reel · culto de celebração', url: 'https://www.instagram.com/reel/DTGS5N5Dmaf/', poster: SITE + '/video-poster-1.jpg' },
    { titulo: 'Louvor ao vivo', meta: 'Reel · equipe de louvor', url: '', poster: SITE + '/video-poster-2.jpg' },
    { titulo: 'Café e Conexão', meta: 'Reel · comunidade', url: '', poster: SITE + '/video-poster-3.jpg' },
    { titulo: 'Escola Bíblica', meta: 'Reel · sábado, 9h', url: '', poster: SITE + '/galeria-1.jpg' },
    { titulo: 'Células nos lares', meta: 'Reel · durante a semana', url: '', poster: SITE + '/galeria-2.jpg' },
    { titulo: 'Batismos', meta: 'Reel · vidas transformadas', url: '', poster: SITE + '/foto-batismo.jpg' },
  ],
  mensagens: [
    { titulo: 'Onde começa uma igreja?', meta: 'Pr. Gabriel Pereira · Atos 2', url: '' },
    { titulo: 'Cuidar, amar e priorizar pessoas', meta: 'Pr. Gabriel Pereira · série da missão', url: '' },
    { titulo: 'A luz que precisa brilhar naquele lugar', meta: 'Culto da Família · sábado', url: '' },
  ],
  celulas: [
    { nome: 'Célula Lago dos Peixes', publico: 'Famílias', horario: 'Quinta, 19h30', endereco: 'Rua Sogerim, 93 — Lago dos Peixes, Austin', lider: 'Família Botelho', mapa: '' },
    { nome: 'Célula Jovens Promessa', publico: 'Jovens', horario: 'Sexta, 20h', endereco: 'Estrada Austin-Queimados, 250 — Austin', lider: 'Liderança de jovens', mapa: '' },
    { nome: 'Célula Antônio Cunha', publico: 'Adultos', horario: 'Quarta, 19h30', endereco: 'Rua Antônio Cunha, 202 — Austin', lider: 'A confirmar', mapa: '' },
  ],
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
      const c = data?.config || {}
      // pré-preenche textos e listas com o conteúdo real do site,
      // pra dar pra ajustar só uma palavra sem redigitar tudo
      const listas = {}
      for (const k of Object.keys(LISTAS_PADRAO)) {
        listas[k] = Array.isArray(c[k]) && c[k].length ? c[k] : LISTAS_PADRAO[k].map((x) => ({ ...x }))
      }
      // fotos com enquadramento: formato antigo era só o link; novo é {src, pos}
      const normFotos = (arr) => (Array.isArray(arr) ? arr : [])
        .map((f) => (typeof f === 'string' ? { src: f, pos: 'centro' } : f))
      const fotosCapa = normFotos(c.fotosCapa)
      const familia = normFotos(c.familia)
      const sobreFotos = normFotos(c.sobreFotos)
      setCfg({
        ...PADRAO,
        ...c,
        links: { ...PADRAO.links, ...(c.links || {}) },
        textos: { ...TEXTOS_PADRAO, ...(c.textos || {}) },
        ...listas,
        fotosCapa,
        familia,
        sobreFotos,
      })
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
      try {
        const { heicTo } = await import('heic-to')
        blob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 })
      } catch (e1) {
        // plano B: biblioteca alternativa
        const { default: heic2any } = await import('heic2any')
        const conv = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
        blob = Array.isArray(conv) ? conv[0] : conv
      }
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
    let ok = 0, falhas = 0
    for (let i = 0; i < arquivos.length; i++) {
      toast(`📤 Enviando foto ${i + 1} de ${arquivos.length}… não saia da página`)
      const url = await upload(arquivos[i], pasta)
      if (url) { ok++; setLista(chave, (l) => [...l, url]) } else falhas++
    }
    toast(falhas
      ? `⚠️ ${ok} foto(s) enviada(s), ${falhas} falhou(aram). Tente as que faltaram de novo.`
      : `✅ ${ok} foto(s) enviada(s)! Agora clique em "Salvar e publicar".`)
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

  // Grid de fotos com escolha de enquadramento (Topo / Centro / Base)
  const FotosGridPos = ({ chave, pasta, dica }) => (
    <div>
      <div style={st.fotosGrid}>
        {(cfg[chave] || []).map((f, i) => (
          <div key={i}>
            <div style={st.fotoCard}>
              <img src={f.src} alt="" style={{ ...st.fotoImg, objectPosition: { topo: 'center top', base: 'center bottom' }[f.pos] || 'center' }} />
              <div style={st.fotoAcoes}>
                <button style={st.miniBtn} onClick={() => mover(chave, i, -1)} title="Mover para trás"><ArrowUp size={13} /></button>
                <button style={st.miniBtn} onClick={() => mover(chave, i, 1)} title="Mover para frente"><ArrowDown size={13} /></button>
                <button style={{ ...st.miniBtn, color: 'var(--red)' }} onClick={() => remover(chave, i)} title="Remover"><Trash2 size={13} /></button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              {[['topo', 'Topo'], ['centro', 'Centro'], ['base', 'Base']].map(([v, rot]) => (
                <button key={v} onClick={() => editarItem(chave, i, 'pos', v)}
                  style={{
                    flex: 1, padding: '5px 0', borderRadius: 7, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    border: '1px solid ' + ((f.pos || 'centro') === v ? 'var(--cy)' : 'var(--bd)'),
                    background: (f.pos || 'centro') === v ? 'var(--cdim)' : 'transparent',
                    color: (f.pos || 'centro') === v ? 'var(--cy)' : 'var(--g)',
                  }}>{rot}</button>
              ))}
            </div>
          </div>
        ))}
        <label style={st.fotoAdd}>
          <Upload size={18} strokeWidth={1.75} />
          <span style={{ fontSize: 11.5, fontWeight: 600 }}>Adicionar foto</span>
          <input type="file" accept="image/*,.heic,.heif" multiple style={{ display: 'none' }} onChange={async (e) => {
            const arquivos = [...e.target.files]
            e.target.value = ''
            let ok = 0, falhas = 0
            for (let i = 0; i < arquivos.length; i++) {
              toast(`📤 Enviando foto ${i + 1} de ${arquivos.length}… não saia da página`)
              const url = await upload(arquivos[i], pasta)
              if (url) { ok++; setLista(chave, (l) => [...l, { src: url, pos: 'centro' }]) } else falhas++
            }
            toast(falhas ? `⚠️ ${ok} enviada(s), ${falhas} falhou(aram).` : `✅ ${ok} foto(s) enviada(s)! Agora clique em "Salvar e publicar".`)
          }} />
        </label>
      </div>
      {dica && <div style={st.dica}>{dica} Em cada foto, escolha qual parte aparece (Topo / Centro / Base) — a miniatura mostra o enquadramento.</div>}
    </div>
  )

  const campo = (label, valor, onChange, placeholder = '') => (
    <label style={st.campo}>
      <span style={st.campoLabel}>{label}</span>
      <input style={st.input} value={valor || ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )

  const setTexto = (k, v) => setCfg((c) => ({ ...c, textos: { ...(c.textos || {}), [k]: v } }))
  const campoTexto = ({ k, label, padrao, grande }) => (
    <label key={k} style={{ ...st.campo, ...(grande ? { gridColumn: '1 / -1' } : {}) }}>
      <span style={st.campoLabel}>{label}</span>
      {grande ? (
        <textarea style={{ ...st.input, resize: 'vertical', minHeight: 64 }} rows={3}
          value={(cfg.textos || {})[k] || ''} placeholder={padrao}
          onChange={(e) => setTexto(k, e.target.value)} />
      ) : (
        <input style={st.input} value={(cfg.textos || {})[k] || ''} placeholder={padrao}
          onChange={(e) => setTexto(k, e.target.value)} />
      )}
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
          {campo('Facebook (link completo)', cfg.links.facebook, (v) => setCfg((c) => ({ ...c, links: { ...c.links, facebook: v } })), 'https://facebook.com/promessalagodospeixes')}
          {campo('Link "Ver todas as pregações" (deixe VAZIO para esconder o botão)', cfg.links.pregacoes, (v) => setCfg((c) => ({ ...c, links: { ...c.links, pregacoes: v } })), 'ex.: canal do YouTube, quando tiver')}
          {campo('E-mail da igreja', cfg.links.email, (v) => setCfg((c) => ({ ...c, links: { ...c.links, email: v } })))}
        </div>
      </div>

      {/* Textos do site */}
      <div style={st.card}>
        <div style={st.cardTitulo}>📝 Textos do site</div>
        <div style={st.dica}>Os campos já vêm com o texto atual do site — é só ajustar o que quiser e clicar em "Salvar e publicar".</div>
        <div style={{ ...st.grid2, marginTop: 12 }}>
          {TEXTOS_CAMPOS.map(campoTexto)}
        </div>
      </div>

      {/* Família pastoral — textos */}
      <div style={st.card}>
        <div style={st.cardTitulo}>👨‍👩‍👧‍👦 Família pastoral — textos</div>
        <div style={st.grid2}>
          {PASTOR_CAMPOS.map(campoTexto)}
        </div>
      </div>

      {/* Horários */}
      <div style={st.card}>
        <div style={st.cardTitulo}>⏰ Horários (faixa da capa)</div>
        {(cfg.horarios || []).map((h, i) => (
          <div key={i} style={st.item}>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,140px),1fr))', gap: 8 }}>
              {campo('Dia', h.dia, (v) => editarItem('horarios', i, 'dia', v), 'Sábado')}
              {campo('Horário', h.hora, (v) => editarItem('horarios', i, 'hora', v), '10h30')}
              {campo('Descrição', h.desc, (v) => editarItem('horarios', i, 'desc', v), 'Culto da Família')}
            </div>
            <div style={st.itemAcoes}>
              <button style={st.miniBtn} onClick={() => mover('horarios', i, -1)}><ArrowUp size={13} /></button>
              <button style={st.miniBtn} onClick={() => mover('horarios', i, 1)}><ArrowDown size={13} /></button>
              <button style={{ ...st.miniBtn, color: 'var(--red)' }} onClick={() => remover('horarios', i)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        <button style={st.btnAdd} onClick={() => setLista('horarios', (l) => [...l, { ...HOR_VAZIO }])}><Plus size={14} /> Adicionar horário</button>
        <div style={st.dica}>Se a lista ficar vazia, o site mostra os 4 horários padrão. O bloco "Células" no fim da faixa é fixo.</div>
      </div>

      {/* Ministérios */}
      <div style={st.card}>
        <div style={st.cardTitulo}>🧩 Ministérios</div>
        {(cfg.ministerios || []).map((m, i) => (
          <div key={i} style={st.item}>
            <div style={{ position: 'relative', width: 56, height: 56, borderRadius: 99, overflow: 'hidden', border: '1px solid var(--bd)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {m.foto ? <img src={m.foto} alt="" style={st.fotoImg} /> : <span style={{ fontSize: 8.5, color: 'var(--g)', textAlign: 'center' }}>foto do líder</span>}
              <label style={{ ...st.itemUpload, right: 0, bottom: 0 }}>
                <Upload size={11} />
                <input type="file" accept="image/*,.heic,.heif" style={{ display: 'none' }} onChange={async (e) => {
                  const url = await upload(e.target.files[0], 'lideres'); e.target.value = ''
                  if (url) editarItem('ministerios', i, 'foto', url)
                }} />
              </label>
            </div>
            <div style={{ flex: 1, display: 'grid', gap: 8 }}>
              <div style={st.grid2}>
                {campo('Nome do ministério', m.nome, (v) => editarItem('ministerios', i, 'nome', v), 'Louvor')}
                {campo('Liderança', m.lider, (v) => editarItem('ministerios', i, 'lider', v), 'Nome de quem lidera')}
              </div>
              <label style={st.campo}>
                <span style={st.campoLabel}>Descrição</span>
                <textarea style={{ ...st.input, resize: 'vertical', minHeight: 56 }} rows={2} value={m.desc || ''}
                  placeholder="O que esse ministério faz"
                  onChange={(e) => editarItem('ministerios', i, 'desc', e.target.value)} />
              </label>
            </div>
            <div style={st.itemAcoes}>
              <button style={st.miniBtn} onClick={() => mover('ministerios', i, -1)}><ArrowUp size={13} /></button>
              <button style={st.miniBtn} onClick={() => mover('ministerios', i, 1)}><ArrowDown size={13} /></button>
              <button style={{ ...st.miniBtn, color: 'var(--red)' }} onClick={() => remover('ministerios', i)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        <button style={st.btnAdd} onClick={() => setLista('ministerios', (l) => [...l, { ...MIN_VAZIO }])}><Plus size={14} /> Adicionar ministério</button>
        <div style={st.dica}>Se a lista ficar vazia, o site mostra os 10 ministérios padrão. A numeração (01, 02…) é automática pela ordem. Esses nomes também viram as opções do formulário "Quero servir".</div>
      </div>

      {/* Fotos de capa */}
      <div style={st.card}>
        <div style={st.cardTitulo}>🖼️ Fotos de capa (carrossel do topo)</div>
        <FotosGridPos chave="fotosCapa" pasta="capa" dica="Fotos deitadas (paisagem) funcionam melhor. Se a lista ficar vazia, o site usa as 2 fotos originais." />
      </div>

      {/* Galeria */}
      <div style={st.card}>
        <div style={st.cardTitulo}>📷 Galeria "Nossa gente"</div>
        <FotosGrid chave="galeria" pasta="galeria" dica="A 1ª e a última aparecem grandes (deitadas); as do meio aparecem quadradas. Se vazia, o site usa as fotos atuais." />
      </div>

      {/* Família pastoral */}
      <div style={st.card}>
        <div style={st.cardTitulo}>👨‍👩‍👧‍👦 Fotos da família pastoral (carrossel da seção Liderança)</div>
        <FotosGridPos chave="familia" pasta="familia" dica="Ideal: 4 fotos deitadas. Se vazia, o site usa fotos genéricas da igreja." />
      </div>

      {/* Fotos do Quem Somos */}
      <div style={st.card}>
        <div style={st.cardTitulo}>🏛️ Fotos do "Quem Somos" (foto grande ao lado da história)</div>
        <FotosGridPos chave="sobreFotos" pasta="sobre" dica="A 1ª é a capa; adicione outras e elas viram um mini-álbum com setinhas pra registrar a história. Se vazia, o site usa a foto do batismo." />
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
              {(r.url || '').includes('instagram.com') && (
                <button style={{ ...st.btnAdd, alignSelf: 'start' }} onClick={async () => {
                  toast('Buscando a capa no Instagram…')
                  try {
                    const resp = await fetch('/api/insta-capa?url=' + encodeURIComponent(r.url))
                    if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).error || 'falha')
                    const blob = await resp.blob()
                    const url = await upload(new File([blob], 'capa-insta.jpg', { type: 'image/jpeg' }), 'reels')
                    if (url) { editarItem('reels', i, 'poster', url); toast('✅ Capa do reel atualizada! Clique em "Salvar e publicar".') }
                  } catch (e) {
                    toast('Não consegui buscar essa capa (' + e.message + '). O post é público?')
                  }
                }}>📸 Buscar capa do Insta</button>
              )}
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
            <div style={{ position: 'relative', width: 64, height: 64, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--bd)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {m.capa ? <img src={m.capa} alt="" style={st.fotoImg} /> : <span style={{ fontSize: 9, color: 'var(--g)' }}>capa</span>}
              <label style={st.itemUpload}>
                <Upload size={12} />
                <input type="file" accept="image/*,.heic,.heif" style={{ display: 'none' }} onChange={async (e) => {
                  const url = await upload(e.target.files[0], 'mensagens'); e.target.value = ''
                  if (url) editarItem('mensagens', i, 'capa', url)
                }} />
              </label>
            </div>
            <div style={{ flex: 1, display: 'grid', gap: 8 }}>
              <div style={st.grid2}>
                {campo('Título da mensagem', m.titulo, (v) => editarItem('mensagens', i, 'titulo', v), 'Onde começa uma igreja?')}
                {campo('Pregador / referência', m.meta, (v) => editarItem('mensagens', i, 'meta', v), 'Pr. Gabriel Pereira · Atos 2')}
              </div>
              {campo('Link (Instagram, YouTube, Drive…)', m.url, (v) => editarItem('mensagens', i, 'url', v))}
              {(m.url || '').includes('instagram.com') && (
                <button style={{ ...st.btnAdd, alignSelf: 'start' }} onClick={async () => {
                  toast('Buscando a capa no Instagram…')
                  try {
                    const resp = await fetch('/api/insta-capa?url=' + encodeURIComponent(m.url))
                    if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).error || 'falha')
                    const blob = await resp.blob()
                    const url = await upload(new File([blob], 'capa-insta.jpg', { type: 'image/jpeg' }), 'mensagens')
                    if (url) { editarItem('mensagens', i, 'capa', url); toast('✅ Capa da mensagem atualizada! Clique em "Salvar e publicar".') }
                  } catch (e) {
                    toast('Não consegui buscar essa capa (' + e.message + '). O post é público?')
                  }
                }}>📸 Buscar capa do Insta</button>
              )}
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
