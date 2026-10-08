import { useState, useRef } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbUpdate, dbDelete } from '../lib/supabase.js'
import { isAdmin, isGestorLouvor, normalizar } from '../lib/utils.js'
import { podeExcluirOuSolicitar } from '../lib/solicitacoes.js'
import { SecHeader, Btn, Modal, FormGrid, FG, Tag, Empty } from '../components/UI.jsx'
import { Plus, Trash2, Pencil, Sparkles } from 'lucide-react'

const CATS = ['Celebração','Ministração','Adoração','Ceia']
const TONS = ['','A','A#/Bb','B','C','C#/Db','D','D#/Eb','E','F','F#/Gb','G','G#/Ab','Am','A#m/Bbm','Bm','Cm','C#m/Dbm','Dm','D#m/Ebm','Em','Fm','F#m/Gbm','Gm','G#m/Abm']
const empty = { nome:'', artista:'', cats:[], tomIg:'', bpm:'', cf:'', yt:'', bateria:'', letra:'', obs:'', confirmados:[] }
// Campos que podem ser confirmados/bloqueados (o resto é identidade da música).
const CONFIRMAVEIS = ['tomIg','bpm','cf','yt','bateria','letra']
const confDe = (m) => Array.isArray(m?.confirmados) ? m.confirmados : (m?.confirmados ? (()=>{try{return JSON.parse(m.confirmados)}catch{return[]}})() : [])
// Status de confirmação: 'completo' (verde) = TODOS os campos confirmados;
// 'parcial' (amarelo) = pelo menos um confirmado, mas ainda falta algum;
// 'nenhum' = nada confirmado. Verde só quando cada botãozinho foi marcado.
const statusMus = (m) => {
  const conf = confDe(m)
  const confirmados = CONFIRMAVEIS.filter(k => conf.includes(k)).length
  if (confirmados === 0) return 'nenhum'
  if (confirmados >= CONFIRMAVEIS.length) return 'completo'
  return 'parcial'
}

export default function Musicas() {
  const { state, dispatch } = useStore()
  const { musicas, user } = state
  const [q, setQ] = useState('')
  const [catFiltro, setCatFiltro] = useState(null)  // filtro por categoria (null = todas)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [aberta, setAberta] = useState(null)
  const [loading, setLoading] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [sugestoes, setSugestoes] = useState([])
  const [geniusUrl, setGeniusUrl] = useState(null)
  const timerRef = useRef(null)

  // A busca também procura dentro da letra: escrever "cura" acha as músicas
  // que falam de cura, mesmo que a palavra não esteja no título.
  const alvo = normalizar(q)
  const noTitulo = (m) => normalizar(m.nome).includes(alvo) || normalizar(m.artista || '').includes(alvo)
  const naLetra = (m) => normalizar(m.letra || '').includes(alvo)

  const catsDe = (m) => (Array.isArray(m.cat) ? m.cat : (m.cat ? [m.cat] : []))
  const lista = (musicas || []).filter(m =>
    (!q || noTitulo(m) || naLetra(m)) &&
    (!catFiltro || catsDe(m).includes(catFiltro))
  )

  // Primeira linha da letra que contém a palavra — a música aparece uma vez só,
  // por mais que a palavra se repita nela.
  const trechoDaLetra = (m) => {
    if (!q || noTitulo(m) || !m.letra) return ''
    const linha = String(m.letra).split('\n').find(l => normalizar(l).includes(alvo))
    return linha ? linha.trim() : ''
  }

  const buscarVagalume = (nome) => {
    clearTimeout(timerRef.current)
    setSugestoes([])
    if (nome.length < 3) return
    timerRef.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(nome)}&entity=song&limit=10&country=br`)
        const d = await r.json()
        setSugestoes((d.results || []).slice(0, 8))
      } catch(e) { console.error('Busca falhou:', e) }
      setBuscando(false)
    }, 600)
  }

  const buscarTudo = async (nome, artista) => {
    if (!nome) return
    setBuscando(true)
    try {
      const params = new URLSearchParams({ nome, artista: artista || '' })
      const r = await fetch(`/api/buscar-musica?${params}`)
      const d = await r.json()
      // Nunca sobrescreve um campo já CONFIRMADO. BPM não é mais automático.
      const conf = form.confirmados || []
      const updates = {}
      if (d.lyrics && !conf.includes('letra')) updates.letra = d.lyrics
      if (d.yt && !conf.includes('yt')) updates.yt = d.yt
      if (d.cf && !conf.includes('cf')) updates.cf = d.cf
      if (d.bat && !conf.includes('bateria')) updates.bateria = d.bat
      if (Object.keys(updates).length) {
        setForm(f => ({ ...f, ...updates }))
        const msgs = []
        if (updates.letra) msgs.push('letra')
        if (updates.yt) msgs.push('YouTube')
        if (updates.cf) msgs.push('cifra')
        if (updates.bateria) msgs.push('bateria')
        dispatch({ type:'TOAST', value:`✅ Carregado: ${msgs.join(' + ')}! (confira e confirme)` })
      } else {
        dispatch({ type:'TOAST', value:'⚠ Nada novo encontrado (ou campos já confirmados). Ajuste manualmente.' })
      }
    } catch { dispatch({ type:'TOAST', value:'⚠ Erro ao buscar.' }) }
    setBuscando(false)
  }

  const selMus = async (x) => {
    const nome = x.nome || x.trackName || ''
    const artista = x.artista || x.artistName || ''
    setForm(f => ({ ...f, nome, artista }))
    setSugestoes([])
    setGeniusUrl(null)
    await buscarTudo(nome, artista)
  }

  const toggleCat = (cat) => setForm(f => ({ ...f, cats: f.cats.includes(cat) ? f.cats.filter(c=>c!==cat) : [...f.cats, cat] }))

  const abrirNova = () => { setForm(empty); setEditId(null); setSugestoes([]); setGeniusUrl(null); setModal(true) }

  const abrirEditar = (m) => {
    setForm({ nome:m.nome||'', artista:m.artista||'', cats:Array.isArray(m.cat)?m.cat:(m.cat?[m.cat]:[]), tomIg:m.tomIg||m.tom_ig||'', bpm:m.bpm||'', cf:m.cf||m.cifra||'', yt:m.yt||'', bateria:m.bateria||'', letra:m.letra||'', obs:m.obs||'', confirmados:confDe(m) })
    setEditId(m.id); setSugestoes([]); setModal(true)
  }

  const confFld = (k) => (form.confirmados||[]).includes(k)
  const toggleConf = (k) => setForm(f => {
    const cur = f.confirmados||[]
    return { ...f, confirmados: cur.includes(k) ? cur.filter(x=>x!==k) : [...cur, k] }
  })
  // Botão de confirmar/bloquear um campo. Confirmado = verde + cadeado; a busca
  // automática não sobrescreve e o campo fica travado até destravar.
  const Trava = ({ k }) => (
    <button type="button" onClick={()=>toggleConf(k)}
      title={confFld(k)?'Confirmado e bloqueado — toque para liberar edição':'Confirmar que está certo (bloqueia e protege da busca automática)'}
      style={{fontSize:10,fontWeight:700,cursor:'pointer',borderRadius:99,padding:'2px 9px',fontFamily:'inherit',border:'1px solid',whiteSpace:'nowrap',
        ...(confFld(k)?{background:'rgba(52,179,122,.15)',borderColor:'var(--grn)',color:'var(--grn)'}:{background:'transparent',borderColor:'var(--bd)',color:'var(--g)'})}}>
      {confFld(k)?'🔒 confirmado':'confirmar'}
    </button>
  )

  const salvar = async () => {
    if (!form.nome) { dispatch({ type:'TOAST', value:'⚠ Informe o nome.' }); return }
    // Verifica duplicata (ignora a própria música ao editar)
    const duplicata = (musicas||[]).find(m => m.id !== editId && normalizar(m.nome) === normalizar(form.nome))
    if (duplicata) { dispatch({ type:'TOAST', value:`⚠ Já existe uma música com esse nome: "${duplicata.nome}".` }); return }
    setLoading(true)
    const row = { nome:form.nome, artista:form.artista, cat:JSON.stringify(form.cats), tom_ig:form.tomIg, bpm:form.bpm||null, cifra:form.cf, yt:form.yt, bateria:form.bateria||null, letra:form.letra, obs:form.obs, confirmados:JSON.stringify(form.confirmados||[]) }
    const localExtra = { cat:form.cats, tomIg:form.tomIg, cf:form.cf, confirmados:form.confirmados||[] }
    if (editId) {
      await dbUpdate('musicas', editId, row)
      dispatch({ type:'SET', key:'musicas', value:(musicas||[]).map(m=>m.id===editId?{...m,...row,...localExtra}:m) })
      dispatch({ type:'TOAST', value:'✅ Música atualizada!' })
    } else {
      const novo = await dbInsert('musicas', row)
      dispatch({ type:'SET', key:'musicas', value:[...(musicas||[]), {...(novo||{id:Date.now()}),...row,...localExtra}] })
      dispatch({ type:'TOAST', value:'🎵 Música adicionada!' })
    }
    setLoading(false); setModal(false); setForm(empty); setEditId(null); setSugestoes([])
  }

  const excluir = async (id, nome) => {
    const ok = await podeExcluirOuSolicitar(user, dispatch, { tabela:'musicas', registroId:id, descricao:`Excluir música "${nome}"` })
    if (!ok) return
    await dbDelete('musicas', id, nome)
    dispatch({ type:'SET', key:'musicas', value:(musicas||[]).filter(m=>m.id!==id) })
    dispatch({ type:'TOAST', value:'🗑 Removida.' })
  }

  return (
    <div>
      <SecHeader title="Repertório" actions={isGestorLouvor(user) && <Btn onClick={abrirNova}><Plus size={15}/> Adicionar</Btn>} />
      <input placeholder="🔍 Buscar por título, artista ou palavra da letra..." value={q} onChange={e=>setQ(e.target.value)} style={{marginBottom:8}} />
      <div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:12}}>
        {[['', 'Todas'], ...CATS.map(c=>[c,c])].map(([val,label])=>{
          const sel = (val==='' && !catFiltro) || catFiltro===val
          return (
            <button key={label} onClick={()=>setCatFiltro(val||null)} style={{
              padding:'6px 12px',borderRadius:99,fontSize:12.5,cursor:'pointer',
              border:`1px solid ${sel?'var(--cy)':'var(--bd)'}`,
              background:sel?'var(--cdim)':'var(--s1)',color:sel?'var(--cy)':'var(--gl)',fontWeight:sel?600:400,
            }}>{label}</button>
          )
        })}
      </div>
      {q && (
        <div style={{fontSize:11,color:'var(--g)',marginBottom:12}}>
          {lista.length === 0 ? 'Nada encontrado' : `${lista.length} ${lista.length === 1 ? 'música' : 'músicas'}`}
          {lista.length > 0 && (() => {
            const naLetraSo = lista.filter(m => trechoDaLetra(m)).length
            return naLetraSo ? ` · ${naLetraSo} ${naLetraSo === 1 ? 'achada' : 'achadas'} pela letra` : ''
          })()}
        </div>
      )}
      {!q && <div style={{marginBottom:14}} />}
      {lista.length===0 ? <Empty icon="🎼" text="Nenhuma música cadastrada." /> : lista.map(m => {
        const st = statusMus(m)
        const stCor = st==='completo'?'var(--grn)':st==='parcial'?'var(--yel)':'var(--bd)'
        const stTitulo = st==='completo'?'Tudo confirmado — música pronta':st==='parcial'?'Em construção — alguns campos confirmados':'Nada confirmado ainda'
        return (
        <div key={m.id}>
          <div onClick={()=>setAberta(aberta===m.id?null:m.id)} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderLeft:`3px solid ${stCor}`,borderRadius:aberta===m.id?'10px 10px 0 0':'10px',padding:'12px 14px',cursor:'pointer',marginBottom:aberta===m.id?0:8}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:'var(--w)',display:'flex',alignItems:'center',gap:7}}>
                  <span title={stTitulo} style={{width:9,height:9,borderRadius:99,flexShrink:0,background:st==='nenhum'?'var(--g)':stCor}} />{m.nome}
                </div>
                <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',marginTop:4}}>
                  <span style={{fontSize:11,color:'var(--g)'}}>{m.artista||'—'}</span>
                  {m.tomIg && <span style={{fontSize:11,color:'var(--cy)',fontWeight:600}}>Tom: {m.tomIg}</span>}
                  {m.bpm && <span style={{fontSize:11,color:'var(--yel)',fontWeight:600}}>{m.bpm} BPM</span>}
                  {(Array.isArray(m.cat)?m.cat:[m.cat]).filter(Boolean).map(c=><Tag key={c} color="gray">{c}</Tag>)}
                </div>
                {(() => {
                  const t = trechoDaLetra(m)
                  if (!t) return null
                  return (
                    <div style={{fontSize:11,color:'var(--cy)',marginTop:5,fontStyle:'italic',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
                      title={t}>🔎 na letra: “{t}”</div>
                  )
                })()}
              </div>
              <div style={{display:'flex',gap:5,flexShrink:0}}>
                {m.yt && <a href={m.yt} target="_blank" rel="noopener" onClick={e=>e.stopPropagation()} style={{display:'inline-flex',alignItems:'center',padding:'3px 7px',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--gl)',textDecoration:'none',fontSize:11}}>▶</a>}
                {m.cf && <a href={m.cf} target="_blank" rel="noopener" onClick={e=>e.stopPropagation()} title="Cifra" style={{display:'inline-flex',alignItems:'center',padding:'3px 7px',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--gl)',textDecoration:'none',fontSize:11}}>🎸</a>}
                {m.bateria && <a href={m.bateria} target="_blank" rel="noopener" onClick={e=>e.stopPropagation()} title="Bateria — ritmo da música" style={{display:'inline-flex',alignItems:'center',padding:'3px 7px',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--gl)',textDecoration:'none',fontSize:11}}>🥁</a>}
                {isGestorLouvor(user) && <Btn variant="outline" size="xs" onClick={e=>{e.stopPropagation();abrirEditar(m)}}><Pencil size={14}/></Btn>}
                {isGestorLouvor(user) && <Btn variant="danger" size="xs" onClick={e=>{e.stopPropagation();excluir(m.id, m.nome)}}><Trash2 size={14}/></Btn>}
              </div>
            </div>
          </div>
          {aberta===m.id && (
            <div style={{background:'var(--s2)',border:'1px solid var(--bd)',borderTop:'none',borderRadius:'0 0 10px 10px',padding:14,marginBottom:8}}>
              {m.letra ? <pre style={{fontSize:12,lineHeight:1.9,color:'var(--tx)',whiteSpace:'pre-wrap',maxHeight:260,overflowY:'auto',fontFamily:'inherit'}}>{m.letra}</pre> : <div style={{color:'var(--g)',fontSize:12}}>Sem letra cadastrada.</div>}
              {m.obs && <div style={{fontSize:11,color:'var(--g)',marginTop:5}}>{m.obs}</div>}
            </div>
          )}
        </div>
      )})}

      {modal && (
        <Modal title={editId ? 'Editar Música' : 'Adicionar Música'} onClose={()=>{setModal(false);setSugestoes([]);setEditId(null)}} wide
          footer={<><Btn variant="outline" onClick={()=>{setModal(false);setSugestoes([]);setEditId(null)}}>Cancelar</Btn><Btn onClick={salvar} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <FormGrid>
            <FG full style={{position:'relative'}}>
              <label>Nome da Música {buscando && <span style={{color:'var(--cy)',fontWeight:'normal',textTransform:'none',letterSpacing:0}}> 🔍 buscando...</span>}</label>
              <input value={form.nome} onChange={e=>{setForm({...form,nome:e.target.value});buscarVagalume(e.target.value)}} placeholder="Digite para buscar automaticamente..." />
              {sugestoes.length>0 && (
                <div style={{position:'absolute',top:'100%',left:0,right:0,background:'var(--s2)',border:'1px solid var(--cy)',borderRadius:'0 0 7px 7px',zIndex:200,maxHeight:200,overflowY:'auto'}}>
                  {sugestoes.map((x,i)=>(
                    <div key={i} onClick={()=>selMus(x)} style={{padding:'9px 12px',cursor:'pointer',fontSize:12,borderBottom:'1px solid var(--bd)',color:'var(--tx)'}} onMouseOver={e=>e.currentTarget.style.background='var(--s3)'} onMouseOut={e=>e.currentTarget.style.background=''}>
                      {x.trackName} <span style={{color:'var(--g)'}}>— {x.artistName}</span>
                    </div>
                  ))}
                </div>
              )}
            </FG>
            <FG><label>Artista</label><input value={form.artista} onChange={e=>setForm({...form,artista:e.target.value})} /></FG>
            <FG><label style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:6}}><span>BPM (andamento)</span><Trava k="bpm"/></label><input type="number" min="30" max="250" value={form.bpm} disabled={confFld('bpm')} onChange={e=>setForm({...form,bpm:e.target.value})} placeholder="Digite o BPM" /></FG>
            <FG full>
              <label style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:6}}>
                <span>Link Cifra Club</span>
                <span style={{display:'inline-flex',gap:8,alignItems:'center'}}>{form.cf && <a href={form.cf} target="_blank" rel="noopener" style={{fontSize:10,color:'var(--cy)',textDecoration:'none'}}>🎸 Abrir</a>}<Trava k="cf"/></span>
              </label>
              <input type="url" value={form.cf} disabled={confFld('cf')} onChange={e=>setForm({...form,cf:e.target.value})} placeholder="Preenchido automaticamente ou cole o link..." />
            </FG>
            <FG><label style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:6}}><span>Tom na Igreja</span><Trava k="tomIg"/></label><select value={form.tomIg} disabled={confFld('tomIg')} onChange={e=>setForm({...form,tomIg:e.target.value})}>{TONS.map(t=><option key={t} value={t}>{t||'—'}</option>)}</select></FG>
            <FG full>
              <label style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:6}}>
                <span>Link Bateria (ritmo p/ baterista)</span>
                <span style={{display:'inline-flex',gap:8,alignItems:'center'}}>{form.bateria && <a href={form.bateria} target="_blank" rel="noopener" style={{fontSize:10,color:'var(--cy)',textDecoration:'none'}}>🥁 Abrir</a>}<Trava k="bateria"/></span>
              </label>
              <input type="url" value={form.bateria} disabled={confFld('bateria')} onChange={e=>setForm({...form,bateria:e.target.value})} placeholder="Preenchido automaticamente (Songsterr ou drum cover) ou cole o link..." />
            </FG>
            <FG full>
              <label>Categorias</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginTop:4}}>
                {CATS.map(cat => {
                  const sel = form.cats.includes(cat)
                  return (
                    <label key={cat} onClick={()=>toggleCat(cat)} style={{display:'flex',alignItems:'center',gap:8,padding:'9px 12px',background:sel?'var(--cdim)':'var(--s2)',border:`1px solid ${sel?'var(--cy)':'var(--bd)'}`,borderRadius:7,cursor:'pointer',userSelect:'none'}}>
                      <div style={{width:16,height:16,flexShrink:0,borderRadius:4,border:`2px solid ${sel?'var(--cy)':'var(--g)'}`,background:sel?'var(--cy)':'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {sel && <span style={{color:'#000',fontSize:11,fontWeight:900,lineHeight:1}}>✓</span>}
                      </div>
                      <span style={{fontSize:12,color:sel?'var(--cy)':'var(--tx)',fontWeight:sel?600:400}}>{cat}</span>
                    </label>
                  )
                })}
              </div>
            </FG>
            <FG full>
              <label style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:6}}>
                <span>Link YouTube</span>
                <span style={{display:'inline-flex',gap:8,alignItems:'center'}}>{form.yt && <a href={form.yt} target="_blank" rel="noopener" style={{fontSize:10,color:'var(--cy)',textDecoration:'none'}}>▶ Abrir</a>}<Trava k="yt"/></span>
              </label>
              <input type="url" value={form.yt} disabled={confFld('yt')} onChange={e=>setForm({...form,yt:e.target.value})} />
            </FG>
            <FG full>
              <label style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:6}}>
                <span style={{display:'inline-flex',gap:8,alignItems:'center'}}>Letra <Trava k="letra"/></span>
                {form.nome && !confFld('letra') && (
                  <button
                    type="button"
                    onClick={()=>buscarTudo(form.nome, form.artista)}
                    disabled={buscando}
                    style={{fontSize:11,color:'var(--cy)',background:'none',border:'none',cursor:buscando?'not-allowed':'pointer',fontWeight:600,fontFamily:'inherit',opacity:buscando?.6:1}}
                  >{buscando ? '🔍 Buscando...' : <><Sparkles size={15} style={{verticalAlign:'-3px'}}/> Buscar letra + YouTube + Cifra automaticamente</>}</button>
                )}
              </label>
              <textarea value={form.letra} disabled={confFld('letra')} onChange={e=>setForm({...form,letra:e.target.value})} style={{minHeight:150}} placeholder="Clique em 'Buscar letra automaticamente' ou cole aqui..." />
            </FG>
            <FG full><label>Observações</label><input value={form.obs} onChange={e=>setForm({...form,obs:e.target.value})} /></FG>
          </FormGrid>
        </Modal>
      )}
    </div>
  )
}
