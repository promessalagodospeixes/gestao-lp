import { useState, useRef } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbDelete } from '../lib/supabase.js'
import { isAdmin } from '../lib/utils.js'
import { SecHeader, Btn, Modal, FormGrid, FG, Tag, Empty } from '../components/UI.jsx'

const CATS = ['Adoração','Louvor','Comunhão','Ceia','Ar Livre','Casamento','Aniversário','Missões','Infantil','Outro']
const TONS = ['','A','A#/Bb','B','C','C#/Db','D','D#/Eb','E','F','F#/Gb','G','G#/Ab']
const empty = { nome:'', artista:'', cats:[], tom:'', tomIg:'', cf:'', yt:'', letra:'', obs:'' }

export default function Musicas() {
  const { state, dispatch } = useStore()
  const { musicas, user } = state
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [aberta, setAberta] = useState(null)
  const [loading, setLoading] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [sugestoes, setSugestoes] = useState([])
  const timerRef = useRef(null)

  const lista = q ? musicas.filter(m=>m.nome.toLowerCase().includes(q.toLowerCase())||(m.artista||'').toLowerCase().includes(q.toLowerCase())) : musicas

  const buscarVagalume = (nome) => {
    clearTimeout(timerRef.current)
    setSugestoes([])
    if (nome.length < 3) return
    timerRef.current = setTimeout(() => {
      setBuscando(true)
      const cbName = '_vg_' + Date.now()
      window[cbName] = (d) => {
        setBuscando(false)
        const list = (d.response?.docs || []).slice(0, 8)
        setSugestoes(list)
        delete window[cbName]
        if (script.parentNode) script.parentNode.removeChild(script)
      }
      const script = document.createElement('script')
      script.src = `https://api.vagalume.com.br/search.php?q=${encodeURIComponent(nome)}&apikey=guest&callback=${cbName}`
      script.onerror = () => { setBuscando(false); delete window[cbName] }
      document.head.appendChild(script)
    }, 700)
  }

  const selMus = (x) => {
    setForm(f => ({ ...f, nome: x.title||'', artista: x.artist||'' }))
    setSugestoes([])
    // Buscar letra
    const cbName = '_vgl_' + Date.now()
    window[cbName] = (d) => {
      const letra = d.mus?.[0]?.text
      if (letra) setForm(f => ({ ...f, letra }))
      delete window[cbName]
      if (script.parentNode) script.parentNode.removeChild(script)
    }
    const script = document.createElement('script')
    script.src = `https://api.vagalume.com.br/search.php?musid=${x.id}&artid=${x.artist_id}&apikey=guest&callback=${cbName}`
    document.head.appendChild(script)
  }

  const toggleCat = (cat) => {
    setForm(f => ({ ...f, cats: f.cats.includes(cat) ? f.cats.filter(c=>c!==cat) : [...f.cats, cat] }))
  }

  const salvar = async () => {
    if (!form.nome) { dispatch({ type:'TOAST', value:'⚠ Informe o nome.' }); return }
    setLoading(true)
    const row = { nome:form.nome, artista:form.artista, cat:JSON.stringify(form.cats), tom:form.tom, tom_ig:form.tomIg, cifra:form.cf, yt:form.yt, letra:form.letra, obs:form.obs }
    const novo = await dbInsert('musicas', row)
    dispatch({ type:'SET', key:'musicas', value:[...(musicas||[]), {...(novo||{id:Date.now()}),...row,cat:form.cats,tomIg:form.tomIg,cf:form.cf}] })
    setLoading(false); setModal(false); setForm(empty)
    dispatch({ type:'TOAST', value:'🎵 Música adicionada!' })
  }

  const excluir = async (id) => {
    await dbDelete('musicas', id)
    dispatch({ type:'SET', key:'musicas', value:(musicas||[]).filter(m=>m.id!==id) })
    dispatch({ type:'TOAST', value:'🗑 Removida.' })
  }

  return (
    <div>
      <SecHeader title="REPERTÓRIO" actions={<Btn onClick={()=>{setForm(empty);setSugestoes([]);setModal(true)}}>+ Adicionar</Btn>} />
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
                {isAdmin(user) && <Btn variant="danger" size="xs" onClick={e=>{e.stopPropagation();excluir(m.id)}}>🗑</Btn>}
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
        <Modal title="ADICIONAR MÚSICA" onClose={()=>{setModal(false);setSugestoes([])}} wide
          footer={<><Btn variant="outline" onClick={()=>{setModal(false);setSugestoes([])}}>Cancelar</Btn><Btn onClick={salvar} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <FormGrid>
            <FG full style={{position:'relative'}}>
              <label>Nome da Música {buscando && <span style={{color:'var(--cy)',fontWeight:'normal',textTransform:'none',letterSpacing:0}}> 🔍 buscando...</span>}</label>
              <input value={form.nome} onChange={e=>{setForm({...form,nome:e.target.value});buscarVagalume(e.target.value)}} placeholder="Digite para buscar automaticamente..." />
              {sugestoes.length>0 && (
                <div style={{position:'absolute',top:'100%',left:0,right:0,background:'var(--s2)',border:'1px solid var(--cy)',borderRadius:'0 0 7px 7px',zIndex:200,maxHeight:190,overflowY:'auto'}}>
                  {sugestoes.map((x,i)=>(
                    <div key={i} onClick={()=>selMus(x)} style={{padding:'8px 11px',cursor:'pointer',fontSize:12,borderBottom:'1px solid var(--bd)',color:'var(--tx)'}} onMouseOver={e=>e.currentTarget.style.background='var(--s3)'} onMouseOut={e=>e.currentTarget.style.background=''}>
                      {x.title} <span style={{color:'var(--g)'}}>— {x.artist}</span>
                    </div>
                  ))}
                </div>
              )}
            </FG>
            <FG><label>Artista</label><input value={form.artista} onChange={e=>setForm({...form,artista:e.target.value})} /></FG>
            <FG><label>Tom Original</label><select value={form.tom} onChange={e=>setForm({...form,tom:e.target.value})}>{TONS.map(t=><option key={t} value={t}>{t||'—'}</option>)}</select></FG>
            <FG><label>Tom na Igreja</label><select value={form.tomIg} onChange={e=>setForm({...form,tomIg:e.target.value})}>{TONS.map(t=><option key={t} value={t}>{t||'—'}</option>)}</select></FG>
            <FG full><label>Categorias</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:7,padding:8}}>
                {CATS.map(cat=>(
                  <label key={cat} style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:form.cats.includes(cat)?'var(--cy)':'var(--tx)',cursor:'pointer',padding:'3px 8px',background:form.cats.includes(cat)?'var(--cdim)':'var(--s3)',borderRadius:5,border:`1px solid ${form.cats.includes(cat)?'var(--cy)':'var(--bd)'}`}}>
                    <input type="checkbox" checked={form.cats.includes(cat)} onChange={()=>toggleCat(cat)} style={{accentColor:'var(--cy)'}} /> {cat}
                  </label>
                ))}
              </div>
            </FG>
            <FG full><label>Link Cifra Club</label><input type="url" value={form.cf} onChange={e=>setForm({...form,cf:e.target.value})} /></FG>
            <FG full><label>Link YouTube</label><input type="url" value={form.yt} onChange={e=>setForm({...form,yt:e.target.value})} /></FG>
            <FG full><label>Letra</label><textarea value={form.letra} onChange={e=>setForm({...form,letra:e.target.value})} style={{minHeight:150}} placeholder="Aparece automaticamente ao buscar, ou cole aqui..." /></FG>
            <FG full><label>Observações</label><input value={form.obs} onChange={e=>setForm({...form,obs:e.target.value})} /></FG>
          </FormGrid>
        </Modal>
      )}
    </div>
  )
}
