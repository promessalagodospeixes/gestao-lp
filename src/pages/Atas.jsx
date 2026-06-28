import { useState, useMemo, useEffect } from 'react'
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

// Nome completo oficial formatado em Title Case para documentos
const EXCL = new Set(['de','da','do','das','dos','e','a','o','as','os'])
const nomeOficial = (n) => (n||'').toLowerCase().split(' ').map((p,i) => (i===0||!EXCL.has(p)) ? p.charAt(0).toUpperCase()+p.slice(1) : p).join(' ')
// Votação com votantes por opção (bloqueio cruzado)
// unanime: null | 'op1' | 'op2' | 'abst'  — qual opção foi unânime
const emptyVot = { tema:'', op1:'A favor', op1v:[], qtd1:'', op2:'Contra', op2v:[], qtd2:'', abstv:[], qtd_abst:'', unanime:null }
const emptyAta = { tipo:'Assembleia Ordinária', outro_tipo:'', data:'', hora:'', hora_fim:'', abertura:'', louvor:'', palavra_inicial:'', registro:'', fechamento:'', link:'', presentes:[], votacoes:[] }

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
      setForm({ tipo:ata.tipo, outro_tipo:ata.outro_tipo||'', data:ata.data, hora:ata.hora||'', hora_fim:ata.hora_fim||'', abertura:ata.abertura||'', louvor:ata.louvor||'', palavra_inicial:ata.palavra_inicial||'', registro:ata.registro||'', fechamento:ata.fechamento||'', link:ata.link||'', presentes:ata.presentes||[], votacoes:ata.votacoes||[] })
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
    const row = { tipo:form.tipo, outro_tipo:form.outro_tipo||null, data:form.data, hora:form.hora||null, hora_fim:form.hora_fim||null, abertura:form.abertura||null, louvor:form.louvor||null, palavra_inicial:form.palavra_inicial||null, registro:form.registro||null, fechamento:form.fechamento||null, link:form.link||null, presentes:JSON.stringify(form.presentes), votacoes:JSON.stringify(form.votacoes) }
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
    if (!votForm.unanime) {
      const qtd1 = (votForm.op1v||[]).length || parseInt(votForm.qtd1)||0
      const qtd2 = (votForm.op2v||[]).length || parseInt(votForm.qtd2)||0
      const qtdA = (votForm.abstv||[]).length || parseInt(votForm.qtd_abst)||0
      const total = qtd1 + qtd2 + qtdA
      const maxVotos = form.presentes.length
      if (maxVotos > 0 && total > maxVotos) {
        dispatch({ type:'TOAST', value:`⚠ Total de votos (${total}) não pode ser maior que o número de presentes (${maxVotos}).` })
        return
      }
    }
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
  const imprimir = (ata) => { setModalVer(null); setPrintAta(ata) }

  useEffect(() => {
    if (!printAta) return
    // Aguarda React renderizar o conteúdo antes de acionar a impressão
    const t1 = setTimeout(() => {
      window.print()
      // Limpa depois que o diálogo de impressão é tratado
      const cleanup = () => { setPrintAta(null) }
      window.addEventListener('afterprint', cleanup, { once: true })
      // Fallback: limpa após 5s caso afterprint não dispare (celular)
      const t2 = setTimeout(() => { setPrintAta(null); window.removeEventListener('afterprint', cleanup) }, 5000)
      return () => clearTimeout(t2)
    }, 800)
    return () => clearTimeout(t1)
  }, [printAta])

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
              <Btn variant="outline" size="xs" onClick={()=>imprimir(ata)}>🖨 PDF</Btn>
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
            <FG><label>Horário de Início</label><input type="time" value={form.hora} onChange={e=>setForm({...form,hora:e.target.value})} /></FG>
            <FG><label>Horário de Encerramento</label><input type="time" value={form.hora_fim} onChange={e=>setForm({...form,hora_fim:e.target.value})} /></FG>
            <FG><label>Abertura</label><input value={form.abertura} onChange={e=>setForm({...form,abertura:e.target.value})} placeholder="Quem abriu a reunião" /></FG>
            <FG><label>Louvor</label><input value={form.louvor} onChange={e=>setForm({...form,louvor:e.target.value})} placeholder="Quem/o que foi cantado" /></FG>
            <FG full><label>Palavra Inicial (Texto Bíblico)</label><input value={form.palavra_inicial} onChange={e=>setForm({...form,palavra_inicial:e.target.value})} placeholder="Ex: João 3:16 — ..." /></FG>
            <FG full><label>Registro da Reunião</label><textarea value={form.registro} onChange={e=>setForm({...form,registro:e.target.value})} style={{minHeight:120}} placeholder="Descreva o que aconteceu na reunião..." /></FG>
            <FG><label>Fechamento / Oração Final</label><input value={form.fechamento} onChange={e=>setForm({...form,fechamento:e.target.value})} placeholder="Quem fez a oração de encerramento" /></FG>
            <FG full><label>Link anexo <span style={{fontWeight:400,color:'var(--g)',fontSize:10}}>(documento, gravação, etc.)</span></label><input type="url" value={form.link} onChange={e=>setForm({...form,link:e.target.value})} placeholder="https://..." /></FG>
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
                  <div style={{fontSize:10,color:'var(--g)',marginTop:2}}>{v.unanime ? `✅ Unânime: ${v.unanime==='op1'?v.op1:v.unanime==='op2'?v.op2:'Abstenção'}` : `${v.op1}: ${(v.op1v||[]).length||v.qtd1||0} · ${v.op2}: ${(v.op2v||[]).length||v.qtd2||0} · Abs: ${(v.abstv||[]).length||v.qtd_abst||0}`}</div>
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

          <div style={{fontSize:11,color:'var(--g)',marginBottom:10}}>
            Preencha o <strong>número de votos</strong>, marque como <strong>Unânime</strong> em uma das opções, ou selecione os nomes individualmente (opcional).
          </div>

          {votForm.unanime && (
            <div style={{marginBottom:10,padding:'8px 12px',background:'rgba(34,197,94,.08)',border:'1px solid var(--grn)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:12,color:'var(--grn)',fontWeight:600}}>
                ✅ Unânime em: {votForm.unanime==='op1'?votForm.op1:votForm.unanime==='op2'?votForm.op2:'Abstenção'}
              </span>
              <button onClick={()=>setVotForm(f=>({...f,unanime:null,op1v:[],op2v:[],abstv:[]}))} style={{fontSize:11,color:'var(--g)',background:'none',border:'none',cursor:'pointer'}}>✕ desfazer</button>
            </div>
          )}

          {!votForm.unanime && form.presentes.length > 0 && (() => {
            const qtd1 = (votForm.op1v||[]).length || parseInt(votForm.qtd1)||0
            const qtd2 = (votForm.op2v||[]).length || parseInt(votForm.qtd2)||0
            const qtdA = (votForm.abstv||[]).length || parseInt(votForm.qtd_abst)||0
            const total = qtd1 + qtd2 + qtdA
            const max = form.presentes.length
            const over = total > max
            return (
              <div style={{marginBottom:10,padding:'6px 12px',borderRadius:7,background:over?'rgba(239,68,68,.1)':'var(--s2)',border:`1px solid ${over?'var(--red)':'var(--bd)'}`,fontSize:11,display:'flex',justifyContent:'space-between'}}>
                <span style={{color:'var(--g)'}}>Total de votos: <strong style={{color:over?'var(--red)':'var(--w)'}}>{total}</strong></span>
                <span style={{color:'var(--g)'}}>Presentes: <strong style={{color:'var(--cy)'}}>{max}</strong></span>
                {over && <span style={{color:'var(--red)',fontWeight:700}}>⚠ Excede presentes!</span>}
              </div>
            )
          })()}

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                {[
                  { key:'op1v', qtdKey:'qtd1', labelKey:'op1', unKey:'op1', color:'var(--grn)', other1:'op2v', other2:'abstv' },
                  { key:'op2v', qtdKey:'qtd2', labelKey:'op2', unKey:'op2', color:'var(--red)', other1:'op1v', other2:'abstv' },
                  { key:'abstv', qtdKey:'qtd_abst', labelKey:null, unKey:'abst', color:'var(--g)', other1:'op1v', other2:'op2v' },
                ].map(col => {
                  const isUnanime = votForm.unanime === col.unKey
                  const blocked = votForm.unanime && !isUnanime
                  const nomesSel = isUnanime ? form.presentes : (votForm[col.key]||[])
                  return (
                    <div key={col.key} style={{opacity:blocked?.4:1}}>
                      <div style={{marginBottom:6}}>
                        {col.labelKey
                          ? <input value={votForm[col.labelKey]} onChange={e=>{ if(!blocked) setVotForm(f=>({...f,[col.labelKey]:e.target.value})) }} readOnly={blocked} style={{width:'100%',padding:'5px 8px',fontSize:11,fontWeight:700,color:col.color,background:'var(--s2)',border:`1px solid ${col.color}`,borderRadius:6,boxSizing:'border-box'}} />
                          : <div style={{padding:'5px 8px',fontSize:11,fontWeight:700,color:col.color,border:`1px solid ${col.color}`,borderRadius:6,textAlign:'center'}}>Abstenção</div>
                        }
                        {/* Botão Unânime por opção */}
                        <button
                          disabled={blocked}
                          onClick={()=>setVotForm(f=>({...f, unanime: isUnanime ? null : col.unKey, op1v:[], op2v:[], abstv:[], qtd1:'', qtd2:'', qtd_abst:''}))}
                          style={{width:'100%',marginTop:4,padding:'4px',borderRadius:5,border:`1px solid ${isUnanime?col.color:'var(--bd)'}`,background:isUnanime?`${col.color}20`:'transparent',color:isUnanime?col.color:'var(--g)',cursor:blocked?'not-allowed':'pointer',fontSize:10,fontWeight:isUnanime?700:400}}>
                          {isUnanime ? '✅ Unânime' : '🎯 Marcar unânime'}
                        </button>
                        {/* Campo numérico */}
                        {!isUnanime && (
                          <input type="number" min="0" disabled={blocked}
                            value={nomesSel.length ? nomesSel.length : (votForm[col.qtdKey]||'')}
                            onChange={e=>{ if(!nomesSel.length && !blocked) setVotForm(f=>({...f,[col.qtdKey]:e.target.value})) }}
                            readOnly={nomesSel.length > 0}
                            placeholder="Nº de votos"
                            style={{width:'100%',marginTop:4,padding:'5px 8px',fontSize:12,textAlign:'center',background:'var(--s2)',border:`1px solid ${col.color}40`,borderRadius:6,boxSizing:'border-box',color:col.color,fontWeight:700}}
                          />
                        )}
                        {isUnanime && <div style={{fontSize:10,color:col.color,textAlign:'center',marginTop:3}}>todos os presentes</div>}
                      </div>
                      {!isUnanime && !blocked && form.presentes.length > 0 && (
                        <details style={{marginTop:4}}>
                          <summary style={{fontSize:10,color:'var(--g)',cursor:'pointer',userSelect:'none',padding:'3px 0'}}>Selecionar nomes (opcional)</summary>
                          <div style={{border:`1px solid ${col.color}40`,borderRadius:7,overflow:'hidden',maxHeight:180,overflowY:'auto',marginTop:4}}>
                            {form.presentes.map(nome => {
                              const jaVotou = (votForm[col.other1]||[]).includes(nome) || (votForm[col.other2]||[]).includes(nome)
                              const selecionado = (votForm[col.key]||[]).includes(nome)
                              const toggle = () => { if(jaVotou||blocked) return; setVotForm(f=>({...f,[col.key]:selecionado?f[col.key].filter(n=>n!==nome):[...(f[col.key]||[]),nome],[col.qtdKey]:''})) }
                              return (
                                <div key={nome} onClick={toggle} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 8px',borderBottom:'1px solid var(--bd)',cursor:jaVotou?'not-allowed':'pointer',background:selecionado?`${col.color}15`:jaVotou?'rgba(0,0,0,.2)':'transparent',opacity:jaVotou?.5:1,userSelect:'none'}}>
                                  <div style={{width:12,height:12,flexShrink:0,borderRadius:3,border:`2px solid ${selecionado?col.color:'var(--g)'}`,background:selecionado?col.color:'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>
                                    {selecionado&&<span style={{color:'#000',fontSize:9,fontWeight:900,lineHeight:1}}>✓</span>}
                                  </div>
                                  <span style={{fontSize:10,color:selecionado?col.color:jaVotou?'var(--g)':'var(--tx)'}}>{nomeDisp(nome,membros)}</span>
                                </div>
                              )
                            })}
                          </div>
                        </details>
                      )}
                    </div>
                  )
                })}
              </div>
        </Modal>
      )}

      {/* ── Modal visualizar/assinar ───────────────────────────────────────── */}
      {modalVer && (
        <Modal title={`ATA — ${tipoLabel(modalVer).toUpperCase()}`} onClose={()=>setModalVer(null)} wide
          footer={
            <div style={{display:'flex',gap:8,flexWrap:'wrap',width:'100%'}}>
              <Btn variant="outline" size="sm" onClick={()=>imprimir(modalVer)}>🖨 Gerar PDF</Btn>
              {!modalVer.assinatura_pastor && isPastor(user) && <Btn variant="green" onClick={()=>assinar(modalVer)}>✅ Assinar como Pastor</Btn>}
              {!modalVer.assinatura_secretario && isSecretario && <Btn variant="green" onClick={()=>assinar(modalVer)}>✅ Assinar como Secretário</Btn>}
              <Btn variant="outline" onClick={()=>setModalVer(null)} style={{marginLeft:'auto'}}>Fechar</Btn>
            </div>
          }>
          <div style={{fontSize:12,lineHeight:1.8}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
              <div><span style={{color:'var(--g)'}}>Data:</span> <strong style={{color:'var(--w)'}}>{fmtBR(new Date(modalVer.data+'T00:00:00'))}</strong></div>
              {modalVer.hora && <div><span style={{color:'var(--g)'}}>Início:</span> <strong style={{color:'var(--w)'}}>{modalVer.hora}</strong></div>}
              {modalVer.hora_fim && <div><span style={{color:'var(--g)'}}>Encerramento:</span> <strong style={{color:'var(--w)'}}>{modalVer.hora_fim}</strong></div>}
              {modalVer.abertura && <div><span style={{color:'var(--g)'}}>Abertura:</span> <strong style={{color:'var(--w)'}}>{modalVer.abertura}</strong></div>}
              {modalVer.louvor && <div><span style={{color:'var(--g)'}}>Louvor:</span> <strong style={{color:'var(--w)'}}>{modalVer.louvor}</strong></div>}
              {modalVer.fechamento && <div><span style={{color:'var(--g)'}}>Fechamento:</span> <strong style={{color:'var(--w)'}}>{modalVer.fechamento}</strong></div>}
              {modalVer.link && <div style={{gridColumn:'1/-1'}}><span style={{color:'var(--g)'}}>Link: </span><a href={modalVer.link} target="_blank" rel="noopener" style={{color:'var(--cy)',fontSize:11}}>{modalVer.link}</a></div>}
            </div>
            {modalVer.palavra_inicial && <div style={{marginBottom:10}}><div style={{fontSize:10,color:'var(--cy)',letterSpacing:1,textTransform:'uppercase',marginBottom:3}}>Palavra Inicial</div><div style={{color:'var(--tx)'}}>{modalVer.palavra_inicial}</div></div>}
            {modalVer.registro && <div style={{marginBottom:10}}><div style={{fontSize:10,color:'var(--cy)',letterSpacing:1,textTransform:'uppercase',marginBottom:3}}>Registro</div><div style={{color:'var(--tx)',whiteSpace:'pre-wrap'}}>{modalVer.registro}</div></div>}
            {(modalVer.votacoes||[]).length>0 && (
              <div style={{marginBottom:10}}>
                <div style={{fontSize:10,color:'var(--cy)',letterSpacing:1,textTransform:'uppercase',marginBottom:6}}>Votações</div>
                {modalVer.votacoes.map((v,i)=>(
                  <div key={i} style={{background:'var(--s2)',borderRadius:7,padding:'10px 12px',marginBottom:8}}>
                    <div style={{fontWeight:600,color:'var(--w)',marginBottom:6}}>{v.tema}</div>
                    {v.unanime
                      ? <div style={{fontSize:12,color:'var(--grn)',fontWeight:600}}>✅ Unânime — {v.unanime==='op1'?v.op1:v.unanime==='op2'?v.op2:'Abstenção'} (todos os presentes)</div>
                      : <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,fontSize:11}}>
                          {[{l:v.op1,ns:v.op1v||[],qtd:v.qtd1,c:'var(--grn)'},{l:v.op2,ns:v.op2v||[],qtd:v.qtd2,c:'var(--red)'},{l:'Abstenção',ns:v.abstv||[],qtd:v.qtd_abst,c:'var(--g)'}].map(op=>{
                            const tot = op.ns.length || parseInt(op.qtd)||0
                            const label = tot > 0 ? `${op.l} (${tot})` : op.l
                            return (
                              <div key={op.l}>
                                <div style={{fontWeight:700,color:op.c,marginBottom:3}}>{label}</div>
                                {op.ns.map(n=><div key={n} style={{fontSize:10,color:'var(--tx)'}}>{nomeDisp(n,membros)}</div>)}
                              </div>
                            )
                          })}
                        </div>
                    }
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
          {/* Aviso de documento não oficial */}
          {printAta.status !== 'assinada' && (
            <div style={{border:'3px solid #cc0000',borderRadius:6,padding:'8px 14px',marginBottom:16,textAlign:'center',background:'#fff8f8'}}>
              <div style={{fontWeight:900,fontSize:14,color:'#cc0000',letterSpacing:2,textTransform:'uppercase'}}>⚠ DOCUMENTO COM PENDÊNCIAS — NÃO OFICIAL</div>
              <div style={{fontSize:11,color:'#cc0000',marginTop:3}}>
                Este documento ainda não possui todas as assinaturas necessárias.
                {!printAta.assinatura_pastor && ' Falta: assinatura do Pastor.'}
                {!printAta.assinatura_secretario && ' Falta: assinatura do Secretário.'}
              </div>
            </div>
          )}
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
              {printAta.hora ? ` | Início: ${printAta.hora}` : ''}
              {printAta.hora_fim ? ` | Encerramento: ${printAta.hora_fim}` : ''}
            </div>
          </div>

          {/* Conteúdo */}
          {printAta.abertura && <p style={{margin:'0 0 8px'}}><strong>Abertura:</strong> {printAta.abertura}</p>}
          {printAta.louvor && <p style={{margin:'0 0 8px'}}><strong>Louvor:</strong> {printAta.louvor}</p>}
          {printAta.palavra_inicial && <p style={{margin:'0 0 8px'}}><strong>Palavra Inicial:</strong> {printAta.palavra_inicial}</p>}
          {printAta.fechamento && <p style={{margin:'0 0 8px'}}><strong>Fechamento / Oração Final:</strong> {printAta.fechamento}</p>}
          {printAta.link && <p style={{margin:'0 0 8px'}}><strong>Link anexo:</strong> {printAta.link}</p>}
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
                  {v.unanime
                    ? <div style={{fontSize:11,fontWeight:600}}>✅ Unânime — {v.unanime==='op1'?v.op1:v.unanime==='op2'?v.op2:'Abstenção'} (todos os presentes)</div>
                    : <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,fontSize:11}}>
                        {[
                          {l:v.op1, ns:v.op1v||[], qtd:v.qtd1},
                          {l:v.op2, ns:v.op2v||[], qtd:v.qtd2},
                          {l:'Abstenção', ns:v.abstv||[], qtd:v.qtd_abst},
                        ].map(op=>{
                          const tot = op.ns.length || parseInt(op.qtd)||0
                          const nomes = op.ns.map(n=>nomeOficial(n)).join(', ')
                          return (
                            <div key={op.l}>
                              <strong>{op.l}{tot>0?` (${tot})`:''}: </strong>
                              {nomes || (tot>0 ? `${tot} voto(s)` : '—')}
                            </div>
                          )
                        })}
                      </div>
                  }
                </div>
              ))}
            </div>
          )}

          {/* Lista de presença */}
          <div style={{margin:'12px 0',borderTop:'1px solid #ccc',paddingTop:10}}>
            <strong style={{display:'block',marginBottom:8,textTransform:'uppercase',fontSize:12}}>Lista de Presença — {(printAta.presentes||[]).length} pessoa(s)</strong>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'2px 12px'}}>
              {(printAta.presentes||[]).map((n,i)=>(
                <div key={n} style={{fontSize:11,padding:'2px 0'}}>
                  {i+1}. {nomeOficial(n)}
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
