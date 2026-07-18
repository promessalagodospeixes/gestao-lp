import { useState, useRef } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbUpdate, dbDelete } from '../lib/supabase.js'
import { isAdmin, isGestorLouvor, normalizar } from '../lib/utils.js'
import { podeExcluirOuSolicitar } from '../lib/solicitacoes.js'
import { SecHeader, Btn, Modal, FormGrid, FG, Tag, Empty } from '../components/UI.jsx'
import { Plus, Trash2, Pencil, Sparkles } from 'lucide-react'

const CATS = ['Adoração','Louvor','Comunhão','Ceia','Ar Livre','Casamento','Aniversário','Missões','Infantil','Outro']
const TONS = ['','A','A#/Bb','B','C','C#/Db','D','D#/Eb','E','F','F#/Gb','G','G#/Ab']
const empty = { nome:'', artista:'', cats:[], tom:'', tomIg:'', cf:'', yt:'', letra:'', obs:'' }

export default function Musicas() {
  const { state, dispatch } = useStore()
  const { musicas, user } = state
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [aberta, setAberta] = useState(null)
  const [loading, setLoading] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [sugestoes, setSugestoes] = useState([])
  const [geniusUrl, setGeniusUrl] = useState(null)
  const timerRef = useRef(null)

  const lista = q
    ? musicas.filter(m => normalizar(m.nome).includes(normalizar(q)) || normalizar(m.artista||'').includes(normalizar(q)))
    : musicas

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
      const updates = {}
      if (d.lyrics) updates.letra = d.lyrics
      if (d.yt) updates.yt = d.yt
      if (d.cf) updates.cf = d.cf
      if (Object.keys(updates).length) {
        setForm(f => ({ ...f, ...updates }))
        const msgs = []
        if (d.lyrics) msgs.push('letra')
        if (d.yt) msgs.push('YouTube')
        if (d.cf) msgs.push('cifra')
        dispatch({ type:'TOAST', value:`✅ Carregado automaticamente: ${msgs.join(' + ')}!` })
      } else {
        dispatch({ type:'TOAST', value:'⚠ Letra não encontrada. Cole manualmente.' })
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
    setForm({ nome:m.nome||'', artista:m.artista||'', cats:Array.isArray(m.cat)?m.cat:(m.cat?[m.cat]:[]), tom:m.tom||'', tomIg:m.tomIg||m.tom_ig||'', cf:m.cf||m.cifra||'', yt:m.yt||'', letra:m.letra||'', obs:m.obs||'' })
    setEditId(m.id); setSugestoes([]); setModal(true)
  }

  const salvar = async () => {
    if (!form.nome) { dispatch({ type:'TOAST', value:'⚠ Informe o nome.' }); return }
    // Verifica duplicata (ignora a própria música ao editar)
    const duplicata = (musicas||[]).find(m => m.id !== editId && normalizar(m.nome) === normalizar(form.nome))
    if (duplicata) { dispatch({ type:'TOAST', value:`⚠ Já existe uma música com esse nome: "${duplicata.nome}".` }); return }
    setLoading(true)
    const row = { nome:form.nome, artista:form.artista, cat:JSON.stringify(form.cats), tom:form.tom, tom_ig:form.tomIg, cifra:form.cf, yt:form.yt, letra:form.letra, obs:form.obs }
    if (editId) {
      await dbUpdate('musicas', editId, row)
      dispatch({ type:'SET', key:'musicas', value:(musicas||[]).map(m=>m.id===editId?{...m,...row,cat:form.cats,tomIg:form.tomIg,cf:form.cf}:m) })
      dispatch({ type:'TOAST', value:'✅ Música atualizada!' })
    } else {
      const novo = await dbInsert('musicas', row)
      dispatch({ type:'SET', key:'musicas', value:[...(musicas||[]), {...(novo||{id:Date.now()}),...row,cat:form.cats,tomIg:form.tomIg,cf:form.cf}] })
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
      <SecHeader title="Repertório" actions={<Btn onClick={abrirNova}><Plus size={15}/> Adicionar</Btn>} />
      <input placeholder="🔍 Buscar música..." value={q} onChange={e=>setQ(e.target.value)} style={{marginBottom:14}} />
      {lista.length===0 ? <Empty icon="🎼" text="Nenhuma música cadastrada." /> : lista.map(m => (
        <div key={m.id}>
          <div onClick={()=>setAberta(aberta===m.id?null:m.id)} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:aberta===m.id?'10px 10px 0 0':'10px',padding:'12px 14px',cursor:'pointer',marginBottom:aberta===m.id?0:8}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:'var(--w)'}}>{m.nome}</div>
                <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',marginTop:4}}>
                  <span style={{fontSize:11,color:'var(--g)'}}>{m.artista||'—'}</span>
                  {m.tomIg && <span style={{fontSize:11,color:'var(--cy)',fontWeight:600}}>Tom: {m.tomIg}</span>}
                  {(Array.isArray(m.cat)?m.cat:[m.cat]).filter(Boolean).map(c=><Tag key={c} color="gray">{c}</Tag>)}
                </div>
              </div>
              <div style={{display:'flex',gap:5,flexShrink:0}}>
                {m.yt && <a href={m.yt} target="_blank" rel="noopener" onClick={e=>e.stopPropagation()} style={{display:'inline-flex',alignItems:'center',padding:'3px 7px',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--gl)',textDecoration:'none',fontSize:11}}>▶</a>}
                {m.cf && <a href={m.cf} target="_blank" rel="noopener" onClick={e=>e.stopPropagation()} style={{display:'inline-flex',alignItems:'center',padding:'3px 7px',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--gl)',textDecoration:'none',fontSize:11}}>🎸</a>}
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
      ))}

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
            <FG><label>Tom Original</label><select value={form.tom} onChange={e=>setForm({...form,tom:e.target.value})}>{TONS.map(t=><option key={t} value={t}>{t||'—'}</option>)}</select></FG>
            <FG full>
              <label style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span>Link Cifra Club</span>
                {form.cf && <a href={form.cf} target="_blank" rel="noopener" style={{fontSize:10,color:'var(--cy)',textDecoration:'none'}}>🎸 Abrir cifra</a>}
              </label>
              <input type="url" value={form.cf} onChange={e=>setForm({...form,cf:e.target.value})} placeholder="Preenchido automaticamente ou cole o link..." />
            </FG>
            <FG><label>Tom na Igreja</label><select value={form.tomIg} onChange={e=>setForm({...form,tomIg:e.target.value})}>{TONS.map(t=><option key={t} value={t}>{t||'—'}</option>)}</select></FG>
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
            <FG full><label>Link YouTube</label><input type="url" value={form.yt} onChange={e=>setForm({...form,yt:e.target.value})} /></FG>
            <FG full>
              <label style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:6}}>
                <span>Letra</span>
                {form.nome && (
                  <button
                    type="button"
                    onClick={()=>buscarTudo(form.nome, form.artista)}
                    disabled={buscando}
                    style={{fontSize:11,color:'var(--cy)',background:'none',border:'none',cursor:buscando?'not-allowed':'pointer',fontWeight:600,fontFamily:'inherit',opacity:buscando?.6:1}}
                  >{buscando ? '🔍 Buscando...' : <><Sparkles size={15} style={{verticalAlign:'-3px'}}/> Buscar letra + YouTube + Cifra automaticamente</>}</button>
                )}
              </label>
              <textarea value={form.letra} onChange={e=>setForm({...form,letra:e.target.value})} style={{minHeight:150}} placeholder="Clique em 'Buscar letra automaticamente' ou cole aqui..." />
            </FG>
            <FG full><label>Observações</label><input value={form.obs} onChange={e=>setForm({...form,obs:e.target.value})} /></FG>
          </FormGrid>
        </Modal>
      )}
    </div>
  )
}
