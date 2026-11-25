import { useState, useMemo } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbUpdate, dbDelete } from '../lib/supabase.js'
import { MESES, MESES_A, DIAS, isAdmin } from '../lib/utils.js'
import { podeExcluirOuSolicitar } from '../lib/solicitacoes.js'
import { uploadFotoSite } from '../lib/fotoSite.js'
import { SecHeader, Btn, Modal, FormGrid, FG, Tag, Empty } from '../components/UI.jsx'
import { Plus, Pencil, Trash2, FileDown, MessageCircle, Printer, Check } from 'lucide-react'

const TIPOS = ['Igreja Local','Evento Regional']
const TAG_COLORS = { 'Igreja Local':'orange', 'Evento Regional':'cyan' }


const empty = { data:'', hora:'', titulo:'', descricao:'', tipo:'Igreja Local', localidade:'', ministerio:'', link:'', capa:'' }

// Filtro compacto que abre um painel ao clicar (fecha ao tocar fora).
function FiltroMenu({ label, resumo, ativo, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position:'relative' }}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        display:'inline-flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:9,
        fontSize:12, fontWeight:600, cursor:'pointer', background:'var(--s1)',
        border:`1px solid ${ativo?'var(--cy)':'var(--bd)'}`, color:ativo?'var(--cy)':'var(--gl)',
      }}>
        <span style={{ color:'var(--g)', fontWeight:500 }}>{label}:</span> {resumo}
        <span style={{ fontSize:10, opacity:.8 }}>▾</span>
      </button>
      {open && (<>
        <div onClick={()=>setOpen(false)} style={{ position:'fixed', inset:0, zIndex:40 }} />
        <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:41, background:'var(--s1)',
          border:'1px solid var(--bd)', borderRadius:11, padding:12, minWidth:235, maxWidth:300,
          maxHeight:'min(60vh,380px)', overflowY:'auto', boxShadow:'0 20px 50px -20px rgba(0,0,0,.7)' }}>
          {children}
        </div>
      </>)}
    </div>
  )
}
// Linha com caixinha de marcar (sem checkbox nativo, para combinar com o tema).
function CaixaLinha({ label, checked, onClick }) {
  return (
    <div onClick={onClick} style={{ display:'flex', alignItems:'center', gap:9, padding:'6px 3px', cursor:'pointer', fontSize:12.5, color:'var(--tx)' }}>
      <span style={{ width:17, height:17, borderRadius:5, flexShrink:0, border:`1.5px solid ${checked?'var(--cy)':'var(--bd)'}`,
        background:checked?'var(--cy)':'transparent', display:'flex', alignItems:'center', justifyContent:'center',
        color:'#04211f', fontSize:12, fontWeight:900 }}>{checked?'✓':''}</span>
      {label}
    </div>
  )
}

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
  const [selTipos, setSelTipos] = useState([])   // [] = todos os tipos
  const [selMins,  setSelMins]  = useState([])   // [] = todos os ministérios
  const [dataModo, setDataModo] = useState('todas') // todas|esteMes|prox3|ult3|mes|periodo
  const [dataMes,  setDataMes]  = useState(new Date().toISOString().slice(0,7))
  const [dataDe,   setDataDe]   = useState('')
  const [dataAte,  setDataAte]  = useState('')
  const toggleArr = (arr, setArr, v) => setArr(arr.includes(v) ? arr.filter(x=>x!==v) : [...arr, v])
  const [modalConf, setModalConf]   = useState(null)
  const [confForm, setConfForm]     = useState({ confirmado: null, obs: '' })
  const [novoMin, setNovoMin]       = useState('')
  const [criandoMin, setCriandoMin] = useState(false)
  const [modalConflito, setModalConflito] = useState(null) // eventos em conflito antes de salvar
  const [modalRelatorio, setModalRelatorio] = useState(false)
  const [modalEnviar, setModalEnviar] = useState(false)
  const anoAtual = new Date().getFullYear()
  const [relAno, setRelAno] = useState(anoAtual)
  const [relMeses, setRelMeses] = useState([]) // [] = todos
  const [relMins, setRelMins]   = useState([]) // [] = todos
  const [relTipos, setRelTipos] = useState([]) // [] = todos
  const [envAno, setEnvAno] = useState(anoAtual)
  const [envMeses, setEnvMeses] = useState([new Date().getMonth()]) // mês atual
  const [envMins, setEnvMins]   = useState([]) // [] = todos
  const [copiado, setCopiado]   = useState(false)

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

  // Intervalo de datas conforme o modo escolhido ([de, até] em 'aaaa-mm-dd', ou null).
  const [dDe, dAte] = useMemo(() => {
    const h = new Date(); h.setHours(0,0,0,0)
    const iso = (d) => d.toLocaleDateString('sv')
    if (dataModo === 'esteMes') return [iso(new Date(h.getFullYear(), h.getMonth(), 1)), iso(new Date(h.getFullYear(), h.getMonth()+1, 0))]
    if (dataModo === 'prox3')   { const a = new Date(h); a.setMonth(a.getMonth()+3); return [iso(h), iso(a)] }
    if (dataModo === 'ult3')    { const d = new Date(h); d.setMonth(d.getMonth()-3); return [iso(d), iso(h)] }
    if (dataModo === 'mes' && dataMes) { const [y,m] = dataMes.split('-').map(Number); return [iso(new Date(y, m-1, 1)), iso(new Date(y, m, 0))] }
    if (dataModo === 'periodo') return [dataDe || null, dataAte || null]
    return [null, null]
  }, [dataModo, dataMes, dataDe, dataAte])

  const lista = useMemo(() => {
    let l = [...(agenda||[])].sort((a,b) => a.data.localeCompare(b.data))
    if (selTipos.length) l = l.filter(a => selTipos.includes(a.tipo))
    if (selMins.length)  l = l.filter(a => selMins.includes(a.ministerio))
    if (dDe) l = l.filter(a => a.data >= dDe)
    if (dAte) l = l.filter(a => a.data <= dAte)
    return l
  }, [agenda, selTipos, selMins, dDe, dAte])

  const abrir = (ev = null) => {
    if (ev) {
      setForm({ data:ev.data, hora:ev.hora||'', titulo:ev.titulo,
        descricao:ev.desc||ev.descricao||'', tipo:ev.tipo||'Igreja Local',
        localidade:ev.localidade||'', ministerio:ev.ministerio||'',
        link:ev.link||'', capa:ev.capa||'' })
      setEditId(ev.id)
    } else {
      setForm({ ...empty, data:new Date().toLocaleDateString('sv'),
        ministerio: minLider || '' })
      setEditId(null)
    }
    setModal(true)
  }

  const salvar = async (forcar = false) => {
    // O onClick passa o evento de clique como argumento — só é "forçar" se for true literal
    forcar = forcar === true
    if (!form.titulo || !form.data) { dispatch({ type:'TOAST', value:'⚠ Título e data obrigatórios.' }); return }
    // Verifica conflito de data apenas para novos eventos
    if (!editId && !forcar) {
      const conflitos = (agenda||[]).filter(a => a.data === form.data)
      if (conflitos.length > 0) {
        setModalConflito(conflitos)
        return
      }
    }
    setLoading(true)
    const row = { data:form.data, hora:form.hora, titulo:form.titulo, descricao:form.descricao,
      tipo:form.tipo, localidade:form.localidade||null, ministerio:form.ministerio||null,
      link:form.link||null, capa:form.capa||null }
    if (editId) {
      await dbUpdate('agenda', editId, row)
      dispatch({ type:'SET', key:'agenda', value:(agenda||[]).map(a => a.id===editId ? {...a,...row,desc:row.descricao} : a) })
      dispatch({ type:'TOAST', value:'✅ Evento atualizado!' })
    } else {
      const novo = await dbInsert('agenda', row)
      dispatch({ type:'SET', key:'agenda', value:[...(agenda||[]), {...(novo||{id:Date.now()}),...row,desc:row.descricao}] })
      dispatch({ type:'TOAST', value:'📅 Evento adicionado!' })
    }
    setLoading(false); setModal(false); setModalConflito(null); setForm(empty); setEditId(null)
  }

  const gerarTextoAgenda = (meses, ano, mins) => {
    let eventos = (agenda||[])
      .filter(a => {
        const d = new Date(a.data+'T00:00:00')
        if (d.getFullYear() !== ano) return false
        if (meses.length && !meses.includes(d.getMonth())) return false
        if (mins.length && !mins.includes(a.ministerio)) return false
        return true
      })
      .sort((a,b) => a.data.localeCompare(b.data))
    if (!eventos.length) return '(Nenhum evento encontrado)'
    let texto = `📅 AGENDA — PROMESSA LAGO DOS PEIXES\n`
    if (meses.length === 1) texto += `${MESES[meses[0]].toUpperCase()} ${ano}\n`
    else texto += `${ano}\n`
    texto += `─────────────────────\n`
    let mesAtual = -1
    eventos.forEach(ev => {
      const d = new Date(ev.data+'T00:00:00')
      const m = d.getMonth()
      if (m !== mesAtual) {
        texto += `\n📌 ${MESES[m].toUpperCase()}\n`
        mesAtual = m
      }
      const dia = String(d.getDate()).padStart(2,'0')
      const diaSem = DIAS[d.getDay()]
      texto += `• ${dia}/${String(m+1).padStart(2,'0')} (${diaSem})`
      if (ev.hora) texto += ` às ${ev.hora}`
      texto += ` — ${ev.titulo}`
      if (ev.ministerio) texto += ` [${ev.ministerio}]`
      if (ev.localidade) texto += ` 📍${ev.localidade}`
      texto += '\n'
    })
    texto += `\n_Promessa Lago dos Peixes_`
    return texto
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

  const confStatus = (ev) => {
    if (ev.confirmado === true)  return { label:'Realizado', color:'var(--grn)', bg:'rgba(34,197,94,.1)' }
    if (ev.confirmado === false) return { label:'Não realizado', color:'var(--red)', bg:'rgba(239,68,68,.1)' }
    return null
  }

  return (
    <div>
      <SecHeader title="Agenda" actions={
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {admin && <Btn variant="outline" size="sm" onClick={()=>setModalRelatorio(true)}><FileDown size={15}/> Relatório</Btn>}
          {admin && <Btn variant="outline" size="sm" onClick={()=>setModalEnviar(true)}><MessageCircle size={14}/> Enviar</Btn>}
          {podeCriar && <Btn onClick={()=>abrir()}><Plus size={15}/> Evento</Btn>}
        </div>
      } />

      {/* ── Filtros compactos ── */}
      {(() => {
        const nTM = selTipos.length + selMins.length
        const resumoTM = nTM === 0 ? 'Todos' : nTM === 1 ? [...selTipos, ...selMins][0] : `${nTM} selecionados`
        const resumoData = dataModo==='todas' ? 'Todas'
          : dataModo==='esteMes' ? 'Este mês'
          : dataModo==='prox3' ? 'Próx. 3 meses'
          : dataModo==='ult3' ? 'Últ. 3 meses'
          : dataModo==='mes' ? (dataMes ? `${MESES_A[Number(dataMes.slice(5,7))-1]}/${dataMes.slice(0,4)}` : 'Mês')
          : (dataDe || dataAte) ? `${dataDe?dataDe.split('-').reverse().slice(0,2).join('/'):'…'}–${dataAte?dataAte.split('-').reverse().slice(0,2).join('/'):'…'}` : 'Período'
        const linkLimpar = { background:'none', border:'none', color:'var(--cy)', cursor:'pointer', fontSize:11, padding:0, marginTop:8, textAlign:'left' }
        return (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:14 }}>
            {/* Tipo / Ministério */}
            <FiltroMenu label="Tipo / Ministério" resumo={resumoTM} ativo={nTM>0}>
              <div style={{ fontSize:9.5, color:'var(--g)', letterSpacing:1.5, textTransform:'uppercase', marginBottom:3 }}>Tipo</div>
              {TIPOS.map(t => <CaixaLinha key={t} label={t} checked={selTipos.includes(t)} onClick={()=>toggleArr(selTipos,setSelTipos,t)} />)}
              {ministeriosPresentes.length > 0 && <>
                <div style={{ height:1, background:'var(--bd)', margin:'8px 0' }} />
                <div style={{ fontSize:9.5, color:'var(--g)', letterSpacing:1.5, textTransform:'uppercase', marginBottom:3 }}>Ministério</div>
                {ministeriosPresentes.map(m => <CaixaLinha key={m} label={m} checked={selMins.includes(m)} onClick={()=>toggleArr(selMins,setSelMins,m)} />)}
              </>}
              {nTM > 0 && <button style={linkLimpar} onClick={()=>{ setSelTipos([]); setSelMins([]) }}>Limpar seleção</button>}
            </FiltroMenu>

            {/* Data */}
            <FiltroMenu label="Data" resumo={resumoData} ativo={dataModo!=='todas'}>
              {[['todas','Todas as datas'],['esteMes','Este mês'],['prox3','Próximos 3 meses'],['ult3','Últimos 3 meses'],['mes','Mês específico'],['periodo','Período personalizado']].map(([k,txt]) => (
                <div key={k} onClick={()=>setDataModo(k)} style={{ display:'flex', alignItems:'center', gap:9, padding:'6px 3px', cursor:'pointer', fontSize:12.5, color:'var(--tx)' }}>
                  <span style={{ width:15, height:15, borderRadius:99, flexShrink:0, border:`1.5px solid ${dataModo===k?'var(--cy)':'var(--bd)'}`, background:dataModo===k?'var(--cy)':'transparent' }} />
                  {txt}
                </div>
              ))}
              {dataModo === 'mes' && (
                <input type="month" value={dataMes} onChange={e=>setDataMes(e.target.value)} style={{ marginTop:8, width:'100%' }} />
              )}
              {dataModo === 'periodo' && (
                <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:6 }}>
                  <label style={{ fontSize:10, color:'var(--g)' }}>De<input type="date" value={dataDe} onChange={e=>setDataDe(e.target.value)} style={{ width:'100%', marginTop:2 }} /></label>
                  <label style={{ fontSize:10, color:'var(--g)' }}>Até<input type="date" value={dataAte} onChange={e=>setDataAte(e.target.value)} style={{ width:'100%', marginTop:2 }} /></label>
                </div>
              )}
            </FiltroMenu>

            <span style={{ fontSize:11, color:'var(--g)' }}>{lista.length} evento{lista.length!==1?'s':''}</span>
          </div>
        )
      })()}

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
                    <Btn variant="outline" size="xs" onClick={()=>abrir(ev)}><Pencil size={14}/></Btn>
                    <Btn variant="danger" size="xs" onClick={()=>excluir(ev.id, ev.titulo)}><Trash2 size={14}/></Btn>
                  </div>
                  {passado && (
                    <Btn variant={ev.confirmado===true?'green':ev.confirmado===false?'danger':'outline'} size="xs"
                      onClick={()=>abrirConf(ev)}>
                      {ev.confirmado===true?<><Check size={14}/> Realizado</>:ev.confirmado===false?'❌ Não realizado':'📋 Confirmar'}
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
        <Modal title={editId ? 'Editar Evento' : 'Novo Evento'} onClose={()=>setModal(false)}
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
            {isLocal(form.tipo) && (<>
              <FG full>
                <label>Link do evento (opcional — aparece no site)</label>
                <input value={form.link} onChange={e=>setForm({...form,link:e.target.value})} placeholder="Ex: post do Instagram do evento" />
              </FG>
              <FG full>
                <label>Foto de capa (opcional — aparece no site)</label>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  {form.capa
                    ? <img src={form.capa} alt="" style={{width:84,height:56,objectFit:'cover',borderRadius:8,border:'1px solid var(--bd)'}} />
                    : <div style={{width:84,height:56,borderRadius:8,border:'1.5px dashed var(--bd)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'var(--g)'}}>sem foto</div>}
                  <label style={{padding:'8px 14px',border:'1px solid var(--bd)',borderRadius:8,cursor:'pointer',fontSize:12,color:'var(--gl)'}}>
                    {form.capa ? 'Trocar foto' : 'Enviar foto'}
                    <input type="file" accept="image/*,.heic,.heif" style={{display:'none'}} onChange={async e=>{
                      const f = e.target.files[0]; e.target.value=''
                      if (!f) return
                      dispatch({ type:'TOAST', value:'📤 Enviando foto…' })
                      try {
                        const url = await uploadFotoSite(f, 'agenda')
                        setForm(fm=>({...fm, capa:url}))
                        dispatch({ type:'TOAST', value:'✅ Foto pronta! Salve o evento.' })
                      } catch (err) {
                        dispatch({ type:'TOAST', value:'⚠ Erro no upload: '+err.message })
                      }
                    }} />
                  </label>
                  {form.capa && <button onClick={()=>setForm(fm=>({...fm,capa:''}))} style={{background:'none',border:'none',color:'var(--red)',cursor:'pointer',fontSize:12}}>Remover</button>}
                </div>
                <div style={{fontSize:10.5,color:'var(--g)',marginTop:4}}>Sem foto, o site mostra o nome do evento, a data/horário e o ministério.</div>
              </FG>
            </>)}
          </FormGrid>
        </Modal>
      )}

      {/* ── Modal conflito de data ── */}
      {modalConflito && (
        <Modal title="⚠ Conflito de Data" onClose={()=>setModalConflito(null)}
          footer={<>
            <Btn variant="outline" onClick={()=>setModalConflito(null)}>Cancelar</Btn>
            <Btn onClick={()=>salvar(true)}>Salvar mesmo assim</Btn>
          </>}>
          <p style={{fontSize:13,color:'var(--tx)',marginBottom:12}}>
            Já existe{modalConflito.length>1?'m':''} <strong>{modalConflito.length} evento{modalConflito.length>1?'s':''}</strong> nessa data:
          </p>
          {modalConflito.map(ev=>(
            <div key={ev.id} style={{padding:'8px 12px',background:'var(--s2)',borderRadius:7,marginBottom:6,fontSize:12}}>
              <div style={{fontWeight:600,color:'var(--w)'}}>{ev.titulo}</div>
              <div style={{color:'var(--g)',marginTop:2}}>{ev.hora?`${ev.hora} · `:''}{ ev.ministerio||ev.tipo}</div>
            </div>
          ))}
          <p style={{fontSize:12,color:'var(--g)',marginTop:12}}>Quer salvar o novo evento mesmo assim?</p>
        </Modal>
      )}

      {/* ── Modal relatório PDF ── */}
      {modalRelatorio && (() => {
        const todosMin = [...new Set((agenda||[]).map(a=>a.ministerio).filter(Boolean))].sort()
        const evsFiltrados = (agenda||[]).filter(a=>{
          const d = new Date(a.data+'T00:00:00')
          if (d.getFullYear() !== relAno) return false
          if (relMeses.length && !relMeses.includes(d.getMonth())) return false
          if (relMins.length && !relMins.includes(a.ministerio)) return false
          if (relTipos.length && !relTipos.includes(a.tipo)) return false
          return true
        }).sort((a,b)=>a.data.localeCompare(b.data))
        return (
          <Modal title="Relatório de Agenda" onClose={()=>setModalRelatorio(false)} wide
            footer={<>
              <Btn variant="outline" onClick={()=>setModalRelatorio(false)}>Fechar</Btn>
              <Btn variant="outline" onClick={()=>window.print()} disabled={!evsFiltrados.length}><Printer size={14}/> Imprimir / PDF</Btn>
            </>}>
            <div style={{display:'flex',gap:10,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
              <div>
                <label style={{fontSize:10,color:'var(--g)',display:'block',marginBottom:4}}>ANO</label>
                <select value={relAno} onChange={e=>setRelAno(parseInt(e.target.value))} style={{padding:'6px 8px',fontSize:12}}>
                  {[anoAtual-1, anoAtual, anoAtual+1].map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <label style={{fontSize:10,color:'var(--g)',display:'block',marginBottom:6}}>TIPO (vazio = todos)</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {TIPOS.map(t=>{
                  const sel = relTipos.includes(t)
                  return <button key={t} onClick={()=>setRelTipos(sel?relTipos.filter(x=>x!==t):[...relTipos,t])}
                    style={{padding:'4px 9px',borderRadius:5,border:`1px solid ${sel?'var(--cy)':'var(--bd)'}`,background:sel?'var(--cdim)':'transparent',color:sel?'var(--cy)':'var(--g)',cursor:'pointer',fontSize:11}}>{t}</button>
                })}
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <label style={{fontSize:10,color:'var(--g)',display:'block',marginBottom:6}}>MESES (vazio = todos)</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {MESES.map((m,i)=>{
                  const sel = relMeses.includes(i)
                  return <button key={i} onClick={()=>setRelMeses(sel?relMeses.filter(x=>x!==i):[...relMeses,i])}
                    style={{padding:'4px 9px',borderRadius:5,border:`1px solid ${sel?'var(--cy)':'var(--bd)'}`,background:sel?'var(--cdim)':'transparent',color:sel?'var(--cy)':'var(--g)',cursor:'pointer',fontSize:11}}>{m}</button>
                })}
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:10,color:'var(--g)',display:'block',marginBottom:6}}>MINISTÉRIOS (vazio = todos)</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {todosMin.map(m=>{
                  const sel = relMins.includes(m)
                  return <button key={m} onClick={()=>setRelMins(sel?relMins.filter(x=>x!==m):[...relMins,m])}
                    style={{padding:'4px 9px',borderRadius:5,border:`1px solid ${sel?'var(--cy)':'var(--bd)'}`,background:sel?'var(--cdim)':'transparent',color:sel?'var(--cy)':'var(--g)',cursor:'pointer',fontSize:11}}>{m}</button>
                })}
              </div>
            </div>
            <div style={{fontSize:11,color:'var(--g)',marginBottom:10}}>{evsFiltrados.length} evento{evsFiltrados.length!==1?'s':''} encontrado{evsFiltrados.length!==1?'s':''}</div>
            <div style={{maxHeight:320,overflowY:'auto'}}>
              {evsFiltrados.length===0
                ? <div style={{textAlign:'center',color:'var(--g)',padding:20}}>Nenhum evento com esses filtros.</div>
                : evsFiltrados.map(ev=>{
                    const d = new Date(ev.data+'T00:00:00')
                    return (
                      <div key={ev.id} style={{display:'flex',gap:12,padding:'8px 0',borderBottom:'1px solid var(--bd)'}}>
                        <div style={{fontSize:11,color:'var(--cy)',width:90,flexShrink:0,fontWeight:600}}>
                          {String(d.getDate()).padStart(2,'0')}/{String(d.getMonth()+1).padStart(2,'0')} ({DIAS[d.getDay()]})
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,fontWeight:600,color:'var(--w)'}}>{ev.titulo}</div>
                          <div style={{fontSize:10,color:'var(--g)'}}>{ev.ministerio||ev.tipo}{ev.hora?` · ${ev.hora}`:''}</div>
                        </div>
                      </div>
                    )
                  })
              }
            </div>
          </Modal>
        )
      })()}

      {/* ── Modal enviar agenda (WhatsApp) ── */}
      {modalEnviar && (() => {
        const todosMin = [...new Set((agenda||[]).map(a=>a.ministerio).filter(Boolean))].sort()
        const texto = gerarTextoAgenda(envMeses, envAno, envMins)
        return (
          <Modal title="Enviar Agenda" onClose={()=>setModalEnviar(false)} wide
            footer={<Btn variant="outline" onClick={()=>setModalEnviar(false)}>Fechar</Btn>}>
            <div style={{display:'flex',gap:10,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
              <div>
                <label style={{fontSize:10,color:'var(--g)',display:'block',marginBottom:4}}>ANO</label>
                <select value={envAno} onChange={e=>setEnvAno(parseInt(e.target.value))} style={{padding:'6px 8px',fontSize:12}}>
                  {[anoAtual-1, anoAtual, anoAtual+1].map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <label style={{fontSize:10,color:'var(--g)',display:'block',marginBottom:6}}>MESES</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                <button onClick={()=>setEnvMeses([])}
                  style={{padding:'4px 9px',borderRadius:5,border:`1px solid ${envMeses.length===0?'var(--cy)':'var(--bd)'}`,background:envMeses.length===0?'var(--cdim)':'transparent',color:envMeses.length===0?'var(--cy)':'var(--g)',cursor:'pointer',fontSize:11}}>Todo o ano</button>
                {MESES.map((m,i)=>{
                  const sel = envMeses.includes(i)
                  return <button key={i} onClick={()=>setEnvMeses(sel?envMeses.filter(x=>x!==i):[...envMeses,i])}
                    style={{padding:'4px 9px',borderRadius:5,border:`1px solid ${sel?'var(--cy)':'var(--bd)'}`,background:sel?'var(--cdim)':'transparent',color:sel?'var(--cy)':'var(--g)',cursor:'pointer',fontSize:11}}>{m}</button>
                })}
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:10,color:'var(--g)',display:'block',marginBottom:6}}>MINISTÉRIOS (vazio = todos)</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {todosMin.map(m=>{
                  const sel = envMins.includes(m)
                  return <button key={m} onClick={()=>setEnvMins(sel?envMins.filter(x=>x!==m):[...envMins,m])}
                    style={{padding:'4px 9px',borderRadius:5,border:`1px solid ${sel?'var(--cy)':'var(--bd)'}`,background:sel?'var(--cdim)':'transparent',color:sel?'var(--cy)':'var(--g)',cursor:'pointer',fontSize:11}}>{m}</button>
                })}
              </div>
            </div>
            <div style={{background:'var(--s2)',borderRadius:8,padding:'12px 14px',fontSize:12,lineHeight:1.9,color:'var(--tx)',whiteSpace:'pre-wrap',borderLeft:'3px solid var(--cy)',maxHeight:220,overflowY:'auto',marginBottom:12}}>{texto}</div>
            <Btn onClick={()=>{ navigator.clipboard.writeText(texto).then(()=>{ setCopiado(true); setTimeout(()=>setCopiado(false),2500) }) }}>
              {copiado ? '✅ Copiado!' : '📋 Copiar mensagem'}
            </Btn>
          </Modal>
        )
      })()}

      {/* ── Modal confirmação ── */}
      {modalConf && (
        <Modal title={`Confirmar — ${modalConf.titulo}`} onClose={()=>setModalConf(null)}
          footer={<><Btn variant="outline" onClick={()=>setModalConf(null)}>Cancelar</Btn><Btn onClick={salvarConf} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:12,color:'var(--g)',fontWeight:700}}>O evento aconteceu?</label>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <Btn variant={confForm.confirmado===true?'green':'outline'} onClick={()=>setConfForm(f=>({...f,confirmado:true}))}>
                <Check size={14}/> Sim, aconteceu
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
      {/* Bloco imprimível do relatório — oculto na tela */}
      <div className="print-mapa">
        {(() => {
          const evs = (agenda||[]).filter(a=>{
            const d = new Date(a.data+'T00:00:00')
            if (d.getFullYear() !== relAno) return false
            if (relMeses.length && !relMeses.includes(d.getMonth())) return false
            if (relMins.length && !relMins.includes(a.ministerio)) return false
            if (relTipos.length && !relTipos.includes(a.tipo)) return false
            return true
          }).sort((a,b)=>a.data.localeCompare(b.data))
          const titulo = relMeses.length===1 ? `${MESES[relMeses[0]].toUpperCase()} ${relAno}` : String(relAno)
          return (<>
            <h2>AGENDA — PROMESSA LAGO DOS PEIXES</h2>
            <h3>{titulo}{relMins.length ? ` · ${relMins.join(', ')}` : ''}</h3>
            <table>
              <thead><tr><th>Data</th><th>Dia</th><th>Horário</th><th>Evento</th><th>Ministério</th><th>Local</th></tr></thead>
              <tbody>{evs.map(ev=>{
                const d=new Date(ev.data+'T00:00:00')
                return <tr key={ev.id}>
                  <td>{String(d.getDate()).padStart(2,'0')}/{String(d.getMonth()+1).padStart(2,'0')}/{d.getFullYear()}</td>
                  <td>{DIAS[d.getDay()]}</td>
                  <td>{ev.hora||'—'}</td>
                  <td><strong>{ev.titulo}</strong>{ev.descricao?<><br/><small>{ev.descricao}</small></>:''}</td>
                  <td>{ev.ministerio||'—'}</td>
                  <td>{ev.localidade||'—'}</td>
                </tr>
              })}</tbody>
            </table>
          </>)
        })()}
      </div>
    </div>
  )
}
