import { useState, useMemo } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbUpdate, dbDelete } from '../lib/supabase.js'
import { isPastor, isAdmin, waLink, normalizar, nomeDisp, primeiroUltimo } from '../lib/utils.js'
import { SecHeader, Btn, Modal, FormGrid, FG, Empty } from '../components/UI.jsx'

const CARGOS = [
  'Pastor', 'Co-Pastor', 'Pastora', 'Evangelista', 'Missionário(a)',
  'Presbítero', 'Diácono', 'Diaconisa',
  'Líder de Louvor', 'Líder de Jovens', 'Líder de Mulheres', 'Líder de Homens',
  'Secretário(a)', 'Tesoureiro(a)', 'Outro',
]

const empty = { membro_nome:'', cargo:'', cargo_custom:'', nome:'', tel:'', email:'', ordenacao:'' }

export default function Lideranca() {
  const { state, dispatch } = useStore()
  const { lideranca, membros, user } = state
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [buscaMembro, setBuscaMembro] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  // Lista ordenada por ordenacao, depois por nome
  const lista = useMemo(() => [...lideranca].sort((a,b) => {
    const oa = a.ordenacao ?? 999, ob = b.ordenacao ?? 999
    if (oa !== ob) return oa - ob
    return (a.nome||'').localeCompare(b.nome||'')
  }), [lideranca])

  // Filtro de membros para o dropdown
  const membrosFiltrados = useMemo(() => {
    if (!buscaMembro) return membros.slice(0, 30)
    const q = normalizar(buscaMembro)
    return membros.filter(m => normalizar(m.nome).includes(q)).slice(0, 20)
  }, [membros, buscaMembro])

  const selecionarMembro = (m) => {
    setForm(f => ({
      ...f,
      membro_nome: m.nome,
      nome: nomeDisp(m.nome, membros),
      tel: f.tel || m.tel || '',
      email: f.email || m.email || '',
    }))
    setBuscaMembro(m.nome_exibicao || primeiroUltimo(m.nome))
    setShowDropdown(false)
  }

  const abrir = (l = null) => {
    if (l) {
      setForm({
        membro_nome: l.membro_nome || '',
        cargo: CARGOS.includes(l.cargo) ? l.cargo : (l.cargo ? 'Outro' : ''),
        cargo_custom: CARGOS.includes(l.cargo) ? '' : (l.cargo || ''),
        nome: l.nome || '',
        tel: l.tel || '',
        email: l.email || '',
        ordenacao: l.ordenacao ?? '',
      })
      setBuscaMembro(l.membro_nome ? (nomeDisp(l.membro_nome, membros)) : '')
      setEditId(l.id)
    } else {
      setForm(empty)
      setBuscaMembro('')
      setEditId(null)
    }
    setShowDropdown(false)
    setModal(true)
  }

  const cargoFinal = form.cargo === 'Outro' ? form.cargo_custom : form.cargo

  const salvar = async () => {
    if (!form.nome) { dispatch({ type:'TOAST', value:'⚠ Nome obrigatório.' }); return }
    if (!cargoFinal) { dispatch({ type:'TOAST', value:'⚠ Cargo obrigatório.' }); return }
    setLoading(true)
    const row = {
      membro_nome: form.membro_nome || null,
      cargo: cargoFinal,
      nome: form.nome,
      tel: form.tel || null,
      email: form.email || null,
      ordenacao: form.ordenacao !== '' ? parseInt(form.ordenacao) : null,
    }
    if (editId) {
      await dbUpdate('lideranca', editId, row)
      dispatch({ type:'SET', key:'lideranca', value: lideranca.map(l => l.id === editId ? {...l,...row} : l) })
      dispatch({ type:'TOAST', value:'✅ Atualizado!' })
    } else {
      const novo = await dbInsert('lideranca', row)
      dispatch({ type:'SET', key:'lideranca', value: [...lideranca, {...(novo||{id:Date.now()}),...row}] })
      dispatch({ type:'TOAST', value:'✅ Líder cadastrado!' })
    }
    setLoading(false); setModal(false)
  }

  const excluir = async (id) => {
    if (!window.confirm('Remover este líder?')) return
    await dbDelete('lideranca', id)
    dispatch({ type:'SET', key:'lideranca', value: lideranca.filter(l => l.id !== id) })
    dispatch({ type:'TOAST', value:'🗑 Removido.' })
  }

  return (
    <div>
      <SecHeader title="LIDERANÇA" actions={isAdmin(user) && <Btn onClick={() => abrir()}>+ Cadastrar</Btn>} />

      {lista.length === 0
        ? <Empty icon="👑" text="Nenhum líder cadastrado." />
        : lista.map(l => (
          <div key={l.id} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,padding:'13px 15px',display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
            <div style={{width:36,height:36,borderRadius:'50%',background:'var(--cdim)',border:'2px solid var(--cy)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-display)',fontSize:14,color:'var(--cy)',flexShrink:0}}>
              {l.nome?.[0] || '?'}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:9,color:'var(--cy)',letterSpacing:2,textTransform:'uppercase'}}>{l.cargo}</div>
              <div style={{fontSize:13,fontWeight:700,color:'var(--w)',marginTop:1}}>{l.nome}</div>
              {l.email && <div style={{fontSize:11,color:'var(--g)',marginTop:1}}>{l.email}</div>}
              {l.tel && (
                <a href={waLink(l.tel, `Olá ${l.nome}!`)} target="_blank" rel="noopener"
                  style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 10px',background:'rgba(34,197,94,.12)',border:'1px solid rgba(34,197,94,.3)',borderRadius:6,color:'var(--grn)',textDecoration:'none',fontSize:11,fontWeight:600,marginTop:5}}>
                  💬 WhatsApp
                </a>
              )}
            </div>
            {l.ordenacao != null && (
              <div style={{fontSize:10,color:'var(--g)',flexShrink:0,marginRight:4}}>#{l.ordenacao}</div>
            )}
            {isAdmin(user) && (
              <div style={{display:'flex',gap:5,flexShrink:0}}>
                <Btn variant="outline" size="xs" onClick={() => abrir(l)}>✏</Btn>
                {isPastor(user) && <Btn variant="danger" size="xs" onClick={() => excluir(l.id)}>🗑</Btn>}
              </div>
            )}
          </div>
        ))
      }

      {modal && (
        <Modal title={editId ? 'EDITAR LÍDER' : 'CADASTRAR LÍDER'} onClose={() => setModal(false)} wide
          footer={<><Btn variant="outline" onClick={() => setModal(false)}>Cancelar</Btn><Btn onClick={salvar} disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Btn></>}>
          <FormGrid>

            {/* Seletor de membro */}
            <FG full>
              <label>Membro do Cadastro <span style={{fontWeight:400,color:'var(--g)',fontSize:10}}>(opcional — preenche nome e tel automaticamente)</span></label>
              <div style={{position:'relative'}}>
                <input
                  value={buscaMembro}
                  onChange={e => { setBuscaMembro(e.target.value); setShowDropdown(true) }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="🔍 Digite para buscar membro..."
                  autoComplete="off"
                />
                {showDropdown && (
                  <div style={{position:'absolute',top:'100%',left:0,right:0,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:6,zIndex:50,maxHeight:180,overflowY:'auto',marginTop:2}}>
                    {membrosFiltrados.length === 0
                      ? <div style={{padding:'8px 12px',fontSize:11,color:'var(--g)'}}>Nenhum membro encontrado.</div>
                      : membrosFiltrados.map(m => (
                        <div key={m.id}
                          onMouseDown={() => selecionarMembro(m)}
                          style={{padding:'8px 12px',cursor:'pointer',fontSize:12,color:'var(--w)',borderBottom:'1px solid var(--bd)',display:'flex',justifyContent:'space-between',alignItems:'center'}}
                          onMouseEnter={e=>e.currentTarget.style.background='var(--cdim)'}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <span>{primeiroUltimo(m.nome)}</span>
                          <span style={{fontSize:10,color:'var(--g)'}}>{m.tel||''}</span>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
              {form.membro_nome && (
                <div style={{fontSize:10,color:'var(--gr)',marginTop:3}}>✅ Vinculado a: <strong>{form.membro_nome}</strong>
                  <button onClick={() => { setForm(f=>({...f,membro_nome:''})); setBuscaMembro('') }}
                    style={{marginLeft:8,fontSize:10,color:'var(--g)',background:'none',border:'none',cursor:'pointer'}}>✕ desvincular</button>
                </div>
              )}
            </FG>

            {/* Cargo */}
            <FG>
              <label>Cargo *</label>
              <select value={form.cargo} onChange={e => setForm({...form, cargo:e.target.value, cargo_custom:''})}>
                <option value="">— Selecione —</option>
                {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FG>
            {form.cargo === 'Outro' && (
              <FG>
                <label>Especificar cargo</label>
                <input value={form.cargo_custom} onChange={e=>setForm({...form,cargo_custom:e.target.value})} placeholder="Ex: Auxiliar de Pregação..." />
              </FG>
            )}

            {/* Ordenação */}
            <FG>
              <label>Ordenação <span style={{fontWeight:400,color:'var(--g)',fontSize:10}}>(ordem na lista)</span></label>
              <input type="number" min="1" value={form.ordenacao} onChange={e=>setForm({...form,ordenacao:e.target.value})} placeholder="1, 2, 3..." />
            </FG>

            {/* Nome de exibição */}
            <FG full>
              <label>Nome de Exibição *</label>
              <input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} placeholder="Como aparece na lista" />
            </FG>

            <FG>
              <label>Telefone / WhatsApp</label>
              <input value={form.tel} onChange={e=>setForm({...form,tel:e.target.value})} placeholder="21 99999-9999" />
            </FG>
            <FG>
              <label>Email</label>
              <input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
            </FG>

          </FormGrid>
        </Modal>
      )}
    </div>
  )
}
