import { useState, useMemo } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbDelete } from '../lib/supabase.js'
import { podeExcluirOuSolicitar } from '../lib/solicitacoes.js'
import { isPastor, isAdmin } from '../lib/utils.js'
import { SecHeader, Btn, Modal, FormGrid, FG, Tag, Empty } from '../components/UI.jsx'
import { Plus, Trash2 } from 'lucide-react'

const DIAS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const TURMAS = ['Nave','Jovens','Adolescentes','Juvenil','Crianças','Batismal','Geral']

export default function Devocional() {
  const { state, dispatch } = useStore()
  const { devocionais, respostas, user, funcoes, membros } = state
  const isProf = ['pastor','secretario','professor'].includes(user?.perfil)

  // Detecta turma do professor logado a partir do Registro de Funções
  const turmaDetectada = useMemo(() => {
    if (!user?.nome || !['professor'].includes(user?.perfil)) return ''
    const fn = (funcoes||[]).find(f => f.nome.startsWith('Professor EB —') && (f.membros||[]).includes(user.nome))
    return fn ? fn.nome.replace('Professor EB — ','') : ''
  }, [user, funcoes])

  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const dw = hoje.getDay()
  const seg = new Date(hoje); seg.setDate(hoje.getDate()-(dw===0?6:dw-1))
  const sex = new Date(seg); sex.setDate(seg.getDate()+4)
  const dvs = (devocionais||[]).filter(d=>{const dd=new Date(d.data+'T00:00:00');return dd>=seg&&dd<=sex}).sort((a,b)=>a.data.localeCompare(b.data))

  const [modal, setModal] = useState(false)
  const [modalR, setModalR] = useState(null)
  const [form, setForm] = useState({})
  const [comentario, setComentario] = useState('')
  const [loading, setLoading] = useState(false)

  const abrirNovo = () => {
    setForm({
      data: new Date().toLocaleDateString('sv'),
      titulo: '',
      referencia: '',
      texto: '',
      link: '',
      professor: user?.perfil === 'professor' ? user.nome : '',
      turma: turmaDetectada,
    })
    setModal(true)
  }

  const salvar = async () => {
    if (!form.titulo) { dispatch({ type:'TOAST', value:'Informe o título.' }); return }
    setLoading(true)
    const novo = await dbInsert('devocionais', form)
    dispatch({ type:'SET', key:'devocionais', value:[...(devocionais||[]), novo||{id:Date.now(),...form}] })
    setLoading(false); setModal(false)
    dispatch({ type:'TOAST', value:'Devocional publicado!' })
  }

  const marcarFeito = async () => {
    if (!modalR) return
    const row = { devocional_id:modalR.id, usuario_id:user?.id, nome_user:user?.nome, comentario, data:new Date().toLocaleDateString('sv') }
    const novo = await dbInsert('devocionais_respostas', row)
    dispatch({ type:'SET', key:'respostas', value:[...(respostas||[]).filter(r=>!(r.devocional_id===modalR.id&&r.usuario_id===user?.id)), novo||{id:Date.now(),...row}] })
    setModalR(null); setComentario('')
    dispatch({ type:'TOAST', value:'Devocional feito!' })
  }

  const excluir = async (id, titulo) => {
    const ok = await podeExcluirOuSolicitar(user, dispatch, { tabela:'devocionais', registroId:id, descricao:`Excluir devocional "${titulo}"` })
    if (!ok) return
    await dbDelete('devocionais', id, titulo)
    dispatch({ type:'SET', key:'devocionais', value:(devocionais||[]).filter(d=>d.id!==id) })
  }

  // Lista de professores para o pastor escolher
  const listaProfessores = useMemo(() => {
    const nomes = new Set()
    ;(funcoes||[]).filter(f=>f.nome.startsWith('Professor EB')).forEach(f=>(f.membros||[]).forEach(n=>nomes.add(n)))
    return [...nomes].sort()
  }, [funcoes])

  return (
    <div>
      <SecHeader title="Devocional da Semana" actions={isProf && <Btn onClick={abrirNovo}><Plus size={15}/> Novo</Btn>} />

      {dvs.length===0 ? <Empty icon="📿" text="Nenhum devocional publicado esta semana." /> : dvs.map(dv => {
        const resp = (respostas||[]).filter(r=>r.devocional_id===dv.id)
        const minha = (respostas||[]).find(r=>r.devocional_id===dv.id&&r.usuario_id===user?.id)
        const dd = new Date(dv.data+'T00:00:00')
        return (
          <div key={dv.id} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,overflow:'hidden',marginBottom:11}}>
            <div style={{background:'var(--s2)',padding:'9px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:6}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:'var(--w)'}}>{DIAS[dd.getDay()]} {dd.toLocaleDateString('pt-BR')} — {dv.titulo}</div>
                <div style={{display:'flex',gap:6,marginTop:4,flexWrap:'wrap'}}>
                  {dv.professor && <Tag color="cyan">{dv.professor.split(' ').slice(0,2).join(' ')}</Tag>}
                  {dv.turma && <Tag color="gray">{dv.turma}</Tag>}
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{fontSize:11,color:'var(--cy)'}}>{dv.referencia}</div>
                {isProf && <span style={{fontSize:11,color:'var(--grn)',fontWeight:600}}>{resp.length} resp.</span>}
                {isProf && <Btn variant="danger" size="xs" onClick={()=>excluir(dv.id, dv.titulo)}><Trash2 size={14}/></Btn>}
              </div>
            </div>
            <div style={{padding:'13px 14px'}}>
              <div style={{fontSize:12,lineHeight:1.8,color:'var(--tx)',marginBottom:10}}>{dv.texto}</div>
              {dv.link && <a href={dv.link} target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',gap:4,padding:'4px 9px',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--gl)',textDecoration:'none',fontSize:11,marginBottom:10}}>Recurso</a>}
              {minha && <div style={{background:'var(--s2)',borderRadius:8,padding:10,marginTop:8}}>
                <div style={{fontSize:11,fontWeight:600,color:'var(--cy)',marginBottom:3}}>Você fez este devocional</div>
                <div style={{fontSize:12,color:'var(--tx)'}}>{minha.comentario||'(sem comentário)'}</div>
              </div>}
              {!minha && !isProf && <Btn size="sm" onClick={()=>{setModalR(dv);setComentario('')}} style={{marginTop:8}}>Fazer Devocional</Btn>}
              {isProf && resp.length>0 && <div style={{marginTop:10,borderTop:'1px solid var(--bd)',paddingTop:10}}>
                {resp.map(r=><div key={r.id} style={{background:'var(--s2)',borderRadius:8,padding:10,marginBottom:6}}>
                  <div style={{fontSize:11,fontWeight:600,color:'var(--cy)',marginBottom:3}}>{r.nome_user}</div>
                  <div style={{fontSize:12,color:'var(--tx)'}}>{r.comentario||'(sem comentário)'}</div>
                </div>)}
              </div>}
            </div>
          </div>
        )
      })}

      {modal && <Modal title="Novo Devocional" onClose={()=>setModal(false)}
        footer={<><Btn variant="outline" onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={salvar} disabled={loading}>{loading?'Publicando...':'Publicar'}</Btn></>}>
        <FormGrid>
          <FG><label>Data</label><input type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})}/></FG>
          <FG>
            <label>Turma</label>
            <select value={form.turma} onChange={e=>setForm({...form,turma:e.target.value})}>
              <option value="">— Selecionar —</option>
              {TURMAS.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </FG>
          <FG full>
            <label>Professor(a)</label>
            {user?.perfil === 'professor'
              ? <input value={form.professor} readOnly style={{background:'var(--s2)',opacity:.7,cursor:'not-allowed'}} />
              : <select value={form.professor} onChange={e=>setForm({...form,professor:e.target.value})}>
                  <option value="">— Selecionar —</option>
                  {listaProfessores.map(n=><option key={n} value={n}>{n}</option>)}
                  <option value="__outro__">Outro...</option>
                </select>
            }
            {form.professor === '__outro__' && (
              <input value={form._profTexto||''} onChange={e=>setForm({...form,_profTexto:e.target.value,professor:e.target.value})} placeholder="Nome do professor" style={{marginTop:4}}/>
            )}
          </FG>
          <FG full><label>Título</label><input value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})}/></FG>
          <FG full><label>Referência Bíblica</label><input value={form.referencia} onChange={e=>setForm({...form,referencia:e.target.value})} placeholder="Ex: Salmos 23:1"/></FG>
          <FG full><label>Texto / Reflexão</label><textarea value={form.texto} onChange={e=>setForm({...form,texto:e.target.value})} style={{minHeight:100}}/></FG>
          <FG full><label>Link de Recurso</label><input type="url" value={form.link} onChange={e=>setForm({...form,link:e.target.value})} placeholder="YouTube, Instagram..."/></FG>
        </FormGrid>
      </Modal>}

      {modalR && <Modal title="Fazer Devocional" onClose={()=>setModalR(null)}
        footer={<><Btn variant="outline" onClick={()=>setModalR(null)}>Cancelar</Btn><Btn variant="green" onClick={marcarFeito}>Marcar como Feito</Btn></>}>
        <div style={{background:'var(--s2)',borderRadius:8,padding:13,marginBottom:14}}>
          <div style={{display:'flex',gap:6,marginBottom:6,flexWrap:'wrap'}}>
            {modalR.professor && <Tag color="cyan">{modalR.professor.split(' ').slice(0,2).join(' ')}</Tag>}
            {modalR.turma && <Tag color="gray">{modalR.turma}</Tag>}
          </div>
          <div style={{fontWeight:600,color:'var(--w)'}}>{modalR.titulo}</div>
          <div style={{fontSize:12,color:'var(--cy)',marginTop:3}}>{modalR.referencia}</div>
          {modalR.texto && <div style={{fontSize:12,color:'var(--tx)',marginTop:7,lineHeight:1.7}}>{modalR.texto}</div>}
        </div>
        <FG full><label>Minha reflexão</label><textarea value={comentario} onChange={e=>setComentario(e.target.value)} style={{minHeight:90}} placeholder="Escreva sua reflexão aqui..."/></FG>
      </Modal>}
    </div>
  )
}
