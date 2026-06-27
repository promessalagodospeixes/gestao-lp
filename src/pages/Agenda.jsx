import { useState, useMemo } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbUpdate, dbDelete } from '../lib/supabase.js'
import { MESES_A, isAdmin } from '../lib/utils.js'
import { dbInsert } from '../lib/supabase.js'
import { podeExcluirOuSolicitar } from '../lib/solicitacoes.js'
import { SecHeader, Btn, Modal, FormGrid, FG, Tag, Empty } from '../components/UI.jsx'

const TIPOS = ['Igreja Local','Evento Regional']
const TAG_COLORS = { 'Igreja Local':'orange', 'Evento Regional':'cyan' }


const empty = { data:'', hora:'', titulo:'', descricao:'', tipo:'Igreja Local', localidade:'', ministerio:'' }

const isLocal    = (tipo) => tipo === 'Igreja Local'
const isRegional = (tipo) => tipo === 'Evento Regional'
const dateColor  = (tipo) => isLocal(tipo) ? '#f97316' : 'var(--cy)'
const dateBg     = (tipo) => isLocal(tipo) ? 'rgba(249,115,22,.1)' : 'var(--cdim)'
const dateBorder = (tipo) => isLocal(tipo) ? '1px solid rgba(249,115,22,.35)' : '1px solid var(--cgl)'

export default function Agenda() {
  const { state, dispatch } = useStore()
  const { agenda, ministerios, user } = state
  const [modal, setModal]   = useState(false)
  const [form, setForm]     = useState(empty)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroMin,  setFiltroMin]  = useState('')
  const [modalConf, setModalConf]   = useState(null)
  const [confForm, setConfForm]     = useState({ confirmado: null, obs: '' })
  const [novoMin, setNovoMin]       = useState('')
  const [criandoMin, setCriandoMin] = useState(false)

  const criarMinisterio = async () => {
    const nome = novoMin.trim()
    if (!nome) return
    if ((ministerios||[]).find(m => m.nome.toLowerCase() === nome.toLowerCase())) {
      dispatch({ type:'TOAST', value:'⚠ Este ministério já existe.' }); return
    }
    setCriandoMin(true)
    const novo = await dbInsert('ministerios', { nome })
    if (novo) {
      dispatch({ type:'SET', key:'ministerios', value:[...(ministerios||[]), novo].sort((a,b)=>a.nome.localeCompare(b.nome)) })
      setForm(f => ({...f, ministerio: nome}))
      dispatch({ type:'TOAST', value:`✅ Ministério "${nome}" criado!` })
    }
    setNovoMin(''); setCriandoMin(false)
  }

  const hoje = new Date(); hoje.setHours(0,0,0,0)

  // Permissões
  const admin = isAdmin(user)
  const minLider = user?.ministerioLider || null  // ministério que o usuário lidera
  const podeCriar = admin || !!minLider
  const podeGerenciar = (ev) => admin || (minLider && ev.ministerio === minLider)

  const ministeriosPresentes = useMemo(() => {
    const set = new Set((agenda||[]).map(a => a.ministerio).filter(Boolean))
    return [...set].sort()
  }, [agenda, ministerios])

  const lista = useMemo(() => {
    let l = [...(agenda||[])].sort((a,b) => a.data.localeCompare(b.data))
    if (filtroTipo) l = l.filter(a => a.tipo === filtroTipo)
    if (filtroMin)  l = l.filter(a => a.ministerio === filtroMin)
    return l
  }, [agenda, filtroTipo, filtroMin])

  const abrir = (ev = null) => {
    if (ev) {
      setForm({ data:ev.data, hora:ev.hora||'', titulo:ev.titulo,
        descricao:ev.desc||ev.descricao||'', tipo:ev.tipo||'Igreja Local',
        localidade:ev.localidade||'', ministerio:ev.ministerio||'' })
      setEditId(ev.id)
    } else {
      setForm({ ...empty, data:new Date().toISOString().slice(0,10),
        ministerio: minLider || '' })
      setEditId(null)
    }
    setModal(true)
  }

  const salvar = async () => {
    if (!form.titulo || !form.data) { dispatch({ type:'TOAST', value:'⚠ Título e data obrigatórios.' }); return }
    setLoading(true)
    const row = { data:form.data, hora:form.hora, titulo:form.titulo, descricao:form.descricao,
      tipo:form.tipo, localidade:form.localidade||null, ministerio:form.ministerio||null }
    if (editId) {
      await dbUpdate('agenda', editId, row)
      dispatch({ type:'SET', key:'agenda', value:(agenda||[]).map(a => a.id===editId ? {...a,...row,desc:row.descricao} : a) })
      dispatch({ type:'TOAST', value:'✅ Evento atualizado!' })
    } else {
      const novo = await dbInsert('agenda', row)
      dispatch({ type:'SET', key:'agenda', value:[...(agenda||[]), {...(novo||{id:Date.now()}),...row,desc:row.descricao}] })
      dispatch({ type:'TOAST', value:'📅 Evento adicionado!' })
    }
    setLoading(false); setModal(false); setForm(empty); setEditId(null)
  }

  const excluir = async (id, titulo) => {
    const ok = await podeExcluirOuSolicitar(user, dispatch, { tabela:'agenda', registroId:id, descricao:`Excluir evento "${titulo}"` })
    if (!ok) return
    await dbDelete('agenda', id, titulo)
    dispatch({ type:'SET', key:'agenda', value:(agenda||[]).filter(a=>a.id!==id) })
    dispatch({ type:'TOAST', value:'🗑 Removido.' })
  }

  const abrirConf = (ev) => {
    setConfForm({ confirmado: ev.confirmado ?? null, obs: ev.confirmacao_obs || '' })
    setModalConf(ev)
  }

  const salvarConf = async () => {
    if (confForm.confirmado === null) { dispatch({ type:'TOAST', value:'⚠ Selecione se o evento aconteceu.' }); return }
    setLoading(true)
    const row = { confirmado: confForm.confirmado, confirmacao_obs: confForm.obs || null }
    await dbUpdate('agenda', modalConf.id, row)
    dispatch({ type:'SET', key:'agenda', value:(agenda||[]).map(a => a.id===modalConf.id ? {...a,...row} : a) })
    setLoading(false); setModalConf(null)
    dispatch({ type:'TOAST', value:'✅ Confirmação registrada!' })
  }

  const chipStyle = (active) => ({
    padding:'4px 11px', borderRadius:99, fontSize:10, fontWeight:600, cursor:'pointer',
    border: active ? '1px solid var(--cy)' : '1px solid var(--bd)',
    background: active ? 'var(--cdim)' : 'transparent',
    color: active ? 'var(--cy)' : 'var(--g)',
    letterSpacing:.5,
  })

  const confStatus = (ev) => {
    if (ev.confirmado === true)  return { label:'Realizado', color:'var(--grn)', bg:'rgba(34,197,94,.1)' }
    if (ev.confirmado === false) return { label:'Não realizado', color:'var(--red)', bg:'rgba(239,68,68,.1)' }
    return null
  }

  return (
    <div>
      <SecHeader title="AGENDA" actions={podeCriar && <Btn onClick={()=>abrir()}>+ Evento</Btn>} />

      {/* ── Filtros ── */}
      <div style={{marginBottom:14}}>
        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>
          {['','Igreja Local','Evento Regional'].map(t => (
            <button key={t} style={chipStyle(filtroTipo===t)} onClick={()=>setFiltroTipo(t)}>
              {t||'Todos os tipos'}
            </button>
          ))}
        </div>
        {ministeriosPresentes.length > 0 && (
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            <button style={chipStyle(filtroMin==='')} onClick={()=>setFiltroMin('')}>Todos os ministérios</button>
            {ministeriosPresentes.map(m => (
              <button key={m} style={chipStyle(filtroMin===m)} onClick={()=>setFiltroMin(m)}>{m}</button>
            ))}
          </div>
        )}
      </div>

      {/* ── Lista ── */}
      {lista.length===0
        ? <Empty icon="📅" text="Nenhum evento encontrado." />
        : lista.map(ev => {
          const d = new Date(ev.data+'T00:00:00')
          const passado = d < hoje
          const dc = dateColor(ev.tipo)
          const st = confStatus(ev)
          const gerencia = podeGerenciar(ev)
          return (
            <div key={ev.id} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'11px 0',borderBottom:'1px solid var(--bd)',opacity:passado&&!st?.label?0.5:1}}>
              <div style={{background:dateBg(ev.tipo),border:dateBorder(ev.tipo),borderRadius:8,padding:'5px 9px',textAlign:'center',flexShrink:0,minWidth:46}}>
                <div style={{fontFamily:'var(--font-display)',fontSize:20,color:dc,lineHeight:1}}>{d.getDate()}</div>
                <div style={{fontSize:8,color:dc,letterSpacing:2,textTransform:'uppercase'}}>{MESES_A[d.getMonth()]} {d.getFullYear()}</div>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  <div style={{fontSize:13,fontWeight:600,color:'var(--w)'}}>{ev.titulo}</div>
                  <Tag color={TAG_COLORS[ev.tipo]||'gray'}>{ev.tipo}</Tag>
                  {ev.ministerio && <Tag color="gray">{ev.ministerio}</Tag>}
                  {st && <span style={{fontSize:9,fontWeight:700,color:st.color,background:st.bg,padding:'2px 7px',borderRadius:99}}>{st.label}</span>}
                </div>
                <div style={{fontSize:11,color:'var(--g)',marginTop:2}}>
                  {ev.hora?ev.hora+' · ':''}
                  {ev.localidade?<span>📍 {ev.localidade}{(ev.desc||ev.descricao)?' · ':''}</span>:''}
                  {ev.desc||ev.descricao||''}
                </div>
                {ev.confirmado === false && ev.confirmacao_obs && (
                  <div style={{fontSize:10,color:'var(--red)',marginTop:3}}>Motivo: {ev.confirmacao_obs}</div>
                )}
                {ev.confirmado === true && ev.confirmacao_obs && (
                  <div style={{fontSize:10,color:'var(--grn)',marginTop:3}}>{ev.confirmacao_obs}</div>
                )}
              </div>
              {gerencia && (
                <div style={{display:'flex',flexDirection:'column',gap:4,flexShrink:0,alignItems:'flex-end'}}>
                  <div style={{display:'flex',gap:4}}>
                    <Btn variant="outline" size="xs" onClick={()=>abrir(ev)}>✏</Btn>
                    <Btn variant="danger" size="xs" onClick={()=>excluir(ev.id, ev.titulo)}>🗑</Btn>
                  </div>
                  {passado && (
                    <Btn variant={ev.confirmado===true?'green':ev.confirmado===false?'danger':'outline'} size="xs"
                      onClick={()=>abrirConf(ev)}>
                      {ev.confirmado===true?'✅ Realizado':ev.confirmado===false?'❌ Não realizado':'📋 Confirmar'}
                    </Btn>
                  )}
                </div>
              )}
            </div>
          )
        })
      }

      {/* ── Modal criar/editar ── */}
      {modal && (
        <Modal title={editId ? 'EDITAR EVENTO' : 'NOVO EVENTO'} onClose={()=>setModal(false)}
          footer={<><Btn variant="outline" onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={salvar} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <FormGrid>
            <FG><label>Data</label><input type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})} /></FG>
            <FG><label>Horário</label><input type="time" value={form.hora} onChange={e=>setForm({...form,hora:e.target.value})} /></FG>
            <FG full><label>Título</label><input value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})} /></FG>
            <FG full><label>Descrição</label><textarea value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})} /></FG>
            <FG>
              <label>Tipo</label>
              <select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}>
                {TIPOS.map(t=><option key={t}>{t}</option>)}
              </select>
            </FG>
            <FG>
              <label>Ministério organizador</label>
              {minLider && !admin
                ? <input value={minLider} readOnly style={{background:'var(--s2)',opacity:.7,cursor:'not-allowed'}} />
                : <>
                    <select value={form.ministerio} onChange={e=>{ if(e.target.value==='__novo__'){setNovoMin('');setForm(f=>({...f,ministerio:'__novo__'}))} else setForm(f=>({...f,ministerio:e.target.value})) }}>
                      <option value="">— nenhum —</option>
                      {(ministerios||[]).map(m=><option key={m.id} value={m.nome}>{m.nome}</option>)}
                      {admin && <option value="__novo__">+ Criar novo ministério...</option>}
                    </select>
                    {form.ministerio === '__novo__' && (
                      <div style={{display:'flex',gap:6,marginTop:6}}>
                        <input value={novoMin} onChange={e=>setNovoMin(e.target.value)} placeholder="Nome do novo ministério..." style={{flex:1}} onKeyDown={e=>e.key==='Enter'&&criarMinisterio()} />
                        <button onClick={criarMinisterio} disabled={criandoMin} style={{padding:'6px 12px',background:'var(--cy)',color:'#000',border:'none',borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:12}}>{criandoMin?'...':'Criar'}</button>
                      </div>
                    )}
                  </>
              }
            </FG>
            {isRegional(form.tipo) && (
              <FG full>
                <label>Localidade</label>
                <input value={form.localidade} onChange={e=>setForm({...form,localidade:e.target.value})} placeholder="Ex: Promessa Mesquita, Niterói..." />
              </FG>
            )}
          </FormGrid>
        </Modal>
      )}

      {/* ── Modal confirmação ── */}
      {modalConf && (
        <Modal title={`CONFIRMAR — ${modalConf.titulo}`} onClose={()=>setModalConf(null)}
          footer={<><Btn variant="outline" onClick={()=>setModalConf(null)}>Cancelar</Btn><Btn onClick={salvarConf} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:12,color:'var(--g)',letterSpacing:1}}>O EVENTO ACONTECEU?</label>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <Btn variant={confForm.confirmado===true?'green':'outline'} onClick={()=>setConfForm(f=>({...f,confirmado:true}))}>
                ✅ Sim, aconteceu
              </Btn>
              <Btn variant={confForm.confirmado===false?'danger':'outline'} onClick={()=>setConfForm(f=>({...f,confirmado:false}))}>
                ❌ Não aconteceu
              </Btn>
            </div>
          </div>
          <FG full>
            <label>{confForm.confirmado===false ? 'Por que não aconteceu?' : 'Como foi o evento? (opcional)'}</label>
            <textarea value={confForm.obs} onChange={e=>setConfForm(f=>({...f,obs:e.target.value}))}
              placeholder={confForm.confirmado===false ? 'Descreva o motivo...' : 'Registre aqui como foi o evento, participação, observações...'} />
          </FG>
        </Modal>
      )}
    </div>
  )
}
