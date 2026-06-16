import { useState, useMemo } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbUpdate, dbDelete } from '../lib/supabase.js'
import { MESES_A, isAdmin } from '../lib/utils.js'
import { podeExcluirOuSolicitar } from '../lib/solicitacoes.js'
import { SecHeader, Btn, Modal, FormGrid, FG, Tag, Empty } from '../components/UI.jsx'

const TIPOS = ['Culto','Igreja Local','Evento Social','Evento Regional','Vigília','Ceia','Entre Amigos','Outro']
const TAG_COLORS = { Culto:'cyan', 'Igreja Local':'orange', Vigília:'yellow', Ceia:'cyan', 'Evento Social':'green', 'Evento Regional':'cyan', 'Entre Amigos':'green', Outro:'gray' }

const MINISTERIOS = [
  '','Igreja Geral','Ministério dos Homens','Ministério das Mulheres','Ministério Jovem',
  'Ministério das Crianças','Ministério de Louvor','Ministério de Intercessão',
  'Escola Bíblica','Convenção Regional','Outro',
]

const empty = { data:'', hora:'', titulo:'', descricao:'', tipo:'Culto', localidade:'', ministerio:'' }

const isLocal    = (tipo) => tipo === 'Igreja Local'
const isRegional = (tipo) => tipo === 'Evento Regional'
const dateColor  = (tipo) => isLocal(tipo) ? '#f97316' : 'var(--cy)'
const dateBg     = (tipo) => isLocal(tipo) ? 'rgba(249,115,22,.1)' : 'var(--cdim)'
const dateBorder = (tipo) => isLocal(tipo) ? '1px solid rgba(249,115,22,.35)' : '1px solid var(--cgl)'

export default function Agenda() {
  const { state, dispatch } = useStore()
  const { agenda, user } = state
  const [modal, setModal]   = useState(false)
  const [form, setForm]     = useState(empty)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filtroTipo, setFiltroTipo]   = useState('')
  const [filtroMin,  setFiltroMin]    = useState('')

  const hoje = new Date(); hoje.setHours(0,0,0,0)

  // ministérios presentes nos dados (para o filtro dinâmico)
  const ministeriosPresentes = useMemo(() => {
    const set = new Set((agenda||[]).map(a => a.ministerio).filter(Boolean))
    return [...set].sort()
  }, [agenda])

  const lista = useMemo(() => {
    let l = [...(agenda||[])].sort((a,b) => a.data.localeCompare(b.data))
    if (filtroTipo) l = l.filter(a => a.tipo === filtroTipo)
    if (filtroMin)  l = l.filter(a => a.ministerio === filtroMin)
    return l
  }, [agenda, filtroTipo, filtroMin])

  const abrir = (ev = null) => {
    if (ev) {
      setForm({ data:ev.data, hora:ev.hora||'', titulo:ev.titulo,
        descricao:ev.desc||ev.descricao||'', tipo:ev.tipo||'Culto',
        localidade:ev.localidade||'', ministerio:ev.ministerio||'' })
      setEditId(ev.id)
    } else {
      setForm({ ...empty, data:new Date().toISOString().slice(0,10) })
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
    await dbDelete('agenda', id)
    dispatch({ type:'SET', key:'agenda', value:(agenda||[]).filter(a=>a.id!==id) })
    dispatch({ type:'TOAST', value:'🗑 Removido.' })
  }

  const chipStyle = (active) => ({
    padding:'4px 11px', borderRadius:99, fontSize:10, fontWeight:600, cursor:'pointer',
    border: active ? '1px solid var(--cy)' : '1px solid var(--bd)',
    background: active ? 'var(--cdim)' : 'transparent',
    color: active ? 'var(--cy)' : 'var(--g)',
    letterSpacing:.5,
  })

  return (
    <div>
      <SecHeader title="AGENDA" actions={isAdmin(user) && <Btn onClick={()=>abrir()}>+ Evento</Btn>} />

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
          return (
            <div key={ev.id} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'11px 0',borderBottom:'1px solid var(--bd)',opacity:passado?.4:1}}>
              <div style={{background:dateBg(ev.tipo),border:dateBorder(ev.tipo),borderRadius:8,padding:'5px 9px',textAlign:'center',flexShrink:0,minWidth:46}}>
                <div style={{fontFamily:'var(--font-display)',fontSize:20,color:dc,lineHeight:1}}>{d.getDate()}</div>
                <div style={{fontSize:8,color:dc,letterSpacing:2,textTransform:'uppercase'}}>{MESES_A[d.getMonth()]} {d.getFullYear()}</div>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  <div style={{fontSize:13,fontWeight:600,color:'var(--w)'}}>{ev.titulo}</div>
                  <Tag color={TAG_COLORS[ev.tipo]||'gray'}>{ev.tipo}</Tag>
                  {ev.ministerio && <Tag color="gray">{ev.ministerio}</Tag>}
                </div>
                <div style={{fontSize:11,color:'var(--g)',marginTop:2}}>
                  {ev.hora?ev.hora+' · ':''}
                  {ev.localidade?<span>📍 {ev.localidade}{(ev.desc||ev.descricao)?' · ':''}</span>:''}
                  {ev.desc||ev.descricao||''}
                </div>
              </div>
              {isAdmin(user) && (
                <div style={{display:'flex',gap:5,flexShrink:0}}>
                  <Btn variant="outline" size="xs" onClick={()=>abrir(ev)}>✏</Btn>
                  <Btn variant="danger" size="xs" onClick={()=>excluir(ev.id, ev.titulo)}>🗑</Btn>
                </div>
              )}
            </div>
          )
        })
      }

      {/* ── Modal ── */}
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
              <select value={form.ministerio} onChange={e=>setForm({...form,ministerio:e.target.value})}>
                {MINISTERIOS.map(m=><option key={m} value={m}>{m||'— nenhum —'}</option>)}
              </select>
            </FG>
            {isRegional(form.tipo) && (
              <FG full>
                <label>Localidade <span style={{fontWeight:400,color:'var(--g)',fontSize:10}}>(onde será realizado)</span></label>
                <input value={form.localidade} onChange={e=>setForm({...form,localidade:e.target.value})} placeholder="Ex: Promessa Mesquita, Niterói..." />
              </FG>
            )}
          </FormGrid>
        </Modal>
      )}
    </div>
  )
}
