import { useEffect, useRef, useState } from 'react'
import { sb } from '../lib/supabase.js'
import { useStore } from '../lib/store.jsx'
import { Globe, Upload, Trash2, Plus, ArrowUp, ArrowDown, Save, ExternalLink, ChevronDown } from 'lucide-react'

// Valores padrão de listas/links
const PADRAO = {
  links: {
    whatsPastor: '5521970250597',
    whatsTesouraria: '5521982936289',
    instagram: 'https://instagram.com/promessalagodospeixes',
    facebook: 'https://facebook.com/promessalagodospeixes',
    pregacoes: '', // vazio = botão "Ver todas as pregações" não aparece no site
    email: 'iaplagodospeixes@gmail.com',
  },
  textos: {},
  horarios: [],
  ministerios: [],
  fotosCapa: [],
  galeria: [],
  familia: [],
  sobreFotos: [],
  reels: [],
  mensagens: [],
  celulas: [],
}

const REEL_VAZIO = { titulo: '', meta: '', url: '', poster: '' }
const MSG_VAZIA = { titulo: '', meta: '', url: '', capa: '' }
const CEL_VAZIA = { nome: '', publico: '', horario: '', endereco: '', lider: '', liderCelula: '', mapa: '' }
const HOR_VAZIO = { dia: '', hora: '', desc: '' }
const MIN_VAZIO = { nome: '', lider: '', desc: '', foto: '' }

// Textos padrão COMPLETOS — pré-preenchem os campos pra editar só uma palavra
const TEXTOS_PADRAO = {
  badge: 'Austin · Nova Iguaçu / RJ · desde 1988',
  heroTitulo: 'Aqui você não é visita. É',
  heroDestaque: 'esperado',
  heroSub: 'Somos a Promessa Lago dos Peixes: uma igreja viva, jovem e de portas abertas, que existe para cuidar, amar e priorizar pessoas.',
  novoTitulo: 'Venha como está. Nós iremos caminhar com você.',
  novoTexto: 'Ninguém precisa se encaixar num molde para entrar aqui. Se for sua primeira vez, avise a gente no WhatsApp: alguém vai te receber na porta, te apresentar a igreja e sentar com você.',
  passo1t: 'Chegue no horário que der',
  passo1d: 'O culto de sábado começa 10h30 e termina às 12h. Sem traje obrigatório, sem constrangimento.',
  passo2t: 'Traga sua família toda',
  passo2d: 'As crianças têm classes por idade na Escola Bíblica; no culto, adoramos todos juntos — em família.',
  passo3t: 'Estrutura pensada para todos',
  passo3d: 'Entrada e banheiros acessíveis. Se precisar de qualquer apoio, avise antes — a igreja se prepara para receber você.',
  videosChapeu: 'Igreja em movimento',
  videosTitulo: 'Conheça um pouco da nossa igreja antes mesmo de vir.',
  mensagensTitulo: 'Pregações para ouvir durante a semana',
  mensagensTexto: 'Publicamos os trechos e as mensagens completas nas redes. Toque em qualquer uma para assistir.',
  fotosTitulo: '38 anos de vidas, batismos e comunhão',
  fotosTexto: 'Cada foto aqui é de um sábado, de uma célula, de um café com a vizinhança. Igreja é gente.',
  sobreTitulo: 'Uma igreja que nasceu de um chamado dentro de um trem.',
  sobreIntro1: 'Em 1º de janeiro de 1988, o Presbítero Paulo Roberto ouviu de Deus:',
  sobreCitacao: '“vá para a casa da tua mãe, que a minha luz tem que brilhar naquele lugar.”',
  sobreIntro2: 'Daquela sala nasceu a nossa igreja. Trinta e oito anos depois, a missão é a mesma.',
  pilar1a: 'Cuidar', pilar1b: 'uns dos outros, de perto',
  pilar2a: 'Amar', pilar2b: 'sem exigir molde',
  pilar3a: 'Priorizar', pilar3b: 'pessoas antes de tudo',
  feTexto: 'Cremos em amar a Deus acima de todas as coisas e proclamar a mensagem de Jesus Cristo sob o poder do Espírito Santo. Fazemos parte de uma família de igrejas presente em todo o Brasil desde 1932.',
  stat1Num: '38',
  stat1Texto: 'anos de história em Lago dos Peixes',
  stat2Num: '1 + 1 = 150',
  stat2Texto: 'nosso sonho é ver cada discípulo alcançando outro discípulo — e chegarmos a 150 membros até 2027',
  historiaResumo: 'Ler a nossa história completa — 1988 até hoje',
  historia: `## O início
Durante a década de 1980, o Presbítero Paulo Roberto Muniz Botelho e sua esposa, Diaconisa Vilma, congregavam na igreja em Austin e exerciam o chamado missionário no Rio de Janeiro e nas cidades vizinhas. Em 1º de janeiro de 1983, haviam iniciado um trabalho em Lages, na casa do Presbítero Norival e da irmã Amélia.

Cinco anos depois, voltando de Lages, o Presbítero Paulo recebeu de Deus, dentro do trem, a seguinte direção:

> “Vá para a casa da tua mãe, que a minha luz tem que brilhar lá naquele lugar.”

Naquele mesmo dia, acompanhado do irmão Alcindo, dirigiu-se à casa de seus pais, Celina e José Muniz Botelho, na Rua Sogerim, nº 93. Em 1º de janeiro de 1988, em obediência a essa direção, teve início ali o ponto de pregação da Promessa em Lago dos Peixes.

## Rua Sogerim, 93 · 1988–1992
Ao trabalho recém-iniciado somou-se a família de José Fernando Muniz Botelho, com sua esposa Ana Botelho e as filhas Angélica e Cíntia. O trabalho consolidou-se, alcançou mais de quarenta irmãos e passou a ser assessorado ministerialmente pelo pastor e pelo grupo base da igreja em Austin.

O primeiro batismo aconteceu em 1988, com o irmão José Muniz e a irmã Celina, pais do Presbítero Paulo. Ao longo desses anos houve batismos no Espírito Santo, avivamentos em subidas ao monte e batismos cerimoniais — além de evangelismos, cultos nos lares e tardes de louvor para levantar recursos para um terreno próprio.

## Rua Antônio Cunha, 202 · a partir de 1992
Em janeiro de 1992, a igreja mudou para um espaço maior, cedido pelo irmão José Fernando. Nesse período, o irmão Luiz Thomé tornou-se o primeiro membro consagrado da igreja, levado ao Diaconato na igreja em Austin. No mesmo ano, de uma visita de amor nasceu também o trabalho em Engenheiro Pedreira.

## Estrada Austin-Queimados, 250 — o templo
Ali foi construído o templo, inaugurado por volta de 1998 — endereço em que permanecemos até hoje.

## O reconhecimento da data de fundação · 2026
Em 27 de junho de 2026, em Assembleia Extraordinária convocada pelo Pastor Gabriel Azeredo Pereira, a igreja refletiu sobre o tema “Onde começa uma igreja?” — a igreja nasce de uma experiência com Deus, e não de um edifício (Atos 2.1-4; Mateus 16.18). Pelo mesmo princípio, a Assembleia Local reconheceu, de forma unânime, a fundação da nossa igreja em 1º de janeiro de 1988.`,
  historiaDataDestaque: '1º de janeiro de 1988',
  historiaDataSub: 'Fundação reconhecida em Assembleia Local · 38 anos em 2026',
  historiaFontes: 'Fontes: “Histórico da Promessa Lago dos Peixes” (pesquisa de Rosilene e Eclair, com testemunhos dos pioneiros, 2026) e Ata da Assembleia Extraordinária de 27/06/2026. Consolidação: Pr. Gabriel Azeredo Pereira.',
  lideresChapeu: 'Conheça nossa família Pastoral',
  lideresTitulo: 'Quem caminha com você aqui',
  lideresApoio: 'Gente de verdade, com nome e rosto. Se precisar de qualquer coisa, procure qualquer um deles no sábado.',
  pastorNome: 'Pr. Gabriel Azeredo Pereira',
  pastorEsposa: 'Pâmela Pereira',
  pastorFilhos: 'Gabriel Filho, Nicolas e Zoe',
  pastorBio1: 'Pastor da Promessa Lago dos Peixes. Conduz a igreja no ensino da Palavra e no louvor, e caminha de perto com cada família — do primeiro café ao batismo. A porta da casa pastoral está aberta para conversar, orar e ouvir.',
  pastorBio2: 'A família pastoral vive a igreja junto com a igreja: no culto, na célula, na visita e no café da esquina.',
  minChapeu: 'Como servimos',
  minTitulo: 'Cada ministério é um jeito de cuidar',
  minApoio: 'Dos de dentro e dos de fora. Escolha por onde começar — tem lugar para você em todos.',
  facaParteTitulo: 'Tem um lugar guardado para você servir',
  facaParteTexto: 'Não precisa ter experiência nem talento pronto — precisa querer. Preencha o cadastro dizendo com o que você gostaria de ajudar e a liderança do ministério entra em contato com você.',
  eventosChapeu: 'Conheça nossa agenda',
  eventosTitulo: 'O que vem por aí na Promessa',
  ritmoTitulo: 'Sempre tem algo acontecendo aqui',
  ritmoTexto: 'Além dos cultos, a semana tem célula nos lares, oração às terças e um encontro por mês com a comunidade. A agenda completa é publicada no Instagram.',
  celTitulo: 'Encontre a célula mais perto de você',
  celApoio: 'Adultos, jovens e crianças reunidos toda semana para compartilhar a vida e aprender mais sobre Jesus. Chegue sem avisar — você vai ser recebido.',
  partTitulo: 'Fale com a igreja por aqui',
  partTexto: 'Preencha e a mensagem chega direto no e-mail da igreja. Respondemos em até dois dias.',
  contribuaTitulo: 'Contribua com esta obra',
  contribuaTexto: 'Dízimos e ofertas são atos voluntários de amor e adoração. Cada recurso é investido com responsabilidade: no cuidado do templo, nas missões local e externa, no auxílio às necessidades dos irmãos, no apoio à família pastoral e no cuidado de outras igrejas.',
  pixExibicao: '30.228.769/0001-22',
  pixCopia: '30228769000122',
  contatoTitulo: 'Onde estamos',
  endereco: 'Estrada Austin-Queimados, 250',
  cidade: 'Austin, Nova Iguaçu / RJ — CEP 26086-295',
  referencia: 'Referência: Mercado do Beto na esquina, ao lado da Águas do Rio.',
}

const SITE = 'https://promessalagodospeixes.com.br'
const LISTAS_PADRAO = {
  horarios: [
    { dia: 'Domingo', hora: '18h', desc: 'Culto de Celebração' },
    { dia: 'Terça', hora: '19h30', desc: 'Reunião de oração' },
    { dia: 'Sábado', hora: '9h', desc: 'Escola Bíblica' },
    { dia: 'Sábado', hora: '10h30', desc: 'Culto da Família' },
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
    { titulo: 'Onde começa uma igreja?', meta: 'Pr. Gabriel Pereira · Atos 2', url: '', capa: '' },
    { titulo: 'Cuidar, amar e priorizar pessoas', meta: 'Pr. Gabriel Pereira · série da missão', url: '', capa: '' },
    { titulo: 'A luz que precisa brilhar naquele lugar', meta: 'Culto da Família · sábado', url: '', capa: '' },
  ],
  celulas: [
    { nome: 'Célula Lago dos Peixes', publico: 'Famílias', horario: 'Quinta, 19h30', endereco: 'Rua Sogerim, 93 — Lago dos Peixes, Austin', lider: 'Família Botelho', liderCelula: '', mapa: '' },
    { nome: 'Célula Jovens Promessa', publico: 'Jovens', horario: 'Sexta, 20h', endereco: 'Estrada Austin-Queimados, 250 — Austin', lider: 'Liderança de jovens', liderCelula: '', mapa: '' },
    { nome: 'Célula Antônio Cunha', publico: 'Adultos', horario: 'Quarta, 19h30', endereco: 'Rua Antônio Cunha, 202 — Austin', lider: 'A confirmar', liderCelula: '', mapa: '' },
  ],
}

// Seção colapsável (fechada por padrão, igual Escala de Culto)
const Sec = ({ titulo, children }) => (
  <details style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 14, overflow: 'hidden' }}>
    <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '15px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontWeight: 800, color: 'var(--w)', fontSize: 14 }}>
      <span>{titulo}</span>
      <ChevronDown size={16} style={{ color: 'var(--g)', flexShrink: 0 }} />
    </summary>
    <div style={{ padding: '4px 18px 18px', display: 'grid', gap: 14 }}>{children}</div>
  </details>
)

// Como cada foto é cortada no site (janela de enquadramento)
const ASPECTOS = {
  fotosCapa: { ratio: '21 / 9', rotulo: 'capa do site (tela de computador)' },
  familia: { ratio: '4 / 3', rotulo: 'carrossel da família pastoral' },
  sobreFotos: { ratio: '4 / 5', rotulo: 'foto do Quem Somos' },
}

// Modal de enquadramento manual: mostra o corte real do site e deixa arrastar a foto
function EnquadroModal({ src, ratio, rotulo, px0, py0, onSalvar, onFechar }) {
  const [px, setPx] = useState(px0 ?? 50)
  const [py, setPy] = useState(py0 ?? 50)
  const drag = useRef(null)
  const frameRef = useRef(null)
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)))
  const aoDescer = (e) => {
    drag.current = { x: e.clientX, y: e.clientY, px, py }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const aoMover = (e) => {
    if (!drag.current) return
    const r = frameRef.current.getBoundingClientRect()
    setPx(clamp(drag.current.px - ((e.clientX - drag.current.x) / r.width) * 100))
    setPy(clamp(drag.current.py - ((e.clientY - drag.current.y) / r.height) * 100))
  }
  const aoSoltar = () => { drag.current = null }
  const preset = (nx, ny) => { setPx(nx); setPy(ny) }
  const btnPre = (rot, nx, ny) => (
    <button key={rot} onClick={() => preset(nx, ny)}
      style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--gl)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>{rot}</button>
  )
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onFechar}>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 16, padding: 18, maxWidth: 700, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 800, color: 'var(--w)', fontSize: 14, marginBottom: 4 }}>🎯 Enquadrar foto</div>
        <div style={{ fontSize: 12, color: 'var(--g)', marginBottom: 12 }}>
          A janela abaixo é <strong>exatamente o corte</strong> que aparece na {rotulo}. Arraste a foto até ficar como você quer.
        </div>
        <div ref={frameRef}
          onPointerDown={aoDescer} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoSoltar}
          style={{ aspectRatio: ratio, width: '100%', borderRadius: 12, overflow: 'hidden', border: '2px solid var(--cy)', cursor: 'grab', touchAction: 'none', background: 'var(--bg)' }}>
          <img src={src} alt="" draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${px}% ${py}%`, userSelect: 'none', pointerEvents: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
          {btnPre('⬆ Topo', 50, 0)}
          {btnPre('◎ Centro', 50, 50)}
          {btnPre('⬇ Base', 50, 100)}
          <div style={{ flex: 1 }}></div>
          <button onClick={onFechar} style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--gl)', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={() => onSalvar(px, py)} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--cy)', color: '#04211f', cursor: 'pointer', fontSize: 13, fontWeight: 800, fontFamily: 'inherit' }}>Aplicar enquadramento</button>
        </div>
      </div>
    </div>
  )
}

export default function SitePublico() {
  const { dispatch } = useStore()
  const [cfg, setCfg] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [enq, setEnq] = useState(null) // { chave, i } — foto sendo enquadrada

  useEffect(() => {
    sb.from('site_config').select('config').eq('id', 1).single().then(({ data }) => {
      const c = data?.config || {}
      const listas = {}
      for (const k of Object.keys(LISTAS_PADRAO)) {
        listas[k] = Array.isArray(c[k]) && c[k].length ? c[k] : LISTAS_PADRAO[k].map((x) => ({ ...x }))
      }
      const normFotos = (arr) => (Array.isArray(arr) ? arr : [])
        .map((f) => (typeof f === 'string' ? { src: f, pos: 'centro' } : f))
      setCfg({
        ...PADRAO,
        ...c,
        links: { ...PADRAO.links, ...(c.links || {}) },
        textos: { ...TEXTOS_PADRAO, ...(c.textos || {}) },
        ...listas,
        fotosCapa: normFotos(c.fotosCapa),
        familia: normFotos(c.familia),
        sobreFotos: normFotos(c.sobreFotos),
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

  const upload = async (file, pasta) => {
    if (!file) return null
    let blob
    try {
      const { uploadFotoSite } = await import('../lib/fotoSite.js')
      return await uploadFotoSite(file, pasta)
    } catch (e) {
      toast('Não consegui enviar essa foto (' + e.message + '). Tente exportar como JPEG.')
      return null
    }
  }

  // helpers de lista
  const setLista = (chave, fn) => setCfg((c) => ({ ...c, [chave]: fn([...(c[chave] || [])]) }))
  const mover = (chave, i, delta) => setLista(chave, (l) => {
    const j = i + delta
    if (j < 0 || j >= l.length) return l
    const c = [...l]; [c[i], c[j]] = [c[j], c[i]]; return c
  })
  const remover = (chave, i) => setLista(chave, (l) => l.filter((_, k) => k !== i))
  const editarItem = (chave, i, campo, valor) => setLista(chave, (l) => {
    const c = [...l]; c[i] = { ...c[i], [campo]: valor }; return c
  })

  const addFotos = (chave, pasta, wrap) => async (e) => {
    const arquivos = [...e.target.files]
    e.target.value = ''
    let ok = 0, falhas = 0
    for (let i = 0; i < arquivos.length; i++) {
      toast(`📤 Enviando foto ${i + 1} de ${arquivos.length}… não saia da página`)
      const url = await upload(arquivos[i], pasta)
      if (url) { ok++; setLista(chave, (l) => [...l, wrap ? wrap(url) : url]) } else falhas++
    }
    toast(falhas ? `⚠️ ${ok} enviada(s), ${falhas} falhou(aram).` : `✅ ${ok} foto(s) enviada(s)! Agora clique em "Salvar e publicar".`)
  }

  // Grid de fotos com escolha de enquadramento (Topo / Centro / Base)
  const FotosGridPos = ({ chave, pasta, dica }) => (
    <div>
      <div style={st.fotosGrid}>
        {(cfg[chave] || []).map((f, i) => (
          <div key={i}>
            <div style={{ ...st.fotoCard, aspectRatio: (ASPECTOS[chave]?.ratio || '4 / 3').replace(/\s/g, '') }}>
              <img src={f.src} alt="" style={{ ...st.fotoImg, objectPosition: f.px != null ? `${f.px}% ${f.py}%` : ({ topo: 'center top', base: 'center bottom' }[f.pos] || 'center') }} />
              <div style={st.fotoAcoes}>
                <button style={st.miniBtn} onClick={() => mover(chave, i, -1)} title="Mover para trás"><ArrowUp size={13} /></button>
                <button style={st.miniBtn} onClick={() => mover(chave, i, 1)} title="Mover para frente"><ArrowDown size={13} /></button>
                <button style={{ ...st.miniBtn, color: 'var(--red)' }} onClick={() => remover(chave, i)} title="Remover"><Trash2 size={13} /></button>
              </div>
            </div>
            <button onClick={() => setEnq({ chave, i })}
              style={{ width: '100%', marginTop: 6, padding: '7px 0', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--bd)', background: 'transparent', color: 'var(--gl)' }}>
              🎯 Enquadrar
            </button>
          </div>
        ))}
        <label style={st.fotoAdd}>
          <Upload size={18} strokeWidth={1.75} />
          <span style={{ fontSize: 11.5, fontWeight: 600 }}>Adicionar foto</span>
          <input type="file" accept="image/*,.heic,.heif" multiple style={{ display: 'none' }}
            onChange={addFotos(chave, pasta, (url) => ({ src: url, pos: 'centro' }))} />
        </label>
      </div>
      {dica && <div style={st.dica}>{dica} Use o botão 🎯 Enquadrar para ajustar exatamente o corte de cada foto.</div>}
    </div>
  )

  // Grid de fotos simples (galeria)
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
          <input type="file" accept="image/*,.heic,.heif" multiple style={{ display: 'none' }} onChange={addFotos(chave, pasta)} />
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

  const setTexto = (k, v) => setCfg((c) => ({ ...c, textos: { ...(c.textos || {}), [k]: v } }))
  const ct = (k, label, opts = {}) => (
    <label key={k} style={{ ...st.campo, ...(opts.grande || opts.gigante ? { gridColumn: '1 / -1' } : {}) }}>
      <span style={st.campoLabel}>{label}</span>
      {opts.grande || opts.gigante ? (
        <textarea style={{ ...st.input, resize: 'vertical', minHeight: opts.gigante ? 260 : 64 }} rows={opts.gigante ? 14 : 3}
          value={(cfg.textos || {})[k] || ''} onChange={(e) => setTexto(k, e.target.value)} />
      ) : (
        <input style={st.input} value={(cfg.textos || {})[k] || ''} onChange={(e) => setTexto(k, e.target.value)} />
      )}
    </label>
  )

  const botaoInstaCapa = (lista, i, url) => (url || '').includes('instagram.com') && (
    <button style={{ ...st.btnAdd, alignSelf: 'start' }} onClick={async () => {
      toast('Buscando a capa no Instagram…')
      try {
        const resp = await fetch('/api/insta-capa?url=' + encodeURIComponent(url))
        if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).error || 'falha')
        const blob = await resp.blob()
        const salvo = await upload(new File([blob], 'capa-insta.jpg', { type: 'image/jpeg' }), lista)
        if (salvo) { editarItem(lista, i, lista === 'reels' ? 'poster' : 'capa', salvo); toast('✅ Capa atualizada! Clique em "Salvar e publicar".') }
      } catch (e) {
        toast('Não consegui buscar essa capa (' + e.message + '). O post é público?')
      }
    }}>📸 Buscar capa do Insta</button>
  )

  return (
    <div style={{ maxWidth: 980, display: 'grid', gap: 12 }}>
      <div style={st.topo}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Globe size={20} strokeWidth={1.75} style={{ color: 'var(--cy)' }} />
          <div>
            <div style={{ fontWeight: 800, color: 'var(--w)', fontSize: 15 }}>Editor do Site Público</div>
            <div style={{ fontSize: 12, color: 'var(--g)' }}>Abra a seção que quer editar, mude e clique em "Salvar e publicar"</div>
          </div>
        </div>
        <a href="https://promessalagodospeixes.com.br" target="_blank" rel="noopener noreferrer" style={st.btnGhost}>
          <ExternalLink size={14} /> Ver o site
        </a>
      </div>

      <Sec titulo="🔗 Links e contatos">
        <div style={st.grid2}>
          {campo('WhatsApp do pastor (só números, com 55)', cfg.links.whatsPastor, (v) => setCfg((c) => ({ ...c, links: { ...c.links, whatsPastor: v.replace(/\D/g, '') } })), '5521970250597')}
          {campo('WhatsApp da tesouraria (só números, com 55)', cfg.links.whatsTesouraria, (v) => setCfg((c) => ({ ...c, links: { ...c.links, whatsTesouraria: v.replace(/\D/g, '') } })), '5521982936289')}
          {campo('Instagram (link completo)', cfg.links.instagram, (v) => setCfg((c) => ({ ...c, links: { ...c.links, instagram: v } })))}
          {campo('Facebook (link completo)', cfg.links.facebook, (v) => setCfg((c) => ({ ...c, links: { ...c.links, facebook: v } })), 'https://facebook.com/promessalagodospeixes')}
          {campo('Link "Ver todas as pregações" — deixe VAZIO até ter o YouTube da igreja', cfg.links.pregacoes, (v) => setCfg((c) => ({ ...c, links: { ...c.links, pregacoes: v } })), 'vazio = botão não aparece no site')}
          {campo('E-mail da igreja', cfg.links.email, (v) => setCfg((c) => ({ ...c, links: { ...c.links, email: v } })))}
        </div>
      </Sec>

      <Sec titulo="🎬 Capa do site (topo)">
        <div style={st.grid2}>
          {ct('badge', 'Selo pequeno da capa')}
          {ct('heroTitulo', 'Título (parte normal)')}
          {ct('heroDestaque', 'Palavra em destaque (itálico)')}
          {ct('heroSub', 'Subtítulo', { grande: true })}
        </div>
        <div>
          <div style={st.subTitulo}>Fotos do carrossel</div>
          {FotosGridPos({ chave: 'fotosCapa', pasta: 'capa', dica: 'Fotos deitadas (paisagem) funcionam melhor.' })}
        </div>
        <div>
          <div style={st.subTitulo}>Horários (faixa da capa)</div>
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
        </div>
      </Sec>

      <Sec titulo="👋 Primeira visita">
        <div style={st.grid2}>
          {ct('novoTitulo', 'Título')}
          {ct('novoTexto', 'Texto', { grande: true })}
          {ct('passo1t', 'Passo 01 — título')}
          {ct('passo1d', 'Passo 01 — texto', { grande: true })}
          {ct('passo2t', 'Passo 02 — título')}
          {ct('passo2d', 'Passo 02 — texto', { grande: true })}
          {ct('passo3t', 'Passo 03 — título')}
          {ct('passo3d', 'Passo 03 — texto', { grande: true })}
        </div>
      </Sec>

      <Sec titulo="📽️ Vídeos / Reels">
        <div style={st.grid2}>
          {ct('videosChapeu', 'Selo da seção')}
          {ct('videosTitulo', 'Título', { grande: true })}
        </div>
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
              {botaoInstaCapa('reels', i, r.url)}
            </div>
            <div style={st.itemAcoes}>
              <button style={st.miniBtn} onClick={() => mover('reels', i, -1)}><ArrowUp size={13} /></button>
              <button style={st.miniBtn} onClick={() => mover('reels', i, 1)}><ArrowDown size={13} /></button>
              <button style={{ ...st.miniBtn, color: 'var(--red)' }} onClick={() => remover('reels', i)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        <button style={st.btnAdd} onClick={() => setLista('reels', (l) => [...l, { ...REEL_VAZIO }])}><Plus size={14} /> Adicionar reel</button>
      </Sec>

      <Sec titulo="🎙️ Mensagens / Pregações">
        <div style={st.grid2}>
          {ct('mensagensTitulo', 'Título')}
          {ct('mensagensTexto', 'Texto de apoio', { grande: true })}
        </div>
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
              {botaoInstaCapa('mensagens', i, m.url)}
            </div>
            <div style={st.itemAcoes}>
              <button style={st.miniBtn} onClick={() => mover('mensagens', i, -1)}><ArrowUp size={13} /></button>
              <button style={st.miniBtn} onClick={() => mover('mensagens', i, 1)}><ArrowDown size={13} /></button>
              <button style={{ ...st.miniBtn, color: 'var(--red)' }} onClick={() => remover('mensagens', i)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        <button style={st.btnAdd} onClick={() => setLista('mensagens', (l) => [...l, { ...MSG_VAZIA }])}><Plus size={14} /> Adicionar pregação</button>
      </Sec>

      <Sec titulo="📷 Fotos — Nossa gente">
        <div style={st.grid2}>
          {ct('fotosTitulo', 'Título')}
          {ct('fotosTexto', 'Texto de apoio', { grande: true })}
        </div>
        {FotosGrid({ chave: 'galeria', pasta: 'galeria', dica: 'A 1ª foto abre em destaque; as demais viram miniaturas com setinha. Toque amplia.' })}
      </Sec>

      <Sec titulo="⛪ Quem somos (com história completa)">
        <div style={st.grid2}>
          {ct('sobreTitulo', 'Título', { grande: true })}
          {ct('sobreIntro1', 'Introdução — antes da citação', { grande: true })}
          {ct('sobreCitacao', 'Citação (itálico)', { grande: true })}
          {ct('sobreIntro2', 'Introdução — depois da citação', { grande: true })}
          {ct('pilar1a', 'Pilar 1 — palavra')}
          {ct('pilar1b', 'Pilar 1 — complemento')}
          {ct('pilar2a', 'Pilar 2 — palavra')}
          {ct('pilar2b', 'Pilar 2 — complemento')}
          {ct('pilar3a', 'Pilar 3 — palavra')}
          {ct('pilar3b', 'Pilar 3 — complemento')}
          {ct('feTexto', 'Texto de fé (antes do link da família de igrejas)', { grande: true })}
          {ct('stat1Num', 'Cartão cinza — número')}
          {ct('stat1Texto', 'Cartão cinza — texto', { grande: true })}
          {ct('stat2Num', 'Cartão azul — número/frase')}
          {ct('stat2Texto', 'Cartão azul — texto', { grande: true })}
          {ct('historiaResumo', 'Texto do botão da história', { grande: true })}
          {ct('historia', 'História completa — linhas com ## viram subtítulo, linhas com > viram citação', { gigante: true })}
          {ct('historiaDataDestaque', 'Destaque final — data')}
          {ct('historiaDataSub', 'Destaque final — legenda', { grande: true })}
          {ct('historiaFontes', 'Fontes (letra pequena)', { grande: true })}
        </div>
        <div>
          <div style={st.subTitulo}>Fotos do Quem Somos (a 1ª é a capa; as demais viram álbum com setinhas)</div>
          {FotosGridPos({ chave: 'sobreFotos', pasta: 'sobre', dica: '' })}
        </div>
      </Sec>

      <Sec titulo="👨‍👩‍👧‍👦 Família pastoral">
        <div style={st.grid2}>
          {ct('lideresChapeu', 'Selo da seção')}
          {ct('lideresTitulo', 'Título')}
          {ct('lideresApoio', 'Texto de apoio', { grande: true })}
          {ct('pastorNome', 'Nome do pastor')}
          {ct('pastorEsposa', 'Esposa')}
          {ct('pastorFilhos', 'Filhos')}
          {ct('pastorBio1', 'Apresentação — 1º parágrafo', { grande: true })}
          {ct('pastorBio2', 'Apresentação — 2º parágrafo', { grande: true })}
        </div>
        <div>
          <div style={st.subTitulo}>Fotos do carrossel</div>
          {FotosGridPos({ chave: 'familia', pasta: 'familia', dica: 'Ideal: 4 fotos deitadas.' })}
        </div>
      </Sec>

      <Sec titulo="🧩 Ministérios e Faça parte">
        <div style={st.grid2}>
          {ct('minChapeu', 'Selo da seção')}
          {ct('minTitulo', 'Título')}
          {ct('minApoio', 'Texto de apoio', { grande: true })}
          {ct('facaParteTitulo', 'Faça parte — título')}
          {ct('facaParteTexto', 'Faça parte — texto', { grande: true })}
        </div>
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
        <div style={st.dica}>Esses nomes também viram as opções do formulário "Quero servir" do site.</div>
      </Sec>

      <Sec titulo="📅 Agenda no site">
        <div style={st.grid2}>
          {ct('eventosChapeu', 'Selo da seção de eventos')}
          {ct('eventosTitulo', 'Título da seção de eventos')}
          {ct('ritmoTitulo', 'Título do "Ritmo da igreja"')}
          {ct('ritmoTexto', 'Texto do "Ritmo da igreja"', { grande: true })}
        </div>
        <div style={st.dica}>Os eventos em si vêm da página <strong>Agenda</strong> do sistema: só os do tipo "Igreja Local" e de hoje em diante aparecem no site, com o link e a foto de capa cadastrados lá.</div>
      </Sec>

      <Sec titulo="🏠 Células">
        <div style={st.grid2}>
          {ct('celTitulo', 'Título')}
          {ct('celApoio', 'Texto de apoio', { grande: true })}
        </div>
        {(cfg.celulas || []).map((c, i) => (
          <div key={i} style={st.item}>
            <div style={{ flex: 1, display: 'grid', gap: 8 }}>
              <div style={st.grid2}>
                {campo('Nome da célula', c.nome, (v) => editarItem('celulas', i, 'nome', v), 'Célula Vida Nova')}
                {campo('Público', c.publico, (v) => editarItem('celulas', i, 'publico', v), 'Famílias / Jovens / Adultos')}
              </div>
              <div style={st.grid2}>
                {campo('Dia e horário', c.horario, (v) => editarItem('celulas', i, 'horario', v), 'Quinta, 19h30')}
                {campo('Líder da célula', c.liderCelula, (v) => editarItem('celulas', i, 'liderCelula', v), 'Quem conduz a célula')}
                {campo('Anfitrião', c.lider, (v) => editarItem('celulas', i, 'lider', v), 'Quem recebe na casa')}
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
      </Sec>

      <Sec titulo="✉️ Participe (formulários)">
        <div style={st.grid2}>
          {ct('partTitulo', 'Título')}
          {ct('partTexto', 'Texto de apoio', { grande: true })}
        </div>
      </Sec>

      <Sec titulo="💰 Contribua">
        <div style={st.grid2}>
          {ct('contribuaTitulo', 'Título')}
          {ct('contribuaTexto', 'Texto de transparência', { grande: true })}
          {ct('pixExibicao', 'PIX — como aparece no site')}
          {ct('pixCopia', 'PIX — chave que o botão copia (só números)')}
        </div>
      </Sec>

      <Sec titulo="📍 Contato">
        <div style={st.grid2}>
          {ct('contatoTitulo', 'Título')}
          {ct('endereco', 'Endereço')}
          {ct('cidade', 'Cidade / CEP')}
          {ct('referencia', 'Referência', { grande: true })}
        </div>
      </Sec>

      {enq && (() => {
        const foto = (cfg[enq.chave] || [])[enq.i]
        if (!foto) return null
        const asp = ASPECTOS[enq.chave] || { ratio: '4 / 3', rotulo: 'foto do site' }
        const posIni = { topo: 0, base: 100 }[foto.pos]
        return (
          <EnquadroModal
            src={foto.src}
            ratio={asp.ratio}
            rotulo={asp.rotulo}
            px0={foto.px != null ? foto.px : 50}
            py0={foto.py != null ? foto.py : (posIni != null ? posIni : 50)}
            onFechar={() => setEnq(null)}
            onSalvar={(px, py) => {
              setLista(enq.chave, (l) => {
                const c = [...l]; c[enq.i] = { ...c[enq.i], px, py }; return c
              })
              setEnq(null)
              toast('🎯 Enquadramento aplicado! Clique em "Salvar e publicar".')
            }}
          />
        )
      })()}

      <div style={{ paddingBottom: 70 }}></div>

      {/* Botão flutuante — salva de qualquer lugar da página */}
      <button onClick={salvar} disabled={salvando}
        style={{
          ...st.btnSalvar,
          position: 'fixed', right: 22, bottom: 22, zIndex: 120,
          boxShadow: '0 14px 34px -10px rgba(0,0,0,.55)',
        }}>
        <Save size={15} /> {salvando ? 'Salvando…' : 'Salvar e publicar'}
      </button>
    </div>
  )
}

const st = {
  topo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' },
  subTitulo: { fontWeight: 700, color: 'var(--gl)', fontSize: 12.5, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' },
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
  dica: { fontSize: 11.5, color: 'var(--g)', marginTop: 4 },
}
