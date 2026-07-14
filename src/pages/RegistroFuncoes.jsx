import { useState, useEffect } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbUpdate, dbDelete } from '../lib/supabase.js'
import { isAdmin, normalizar, DISP_OPTS, nomeDisp } from '../lib/utils.js'
import { podeExcluirOuSolicitar } from '../lib/solicitacoes.js'
import { Tabs, Btn, Modal, FormGrid, FG, Empty } from '../components/UI.jsx'

const CAT_LABEL = { culto:'⛪ Culto', louvor:'🎵 Equipe de Louvor', eb:'📖 Escola Bíblica', outro:'📌 Outro' }
const emptyFn = { nome:'', cat:'culto', apl:'ambos', membros:[], disponibilidades:{} }

// Páginas disponíveis para conceder acesso extra (secretario/tesoureiro/professor/membro)
const PAGINAS = [
  { id:'escala-culto', l:'Escala de Culto' },
  { id:'escala-eb', l:'Escola Bíblica' },
  { id:'escala-louvor', l:'Equipe de Louvor' },
  { id:'pregacao', l:'Pregação' },
  { id:'musicas', l:'Músicas' },
  { id:'agenda', l:'Agenda' },
  { id:'avisos', l:'Avisos' },
  { id:'membros', l:'Membros' },
  { id:'funcoes', l:'Registro de Funções' },
  { id:'lideranca', l:'Liderança' },
  { id:'financeiro', l:'Financeiro' },
  { id:'devocional', l:'Devocional' },
]
// Páginas para gestores de louvor — vocal e instrumental separados
const PAGINAS_GESTOR = [
  { id:'escala-culto', l:'Escala de Culto' },
  { id:'escala-eb', l:'Escola Bíblica' },
  { id:'escala-louvor', l:'Equipe de Louvor' },
  { id:'louvor-vocal', l:'Louvor — editar Vocal' },
  { id:'louvor-instrumental', l:'Louvor — editar Instrumental' },
  { id:'pregacao', l:'Pregação' },
  { id:'musicas', l:'Músicas' },
  { id:'agenda', l:'Agenda' },
  { id:'avisos', l:'Avisos' },
  { id:'membros', l:'Membros' },
  { id:'funcoes', l:'Registro de Funções' },
  { id:'lideranca', l:'Liderança' },
  { id:'financeiro', l:'Financeiro' },
  { id:'devocional', l:'Devocional' },
]
// Defaults pré-selecionados por tipo de gestor (todos editáveis, nenhum travado)
const GESTOR_DEFAULTS = {
  vocal: ['escala-louvor','louvor-vocal','musicas','agenda','avisos'],
  instrumental: ['escala-louvor','louvor-instrumental','musicas','agenda','avisos'],
}
const PERFIL_BASE = {
  secretario: [],
  tesoureiro: [],
  professor: ['devocional','escala-eb','agenda','avisos'],
  membro: ['agenda','avisos'],
}

const DIAS_SEMANA = [
  { v: 0, l: 'Domingo' }, { v: 1, l: 'Segunda-feira' }, { v: 2, l: 'Terça-feira' },
  { v: 3, l: 'Quarta-feira' }, { v: 4, l: 'Quinta-feira' }, { v: 5, l: 'Sexta-feira' }, { v: 6, l: 'Sábado' },
]
const PERIOD_LABEL = { semanal: 'Toda semana', quinzenal: 'A cada 2 semanas', mensal: 'Uma vez por mês' }
const emptyLem = { titulo: '', mensagem: '', periodicidade: 'semanal', dia_semana: 1, ativo: true, destinatarios: [] }

export default function RegistroFuncoes() {
  const { state, dispatch } = useStore()
  const { funcoes, membros, gestores, lembretes, user } = state
  const [tab, setTab] = useState('funcoes')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyFn)
  const [editId, setEditId] = useState(null)
  const [busca, setBusca] = useState('')
  const [aberta, setAberta] = useState(null)
  const [loading, setLoading] = useState(false)
  const [lemModal, setLemModal] = useState(false)
  const [lemForm, setLemForm] = useState(emptyLem)
  const [lemEditId, setLemEditId] = useState(null)
  const [lemBusca, setLemBusca] = useState('')
  const emptyGest = { louvor:['','','','','',''], secretario:'', tesoureiro:'', permissoes:{} }
  const [gestForm, setGestForm] = useState(() => emptyGest)

  // Sync when gestores loads — mescla vocal[] + instrumental[] em louvor unificado
  useEffect(() => {
    if (!gestores) return
    const vArr = Array.isArray(gestores.vocal) ? gestores.vocal : []
    const iArr = Array.isArray(gestores.instrumental) ? gestores.instrumental : []
    const merged = [...new Set([...vArr, ...iArr].filter(Boolean))]
    while (merged.length < 6) merged.push('')
    const perms = { ...(gestores.permissoes || {}) }
    merged.filter(Boolean).forEach(nome => {
      if (!perms[nome]?.length) perms[nome] = ['escala-louvor','louvor-vocal','louvor-instrumental','musicas','agenda','avisos']
    })
    setGestForm({ ...emptyGest, secretario: gestores.secretario||'', tesoureiro: gestores.tesoureiro||'', louvor: merged, permissoes: perms })
  }, [gestores])

  const nomes = [...(membros||[])].map(m=>m.nome).sort()
  const filtered = busca ? nomes.filter(n=>normalizar(n).includes(normalizar(busca))) : nomes

  // Membros que estão numa função mas não existem mais no cadastro
  const nomesSet = new Set(nomes)
  const orfaos = (nome) => !nomesSet.has(nome)

  const removerOrfao = (nome) => {
    setForm(f => {
      const newMbs = f.membros.filter(m => m !== nome)
      const newDisp = {...f.disponibilidades}
      delete newDisp[nome]
      return {...f, membros: newMbs, disponibilidades: newDisp}
    })
  }

  const grupos = { culto:[], louvor:[], eb:[], outro:[] }
  ;(funcoes||[]).forEach(f => (grupos[f.cat]||grupos.outro).push(f))

  const abrirFn = (fn=null) => {
    setForm(fn ? {
      nome:fn.nome, cat:fn.cat, apl:fn.apl,
      membros:[...(fn.membros||[])],
      disponibilidades:{...(fn.disponibilidades||{})}
    } : emptyFn)
    setEditId(fn?.id||null); setBusca(''); setModal(true)
  }

  const toggleMb = (nome) => {
    setForm(f => {
      const hasMb = f.membros.includes(nome)
      const newMbs = hasMb ? f.membros.filter(m=>m!==nome) : [...f.membros, nome]
      const newDisp = {...f.disponibilidades}
      if (!hasMb) newDisp[nome] = 'semanal'
      else delete newDisp[nome]
      return {...f, membros:newMbs, disponibilidades:newDisp}
    })
  }

  const setDisp = (nome, val) => {
    setForm(f => ({...f, disponibilidades:{...f.disponibilidades,[nome]:val}}))
  }

  const salvarFn = async () => {
    if (!form.nome) { dispatch({ type:'TOAST', value:'⚠ Informe o nome.' }); return }
    setLoading(true)
    const row = {
      nome:form.nome, cat:form.cat, apl:form.apl,
      membros:JSON.stringify(form.membros),
      disponibilidades:JSON.stringify(form.disponibilidades||{})
    }
    if (editId) {
      await dbUpdate('funcoes', editId, row)
      dispatch({ type:'SET', key:'funcoes', value:(funcoes||[]).map(f=>f.id===editId?{...f,...row,membros:form.membros,disponibilidades:form.disponibilidades}:f) })
    } else {
      const novo = await dbInsert('funcoes', row)
      dispatch({ type:'SET', key:'funcoes', value:[...(funcoes||[]), {...(novo||{id:Date.now()}),...row,membros:form.membros,disponibilidades:form.disponibilidades}] })
    }
    setLoading(false); setModal(false)
    dispatch({ type:'TOAST', value:'✅ Função salva!' })
  }

  const excluirFn = async (id, nome) => {
    const ok = await podeExcluirOuSolicitar(user, dispatch, { tabela:'funcoes', registroId:id, descricao:`Excluir função "${nome}"` })
    if (!ok) return
    await dbDelete('funcoes', id)
    dispatch({ type:'SET', key:'funcoes', value:(funcoes||[]).filter(f=>f.id!==id) })
    dispatch({ type:'TOAST', value:'🗑 Removida.' })
  }

  const setPermissao = (nome, pageId, checked) => {
    if (!nome) return
    setGestForm(f => {
      const prev = f.permissoes[nome] || []
      const next = checked ? [...new Set([...prev, pageId])] : prev.filter(p => p !== pageId)
      return { ...f, permissoes: { ...f.permissoes, [nome]: next } }
    })
  }

  const salvarGestores = async () => {
    const { dbGet, dbUpdate: upd, dbInsert: ins } = await import('../lib/supabase.js')
    setLoading(true)
    const existing = await dbGet('gestores')
    const row = {
      vocal: JSON.stringify(gestForm.louvor.filter(Boolean)),
      instrumental: JSON.stringify([]),
      secretario: gestForm.secretario || '',
      tesoureiro: gestForm.tesoureiro || '',
      permissoes: JSON.stringify(gestForm.permissoes || {}),
    }
    if (existing.length) await upd('gestores', existing[0].id, row)
    else await ins('gestores', row)
    dispatch({ type:'SET', key:'gestores', value:{ ...gestForm, vocal: gestForm.louvor.filter(Boolean), instrumental: [] } })
    setLoading(false)
    dispatch({ type:'TOAST', value:'✅ Gestores salvos!' })
  }

  const abrirLem = (lem = null) => {
    if (lem) {
      setLemForm({
        titulo: lem.titulo || '',
        mensagem: lem.mensagem || '',
        periodicidade: lem.periodicidade || 'semanal',
        dia_semana: lem.dia_semana ?? 1,
        ativo: lem.ativo ?? true,
        destinatarios: Array.isArray(lem.destinatarios) ? [...lem.destinatarios] : [],
      })
      setLemEditId(lem.id)
    } else {
      setLemForm(emptyLem)
      setLemEditId(null)
    }
    setLemBusca('')
    setLemModal(true)
  }

  const salvarLem = async () => {
    if (!lemForm.titulo) { dispatch({ type:'TOAST', value:'⚠ Informe o título.' }); return }
    setLoading(true)
    const row = {
      titulo: lemForm.titulo,
      mensagem: lemForm.mensagem,
      periodicidade: lemForm.periodicidade,
      dia_semana: lemForm.dia_semana,
      ativo: lemForm.ativo,
      destinatarios: lemForm.destinatarios || [],
    }
    if (lemEditId) {
      await dbUpdate('lembretes', lemEditId, row)
      dispatch({ type:'SET', key:'lembretes', value:(lembretes||[]).map(l=>l.id===lemEditId?{...l,...row,destinatarios:lemForm.destinatarios}:l) })
    } else {
      const novo = await dbInsert('lembretes', row)
      dispatch({ type:'SET', key:'lembretes', value:[...(lembretes||[]), {...(novo||{id:Date.now()}),...row,destinatarios:lemForm.destinatarios}] })
    }
    setLoading(false); setLemModal(false)
    dispatch({ type:'TOAST', value:'✅ Lembrete salvo!' })
  }

  const excluirLem = async (id) => {
    if (!window.confirm('Remover este lembrete?')) return
    await dbDelete('lembretes', id)
    dispatch({ type:'SET', key:'lembretes', value:(lembretes||[]).filter(l=>l.id!==id) })
    dispatch({ type:'TOAST', value:'🗑 Removido.' })
  }

  const enviarAgora = async (lem) => {
    dispatch({ type:'TOAST', value:'📤 Enviando...' })
    try {
      const r = await fetch('/api/enviar-lembrete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lem.id }),
      })
      const data = await r.json()
      if (data.enviados > 0) dispatch({ type:'TOAST', value:`✅ Enviado para ${data.enviados} pessoa${data.enviados!==1?'s':''}!` })
      else dispatch({ type:'TOAST', value:'⚠ Nenhum e-mail enviado (verifique os destinatários).' })
    } catch {
      dispatch({ type:'TOAST', value:'❌ Erro ao enviar.' })
    }
  }

  const toggleLemAtivo = async (lem) => {
    const novo = !lem.ativo
    await dbUpdate('lembretes', lem.id, { ativo: novo })
    dispatch({ type:'SET', key:'lembretes', value:(lembretes||[]).map(l=>l.id===lem.id?{...l,ativo:novo}:l) })
  }

  const toggleDestinatario = (membro) => {
    setLemForm(f => {
      const dest = f.destinatarios || []
      const existe = dest.some(d => d.nome === membro.nome)
      if (existe) return {...f, destinatarios: dest.filter(d => d.nome !== membro.nome)}
      return {...f, destinatarios: [...dest, { nome: membro.nome, email: membro.email || '' }]}
    })
  }

  // Relatório de funções por pessoa
  const relatorio = [...(membros||[])].map(m => {
    const fns = (funcoes||[]).filter(f=>(f.membros||[]).includes(m.nome))
    return { ...m, fns }
  }).sort((a,b) => b.fns.length - a.fns.length)

  return (
    <div>
      <Tabs tabs={[{id:'funcoes',label:'⚙️ Funções'},{id:'gestores',label:'👤 Gestores'},{id:'lembretes',label:'🔔 Lembretes'},{id:'relatorio',label:'📊 Relatório'}]} active={tab} onChange={setTab} />

      {tab==='funcoes' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
            <Btn onClick={()=>abrirFn()}>+ Nova Função</Btn>
          </div>
          {Object.entries(CAT_LABEL).map(([cat,label]) => {
            const fns = grupos[cat]||[]
            if (!fns.length) return null
            return (
              <div key={cat} style={{marginBottom:20}}>
                <div style={{fontFamily:'var(--font-display)',fontSize:14,letterSpacing:2,color:'var(--cy)',marginBottom:8,borderBottom:'1px solid var(--bd)',paddingBottom:5}}>{label}</div>
                {fns.map(fn=>(
                  <div key={fn.id} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,marginBottom:8,overflow:'hidden'}}>
                    <div onClick={()=>setAberta(aberta===fn.id?null:fn.id)} style={{background:'var(--s2)',padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontFamily:'var(--font-display)',fontSize:13,letterSpacing:2,color:'var(--w)'}}>{fn.nome}</span>
                        <span style={{background:'#2a2a2a',color:'var(--gl)',fontSize:9,padding:'2px 7px',borderRadius:99,fontWeight:600}}>{(fn.membros||[]).length} pessoas</span>
                      </div>
                      <div style={{display:'flex',gap:5}} onClick={e=>e.stopPropagation()}>
                        <Btn variant="outline" size="xs" onClick={()=>abrirFn(fn)}>✏</Btn>
                        {isAdmin(user) && <Btn variant="danger" size="xs" onClick={()=>excluirFn(fn.id, fn.nome)}>🗑</Btn>}
                      </div>
                    </div>
                    {aberta===fn.id && (
                      <div style={{padding:'11px 14px'}}>
                        {(fn.membros||[]).length ? (fn.membros||[]).map(m=>{
                          const disp = (fn.disponibilidades||{})[m]
                          const ghost = orfaos(m)
                          return (
                            <div key={m} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0',borderBottom:'1px solid var(--bd)'}}>
                              <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 9px',background:ghost?'rgba(239,68,68,.08)':'var(--s2)',border:`1px solid ${ghost?'rgba(239,68,68,.4)':'var(--bd)'}`,borderRadius:6,fontSize:11,color:ghost?'var(--red)':'var(--tx)',flex:1}}>
                                {ghost ? '⚠' : '👤'} {ghost ? m : nomeDisp(m, membros)}
                                {ghost && <span style={{fontSize:9,color:'var(--red)',marginLeft:4}}>não encontrado no cadastro</span>}
                              </span>
                              {disp && !ghost && <span style={{fontSize:10,color:'var(--cy)',background:'var(--cdim)',padding:'3px 8px',borderRadius:5,border:'1px solid var(--cgl)'}}>{DISP_OPTS.find(([v])=>v===disp)?.[1]||disp}</span>}
                            </div>
                          )
                        }) : <span style={{color:'var(--g)',fontSize:12}}>Nenhum membro cadastrado.</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {tab==='gestores' && (
        <div>
          <div style={{fontSize:11,color:'var(--g)',marginBottom:14,lineHeight:1.6,background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:8,padding:'10px 14px'}}>
            Defina quem ocupa cada cargo e quais paginas extras cada pessoa pode acessar alem do que o cargo ja libera. Clique em Salvar Gestores ao terminar.
          </div>

          {/* Secretário e Tesoureiro */}
          {[
            { tipo:'secretario', label:'Secretario(a)', perfil:'secretario' },
            { tipo:'tesoureiro', label:'Tesoureiro(a)', perfil:'tesoureiro' },
          ].map(({ tipo, label, perfil: pf })=>{
            const nome = gestForm[tipo] || ''
            const base = PERFIL_BASE[pf] || []
            const extras = gestForm.permissoes[nome] || []
            return (
              <div key={tipo} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,marginBottom:14,overflow:'hidden'}}>
                <div style={{background:'var(--s2)',padding:'9px 14px',fontFamily:'var(--font-display)',fontSize:13,letterSpacing:2,color:'var(--w)'}}>{label}</div>
                <div style={{padding:'11px 14px'}}>
                  <select value={nome} onChange={e=>setGestForm({...gestForm,[tipo]:e.target.value})} style={{width:'100%',padding:'7px 8px',fontSize:12,marginBottom:10}}>
                    <option value="">— Nenhum —</option>
                    {nomes.map(n=><option key={n} value={n}>{nomeDisp(n, membros)}</option>)}
                  </select>
                  {nome && (
                    <div>
                      <div style={{fontSize:9,color:'var(--g)',letterSpacing:1,textTransform:'uppercase',marginBottom:7}}>Acesso a paginas</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                        {PAGINAS.map(p=>{
                          const incluso = base.includes(p.id)
                          const checked = incluso || extras.includes(p.id)
                          return (
                            <label key={p.id} style={{display:'flex',alignItems:'center',gap:5,padding:'4px 9px',borderRadius:6,border:`1px solid ${incluso?'var(--cgl)':checked?'var(--cy)':'var(--bd)'}`,background:incluso?'var(--cdim)':checked?'rgba(0,188,212,.08)':'transparent',cursor:incluso?'default':'pointer',fontSize:11,color:incluso?'var(--cy)':checked?'var(--cy)':'var(--g)',opacity:incluso?.7:1}}>
                              <input type="checkbox" checked={checked} disabled={incluso} onChange={e=>setPermissao(nome,p.id,e.target.checked)} style={{accentColor:'var(--cy)',width:12,height:12,cursor:incluso?'default':'pointer'}} />
                              {p.l}
                              {incluso&&<span style={{fontSize:8,color:'var(--cy)',marginLeft:3}}>padrao</span>}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Gestores de Louvor — seção unificada */}
          <div style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,marginBottom:14,overflow:'hidden'}}>
            <div style={{background:'var(--s2)',padding:'9px 14px',fontFamily:'var(--font-display)',fontSize:13,letterSpacing:2,color:'var(--w)'}}>GESTORES DE LOUVOR</div>
            <div style={{padding:'11px 14px'}}>
              {[0,1,2,3,4,5].map(i=>{
                const nome = gestForm.louvor?.[i] || ''
                const extras = gestForm.permissoes[nome] || []
                return (
                  <div key={i} style={{borderBottom:i<5?'1px solid var(--bd)':'none',paddingBottom:i<5?12:0,marginBottom:i<5?12:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:nome?8:0}}>
                      <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:2,textTransform:'uppercase',width:65,flexShrink:0}}>Gestor {i+1}</div>
                      <select value={nome} onChange={e=>{
                        const v=[...(gestForm.louvor||['','','','','',''])];v[i]=e.target.value
                        const newPerms={...gestForm.permissoes}
                        if (e.target.value && (!newPerms[e.target.value]?.length)) {
                          newPerms[e.target.value] = ['escala-louvor','louvor-vocal','louvor-instrumental','musicas','agenda','avisos']
                        }
                        setGestForm({...gestForm,louvor:v,permissoes:newPerms})
                      }} style={{flex:1,padding:'6px 8px',fontSize:12}}>
                        <option value="">— Selecionar —</option>
                        {nomes.map(n=><option key={n} value={n}>{nomeDisp(n, membros)}</option>)}
                      </select>
                    </div>
                    {nome && (
                      <div style={{marginLeft:74}}>
                        <div style={{fontSize:9,color:'var(--g)',letterSpacing:1,textTransform:'uppercase',marginBottom:6}}>Acesso</div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                          {PAGINAS_GESTOR.map(p=>{
                            const checked = extras.includes(p.id)
                            return (
                              <label key={p.id} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 7px',borderRadius:5,border:`1px solid ${checked?'var(--cy)':'var(--bd)'}`,background:checked?'rgba(0,188,212,.08)':'transparent',cursor:'pointer',fontSize:10,color:checked?'var(--cy)':'var(--g)'}}>
                                <input type="checkbox" checked={checked} onChange={e=>setPermissao(nome,p.id,e.target.checked)} style={{accentColor:'var(--cy)',width:11,height:11,cursor:'pointer'}} />
                                {p.l}
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <Btn onClick={salvarGestores} disabled={loading}>{loading?'Salvando...':'Salvar Gestores'}</Btn>
        </div>
      )}

      {tab==='lembretes' && (
        <div>
          <div style={{fontSize:11,color:'var(--g)',marginBottom:14,lineHeight:1.6,background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:8,padding:'10px 14px'}}>
            Crie lembretes automáticos por e-mail para qualquer pessoa cadastrada. O sistema envia automaticamente na data e frequência configuradas, sem precisar de código.
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
            <Btn onClick={()=>abrirLem()}>+ Novo Lembrete</Btn>
          </div>
          {!(lembretes||[]).length && (
            <div style={{textAlign:'center',padding:'40px 0',color:'var(--g)',fontSize:13}}>Nenhum lembrete configurado ainda.</div>
          )}
          {(lembretes||[]).map(lem => {
            const dests = Array.isArray(lem.destinatarios) ? lem.destinatarios : []
            const dia = DIAS_SEMANA.find(d=>d.v===lem.dia_semana)?.l || ''
            return (
              <div key={lem.id} style={{background:'var(--s1)',border:`1px solid ${lem.ativo?'var(--bd)':'rgba(100,100,100,.3)'}`,borderRadius:10,marginBottom:10,overflow:'hidden',opacity:lem.ativo?1:.6}}>
                <div style={{background:'var(--s2)',padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:'var(--font-display)',fontSize:13,letterSpacing:1,color:'var(--w)',marginBottom:3}}>{lem.titulo}</div>
                    <div style={{fontSize:11,color:'var(--g)'}}>{PERIOD_LABEL[lem.periodicidade] || lem.periodicidade} · {dia} · {dests.length} destinatário{dests.length!==1?'s':''}</div>
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
                    <button onClick={()=>enviarAgora(lem)} title="Enviar agora" style={{padding:'4px 9px',fontSize:11,background:'rgba(0,188,212,.08)',border:'1px solid var(--cy)',borderRadius:5,color:'var(--cy)',cursor:'pointer',fontWeight:600}}>
                      📤 Enviar agora
                    </button>
                    <button onClick={()=>toggleLemAtivo(lem)} title={lem.ativo?'Pausar':'Ativar'} style={{padding:'4px 9px',fontSize:11,background:lem.ativo?'rgba(0,188,212,.15)':'var(--s1)',border:`1px solid ${lem.ativo?'var(--cy)':'var(--bd)'}`,borderRadius:5,color:lem.ativo?'var(--cy)':'var(--g)',cursor:'pointer'}}>
                      {lem.ativo ? '✅ Ativo' : '⏸ Pausado'}
                    </button>
                    <Btn variant="outline" size="xs" onClick={()=>abrirLem(lem)}>✏</Btn>
                    {isAdmin(user) && <Btn variant="danger" size="xs" onClick={()=>excluirLem(lem.id)}>🗑</Btn>}
                  </div>
                </div>
                {lem.mensagem && (
                  <div style={{padding:'10px 14px',fontSize:12,color:'var(--g)',borderTop:'1px solid var(--bd)',whiteSpace:'pre-wrap',lineHeight:1.6}}>{lem.mensagem}</div>
                )}
                {dests.length > 0 && (
                  <div style={{padding:'8px 14px',display:'flex',flexWrap:'wrap',gap:5,borderTop:'1px solid var(--bd)'}}>
                    {dests.map(d=>(
                      <span key={d.nome} style={{fontSize:10,padding:'3px 8px',borderRadius:99,background:'var(--s2)',border:'1px solid var(--bd)',color:d.email?'var(--cy)':'var(--red)'}}>
                        {d.nome.split(' ')[0]}{!d.email&&' ⚠ sem email'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab==='relatorio' && (
        <div>
          <div style={{marginBottom:14,display:'flex',gap:12}}>
            <div style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:8,padding:'10px 16px',flex:1,textAlign:'center'}}>
              <div style={{fontSize:9,color:'var(--g)',letterSpacing:2,textTransform:'uppercase'}}>Com função</div>
              <div style={{fontFamily:'var(--font-display)',fontSize:24,color:'var(--grn)'}}>{relatorio.filter(m=>m.fns.length>0).length}</div>
            </div>
            <div style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:8,padding:'10px 16px',flex:1,textAlign:'center'}}>
              <div style={{fontSize:9,color:'var(--g)',letterSpacing:2,textTransform:'uppercase'}}>Sem função</div>
              <div style={{fontFamily:'var(--font-display)',fontSize:24,color:'var(--red)'}}>{relatorio.filter(m=>m.fns.length===0).length}</div>
            </div>
            <div style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:8,padding:'10px 16px',flex:1,textAlign:'center'}}>
              <div style={{fontSize:9,color:'var(--g)',letterSpacing:2,textTransform:'uppercase'}}>Total</div>
              <div style={{fontFamily:'var(--font-display)',fontSize:24,color:'var(--cy)'}}>{relatorio.length}</div>
            </div>
          </div>
          {relatorio.map(m=>(
            <div key={m.id} style={{background:'var(--s1)',border:`1px solid ${m.fns.length===0?'rgba(239,68,68,.3)':'var(--bd)'}`,borderRadius:10,padding:'11px 15px',display:'flex',alignItems:'center',gap:10,marginBottom:7}}>
              <div style={{width:32,height:32,borderRadius:'50%',background:m.fns.length>0?'var(--cdim)':'rgba(239,68,68,.1)',border:`2px solid ${m.fns.length>0?'var(--cy)':'var(--red)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:m.fns.length>0?'var(--cy)':'var(--red)',flexShrink:0}}>{m.fns.length}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--w)'}}>{m.nome}</div>
                <div style={{fontSize:11,color:'var(--g)',marginTop:2}}>
                  {m.fns.length===0
                    ? <span style={{color:'var(--red)'}}>Sem função cadastrada</span>
                    : m.fns.map(f=>f.nome).join(' · ')
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {lemModal && (
        <Modal title={lemEditId ? 'EDITAR LEMBRETE' : 'NOVO LEMBRETE'} onClose={()=>setLemModal(false)} wide
          footer={<><Btn variant="outline" onClick={()=>setLemModal(false)}>Cancelar</Btn><Btn onClick={salvarLem} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <FormGrid>
            <FG full>
              <label>Título (assunto do e-mail)</label>
              <input value={lemForm.titulo} onChange={e=>setLemForm({...lemForm,titulo:e.target.value})} placeholder="Ex: Lembrete de escala" />
            </FG>
            <FG>
              <label>Frequência</label>
              <select value={lemForm.periodicidade} onChange={e=>setLemForm({...lemForm,periodicidade:e.target.value})}>
                <option value="semanal">Toda semana</option>
                <option value="quinzenal">A cada 2 semanas</option>
                <option value="mensal">Uma vez por mês</option>
              </select>
            </FG>
            <FG>
              <label>Dia de envio</label>
              <select value={lemForm.dia_semana} onChange={e=>setLemForm({...lemForm,dia_semana:Number(e.target.value)})}>
                {DIAS_SEMANA.map(d=><option key={d.v} value={d.v}>{d.l}</option>)}
              </select>
            </FG>
            <FG full>
              <label>Mensagem</label>
              <textarea value={lemForm.mensagem} onChange={e=>setLemForm({...lemForm,mensagem:e.target.value})}
                rows={5} placeholder="Escreva aqui o corpo do e-mail..." style={{resize:'vertical'}} />
            </FG>
          </FormGrid>

          <div style={{marginTop:14}}>
            <label>Destinatários</label>
            <div style={{border:'1px solid var(--bd)',borderRadius:7,overflow:'hidden',marginTop:4}}>
              <input placeholder="🔍 Buscar membro..." value={lemBusca} onChange={e=>setLemBusca(e.target.value)} style={{border:'none',borderBottom:'1px solid var(--bd)',borderRadius:0}} />
              <div style={{maxHeight:240,overflowY:'auto',background:'var(--s2)'}}>
                {(membros||[])
                  .filter(m => !lemBusca || normalizar(m.nome).includes(normalizar(lemBusca)))
                  .sort((a,b)=>a.nome.localeCompare(b.nome))
                  .map(m => {
                    const sel = (lemForm.destinatarios||[]).some(d=>d.nome===m.nome)
                    return (
                      <label key={m.nome} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',cursor:'pointer',fontSize:12,color:sel?'var(--cy)':'var(--tx)',background:sel?'var(--cdim)':'',borderBottom:'1px solid var(--bd)'}}>
                        <input type="checkbox" checked={sel} onChange={()=>toggleDestinatario(m)} style={{accentColor:'var(--cy)',width:14,height:14,flexShrink:0}} />
                        <span style={{flex:1}}>{nomeDisp(m.nome, membros)}</span>
                        {!m.email && <span style={{fontSize:9,color:'var(--red)',background:'rgba(239,68,68,.1)',padding:'2px 6px',borderRadius:4}}>sem email</span>}
                      </label>
                    )
                  })}
              </div>
            </div>
            {(lemForm.destinatarios||[]).filter(d=>!d.email).length > 0 && (
              <div style={{marginTop:6,fontSize:11,color:'var(--red)'}}>⚠ Alguns destinatários não têm e-mail cadastrado — não receberão o lembrete.</div>
            )}
          </div>
        </Modal>
      )}

      {modal && (
        <Modal title={editId?'EDITAR FUNÇÃO':'NOVA FUNÇÃO'} onClose={()=>setModal(false)} wide
          footer={<><Btn variant="outline" onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={salvarFn} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <FormGrid>
            <FG full><label>Nome da Função</label><input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} /></FG>
            <FG><label>Categoria</label><select value={form.cat} onChange={e=>setForm({...form,cat:e.target.value})}>{Object.entries(CAT_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></FG>
            <FG><label>Aplicável a</label><select value={form.apl} onChange={e=>setForm({...form,apl:e.target.value})}><option value="ambos">Sábado e Domingo</option><option value="sabado">Só Sábado</option><option value="domingo">Só Domingo</option><option value="na">Não aplica</option></select></FG>
          </FormGrid>
          {/* Membros órfãos — existem na função mas foram removidos/renomeados no cadastro */}
          {form.membros.filter(orfaos).length > 0 && (
            <div style={{marginTop:12,background:'rgba(239,68,68,.07)',border:'1px solid rgba(239,68,68,.35)',borderRadius:8,padding:'10px 14px'}}>
              <div style={{fontSize:11,color:'var(--red)',fontWeight:700,marginBottom:8}}>⚠ Membros não encontrados no cadastro atual</div>
              <div style={{fontSize:10,color:'var(--g)',marginBottom:10}}>Esses nomes estão salvos nesta função mas não existem mais como membros. Clique em ✕ para remover.</div>
              {form.membros.filter(orfaos).map(m => (
                <div key={m} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'1px solid rgba(239,68,68,.2)'}}>
                  <span style={{flex:1,fontSize:12,color:'var(--red)'}}>{m}</span>
                  <button onClick={() => removerOrfao(m)}
                    style={{padding:'3px 10px',fontSize:11,background:'rgba(239,68,68,.15)',border:'1px solid rgba(239,68,68,.4)',borderRadius:5,color:'var(--red)',cursor:'pointer',fontWeight:700}}>
                    ✕ Remover
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{marginTop:12}}>
            <label>Membros nesta função</label>
            <div style={{border:'1px solid var(--bd)',borderRadius:7,overflow:'hidden',marginTop:4}}>
              <input placeholder="🔍 Buscar membro..." value={busca} onChange={e=>setBusca(e.target.value)} style={{border:'none',borderBottom:'1px solid var(--bd)',borderRadius:0}} />
              <div style={{maxHeight:260,overflowY:'auto',background:'var(--s2)'}}>
                {filtered.map(n=>(
                  <div key={n} style={{borderBottom:'1px solid var(--bd)'}}>
                    <label style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',cursor:'pointer',fontSize:12,color:form.membros.includes(n)?'var(--cy)':'var(--tx)',background:form.membros.includes(n)?'var(--cdim)':''}}>
                      <input type="checkbox" checked={form.membros.includes(n)} onChange={()=>toggleMb(n)} style={{accentColor:'var(--cy)',width:15,height:15,flexShrink:0}} /> {nomeDisp(n, membros)}
                    </label>
                    {form.membros.includes(n) && (
                      <div style={{padding:'4px 12px 8px 36px',background:'var(--cdim)'}}>
                        <select value={form.disponibilidades[n]||'semanal'} onChange={e=>setDisp(n,e.target.value)} style={{fontSize:11,padding:'4px 8px',background:'var(--s2)',border:'1px solid var(--cy)',borderRadius:5,color:'var(--cy)',width:'auto'}}>
                          {DISP_OPTS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
