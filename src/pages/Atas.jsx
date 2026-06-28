import { useState, useMemo } from 'react'
import { useStore } from '../lib/store.jsx'
import { sb } from '../lib/supabase.js'
import { dbInsert, dbUpdate } from '../lib/supabase.js'
import { fmtBR, isPastor, isAdmin, nomeDisp } from '../lib/utils.js'
import { SecHeader, Btn, Modal, FG, FormGrid, Tag, Empty } from '../components/UI.jsx'

// ── Informações institucionais para o cabeçalho do PDF ──────────────────────
const CONV = {
  nome: 'CONVENÇÃO REGIONAL RIO DE JANEIRO DAS IGREJAS ADVENTISTA DA PROMESSA',
  cnpj: '30.228.769/0001-22',
  endereco: 'Av. Meriti, 2487, Sala 402 — Vila da Penha, Rio de Janeiro - RJ',
  cep: 'CEP: 21.211-007',
  tel: '(21) 2148-3942',
}
const IGREJA = {
  nome: 'Igreja Adventista da Promessa — Lago dos Peixes',
  endereco: 'Estrada Austin-Queimados, 250 — Austin, Nova Iguaçu - RJ',
  cep: 'CEP: 26086-295',
  email: 'iaplagodospeixes@gmail.com',
}

const TIPOS = ['Conselho Local','Assembleia Ordinária','Assembleia Extraordinária','Outros']
// Votação com votantes por opção (bloqueio cruzado)
const emptyVot = { tema:'', op1:'A favor', op1v:[], op2:'Contra', op2v:[], abstv:[] }
const emptyAta = { tipo:'Assembleia Ordinária', outro_tipo:'', data:'', hora:'', abertura:'', louvor:'', palavra_inicial:'', registro:'', fechamento:'', presentes:[], votacoes:[] }

const STATUS_COLOR = { rascunho:'var(--g)', assinada:'var(--grn)' }
const STATUS_LABEL = { rascunho:'Rascunho', assinada:'Assinada' }

function fmtTS(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

export default function Atas() {
  const { state, dispatch } = useStore()
  const { atas, membros, lideranca, user } = state

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyAta)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [modalVer, setModalVer] = useState(null)  // ata para visualizar/assinar
  const [modalVot, setModalVot] = useState(null)  // votação sendo editada {ataid, idx}
  const [votForm, setVotForm] = useState(emptyVot)
  const [printAta, setPrintAta] = useState(null)   // ata para imprimir

  const isSecretario = user?.perfil === 'secretario'
  const pastor = isAdmin(user)

  // Lista de membros para presença
  const todosNomes = useMemo(() => (membros||[]).map(m => m.nome).sort(), [membros])
  const nomesLideranca = useMemo(() => (lideranca||[]).map(l => l.membro_nome).filter(Boolean), [lideranca])
  const nomesPadrao = (tipo) => tipo === 'Conselho Local' ? nomesLideranca : todosNomes

  const abrir = (ata = null) => {
    if (ata) {
      setForm({ tipo:ata.tipo, outro_tipo:ata.outro_tipo||'', data:ata.data, hora:ata.hora||'', abertura:ata.abertura||'', louvor:ata.louvor||'', palavra_inicial:ata.palavra_inicial||'', registro:ata.registro||'', fechamento:ata.fechamento||'', presentes:ata.presentes||[], votacoes:ata.votacoes||[] })
      setEditId(ata.id)
    } else {
      setForm({ ...emptyAta, data: new Date().toISOString().slice(0,10) })
      setEditId(null)
    }
    setModal(true)
  }

  const salvar = async () => {
    if (!form.data) { dispatch({ type:'TOAST', value:'⚠ Informe a data.' }); return }
    setLoading(true)
    const row = { tipo:form.tipo, outro_tipo:form.outro_tipo||null, data:form.data, hora:form.hora||null, abertura:form.abertura||null, louvor:form.louvor||null, palavra_inicial:form.palavra_inicial||null, registro:form.registro||null, fechamento:form.fechamento||null, presentes:JSON.stringify(form.presentes), votacoes:JSON.stringify(form.votacoes) }
    if (editId) {
      await dbUpdate('atas', editId, row)
      dispatch({ type:'SET', key:'atas', value:(atas||[]).map(a => a.id===editId ? {...a,...row,presentes:form.presentes,votacoes:form.votacoes} : a) })
      dispatch({ type:'TOAST', value:'✅ Ata atualizada!' })
    } else {
      const novo = await dbInsert('atas', { ...row, status:'rascunho' })
      dispatch({ type:'SET', key:'atas', value:[{...novo,...row,presentes:form.presentes,votacoes:form.votacoes,status:'rascunho'}, ...(atas||[])] })
      dispatch({ type:'TOAST', value:'📋 Ata criada!' })
    }
    setLoading(false); setModal(false)
  }

  const togglePresente = (nome) => {
    setForm(f => ({ ...f, presentes: f.presentes.includes(nome) ? f.presentes.filter(n=>n!==nome) : [...f.presentes, nome] }))
  }
  const addTodosPresentes = () => setForm(f => ({ ...f, presentes: nomesPadrao(f.tipo) }))

  // ── Assinatura ──────────────────────────────────────────────────────────────
  const assinar = async (ata) => {
    const agora = new Date().toISOString()
    const updates = {}
    if (isPastor(user) && !ata.assinatura_pastor) updates.assinatura_pastor = agora
    if (isSecretario && !ata.assinatura_secretario) updates.assinatura_secretario = agora
    if (!Object.keys(updates).length) return

    // Verifica se ambos vão estar assinados após este update
    const novaPastor = updates.assinatura_pastor || ata.assinatura_pastor
    const novaSecretario = updates.assinatura_secretario || ata.assinatura_secretario
    if (novaPastor && novaSecretario) updates.status = 'assinada'

    const { error } = await sb.from('atas').update(updates).eq('id', ata.id)
    if (error) { dispatch({ type:'TOAST', value:'⚠ Erro ao assinar.' }); return }
    const atualizada = { ...ata, ...updates }
    dispatch({ type:'SET', key:'atas', value:(atas||[]).map(a=>a.id===ata.id?atualizada:a) })
    setModalVer(atualizada)
    dispatch({ type:'TOAST', value:'✅ Assinado com sucesso!' })
  }

  // ── Votações ────────────────────────────────────────────────────────────────
  const abrirVotacao = (idx) => {
    const vot = form.votacoes[idx] || emptyVot
    setVotForm({ ...emptyVot, ...vot })
    setModalVot(idx)
  }
  const salvarVotacao = () => {
    setForm(f => {
      const vots = [...f.votacoes]
      if (modalVot === 'novo') vots.push(votForm)
      else vots[modalVot] = votForm
      return { ...f, votacoes: vots }
    })
    setModalVot(null)
  }
  const removerVotacao = (idx) => setForm(f => ({ ...f, votacoes: f.votacoes.filter((_,i)=>i!==idx) }))

  // ── Print ───────────────────────────────────────────────────────────────────
  const imprimir = (ata) => { setPrintAta(ata); setTimeout(()=>{ window.print(); setPrintAta(null) }, 300) }

  const tipoLabel = (ata) => ata.tipo === 'Outros' ? (ata.outro_tipo || 'Outros') : ata.tipo

  return (
    <div>
      <SecHeader title="ATAS" actions={isAdmin(user) && <Btn onClick={()=>abrir()}>+ Nova Ata</Btn>} />

      {(atas||[]).length === 0
        ? <Empty icon="📋" text="Nenhuma ata registrada." />
        : (atas||[]).map(ata => (
          <div key={ata.id} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderLeft:`3px solid ${ata.status==='assinada'?'var(--grn)':'var(--g)'}`,borderRadius:10,padding:'12px 15px',marginBottom:8,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                <div style={{fontSize:13,fontWeight:700,color:'var(--w)'}}>{tipoLabel(ata)}</div>
                <span style={{fontSize:9,fontWeight:700,color:STATUS_COLOR[ata.status],background:`${STATUS_COLOR[ata.status]}18`,padding:'2px 8px',borderRadius:99,textTransform:'uppercase'}}>{STATUS_LABEL[ata.status]}</span>
              </div>
              <div style={{fontSize:11,color:'var(--g)',marginTop:3}}>{fmtBR(new Date(ata.data+'T00:00:00'))}{ata.hora?' · '+ata.hora:''} · {(ata.presentes||[]).length} presente(s)</div>
            </div>
            <div style={{display:'flex',gap:5,flexShrink:0}}>
              <Btn variant="outline" size="xs" onClick={()=>setModalVer(ata)}>👁 Ver</Btn>
              {ata.status !== 'assinada' && isAdmin(user) && <Btn variant="outline" size="xs" onClick={()=>abrir(ata)}>✏</Btn>}
              {ata.status === 'assinada' && <Btn variant="outline" size="xs" onClick={()=>imprimir(ata)}>🖨 PDF</Btn>}
            </div>
          </div>
        ))
      }

      {/* ── Modal criar/editar ─────────────────────────────────────────────── */}
      {modal && (
        <Modal title={editId ? 'EDITAR ATA' : 'NOVA ATA'} onClose={()=>setModal(false)} wide
          footer={<><Btn variant="outline" onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={salvar} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <FormGrid>
            <FG>
              <label>Tipo de Reunião</label>
              <select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value,presentes:[]})}>
                {TIPOS.map(t=><option key={t}>{t}</option>)}
              </select>
            </FG>
            {form.tipo==='Outros' && <FG><label>Qual reunião?</label><input value={form.outro_tipo} onChange={e=>setForm({...form,outro_tipo:e.target.value})} placeholder="Ex: Reunião de líderes..." /></FG>}
            <FG><label>Data</label><input type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})} /></FG>
            <FG><label>Horário</label><input type="time" value={form.hora} onChange={e=>setForm({...form,hora:e.target.value})} /></FG>
            <FG><label>Abertura</label><input value={form.abertura} onChange={e=>setForm({...form,abertura:e.target.value})} placeholder="Quem abriu a reunião" /></FG>
            <FG><label>Louvor</label><input value={form.louvor} onChange={e=>setForm({...form,louvor:e.target.value})} placeholder="Quem/o que foi cantado" /></FG>
            <FG full><label>Palavra Inicial (Texto Bíblico)</label><input value={form.palavra_inicial} onChange={e=>setForm({...form,palavra_inicial:e.target.value})} placeholder="Ex: João 3:16 — ..." /></FG>
            <FG full><label>Registro da Reunião</label><textarea value={form.registro} onChange={e=>setForm({...form,registro:e.target.value})} style={{minHeight:120}} placeholder="Descreva o que aconteceu na reunião..." /></FG>
            <FG><label>Fechamento / Oração Final</label><input value={form.fechamento} onChange={e=>setForm({...form,fechamento:e.target.value})} placeholder="Quem fez a oração de encerramento" /></FG>
          </FormGrid>

          {/* Votações */}
          <div style={{marginTop:16}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <div style={{fontFamily:'var(--font-display)',fontSize:12,letterSpacing:2,color:'var(--cy)'}}>VOTAÇÕES</div>
              <Btn variant="outline" size="xs" onClick={()=>{setVotForm(emptyVot);setModalVot('novo')}}>+ Adicionar</Btn>
            </div>
            {form.votacoes.map((v,i)=>(
              <div key={i} style={{background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:8,padding:'8px 12px',marginBottom:6,display:'flex',alignItems:'center',gap:10}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--w)'}}>{v.tema||'(sem tema)'}</div>
                  <div style={{fontSize:10,color:'var(--g)',marginTop:2}}>{v.op1}: {(v.op1v||[]).length} · {v.op2}: {(v.op2v||[]).length} · Abstenção: {(v.abstv||[]).length}</div>
                </div>
                <Btn variant="outline" size="xs" onClick={()=>abrirVotacao(i)}>✏</Btn>
                <Btn variant="danger" size="xs" onClick={()=>removerVotacao(i)}>🗑</Btn>
              </div>
            ))}
          </div>

          {/* Lista de presença */}
          <div style={{marginTop:16}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <div style={{fontFamily:'var(--font-display)',fontSize:12,letterSpacing:2,color:'var(--cy)'}}>LISTA DE PRESENÇA <span style={{fontSize:9,color:'var(--g)',fontFamily:'inherit',fontWeight:400}}>({form.presentes.length} marcados)</span></div>
              <Btn variant="outline" size="xs" onClick={addTodosPresentes}>Marcar todos</Btn>
            </div>
            <div style={{maxHeight:220,overflowY:'auto',border:'1px solid var(--bd)',borderRadius:8}}>
              {nomesPadrao(form.tipo).map(nome=>{
                const sel = form.presentes.includes(nome)
                return (
                  <label key={nome} onClick={()=>togglePresente(nome)} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',cursor:'pointer',borderBottom:'1px solid var(--bd)',background:sel?'var(--cdim)':'transparent',userSelect:'none'}}>
                    <div style={{width:16,height:16,flexShrink:0,borderRadius:3,border:`2px solid ${sel?'var(--cy)':'var(--g)'}`,background:sel?'var(--cy)':'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {sel&&<span style={{color:'#000',fontSize:11,fontWeight:900,lineHeight:1}}>✓</span>}
                    </div>
                    <span style={{fontSize:12,color:sel?'var(--cy)':'var(--tx)'}}>{nomeDisp(nome,membros)}</span>
                  </label>
                )
              })}
              {/* Adicionar outros (Conselho Local) */}
              {form.tipo==='Conselho Local' && (
                <div style={{padding:'8px 12px',borderTop:'1px solid var(--bd)'}}>
                  <div style={{fontSize:10,color:'var(--g)',marginBottom:6}}>Outros membros convidados:</div>
                  {todosNomes.filter(n=>!nomesLideranca.includes(n)).map(nome=>{
                    const sel = form.presentes.includes(nome)
                    return (
                      <label key={nome} onClick={()=>togglePresente(nome)} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',cursor:'pointer',userSelect:'none'}}>
                        <div style={{width:14,height:14,flexShrink:0,borderRadius:3,border:`2px solid ${sel?'var(--cy)':'var(--bd)'}`,background:sel?'var(--cy)':'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          {sel&&<span style={{color:'#000',fontSize:10,fontWeight:900,lineHeight:1}}>✓</span>}
                        </div>
                        <span style={{fontSize:11,color:sel?'var(--cy)':'var(--g)'}}>{nomeDisp(nome,membros)}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal votação ──────────────────────────────────────────────────── */}
      {modalVot !== null && (
        <Modal title="VOTAÇÃO" onClose={()=>setModalVot(null)} wide
          footer={<><Btn variant="outline" onClick={()=>setModalVot(null)}>Cancelar</Btn><Btn onClick={salvarVotacao}>Salvar</Btn></>}>
          <FG full style={{marginBottom:12}}>
            <label>Tema da Votação</label>
            <input value={votForm.tema} onChange={e=>setVotForm(f=>({...f,tema:e.target.value}))} placeholder="Ex: Escolha da data do batismo" />
          </FG>
          {form.presentes.length===0 && <div style={{color:'var(--yel)',fontSize:11,marginBottom:10}}>⚠ Marque a presença antes para selecionar votantes.</div>}

          {/* 3 colunas: Op1 | Op2 | Abstenção */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
            {[
              { key:'op1v', label: votForm.op1, labelKey:'op1', color:'var(--grn)', other1:'op2v', other2:'abstv' },
              { key:'op2v', label: votForm.op2, labelKey:'op2', color:'var(--red)', other1:'op1v', other2:'abstv' },
              { key:'abstv', label:'Abstenção', labelKey:null, color:'var(--g)', other1:'op1v', other2:'op2v' },
            ].map(col => (
              <div key={col.key}>
                <div style={{marginBottom:6}}>
                  {col.labelKey
                    ? <input value={votForm[col.labelKey]} onChange={e=>setVotForm(f=>({...f,[col.labelKey]:e.target.value}))} style={{width:'100%',padding:'5px 8px',fontSize:11,fontWeight:700,color:col.color,background:'var(--s2)',border:`1px solid ${col.color}`,borderRadius:6,boxSizing:'border-box'}} />
                    : <div style={{padding:'5px 8px',fontSize:11,fontWeight:700,color:col.color,border:`1px solid ${col.color}`,borderRadius:6,textAlign:'center'}}>Abstenção</div>
                  }
                  <div style={{fontSize:10,color:col.color,textAlign:'center',marginTop:3}}>{(votForm[col.key]||[]).length} voto(s)</div>
                </div>
                <div style={{border:`1px solid ${col.color}40`,borderRadius:7,overflow:'hidden',maxHeight:220,overflowY:'auto'}}>
                  {form.presentes.length===0
                    ? <div style={{padding:'8px',fontSize:10,color:'var(--g)'}}>—</div>
                    : form.presentes.map(nome => {
                        const jaVotou = (votForm[col.other1]||[]).includes(nome) || (votForm[col.other2]||[]).includes(nome)
                        const selecionado = (votForm[col.key]||[]).includes(nome)
                        const toggle = () => {
                          if (jaVotou) return
                          setVotForm(f => ({
                            ...f,
                            [col.key]: selecionado
                              ? f[col.key].filter(n=>n!==nome)
                              : [...(f[col.key]||[]), nome]
                          }))
                        }
                        return (
                          <div key={nome} onClick={toggle}
                            style={{display:'flex',alignItems:'center',gap:6,padding:'6px 8px',borderBottom:'1px solid var(--bd)',cursor:jaVotou?'not-allowed':'pointer',background:selecionado?`${col.color}15`:jaVotou?'rgba(0,0,0,.2)':'transparent',opacity:jaVotou?.5:1,userSelect:'none'}}>
                            <div style={{width:13,height:13,flexShrink:0,borderRadius:3,border:`2px solid ${selecionado?col.color:'var(--g)'}`,background:selecionado?col.color:'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>
                              {selecionado&&<span style={{color:'#000',fontSize:9,fontWeight:900,lineHeight:1}}>✓</span>}
                            </div>
                            <span style={{fontSize:11,color:selecionado?col.color:jaVotou?'var(--g)':'var(--tx)'}}>{nomeDisp(nome,membros)}</span>
                          </div>
                        )
                      })
                  }
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* ── Modal visualizar/assinar ───────────────────────────────────────── */}
      {modalVer && (
        <Modal title={`ATA — ${tipoLabel(modalVer).toUpperCase()}`} onClose={()=>setModalVer(null)} wide
          footer={
            <div style={{display:'flex',gap:8,flexWrap:'wrap',width:'100%'}}>
              {modalVer.status==='assinada' && <Btn variant="outline" size="sm" onClick={()=>imprimir(modalVer)}>🖨 Gerar PDF</Btn>}
              {!modalVer.assinatura_pastor && isPastor(user) && <Btn variant="green" onClick={()=>assinar(modalVer)}>✅ Assinar como Pastor</Btn>}
              {!modalVer.assinatura_secretario && isSecretario && <Btn variant="green" onClick={()=>assinar(modalVer)}>✅ Assinar como Secretário</Btn>}
              <Btn variant="outline" onClick={()=>setModalVer(null)} style={{marginLeft:'auto'}}>Fechar</Btn>
            </div>
          }>
          <div style={{fontSize:12,lineHeight:1.8}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
              <div><span style={{color:'var(--g)'}}>Data:</span> <strong style={{color:'var(--w)'}}>{fmtBR(new Date(modalVer.data+'T00:00:00'))}</strong></div>
              {modalVer.hora && <div><span style={{color:'var(--g)'}}>Horário:</span> <strong style={{color:'var(--w)'}}>{modalVer.hora}</strong></div>}
              {modalVer.abertura && <div><span style={{color:'var(--g)'}}>Abertura:</span> <strong style={{color:'var(--w)'}}>{modalVer.abertura}</strong></div>}
              {modalVer.louvor && <div><span style={{color:'var(--g)'}}>Louvor:</span> <strong style={{color:'var(--w)'}}>{modalVer.louvor}</strong></div>}
              {modalVer.fechamento && <div><span style={{color:'var(--g)'}}>Fechamento:</span> <strong style={{color:'var(--w)'}}>{modalVer.fechamento}</strong></div>}
            </div>
            {modalVer.palavra_inicial && <div style={{marginBottom:10}}><div style={{fontSize:10,color:'var(--cy)',letterSpacing:1,textTransform:'uppercase',marginBottom:3}}>Palavra Inicial</div><div style={{color:'var(--tx)'}}>{modalVer.palavra_inicial}</div></div>}
            {modalVer.registro && <div style={{marginBottom:10}}><div style={{fontSize:10,color:'var(--cy)',letterSpacing:1,textTransform:'uppercase',marginBottom:3}}>Registro</div><div style={{color:'var(--tx)',whiteSpace:'pre-wrap'}}>{modalVer.registro}</div></div>}
            {(modalVer.votacoes||[]).length>0 && (
              <div style={{marginBottom:10}}>
                <div style={{fontSize:10,color:'var(--cy)',letterSpacing:1,textTransform:'uppercase',marginBottom:6}}>Votações</div>
                {modalVer.votacoes.map((v,i)=>(
                  <div key={i} style={{background:'var(--s2)',borderRadius:7,padding:'10px 12px',marginBottom:8}}>
                    <div style={{fontWeight:600,color:'var(--w)',marginBottom:8}}>{v.tema}</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,fontSize:11}}>
                      {[{l:v.op1,ns:v.op1v||[],c:'var(--grn)'},{l:v.op2,ns:v.op2v||[],c:'var(--red)'},{l:'Abstenção',ns:v.abstv||[],c:'var(--g)'}].map(op=>(
                        <div key={op.l}>
                          <div style={{fontWeight:700,color:op.c,marginBottom:3}}>{op.l} ({op.ns.length})</div>
                          {op.ns.map(n=><div key={n} style={{fontSize:10,color:'var(--tx)'}}>{nomeDisp(n,membros)}</div>)}
                          {!op.ns.length&&<div style={{fontSize:10,color:'var(--g)'}}>—</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:'var(--cy)',letterSpacing:1,textTransform:'uppercase',marginBottom:6}}>Lista de Presença ({(modalVer.presentes||[]).length})</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                {(modalVer.presentes||[]).map(n=><span key={n} style={{fontSize:11,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,padding:'2px 8px',color:'var(--tx)'}}>{nomeDisp(n,membros)}</span>)}
              </div>
            </div>
            <div style={{borderTop:'1px solid var(--bd)',paddingTop:12,marginTop:4}}>
              <div style={{fontSize:10,color:'var(--cy)',letterSpacing:1,textTransform:'uppercase',marginBottom:8}}>Assinaturas</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div style={{background:'var(--s2)',borderRadius:7,padding:'10px 12px'}}>
                  <div style={{fontSize:10,color:'var(--g)',marginBottom:3}}>Pastor</div>
                  {modalVer.assinatura_pastor ? <div style={{fontSize:11,color:'var(--grn)'}}>✅ Assinado em {fmtTS(modalVer.assinatura_pastor)}</div> : <div style={{fontSize:11,color:'var(--g)'}}>Aguardando...</div>}
                </div>
                <div style={{background:'var(--s2)',borderRadius:7,padding:'10px 12px'}}>
                  <div style={{fontSize:10,color:'var(--g)',marginBottom:3}}>Secretário(a)</div>
                  {modalVer.assinatura_secretario ? <div style={{fontSize:11,color:'var(--grn)'}}>✅ Assinado em {fmtTS(modalVer.assinatura_secretario)}</div> : <div style={{fontSize:11,color:'var(--g)'}}>Aguardando...</div>}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Print area — geração de PDF ────────────────────────────────────── */}
      {printAta && (
        <div className="print-mapa" style={{fontFamily:'serif',lineHeight:1.7}}>
          {/* Cabeçalho */}
          <div style={{textAlign:'center',borderBottom:'2px solid #000',paddingBottom:12,marginBottom:16}}>
            <div style={{fontWeight:700,fontSize:13,textTransform:'uppercase',letterSpacing:1}}>{CONV.nome}</div>
            <div style={{fontSize:11}}>CNPJ: {CONV.cnpj} | {CONV.endereco} | {CONV.cep} | Tel: {CONV.tel}</div>
            <div style={{marginTop:8,fontWeight:600,fontSize:12}}>{IGREJA.nome}</div>
            <div style={{fontSize:11}}>{IGREJA.endereco} | {IGREJA.cep} | {IGREJA.email}</div>
          </div>

          {/* Título */}
          <div style={{textAlign:'center',marginBottom:16}}>
            <h2 style={{fontSize:15,fontWeight:700,textTransform:'uppercase',margin:'0 0 4px'}}>
              ATA DE {tipoLabel(printAta).toUpperCase()}
            </h2>
            <div style={{fontSize:12}}>
              Data: {fmtBR(new Date(printAta.data+'T00:00:00'))}
              {printAta.hora ? ` | Horário: ${printAta.hora}` : ''}
            </div>
          </div>

          {/* Conteúdo */}
          {printAta.abertura && <p style={{margin:'0 0 8px'}}><strong>Abertura:</strong> {printAta.abertura}</p>}
          {printAta.louvor && <p style={{margin:'0 0 8px'}}><strong>Louvor:</strong> {printAta.louvor}</p>}
          {printAta.palavra_inicial && <p style={{margin:'0 0 8px'}}><strong>Palavra Inicial:</strong> {printAta.palavra_inicial}</p>}
          {printAta.fechamento && <p style={{margin:'0 0 8px'}}><strong>Fechamento / Oração Final:</strong> {printAta.fechamento}</p>}
          {printAta.registro && (
            <div style={{margin:'12px 0',borderTop:'1px solid #ccc',paddingTop:10}}>
              <strong style={{display:'block',marginBottom:6,textTransform:'uppercase',fontSize:12}}>Registro da Reunião</strong>
              <p style={{margin:0,whiteSpace:'pre-wrap',textAlign:'justify'}}>{printAta.registro}</p>
            </div>
          )}

          {/* Votações */}
          {(printAta.votacoes||[]).length>0 && (
            <div style={{margin:'12px 0',borderTop:'1px solid #ccc',paddingTop:10}}>
              <strong style={{display:'block',marginBottom:8,textTransform:'uppercase',fontSize:12}}>Votações</strong>
              {printAta.votacoes.map((v,i)=>(
                <div key={i} style={{marginBottom:12,paddingLeft:12,borderLeft:'2px solid #999'}}>
                  <div style={{fontWeight:600,marginBottom:4}}>{i+1}. {v.tema}</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,fontSize:11}}>
                    {[{l:v.op1,ns:v.op1v||[]},{l:v.op2,ns:v.op2v||[]},{l:'Abstenção',ns:v.abstv||[]}].map(op=>(
                      <div key={op.l}><strong>{op.l} ({op.ns.length}):</strong> {op.ns.map(n=>nomeDisp(n,membros)).join(', ')||'—'}</div>
                    ))}
                  </div>
                  {(v.votantes||[]).length>0 && <div style={{fontSize:10,color:'#555',marginTop:2}}>Votantes: {v.votantes.map(n=>nomeDisp(n,membros)).join(', ')}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Lista de presença */}
          <div style={{margin:'12px 0',borderTop:'1px solid #ccc',paddingTop:10}}>
            <strong style={{display:'block',marginBottom:8,textTransform:'uppercase',fontSize:12}}>Lista de Presença — {(printAta.presentes||[]).length} pessoa(s)</strong>
            <div style={{columns:3,columnGap:20}}>
              {(printAta.presentes||[]).map((n,i)=>(
                <div key={n} style={{fontSize:11,padding:'2px 0',breakInside:'avoid'}}>
                  {i+1}. {nomeDisp(n,membros)}
                </div>
              ))}
            </div>
          </div>

          {/* Assinaturas */}
          <div style={{marginTop:40,borderTop:'2px solid #000',paddingTop:20}}>
            <strong style={{display:'block',marginBottom:20,textTransform:'uppercase',fontSize:12}}>Assinaturas</strong>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:40}}>
              <div style={{textAlign:'center'}}>
                <div style={{borderTop:'1px solid #000',paddingTop:6,marginTop:30}}>
                  <div style={{fontWeight:600,fontSize:12}}>Pastor</div>
                  <div style={{fontSize:10,color:'#555',marginTop:2}}>Assinado digitalmente em: {fmtTS(printAta.assinatura_pastor)}</div>
                </div>
              </div>
              <div style={{textAlign:'center'}}>
                <div style={{borderTop:'1px solid #000',paddingTop:6,marginTop:30}}>
                  <div style={{fontWeight:600,fontSize:12}}>Secretário(a)</div>
                  <div style={{fontSize:10,color:'#555',marginTop:2}}>Assinado digitalmente em: {fmtTS(printAta.assinatura_secretario)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé */}
          <div style={{marginTop:30,textAlign:'center',fontSize:10,color:'#777',borderTop:'1px solid #ccc',paddingTop:8}}>
            Documento gerado pelo sistema de gestão da {IGREJA.nome} em {new Date().toLocaleString('pt-BR')}
          </div>
        </div>
      )}
    </div>
  )
}
