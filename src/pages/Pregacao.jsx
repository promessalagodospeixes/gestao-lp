import { useState, useEffect, useRef } from 'react'
import SeloEnvio from '../components/SeloEnvio.jsx'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbUpdate, dbDelete } from '../lib/supabase.js'
import { MESES, getCultosOrdenados, cultoNomeDe, cultoLabelDe, fmtBR, isAdmin, waLink, MSG_PREG, nomeDisp, primeiroUltimo } from '../lib/utils.js'
import { podeExcluirOuSolicitar } from '../lib/solicitacoes.js'
import { Tabs, MonthNav, Btn, BtnGroup, Modal, FormGrid, FG, Empty } from '../components/UI.jsx'
import { Save, Send, Mail, MessageCircle, Pencil, Trash2, Plus, ChevronRight, X } from 'lucide-react'

const CULTO_NOME = { sab: 'Sábado Manhã', dom: 'Domingo Noite' }
const emptyMensagem = { data:'', culto:'Sábado Manhã', pregador:'', tema:'', referencia:'', link1:'', link2:'', obs:'' }
const emptyDetalhe = { tema:'', referencia:'', serie:'', serie_id:null, subtema_id:null, link1:'', link2:'', obs:'', pregador_email:'' }

export default function Pregacao() {
  const { state, dispatch } = useStore()
  const { escalaPreg, pregacoes, funcoes, membros, cultosEspeciais, series, subtemas, user } = state
  const now = new Date()
  const [tab, setTab] = useState('escala')
  const [seriesAbertas, setSeriesAbertas] = useState({})
  const [mostrarTodosSub, setMostrarTodosSub] = useState(false)
  const [modalSerieNova, setModalSerieNova] = useState(false)
  const [serieEdit, setSerieEdit] = useState(null) // { id, nome, texto_base, descricao, subs:[{id,ordem,titulo,referencia,link1,link2,obs,_novo,_del}] }

  // --- Séries e subtemas ---
  const subtemasDaSerie = (sid) => (subtemas||[]).filter(x=>x.serie_id===sid).sort((a,b)=>(a.ordem||0)-(b.ordem||0))
  // quem já está pregando este subtema (pode ser mais de um se foi forçado)
  const subtemaUsadoPor = (subId) => (escalaPreg||[]).filter(e=>e.subtema_id===subId && e.pregador)

  const abrirSerie = (sr=null) => {
    if (sr) {
      setSerieEdit({ id:sr.id, nome:sr.nome||'', texto_base:sr.texto_base||'', descricao:sr.descricao||'',
        subs: subtemasDaSerie(sr.id).map(x=>({ ...x })) })
    } else {
      setSerieEdit({ id:null, nome:'', texto_base:'', descricao:'', subs:[{ _novo:true, ordem:1, titulo:'', referencia:'', link1:'', link2:'', obs:'' }] })
    }
    setModalSerieNova(true)
  }

  const setSub = (i, campo, valor) => setSerieEdit(se=>({ ...se, subs: se.subs.map((x,ix)=>ix===i?{...x,[campo]:valor}:x) }))
  const addSub = () => setSerieEdit(se=>({ ...se, subs:[...se.subs, { _novo:true, ordem:se.subs.length+1, titulo:'', referencia:'', link1:'', link2:'', obs:'' }] }))
  const rmSub = (i) => setSerieEdit(se=>{
    const alvo = se.subs[i]
    if (alvo.id && subtemaUsadoPor(alvo.id).length) {
      dispatch({ type:'TOAST', value:'⚠ Esse subtema já está distribuído a um pregador. Tire da escala antes de remover.' })
      return se
    }
    return { ...se, subs: se.subs.filter((_,ix)=>ix!==i).map((x,ix)=>({ ...x, ordem: ix+1 })) }
  })

  const salvarSerieNova = async () => {
    const se = serieEdit
    if (!se.nome.trim()) { dispatch({ type:'TOAST', value:'⚠ Dê um nome para a série.' }); return }
    const comTitulo = se.subs.filter(x=>x.titulo.trim())
    if (!comTitulo.length) { dispatch({ type:'TOAST', value:'⚠ Cadastre pelo menos um subtema.' }); return }
    setLoading(true)
    let serieId = se.id
    const dadosSerie = { nome:se.nome.trim(), texto_base:se.texto_base||null, descricao:se.descricao||null }
    if (serieId) {
      await dbUpdate('series', serieId, dadosSerie)
      dispatch({ type:'SET', key:'series', value:(series||[]).map(x=>x.id===serieId?{...x,...dadosSerie}:x) })
    } else {
      const nova = await dbInsert('series', dadosSerie)
      serieId = nova?.id
      dispatch({ type:'SET', key:'series', value:[...(series||[]), nova||{id:serieId,...dadosSerie}] })
    }
    let lista = [...(subtemas||[])]
    let ordem = 0
    for (const x of comTitulo) {
      ordem++
      const linha = { serie_id:serieId, ordem, titulo:x.titulo.trim(), referencia:x.referencia||null, link1:x.link1||null, link2:x.link2||null, obs:x.obs||null }
      if (x.id) { await dbUpdate('series_subtemas', x.id, linha); lista = lista.map(y=>y.id===x.id?{...y,...linha}:y) }
      else { const novo = await dbInsert('series_subtemas', linha); lista = [...lista, novo||{id:Date.now()+ordem,...linha}] }
    }
    // remove os que o usuário tirou
    const idsMantidos = comTitulo.filter(x=>x.id).map(x=>x.id)
    for (const antigo of subtemasDaSerie(serieId)) {
      if (!idsMantidos.includes(antigo.id)) { await dbDelete('series_subtemas', antigo.id); lista = lista.filter(y=>y.id!==antigo.id) }
    }
    dispatch({ type:'SET', key:'subtemas', value:lista })
    setLoading(false); setModalSerieNova(false); setSerieEdit(null)
    dispatch({ type:'TOAST', value:'✅ Série salva!' })
  }

  const excluirSerie = async (sr) => {
    const subs = subtemasDaSerie(sr.id)
    const distribuidos = subs.filter(x=>subtemaUsadoPor(x.id).length).length
    if (distribuidos) { dispatch({ type:'TOAST', value:`⚠ ${distribuidos} subtema(s) já distribuído(s). Tire da escala antes de excluir a série.` }); return }
    if (!window.confirm(`Excluir a série "${sr.nome}" e seus ${subs.length} subtema(s)?`)) return
    for (const x of subs) await dbDelete('series_subtemas', x.id)
    await dbDelete('series', sr.id)
    dispatch({ type:'SET', key:'subtemas', value:(subtemas||[]).filter(x=>x.serie_id!==sr.id) })
    dispatch({ type:'SET', key:'series', value:(series||[]).filter(x=>x.id!==sr.id) })
    dispatch({ type:'TOAST', value:'🗑 Série removida.' })
  }
  const [mes, setMes] = useState(now.getMonth())
  const [ano, setAno] = useState(now.getFullYear())

  // Mapa local de pregadores por slot do mês: { 'sab-0': 'Nome', 'dom-0': '' }
  const [escLocal, setEscLocal] = useState({})
  const [saving, setSaving] = useState(false)
  const initializedRef = useRef(null) // chave 'mes-ano' da última inicialização

  // Modal: editar detalhes de um slot
  const [modalDet, setModalDet] = useState(false)
  const [detSlot, setDetSlot] = useState(null) // { slot, data, culto, existingId }
  const [detForm, setDetForm] = useState(emptyDetalhe)

  // Modal: nova série

  // Modal: editar mensagem de série
  const [modalEditMsg, setModalEditMsg] = useState(false)
  const [editMsg, setEditMsg] = useState(null)
  // Modal: WA escala pregadores
  const [modalWA, setModalWA] = useState(false)
  const [copiadoPreg, setCopiadoPreg] = useState(false)

  const [loading, setLoading] = useState(false)

  const chM = (d) => { let m=mes+d,a=ano; if(m>11){m=0;a++} if(m<0){m=11;a--} setMes(m);setAno(a) }

  const pregFn = funcoes?.find(f=>f.nome==='Pregadores')
  const pregadores = pregFn?.membros?.length ? pregFn.membros : []

  const cultos = getCultosOrdenados(mes, ano, cultosEspeciais)

  // Acha o registro salvo para um slot
  const findEsc = (tipo, idx) => {
    const c0 = cultos.find(c=>c.tipo===tipo&&c.idx===idx)
    if (!c0) return null
    const cultoNome = cultoNomeDe(c0)
    const dataStr = c0.data.toISOString().slice(0,10)
    return (escalaPreg||[]).find(p=>p.data===dataStr&&p.culto===cultoNome) || null
  }

  // Popula escLocal quando muda o mês OU quando os dados chegam do banco pela
  // primeira vez. Usa ref para não sobrescrever o que o usuário digitou após
  // um save no mesmo mês.
  useEffect(() => {
    const temDados = (escalaPreg||[]).length > 0
    const chave = `${mes}-${ano}-${temDados}`
    const mesMudou = initializedRef.current !== chave
    // Re-inicializa se: mudou de mês, OU os dados do banco acabaram de chegar
    // (evita mostrar campos vazios — e salvar vazio apagaria os pregadores)
    if (mesMudou) {
      initializedRef.current = chave
      const local = {}
      cultos.forEach(c => {
        const key = `${c.tipo}-${c.idx}`
        const ex = findEsc(c.tipo, c.idx)
        local[key] = ex?.pregador || ''
      })
      setEscLocal(local)
    }
  }, [mes, ano, escalaPreg])

  const setPregador = (key, val) => setEscLocal(prev => ({...prev, [key]: val}))

  const salvarEscala = async () => {
    setSaving(true)
    const novosEsc = [...(escalaPreg||[])]
    let erros = 0
    for (const c of cultos) {
      const key = `${c.tipo}-${c.idx}`
      const pregador = (escLocal[key]||'').trim()
      const dataStr = c.data.toISOString().slice(0,10)
      const cultoNome = cultoNomeDe(c)
      const existing = findEsc(c.tipo, c.idx)
      if (pregador) {
        const row = { data:dataStr, culto:cultoNome, pregador }
        if (existing) {
          const res = await dbUpdate('escala_preg', existing.id, row)
          if (res) {
            const idx2 = novosEsc.findIndex(p=>p.id===existing.id)
            if (idx2>=0) novosEsc[idx2] = {...novosEsc[idx2], ...row}
          } else { erros++ }
        } else {
          const novo = await dbInsert('escala_preg', row)
          if (novo) {
            novosEsc.push(novo)
          } else { erros++ }
        }
      } else if (existing) {
        await dbDelete('escala_preg', existing.id)
        const idx2 = novosEsc.findIndex(p=>p.id===existing.id)
        if (idx2>=0) novosEsc.splice(idx2,1)
      }
    }
    dispatch({ type:'SET', key:'escalaPreg', value:[...novosEsc] })
    setSaving(false)
    if (erros > 0) {
      dispatch({ type:'TOAST', value:`⚠ ${erros} registro(s) não salvou no banco. Verifique a conexão.` })
    } else {
      dispatch({ type:'TOAST', value:'💾 Escala de pregadores salva!' })
    }
  }

  // ── Detalhes de um slot ───────────────────────────────────────────────

  const abrirDetalhes = (c) => {
    const ex = findEsc(c.tipo, c.idx)
    setDetSlot({ slot:`${c.tipo}-${c.idx}`, data:c.data.toISOString().slice(0,10), culto:cultoNomeDe(c), existingId:ex?.id||null })
    setMostrarTodosSub(false)
    setDetForm({ tema:ex?.tema||'', referencia:ex?.referencia||'', serie:ex?.serie||'', serie_id:ex?.serie_id||null, subtema_id:ex?.subtema_id||null, link1:ex?.link1||'', link2:ex?.link2||'', obs:ex?.obs||'', pregador_email:ex?.pregador_email||'' })
    setModalDet(true)
  }

  const salvarDetalhes = async () => {
    if (!detSlot) return
    setLoading(true)
    const pregador = escLocal[detSlot.slot] || ''
    const row = { data:detSlot.data, culto:detSlot.culto, pregador, tema:detForm.tema, referencia:detForm.referencia||null, serie:detForm.serie, serie_id:detForm.serie_id||null, subtema_id:detForm.subtema_id||null, link1:detForm.link1||null, link2:detForm.link2||null, obs:detForm.obs||null, pregador_email:detForm.pregador_email||null }
    if (detSlot.existingId) {
      const res = await dbUpdate('escala_preg', detSlot.existingId, row)
      if (res && !res._err) {
        dispatch({ type:'SET', key:'escalaPreg', value:(escalaPreg||[]).map(p=>p.id===detSlot.existingId?{...p,...row}:p) })
        setLoading(false); setModalDet(false)
        dispatch({ type:'TOAST', value:'✅ Detalhes salvos!' })
      } else {
        setLoading(false)
        dispatch({ type:'TOAST', value:`⚠ Erro: ${res?._err || 'sem permissao no banco'}` })
      }
    } else if (pregador) {
      const novo = await dbInsert('escala_preg', row)
      if (novo) {
        dispatch({ type:'SET', key:'escalaPreg', value:[...(escalaPreg||[]), novo] })
        // Atualiza também existingId para futuras edições na mesma sessão
        setDetSlot(s => s ? {...s, existingId: novo.id} : s)
        setLoading(false); setModalDet(false)
        dispatch({ type:'TOAST', value:'✅ Pregador e detalhes salvos!' })
      } else {
        setLoading(false)
        dispatch({ type:'TOAST', value:'⚠ Erro ao salvar no banco. Verifique a conexão.' })
      }
    } else {
      setLoading(false); setModalDet(false)
      dispatch({ type:'TOAST', value:'⚠ Digite o nome do pregador antes de salvar os detalhes.' })
    }
  }

  const excluirEsc = async (id, pregador) => {
    const ok = await podeExcluirOuSolicitar(user, dispatch, { tabela:'escala_preg', registroId:id, descricao:`Excluir pregador "${pregador}" da escala` })
    if (!ok) return
    await dbDelete('escala_preg', id)
    dispatch({ type:'SET', key:'escalaPreg', value:(escalaPreg||[]).filter(p=>p.id!==id) })
    dispatch({ type:'TOAST', value:'🗑 Removido.' })
  }

  // ── Séries & Mensagens ────────────────────────────────────────────────


  const excluirMsg = async (id, tema) => {
    const ok = await podeExcluirOuSolicitar(user, dispatch, { tabela:'pregacoes', registroId:id, descricao:`Excluir mensagem "${tema}"` })
    if (!ok) return
    await dbDelete('pregacoes', id)
    dispatch({ type:'SET', key:'pregacoes', value:(pregacoes||[]).filter(p=>p.id!==id) })
    dispatch({ type:'TOAST', value:'🗑 Removida.' })
  }

  const abrirEditMsg = (p) => {
    const escItem = (escalaPreg||[]).find(e =>
      e.data === (p.dt||p.data) && (e.tema === (p.tm||p.tema) || (e.serie && e.serie === (p.sr||p.serie)))
    )
    setEditMsg({
      pregId: p.id, escId: escItem?.id||null,
      data: p.dt||p.data||'', culto: p.cu||p.culto||'Sábado Manhã',
      pregador: escItem?.pregador||'', tema: p.tm||p.tema||'',
      referencia: p.rf||p.referencia||'', serie: p.sr||p.serie||'',
      link1: p.l1||p.link1||'', link2: p.l2||p.link2||'', obs: p.ob||p.obs||'',
    })
    setModalEditMsg(true)
  }

  const salvarEditMsg = async () => {
    if (!editMsg.tema||!editMsg.data) { dispatch({ type:'TOAST', value:'⚠ Data e tema são obrigatórios.' }); return }
    setLoading(true)
    const rowMsg = { data:editMsg.data, culto:editMsg.culto, tema:editMsg.tema, serie:editMsg.serie, referencia:editMsg.referencia, link1:editMsg.link1, link2:editMsg.link2, obs:editMsg.obs }
    await dbUpdate('pregacoes', editMsg.pregId, rowMsg)
    dispatch({ type:'SET', key:'pregacoes', value:(pregacoes||[]).map(p=>p.id===editMsg.pregId?{...p,...rowMsg,dt:rowMsg.data,cu:rowMsg.culto,tm:rowMsg.tema,sr:rowMsg.serie,rf:rowMsg.referencia,l1:rowMsg.link1||'',l2:rowMsg.link2||'',ob:rowMsg.obs||''}:p) })
    if (editMsg.escId) {
      const rowEsc = { data:editMsg.data, culto:editMsg.culto, pregador:editMsg.pregador, tema:editMsg.tema, referencia:editMsg.referencia||null, serie:editMsg.serie }
      await dbUpdate('escala_preg', editMsg.escId, rowEsc)
      dispatch({ type:'SET', key:'escalaPreg', value:(escalaPreg||[]).map(e=>e.id===editMsg.escId?{...e,...rowEsc}:e) })
    }
    setLoading(false); setModalEditMsg(false); setEditMsg(null)
    dispatch({ type:'TOAST', value:'✅ Mensagem atualizada!' })
  }

  const getPregadorMsg = (p) => (escalaPreg||[]).find(e =>
    e.data === (p.dt||p.data) && (e.tema === (p.tm||p.tema) || (e.serie && e.serie === (p.sr||p.serie)))
  )?.pregador || ''

  // Monta o item do e-mail com TUDO que foi cadastrado em Detalhes
  const itemEmailPreg = (c, ex) => {
    const extras = []
    if (ex.serie) extras.push({ rotulo:'Série', valor:ex.serie })
    if (ex.referencia) extras.push({ rotulo:'Texto base', valor:ex.referencia })
    if (ex.link1) extras.push({ rotulo:'Vídeo / YouTube', valor:ex.link1, url:true })
    if (ex.link2) extras.push({ rotulo:'Material de apoio', valor:ex.link2, url:true })
    if (ex.obs) extras.push({ rotulo:'Observações', valor:ex.obs })
    return {
      texto: `${fmtBR(c.data)} — ${cultoNomeDe(c)} — Pregação${ex.tema ? ` | ${ex.tema}` : ''}`,
      extras,
    }
  }

  const enviarEmailPreg = async () => {
    const map = {}
    cultos.forEach(c => {
      const ex = findEsc(c.tipo, c.idx)
      if (!ex?.pregador) return
      if (!map[ex.pregador]) map[ex.pregador] = []
      map[ex.pregador].push(itemEmailPreg(c, ex))
    })
    const pessoas = Object.entries(map).map(([nome,linhas]) => {
      const mb = (membros||[]).find(m=>m.nome===nome)
      const ex = cultos.map(c=>findEsc(c.tipo,c.idx)).find(e=>e?.pregador===nome)
      return { nome, email: mb?.email || ex?.pregador_email || null, linhas }
    })
    // Debug: mostra quem foi encontrado e quem não tem email
    console.log('Pregadores encontrados:', pessoas.map(p=>({nome:p.nome, email:p.email, membroAchado:!!(membros||[]).find(m=>m.nome===p.nome)})))
    const comEmail = pessoas.filter(p=>p.email).length
    if (!comEmail) {
      const semMembro = pessoas.filter(p=>!(membros||[]).find(m=>m.nome===p.nome)).map(p=>p.nome)
      const semEmailMsg = semMembro.length ? `Pregadores não encontrados no cadastro: ${semMembro.join(', ')}` : 'Nenhum pregador tem e-mail cadastrado no perfil de membro.'
      dispatch({type:'TOAST',value:`⚠ ${semEmailMsg}`}); return
    }
    dispatch({type:'TOAST',value:`✉ Enviando para ${comEmail} pregador(es)...`})
    try {
      const r = await fetch('/api/send-email', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ pessoas, tipo:'pregacao', mes, ano, escopo:'mes', usuario:user?.nome })
      })
      const d=await r.json();window.dispatchEvent(new Event('email-enviado'))
      dispatch({type:'TOAST',value:`✅ ${d.enviados} e-mail(s) enviado(s)!${d.semEmail?` (${d.semEmail} sem e-mail)`:''}`})
    } catch { dispatch({type:'TOAST',value:'⚠ Erro ao enviar e-mails.'}) }
  }

  return (
    <div>
      <Tabs tabs={[{id:'escala',label:'📅 Escala de Pregadores'},{id:'series',label:'📚 Séries & Mensagens'}]} active={tab} onChange={setTab} />

      {/* ── ESCALA DE PREGADORES ── */}
      {tab==='escala' && (
        <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
            <MonthNav month={mes} year={ano} onPrev={()=>chM(-1)} onNext={()=>chM(1)} />
            <SeloEnvio tipo="pregacao" periodo={`${ano}-${mes + 1}`} />
            <BtnGroup>
              {isAdmin(user) && <Btn onClick={salvarEscala} disabled={saving}>{saving?'Salvando...':<><Save size={15}/> Salvar</>}</Btn>}
              <Btn variant="wa" size="sm" onClick={()=>{setCopiadoPreg(false);setModalWA(true)}}><Send size={15}/> Enviar Escala</Btn>
              <Btn variant="outline" size="sm" onClick={()=>enviarEmailPreg()}><Mail size={14}/> Email</Btn>
            </BtnGroup>
          </div>

          <datalist id="lista-pregadores">{pregadores.map(p=><option key={p} value={p}/>)}</datalist>

          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {cultos.map(c => {
              const key = `${c.tipo}-${c.idx}`
              const ex = findEsc(c.tipo, c.idx)
              const pregador = escLocal[key] ?? (ex?.pregador||'')
              const temDetalhes = ex && (ex.tema||ex.referencia||ex.serie)
              return (
                <div key={key} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderLeft:`3px solid ${c.tipo==='sab'?'var(--cy)':'var(--cgl)'}`,borderRadius:10,padding:'10px 14px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                  <div style={{minWidth:130,flexShrink:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:'var(--w)'}}>{fmtBR(c.data)}</div>
                    <div style={{fontSize:10,color:c.esp?'var(--yel)':'var(--g)',marginTop:2}}>{c.esp ? `⭐ ${cultoLabelDe(c)}` : cultoNomeDe(c)}</div>
                  </div>
                  <input
                    list="lista-pregadores"
                    value={pregador}
                    onChange={e=>setPregador(key, e.target.value)}
                    placeholder="Selecione ou digite..."
                    disabled={!isAdmin(user)}
                    style={{flex:1,minWidth:160,padding:'7px 10px',fontSize:12,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:6,color:'var(--w)'}}
                  />
                  {(ex || pregador) && (
                    <div style={{display:'flex',gap:5,alignItems:'center',flexShrink:0,flexWrap:'wrap'}}>
                      {temDetalhes && <span style={{fontSize:10,color:'var(--cy)',background:'var(--cdim)',padding:'2px 7px',borderRadius:5,border:'1px solid var(--cgl)'}}>{ex.tema||ex.serie}</span>}
                      {ex?.pregador && (() => {
                        const mb = (membros||[]).find(m=>m.nome===ex.pregador)
                        const emailPreg = mb?.email || ex?.pregador_email || null
                        const msg = MSG_PREG(primeiroUltimo(ex.pregador).split(' ')[0], fmtBR(c.data), ex.tema, ex.serie, ex.link1, ex.link2, ex.obs)
                        const linha = `${fmtBR(c.data)} — ${cultoNomeDe(c)} — Pregação${ex.tema?` | ${ex.tema}`:''}`
                        return <>
                          {mb?.tel && <a href={waLink(mb.tel, msg)} target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',gap:4,padding:'4px 8px',background:'rgba(34,197,94,.12)',border:'1px solid rgba(34,197,94,.3)',borderRadius:5,color:'var(--grn)',textDecoration:'none',fontSize:11,fontWeight:600}}><MessageCircle size={14}/></a>}
                          <button title={emailPreg?`Enviar email`:'Sem e-mail (adicione nos Detalhes)'} onClick={async()=>{
                            if(!emailPreg){dispatch({type:'TOAST',value:'⚠ Sem e-mail. Adicione em Detalhes.'});return}
                            dispatch({type:'TOAST',value:'✉ Enviando...'})
                            try{const r=await fetch('/api/send-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pessoas:[{nome:ex.pregador,email:emailPreg,linhas:[itemEmailPreg(c, ex)]}],tipo:'pregacao',mes,ano,escopo:'mes',usuario:user?.nome})});const d=await r.json();window.dispatchEvent(new Event('email-enviado'));dispatch({type:'TOAST',value:d.enviados?'✅ E-mail enviado!':'⚠ Falha.'})}
                            catch{dispatch({type:'TOAST',value:'⚠ Erro.'})}
                          }} style={{display:'inline-flex',alignItems:'center',padding:'4px 8px',borderRadius:5,border:`1px solid ${mb?.email?'var(--cgl)':'var(--bd)'}`,background:mb?.email?'var(--cdim)':'transparent',color:mb?.email?'var(--cy)':'var(--g)',cursor:mb?.email?'pointer':'default',fontSize:11}}><Mail size={14}/></button>
                        </>
                      })()}
                      {isAdmin(user) && <BtnGroup>
                        <Btn variant="outline" size="xs" onClick={()=>abrirDetalhes(c)}><Pencil size={14}/> Detalhes</Btn>
                        {ex && <Btn variant="danger" size="xs" onClick={()=>excluirEsc(ex.id, ex.pregador)}><Trash2 size={14}/></Btn>}
                      </BtnGroup>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── SÉRIES & MENSAGENS ── */}
      {tab==='series' && (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,gap:10,flexWrap:'wrap'}}>
            <div style={{fontSize:11.5,color:'var(--g)'}}>
              Crie a série com seus subtemas. A distribuição para cada pregador é feita na aba <strong style={{color:'var(--cy)'}}>Escala de Pregadores</strong>.
            </div>
            {isAdmin(user) && <Btn onClick={()=>abrirSerie()}><Plus size={15}/> Nova Série</Btn>}
          </div>

          {(series||[]).length===0
            ? <Empty icon="📚" text="Nenhuma série criada ainda." />
            : [...(series||[])].sort((a,b)=>b.id-a.id).map(sr=>{
                const subs = subtemasDaSerie(sr.id)
                const usados = subs.filter(s=>subtemaUsadoPor(s.id).length)
                const pct = subs.length ? Math.round(usados.length/subs.length*100) : 0
                const aberta = !!seriesAbertas[sr.id]
                return (
                  <div key={sr.id} style={{border:'1px solid var(--bd)',borderRadius:12,marginBottom:12,overflow:'hidden'}}>
                    <div onClick={()=>setSeriesAbertas(a=>({...a,[sr.id]:!a[sr.id]}))}
                      style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',cursor:'pointer',background:'var(--s2)'}}>
                      <ChevronRight size={15} style={{color:'var(--g)',transform:aberta?'rotate(90deg)':'none',transition:'transform .15s',flexShrink:0}} />
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:'var(--w)'}}>{sr.nome}</div>
                        <div style={{fontSize:11,color:'var(--g)',marginTop:2}}>
                          {subs.length} subtema{subs.length!==1?'s':''} · {usados.length} distribuído{usados.length!==1?'s':''}
                          {subs.length>usados.length && <span style={{color:'var(--cy)'}}> · {subs.length-usados.length} livre{subs.length-usados.length!==1?'s':''}</span>}
                          {subs.length>0 && usados.length===subs.length && <span style={{color:'var(--grn)'}}> · série completa ✓</span>}
                        </div>
                      </div>
                      <div style={{width:70,height:6,background:'var(--s3)',borderRadius:99,overflow:'hidden',flexShrink:0}}>
                        <div style={{width:`${pct}%`,height:'100%',background:pct===100?'var(--grn)':'var(--cy)'}} />
                      </div>
                      {isAdmin(user) && (
                        <div style={{display:'flex',gap:4,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                          <Btn variant="outline" size="xs" onClick={()=>abrirSerie(sr)}><Pencil size={13}/></Btn>
                          <Btn variant="danger" size="xs" onClick={()=>excluirSerie(sr)}><Trash2 size={13}/></Btn>
                        </div>
                      )}
                    </div>
                    {aberta && (
                      <div style={{padding:'6px 14px 12px'}}>
                        {sr.texto_base && <div style={{fontSize:11.5,color:'var(--tx)',padding:'6px 0'}}>📖 Texto base da série: <strong>{sr.texto_base}</strong></div>}
                        {sr.descricao && <div style={{fontSize:11.5,color:'var(--g)',paddingBottom:6}}>{sr.descricao}</div>}
                        {subs.length===0 && <div style={{fontSize:12,color:'var(--g)',fontStyle:'italic',padding:'8px 0'}}>Sem subtemas. Clique no lápis para adicionar.</div>}
                        {subs.map(s=>{
                          const usos = subtemaUsadoPor(s.id)
                          return (
                            <div key={s.id} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'8px 0',borderBottom:'1px solid var(--bd)'}}>
                              <span style={{fontSize:10,fontWeight:800,color:usos.length?'var(--grn)':'var(--cy)',background:usos.length?'rgba(34,197,94,.12)':'var(--cdim)',borderRadius:5,padding:'3px 7px',flexShrink:0,minWidth:26,textAlign:'center'}}>{s.ordem}</span>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:12.5,fontWeight:600,color:'var(--w)'}}>{s.titulo}</div>
                                {s.referencia && <div style={{fontSize:11,color:'var(--g)'}}>{s.referencia}</div>}
                                {usos.length>0
                                  ? usos.map((u,ui)=>(
                                      <div key={ui} style={{fontSize:11,color:'var(--grn)',marginTop:2}}>
                                        ✓ {nomeDisp(u.pregador,membros)} — {fmtBR(new Date(u.data+'T00:00:00'))} ({u.culto})
                                      </div>
                                    ))
                                  : <div style={{fontSize:11,color:'var(--yel)',marginTop:2}}>• ainda não distribuído</div>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
          }
        </div>
      )}

      {/* Modal: enviar escala de pregadores */}
      {modalWA && (() => {
        const escalados = cultos
          .map(c => ({ c, ex: findEsc(c.tipo, c.idx) }))
          .filter(({ ex }) => ex?.pregador)
        const textoGrupo = (() => {
          const linhas = [`ESCALA DE PREGADORES — ${MESES[mes].toUpperCase()} ${ano}`, '']
          escalados.forEach(({ c, ex }) => {
            const label = cultoNomeDe(c)
            linhas.push(`${label} (${fmtBR(c.data)}) — ${ex.pregador}`)
            if (ex.tema) linhas.push(`  Tema: ${ex.tema}`)
            if (ex.serie) linhas.push(`  Serie: ${ex.serie}`)
            if (ex.referencia) linhas.push(`  Texto: ${ex.referencia}`)
            linhas.push('')
          })
          return linhas.join('\n').trim()
        })()
        const copiar = () => navigator.clipboard.writeText(textoGrupo).then(()=>setCopiadoPreg(true))
        return (
          <Modal title={`Enviar escala — ${MESES[mes]} ${ano}`} onClose={()=>setModalWA(false)} wide
            footer={<Btn variant="outline" onClick={()=>setModalWA(false)}>Fechar</Btn>}>
            {/* Individual */}
            <div style={{fontWeight:700,fontSize:12,letterSpacing:'-.01em',color:'var(--cy)',marginBottom:10}}>Mensagens individuais</div>
            {escalados.length===0
              ? <div style={{color:'var(--g)',fontSize:12,marginBottom:16}}>Nenhum pregador escalado neste mês.</div>
              : escalados.map(({ c, ex }) => {
                  const mb = (membros||[]).find(m=>m.nome===ex.pregador)
                  const msg = MSG_PREG(primeiroUltimo(ex.pregador).split(' ')[0], fmtBR(c.data), ex.tema, ex.serie, ex.link1, ex.link2, ex.obs)
                  return (
                    <div key={`${c.tipo}-${c.idx}`} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid var(--bd)'}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:600,color:'var(--w)'}}>{nomeDisp(ex.pregador,membros)}</div>
                        <div style={{fontSize:11,color:'var(--g)',marginTop:2}}>{c.esp ? `⭐ ${cultoLabelDe(c)}` : cultoNomeDe(c)} · {fmtBR(c.data)}{ex.tema?` · ${ex.tema}`:''}</div>
                      </div>
                      <div style={{display:'flex',gap:5,flexShrink:0}}>
                        {mb?.tel ? <a href={waLink(mb.tel, msg)} target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',padding:'5px 10px',background:'rgba(34,197,94,.12)',border:'1px solid rgba(34,197,94,.3)',borderRadius:6,color:'var(--grn)',textDecoration:'none',fontSize:11,fontWeight:600}}><MessageCircle size={14}/></a> : <span style={{fontSize:10,color:'var(--g)'}}>sem tel</span>}
                        <button onClick={async()=>{if(!mb?.email){dispatch({type:'TOAST',value:'⚠ Sem e-mail cadastrado.'});return}dispatch({type:'TOAST',value:`✉ Enviando...`});try{const r=await fetch('/api/send-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pessoas:[{nome:ex.pregador,email:mb.email,linhas:[itemEmailPreg(c, ex)]}],tipo:'pregacao',mes,ano,escopo:'mes',usuario:user?.nome})});const d=await r.json();window.dispatchEvent(new Event('email-enviado'));dispatch({type:'TOAST',value:d.enviados?'✅ E-mail enviado!':'⚠ Falha.'})}catch{dispatch({type:'TOAST',value:'⚠ Erro.'})}}} style={{display:'inline-flex',alignItems:'center',padding:'5px 10px',borderRadius:6,border:`1px solid ${mb?.email?'var(--cgl)':'var(--bd)'}`,background:mb?.email?'var(--cdim)':'transparent',color:mb?.email?'var(--cy)':'var(--g)',cursor:mb?.email?'pointer':'default',fontSize:11}}><Mail size={14}/></button>
                      </div>
                    </div>
                  )
                })
            }
            {/* Grupo */}
            <div style={{fontWeight:700,fontSize:12,letterSpacing:'-.01em',color:'var(--cy)',margin:'18px 0 10px'}}>Mensagem para o grupo</div>
            <textarea readOnly value={textoGrupo||'Nenhum pregador escalado.'} onClick={e=>e.target.select()}
              style={{width:'100%',minHeight:160,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:8,padding:12,fontSize:11,color:'var(--tx)',lineHeight:1.7,resize:'vertical',fontFamily:'monospace',boxSizing:'border-box',marginBottom:8}}/>
            <Btn onClick={copiar} variant={copiadoPreg?'green':'cyan'}>{copiadoPreg?'Copiado!':'Copiar texto do grupo'}</Btn>
          </Modal>
        )
      })()}

      {/* Modal: detalhes do slot */}
      {modalDet && detSlot && (
        <Modal title={`Detalhes — ${fmtBR(new Date(detSlot.data+'T00:00:00'))}`} onClose={()=>setModalDet(false)}
          footer={<><Btn variant="outline" onClick={()=>setModalDet(false)}>Cancelar</Btn><Btn onClick={salvarDetalhes} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <FormGrid>
            <FG full><label>Tema</label><input value={detForm.tema} onChange={e=>setDetForm({...detForm,tema:e.target.value})} /></FG>
            <FG full><label>Texto Bíblico</label><input value={detForm.referencia} onChange={e=>setDetForm({...detForm,referencia:e.target.value})} placeholder="Ex: João 3:16" /></FG>
            <FG full>
              <label>Série de mensagens</label>
              <select value={detForm.serie_id||''} onChange={e=>{
                const sid = e.target.value ? Number(e.target.value) : null
                setDetForm(f=>({ ...f, serie_id:sid, subtema_id:null, serie: sid ? ((series||[]).find(x=>x.id===sid)?.nome||'') : '' }))
              }}>
                <option value="">— sem série (tema livre) —</option>
                {(series||[]).map(sr=><option key={sr.id} value={sr.id}>{sr.nome}</option>)}
              </select>
            </FG>
            {detForm.serie_id && (() => {
              const subs = subtemasDaSerie(detForm.serie_id)
              const livres = subs.filter(x => {
                const usos = subtemaUsadoPor(x.id)
                return !usos.length || x.id === detForm.subtema_id || usos.every(u => u.id === detSlot.existingId)
              })
              const escolhido = subs.find(x=>x.id===detForm.subtema_id)
              return (
                <FG full>
                  <label>Subtema desta pregação</label>
                  {subs.length === 0
                    ? <div style={{fontSize:11.5,color:'var(--yel)',padding:'6px 0'}}>Esta série ainda não tem subtemas. Cadastre na aba “Séries & Mensagens”.</div>
                    : livres.length === 0
                      ? <div style={{fontSize:11.5,color:'var(--yel)',padding:'6px 0'}}>
                          ✓ Todos os {subs.length} subtemas desta série já foram distribuídos.
                          {!mostrarTodosSub && <button type="button" onClick={()=>setMostrarTodosSub(true)} style={{marginLeft:8,background:'none',border:'none',color:'var(--cy)',cursor:'pointer',fontSize:11.5,textDecoration:'underline',padding:0}}>repetir um subtema mesmo assim</button>}
                        </div>
                      : null}
                  {(livres.length>0 || mostrarTodosSub) && (
                    <select value={detForm.subtema_id||''} onChange={e=>{
                      const id = e.target.value ? Number(e.target.value) : null
                      const sub = subs.find(x=>x.id===id)
                      setDetForm(f=>({ ...f, subtema_id:id,
                        tema: sub ? sub.titulo : f.tema,
                        referencia: sub && sub.referencia ? sub.referencia : f.referencia,
                        link1: sub && sub.link1 ? sub.link1 : f.link1,
                        link2: sub && sub.link2 ? sub.link2 : f.link2,
                        obs: sub && sub.obs ? sub.obs : f.obs }))
                    }}>
                      <option value="">— escolher subtema —</option>
                      {(mostrarTodosSub ? subs : livres).map(x=>{
                        const usos = subtemaUsadoPor(x.id).filter(u=>u.id!==detSlot.existingId)
                        return <option key={x.id} value={x.id}>{x.ordem}. {x.titulo}{usos.length?`  ⚠ já com ${nomeDisp(usos[0].pregador,membros)}`:''}</option>
                      })}
                    </select>
                  )}
                  {escolhido && subtemaUsadoPor(escolhido.id).some(u=>u.id!==detSlot.existingId) && (
                    <div style={{fontSize:11,color:'var(--yel)',marginTop:4}}>⚠ Este subtema está repetido em outro culto.</div>
                  )}
                  {subs.length>0 && <div style={{fontSize:10.5,color:'var(--g)',marginTop:4}}>{subs.filter(x=>subtemaUsadoPor(x.id).length).length} de {subs.length} subtemas distribuídos nesta série</div>}
                </FG>
              )
            })()}
            <FG><label>Link YouTube</label><input type="url" value={detForm.link1} onChange={e=>setDetForm({...detForm,link1:e.target.value})} /></FG>
            <FG><label>Link Recurso</label><input type="url" value={detForm.link2} onChange={e=>setDetForm({...detForm,link2:e.target.value})} /></FG>
            <FG full><label>Observações</label><textarea value={detForm.obs} onChange={e=>setDetForm({...detForm,obs:e.target.value})} /></FG>
            <FG full>
              <label>E-mail do Pregador <span style={{fontWeight:400,color:'var(--g)',fontSize:10}}>(para convidados ou quem não tem e-mail no cadastro)</span></label>
              <input type="email" value={detForm.pregador_email} onChange={e=>setDetForm({...detForm,pregador_email:e.target.value})} placeholder="email@exemplo.com" />
            </FG>
          </FormGrid>
        </Modal>
      )}

      {/* Modal: editar mensagem de série */}
      {modalEditMsg && editMsg && (
        <Modal title="Editar mensagem" onClose={()=>{setModalEditMsg(false);setEditMsg(null)}} wide
          footer={<><Btn variant="outline" onClick={()=>{setModalEditMsg(false);setEditMsg(null)}}>Cancelar</Btn><Btn onClick={salvarEditMsg} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <FormGrid>
            <FG><label>Data</label><input type="date" value={editMsg.data} onChange={e=>setEditMsg({...editMsg,data:e.target.value})} /></FG>
            <FG><label>Culto</label><select value={editMsg.culto} onChange={e=>setEditMsg({...editMsg,culto:e.target.value})}><option>Sábado Manhã</option><option>Domingo Noite</option><option>Evento Especial</option></select></FG>
            <FG full><label>Pregador</label>
              <input list="lista-pregadores-edit" value={editMsg.pregador} onChange={e=>setEditMsg({...editMsg,pregador:e.target.value})} placeholder="Selecione ou digite um convidado..." />
              <datalist id="lista-pregadores-edit">{pregadores.map(p=><option key={p} value={p}/>)}</datalist>
            </FG>
            <FG full><label>Tema</label><input value={editMsg.tema} onChange={e=>setEditMsg({...editMsg,tema:e.target.value})} /></FG>
            <FG full><label>Referência Bíblica</label><input value={editMsg.referencia} onChange={e=>setEditMsg({...editMsg,referencia:e.target.value})} placeholder="Ex: João 3:16" /></FG>
            <FG full><label>Série</label><input value={editMsg.serie} onChange={e=>setEditMsg({...editMsg,serie:e.target.value})} /></FG>
            <FG><label>Link YouTube</label><input type="url" value={editMsg.link1} onChange={e=>setEditMsg({...editMsg,link1:e.target.value})} /></FG>
            <FG><label>Link Recurso</label><input type="url" value={editMsg.link2} onChange={e=>setEditMsg({...editMsg,link2:e.target.value})} /></FG>
            <FG full><label>Observações</label><textarea value={editMsg.obs} onChange={e=>setEditMsg({...editMsg,obs:e.target.value})} /></FG>
          </FormGrid>
        </Modal>
      )}

      {/* Modal: criar / editar série */}
      {modalSerieNova && serieEdit && (
        <Modal title={serieEdit.id ? 'Editar série' : 'Nova série de mensagens'} onClose={()=>{setModalSerieNova(false);setSerieEdit(null)}} wide
          footer={<><Btn variant="outline" onClick={()=>{setModalSerieNova(false);setSerieEdit(null)}}>Cancelar</Btn><Btn onClick={salvarSerieNova} disabled={loading}>{loading?'Salvando...':<><Save size={15}/> Salvar série</>}</Btn></>}>
          <FormGrid>
            <FG full><label>Nome da série</label>
              <input value={serieEdit.nome} onChange={e=>setSerieEdit({...serieEdit,nome:e.target.value})} placeholder="Ex: Campanha de Missões 2026" />
            </FG>
            <FG full><label>Texto base da série <span style={{fontWeight:400,color:'var(--g)',fontSize:10}}>(opcional)</span></label>
              <input value={serieEdit.texto_base} onChange={e=>setSerieEdit({...serieEdit,texto_base:e.target.value})} placeholder="Ex: Atos 1.8" />
            </FG>
            <FG full><label>Descrição <span style={{fontWeight:400,color:'var(--g)',fontSize:10}}>(opcional)</span></label>
              <textarea value={serieEdit.descricao} onChange={e=>setSerieEdit({...serieEdit,descricao:e.target.value})} rows={2} />
            </FG>
          </FormGrid>

          <div style={{marginTop:16,marginBottom:8,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{fontSize:12,fontWeight:700,color:'var(--cy)'}}>Subtemas ({serieEdit.subs.length})</div>
            <div style={{fontSize:10.5,color:'var(--g)'}}>Cada subtema vira uma pregação. O pregador é definido na Escala.</div>
          </div>

          {serieEdit.subs.map((x,i)=>{
            const usos = x.id ? subtemaUsadoPor(x.id) : []
            return (
              <div key={i} style={{border:'1px solid var(--bd)',borderRadius:10,padding:'10px 12px',marginBottom:8,background:'var(--s2)'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  <span style={{fontSize:11,fontWeight:800,color:'var(--cy)',background:'var(--cdim)',borderRadius:5,padding:'3px 8px',flexShrink:0}}>{i+1}</span>
                  <input value={x.titulo} onChange={e=>setSub(i,'titulo',e.target.value)} placeholder="Título do subtema"
                    style={{flex:1,padding:'7px 9px',fontSize:12,background:'var(--bg)',border:'1px solid var(--bd)',borderRadius:6,color:'var(--w)'}} />
                  <button onClick={()=>rmSub(i)} title={usos.length?'Já distribuído — tire da escala primeiro':'Remover subtema'}
                    style={{background:'none',border:'none',cursor:'pointer',color:usos.length?'var(--g)':'var(--red)',padding:4,display:'flex'}}><X size={15}/></button>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,170px),1fr))',gap:8}}>
                  <input value={x.referencia||''} onChange={e=>setSub(i,'referencia',e.target.value)} placeholder="Texto bíblico"
                    style={{padding:'6px 9px',fontSize:11.5,background:'var(--bg)',border:'1px solid var(--bd)',borderRadius:6,color:'var(--w)'}} />
                  <input value={x.link1||''} onChange={e=>setSub(i,'link1',e.target.value)} placeholder="Link YouTube"
                    style={{padding:'6px 9px',fontSize:11.5,background:'var(--bg)',border:'1px solid var(--bd)',borderRadius:6,color:'var(--w)'}} />
                  <input value={x.link2||''} onChange={e=>setSub(i,'link2',e.target.value)} placeholder="Link material"
                    style={{padding:'6px 9px',fontSize:11.5,background:'var(--bg)',border:'1px solid var(--bd)',borderRadius:6,color:'var(--w)'}} />
                  <input value={x.obs||''} onChange={e=>setSub(i,'obs',e.target.value)} placeholder="Observações"
                    style={{padding:'6px 9px',fontSize:11.5,background:'var(--bg)',border:'1px solid var(--bd)',borderRadius:6,color:'var(--w)'}} />
                </div>
                {usos.length>0 && (
                  <div style={{fontSize:10.5,color:'var(--grn)',marginTop:6}}>
                    ✓ já distribuído: {usos.map(u=>`${nomeDisp(u.pregador,membros)} (${fmtBR(new Date(u.data+'T00:00:00'))})`).join(' · ')}
                  </div>
                )}
              </div>
            )
          })}
          <Btn variant="outline" size="sm" onClick={addSub}><Plus size={14}/> Adicionar subtema</Btn>
        </Modal>
      )}
    </div>
  )
}
