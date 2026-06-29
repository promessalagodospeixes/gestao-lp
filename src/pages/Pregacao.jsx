import { useState, useEffect, useRef } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbUpdate, dbDelete } from '../lib/supabase.js'
import { MESES, getCultosOrdenados, fmtBR, isAdmin, waLink, MSG_PREG, nomeDisp, primeiroUltimo } from '../lib/utils.js'
import { podeExcluirOuSolicitar } from '../lib/solicitacoes.js'
import { Tabs, MonthNav, Btn, BtnGroup, Modal, FormGrid, FG, Empty } from '../components/UI.jsx'

const CULTO_NOME = { sab: 'Sábado Manhã', dom: 'Domingo Noite' }
const emptyMensagem = { data:'', culto:'Sábado Manhã', pregador:'', tema:'', referencia:'', link1:'', link2:'', obs:'' }
const emptySerie = { nome:'', qtd:1, mensagens:[] }
const emptyDetalhe = { tema:'', referencia:'', serie:'', link1:'', link2:'', obs:'', pregador_email:'' }

export default function Pregacao() {
  const { state, dispatch } = useStore()
  const { escalaPreg, pregacoes, funcoes, membros, user } = state
  const now = new Date()
  const [tab, setTab] = useState('escala')
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
  const [modalSerie, setModalSerie] = useState(false)
  const [serieForm, setSerieForm] = useState(emptySerie)

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

  const cultos = getCultosOrdenados(mes, ano)

  // Acha o registro salvo para um slot
  const findEsc = (tipo, idx) => {
    const cultoNome = CULTO_NOME[tipo]
    const data = cultos.find(c=>c.tipo===tipo&&c.idx===idx)?.data
    if (!data) return null
    const dataStr = data.toISOString().slice(0,10)
    return (escalaPreg||[]).find(p=>p.data===dataStr&&p.culto===cultoNome) || null
  }

  // Popula escLocal quando muda o mês OU quando os dados chegam do banco pela
  // primeira vez. Usa ref para não sobrescrever o que o usuário digitou após
  // um save no mesmo mês.
  useEffect(() => {
    const chave = `${mes}-${ano}`
    const mesMudou = initializedRef.current !== chave
    // Re-inicializa se: mudou de mês, OU é a primeira vez neste mês
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
      const cultoNome = CULTO_NOME[c.tipo]
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
    setDetSlot({ slot:`${c.tipo}-${c.idx}`, data:c.data.toISOString().slice(0,10), culto:CULTO_NOME[c.tipo], existingId:ex?.id||null })
    setDetForm({ tema:ex?.tema||'', referencia:ex?.referencia||'', serie:ex?.serie||'', link1:ex?.link1||'', link2:ex?.link2||'', obs:ex?.obs||'', pregador_email:ex?.pregador_email||'' })
    setModalDet(true)
  }

  const salvarDetalhes = async () => {
    if (!detSlot) return
    setLoading(true)
    const pregador = escLocal[detSlot.slot] || ''
    const row = { data:detSlot.data, culto:detSlot.culto, pregador, tema:detForm.tema, referencia:detForm.referencia||null, serie:detForm.serie, link1:detForm.link1||null, link2:detForm.link2||null, obs:detForm.obs||null, pregador_email:detForm.pregador_email||null }
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

  const gerarCampos = () => {
    const n = Math.max(1, Math.min(52, parseInt(serieForm.qtd)||1))
    const mensagens = Array.from({length:n}, (_,i) => serieForm.mensagens[i] || {...emptyMensagem})
    setSerieForm(f => ({ ...f, mensagens }))
  }

  const setMsgCampo = (i, campo, val) => {
    setSerieForm(f => {
      const mensagens = [...f.mensagens]
      mensagens[i] = { ...mensagens[i], [campo]: val }
      return { ...f, mensagens }
    })
  }

  const salvarSerie = async () => {
    if (!serieForm.nome) { dispatch({ type:'TOAST', value:'⚠ Informe o nome da série.' }); return }
    if (!serieForm.mensagens.length) { dispatch({ type:'TOAST', value:'⚠ Defina a quantidade de mensagens e gere os campos.' }); return }
    if (serieForm.mensagens.some(m=>!m.data||!m.pregador||!m.tema)) { dispatch({ type:'TOAST', value:'⚠ Preencha data, pregador e tema de cada mensagem.' }); return }
    setLoading(true)
    const novosEsc = [], novasMsgs = []
    for (const m of serieForm.mensagens) {
      const rowEsc = { data:m.data, culto:m.culto, pregador:m.pregador, tema:m.tema, referencia:m.referencia||null, serie:serieForm.nome }
      const novoEsc = await dbInsert('escala_preg', rowEsc)
      novosEsc.push(novoEsc || { id:Date.now()+Math.random(), ...rowEsc })
      const rowMsg = { data:m.data, culto:m.culto, tema:m.tema, serie:serieForm.nome, referencia:m.referencia, link1:m.link1, link2:m.link2, obs:m.obs }
      const novoMsg = await dbInsert('pregacoes', rowMsg)
      novasMsgs.push({ ...(novoMsg||{id:Date.now()+Math.random()}), ...rowMsg, dt:rowMsg.data, cu:rowMsg.culto, tm:rowMsg.tema, sr:rowMsg.serie, rf:rowMsg.referencia, l1:rowMsg.link1||'', l2:rowMsg.link2||'' })
    }
    dispatch({ type:'SET', key:'escalaPreg', value:[...(escalaPreg||[]), ...novosEsc] })
    dispatch({ type:'SET', key:'pregacoes', value:[...(pregacoes||[]), ...novasMsgs] })
    setLoading(false); setModalSerie(false); setSerieForm(emptySerie)
    dispatch({ type:'TOAST', value:'✅ Série criada!' })
  }

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

  const enviarEmailPreg = async () => {
    const map = {}
    cultos.forEach(c => {
      const ex = findEsc(c.tipo, c.idx)
      if (!ex?.pregador) return
      if (!map[ex.pregador]) map[ex.pregador] = []
      const tipo = c.tipo==='sab'?'Sábado Manhã':'Domingo Noite'
      let linha = `${fmtBR(c.data)} — ${tipo} — Pregação`
      if (ex.tema) linha += ` | ${ex.tema}`
      if (ex.referencia) linha += ` (${ex.referencia})`
      map[ex.pregador].push(linha)
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
        body: JSON.stringify({ pessoas, tipo:'culto', mes, ano, escopo:'mes' })
      })
      const d = await r.json()
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
            <BtnGroup>
              {isAdmin(user) && <Btn onClick={salvarEscala} disabled={saving}>{saving?'Salvando...':'💾 Salvar'}</Btn>}
              <Btn variant="wa" size="sm" onClick={()=>{setCopiadoPreg(false);setModalWA(true)}}>📱 Enviar Escala</Btn>
              <Btn variant="outline" size="sm" onClick={()=>enviarEmailPreg()}>✉ Email</Btn>
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
                    <div style={{fontSize:10,color:'var(--g)',marginTop:2}}>{CULTO_NOME[c.tipo]}</div>
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
                        const linha = `${fmtBR(c.data)} — ${CULTO_NOME[c.tipo]} — Pregação${ex.tema?` | ${ex.tema}`:''}`
                        return <>
                          {mb?.tel && <a href={waLink(mb.tel, msg)} target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',gap:4,padding:'4px 8px',background:'rgba(34,197,94,.12)',border:'1px solid rgba(34,197,94,.3)',borderRadius:5,color:'var(--grn)',textDecoration:'none',fontSize:11,fontWeight:600}}>💬</a>}
                          <button title={emailPreg?`Enviar email`:'Sem e-mail (adicione nos Detalhes)'} onClick={async()=>{
                            if(!emailPreg){dispatch({type:'TOAST',value:'⚠ Sem e-mail. Adicione em Detalhes.'});return}
                            dispatch({type:'TOAST',value:'✉ Enviando...'})
                            try{const r=await fetch('/api/send-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pessoas:[{nome:ex.pregador,email:emailPreg,linhas:[linha]}],tipo:'culto',mes,ano,escopo:'mes'})});const d=await r.json();dispatch({type:'TOAST',value:d.enviados?'✅ E-mail enviado!':'⚠ Falha.'})}
                            catch{dispatch({type:'TOAST',value:'⚠ Erro.'})}
                          }} style={{padding:'4px 8px',borderRadius:5,border:`1px solid ${mb?.email?'rgba(0,188,212,.4)':'var(--bd)'}`,background:mb?.email?'rgba(0,188,212,.08)':'transparent',color:mb?.email?'var(--cy)':'var(--g)',cursor:mb?.email?'pointer':'default',fontSize:11}}>📧</button>
                        </>
                      })()}
                      {isAdmin(user) && <BtnGroup>
                        <Btn variant="outline" size="xs" onClick={()=>abrirDetalhes(c)}>✏ Detalhes</Btn>
                        {ex && <Btn variant="danger" size="xs" onClick={()=>excluirEsc(ex.id, ex.pregador)}>🗑</Btn>}
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
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
            {isAdmin(user) && <Btn onClick={()=>{setSerieForm(emptySerie);setModalSerie(true)}}>+ Nova Série</Btn>}
          </div>
          {(pregacoes||[]).length===0 ? <Empty icon="📖" text="Nenhuma pregação cadastrada." /> :
            [...(pregacoes||[])].sort((a,b)=>(b.dt||b.data||'').localeCompare(a.dt||a.data||'')).map(p=>{
              const pregadorNome = getPregadorMsg(p)
              const mb = pregadorNome ? (membros||[]).find(m=>m.nome===pregadorNome) : null
              const msgWA = pregadorNome ? MSG_PREG(pregadorNome.split(' ')[0], fmtBR(p.dt||p.data), p.tm||p.tema, p.sr||p.serie, p.l1||p.link1, p.l2||p.link2, p.ob||p.obs) : ''
              return (
                <div key={p.id} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderLeft:'3px solid var(--cy)',borderRadius:10,padding:14,marginBottom:10}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:'var(--w)'}}>{p.tm||p.tema||'(sem tema)'}</div>
                      <div style={{fontSize:11,color:'var(--g)',marginTop:3}}>{p.cu||p.culto} · {fmtBR(p.dt||p.data)}{pregadorNome?` · 🎤 ${nomeDisp(pregadorNome,membros)}`:''}</div>
                      {(p.sr||p.serie) && <div style={{color:'var(--cy)',fontSize:11,marginTop:3}}>📚 {p.sr||p.serie}</div>}
                      {(p.rf||p.referencia) && <div style={{fontSize:11,color:'var(--g)'}}>📖 {p.rf||p.referencia}</div>}
                      <div style={{display:'flex',gap:5,marginTop:7,flexWrap:'wrap'}}>
                        {(p.l1||p.link1) && <a href={p.l1||p.link1} target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',gap:4,padding:'4px 9px',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--gl)',textDecoration:'none',fontSize:11}}>▶ YouTube</a>}
                        {(p.l2||p.link2) && <a href={p.l2||p.link2} target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',gap:4,padding:'4px 9px',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--gl)',textDecoration:'none',fontSize:11}}>⬇ Material</a>}
                        {pregadorNome && (mb?.tel
                          ? <a href={waLink(mb.tel, msgWA)} target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',gap:4,padding:'4px 9px',background:'rgba(34,197,94,.12)',border:'1px solid rgba(34,197,94,.3)',borderRadius:5,color:'var(--grn)',textDecoration:'none',fontSize:11,fontWeight:600}}>💬 WhatsApp p/ {pregadorNome.split(' ')[0]}</a>
                          : <span style={{fontSize:10,color:'var(--g)'}}>🎤 {nomeDisp(pregadorNome,membros)} — sem tel cadastrado</span>
                        )}
                      </div>
                    </div>
                    {isAdmin(user) && (
                      <div style={{display:'flex',gap:5,flexShrink:0}}>
                        <Btn variant="outline" size="xs" onClick={()=>abrirEditMsg(p)}>✏</Btn>
                        <Btn variant="danger" size="xs" onClick={()=>excluirMsg(p.id, p.tm||p.tema)}>🗑</Btn>
                      </div>
                    )}
                  </div>
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
            const label = c.tipo==='sab' ? 'Sabado Manha' : 'Domingo Noite'
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
          <Modal title={`ENVIAR ESCALA — ${MESES[mes].toUpperCase()} ${ano}`} onClose={()=>setModalWA(false)} wide
            footer={<Btn variant="outline" onClick={()=>setModalWA(false)}>Fechar</Btn>}>
            {/* Individual */}
            <div style={{fontFamily:'var(--font-display)',fontSize:12,letterSpacing:2,color:'var(--cy)',marginBottom:10}}>MENSAGENS INDIVIDUAIS</div>
            {escalados.length===0
              ? <div style={{color:'var(--g)',fontSize:12,marginBottom:16}}>Nenhum pregador escalado neste mês.</div>
              : escalados.map(({ c, ex }) => {
                  const mb = (membros||[]).find(m=>m.nome===ex.pregador)
                  const msg = MSG_PREG(primeiroUltimo(ex.pregador).split(' ')[0], fmtBR(c.data), ex.tema, ex.serie, ex.link1, ex.link2, ex.obs)
                  return (
                    <div key={`${c.tipo}-${c.idx}`} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid var(--bd)'}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:600,color:'var(--w)'}}>{nomeDisp(ex.pregador,membros)}</div>
                        <div style={{fontSize:11,color:'var(--g)',marginTop:2}}>{c.tipo==='sab'?'Sábado Manhã':'Domingo Noite'} · {fmtBR(c.data)}{ex.tema?` · ${ex.tema}`:''}</div>
                      </div>
                      <div style={{display:'flex',gap:5,flexShrink:0}}>
                        {mb?.tel ? <a href={waLink(mb.tel, msg)} target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',padding:'5px 10px',background:'rgba(34,197,94,.12)',border:'1px solid rgba(34,197,94,.3)',borderRadius:6,color:'var(--grn)',textDecoration:'none',fontSize:11,fontWeight:600}}>💬</a> : <span style={{fontSize:10,color:'var(--g)'}}>sem tel</span>}
                        <button onClick={async()=>{if(!mb?.email){dispatch({type:'TOAST',value:'⚠ Sem e-mail cadastrado.'});return}dispatch({type:'TOAST',value:`✉ Enviando...`});try{const r=await fetch('/api/send-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pessoas:[{nome:ex.pregador,email:mb.email,linhas:[`${fmtBR(c.data)} — ${c.tipo==='sab'?'Sábado Manhã':'Domingo Noite'} — Pregação${ex.tema?` | ${ex.tema}`:''}`]}],tipo:'culto',mes,ano,escopo:'mes'})});const d=await r.json();dispatch({type:'TOAST',value:d.enviados?'✅ E-mail enviado!':'⚠ Falha.'})}catch{dispatch({type:'TOAST',value:'⚠ Erro.'})}}} style={{padding:'5px 10px',borderRadius:6,border:`1px solid ${mb?.email?'rgba(0,188,212,.4)':'var(--bd)'}`,background:mb?.email?'rgba(0,188,212,.08)':'transparent',color:mb?.email?'var(--cy)':'var(--g)',cursor:mb?.email?'pointer':'default',fontSize:11}}>📧</button>
                      </div>
                    </div>
                  )
                })
            }
            {/* Grupo */}
            <div style={{fontFamily:'var(--font-display)',fontSize:12,letterSpacing:2,color:'var(--cy)',margin:'18px 0 10px'}}>MENSAGEM PARA O GRUPO</div>
            <textarea readOnly value={textoGrupo||'Nenhum pregador escalado.'} onClick={e=>e.target.select()}
              style={{width:'100%',minHeight:160,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:8,padding:12,fontSize:11,color:'var(--tx)',lineHeight:1.7,resize:'vertical',fontFamily:'monospace',boxSizing:'border-box',marginBottom:8}}/>
            <Btn onClick={copiar} variant={copiadoPreg?'green':'cyan'}>{copiadoPreg?'Copiado!':'Copiar texto do grupo'}</Btn>
          </Modal>
        )
      })()}

      {/* Modal: detalhes do slot */}
      {modalDet && detSlot && (
        <Modal title={`DETALHES — ${fmtBR(new Date(detSlot.data+'T00:00:00'))}`} onClose={()=>setModalDet(false)}
          footer={<><Btn variant="outline" onClick={()=>setModalDet(false)}>Cancelar</Btn><Btn onClick={salvarDetalhes} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <FormGrid>
            <FG full><label>Tema</label><input value={detForm.tema} onChange={e=>setDetForm({...detForm,tema:e.target.value})} /></FG>
            <FG full><label>Texto Bíblico</label><input value={detForm.referencia} onChange={e=>setDetForm({...detForm,referencia:e.target.value})} placeholder="Ex: João 3:16" /></FG>
            <FG full><label>Série</label><input value={detForm.serie} onChange={e=>setDetForm({...detForm,serie:e.target.value})} /></FG>
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
        <Modal title="EDITAR MENSAGEM" onClose={()=>{setModalEditMsg(false);setEditMsg(null)}} wide
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

      {/* Modal: nova série */}
      {modalSerie && (
        <Modal title="NOVA SÉRIE DE MENSAGENS" onClose={()=>setModalSerie(false)} wide
          footer={<><Btn variant="outline" onClick={()=>setModalSerie(false)}>Cancelar</Btn><Btn onClick={salvarSerie} disabled={loading}>{loading?'Salvando...':'Salvar Série'}</Btn></>}>
          <FormGrid>
            <FG full><label>Nome da Série</label><input value={serieForm.nome} onChange={e=>setSerieForm({...serieForm,nome:e.target.value})} placeholder="Ex: Vidas Transformadas" /></FG>
            <FG><label>Quantidade de Mensagens</label><input type="number" min={1} max={52} value={serieForm.qtd} onChange={e=>setSerieForm({...serieForm,qtd:e.target.value})} /></FG>
            <FG style={{justifyContent:'flex-end'}}><Btn variant="outline" onClick={gerarCampos}>📋 Gerar Campos</Btn></FG>
          </FormGrid>
          {serieForm.mensagens.length>0 && (
            <div style={{marginTop:16,display:'flex',flexDirection:'column',gap:14}}>
              {serieForm.mensagens.map((m,i)=>(
                <div key={i} style={{background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:9,padding:13}}>
                  <div style={{fontFamily:'var(--font-display)',fontSize:12,letterSpacing:2,color:'var(--cy)',marginBottom:9}}>MENSAGEM {i+1}</div>
                  <FormGrid>
                    <FG><label>Data</label><input type="date" value={m.data} onChange={e=>setMsgCampo(i,'data',e.target.value)} /></FG>
                    <FG><label>Culto</label><select value={m.culto} onChange={e=>setMsgCampo(i,'culto',e.target.value)}><option>Sábado Manhã</option><option>Domingo Noite</option><option>Evento Especial</option></select></FG>
                    <FG full><label>Pregador</label>
                      <input list="lista-pregadores" value={m.pregador} onChange={e=>setMsgCampo(i,'pregador',e.target.value)} placeholder="Selecione ou digite um convidado..." />
                    </FG>
                    <FG full><label>Tema</label><input value={m.tema} onChange={e=>setMsgCampo(i,'tema',e.target.value)} /></FG>
                    <FG full><label>Referência Bíblica</label><input value={m.referencia} onChange={e=>setMsgCampo(i,'referencia',e.target.value)} placeholder="Ex: João 3:16" /></FG>
                    <FG><label>Link YouTube</label><input type="url" value={m.link1} onChange={e=>setMsgCampo(i,'link1',e.target.value)} /></FG>
                    <FG><label>Link Recurso</label><input type="url" value={m.link2} onChange={e=>setMsgCampo(i,'link2',e.target.value)} /></FG>
                    <FG full><label>Observações</label><textarea value={m.obs} onChange={e=>setMsgCampo(i,'obs',e.target.value)} /></FG>
                  </FormGrid>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
