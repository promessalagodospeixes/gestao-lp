import { useState } from 'react'
import SeloEnvio from '../components/SeloEnvio.jsx'
import AvisoSaida from '../components/AvisoSaida.jsx'
import ConfDot, { statusConf, corConf } from '../components/ConfDot.jsx'
import { useStore } from '../lib/store.jsx'
import { dbUpsert, dbInsert, dbDelete, getToken } from '../lib/supabase.js'
import { MESES, getSabDom, fmtBR, isCafeConexao, isAdmin, waLink, MSG_EB, nomeDisp } from '../lib/utils.js'
import { Tabs, MonthNav, Btn, BtnGroup, Modal, FormGrid, FG } from '../components/UI.jsx'
import { Plus, Trash2, FileDown, Save, Sparkles, Map, Send, Check, Mail, MessageCircle, Printer, BookOpen } from 'lucide-react'
import LicoesEB from '../components/LicoesEB.jsx'
import SeletorPessoa from '../components/SeletorPessoa.jsx'

const CLASSES = ['Nave','Jovens','Adolescentes','Juvenil','Crianças','Batismal']
const HAS_AUX = ['Nave','Crianças']

export default function EscalaEB() {
  const { state, dispatch } = useStore()
  const { escalasEB, funcoes, membros, ocorrencias, confirmacoes, user, ebLicoes, ebAulas } = state
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth())
  const [ano, setAno] = useState(now.getFullYear())
  const [abertas, setAbertas] = useState([])
  const [saving, setSaving] = useState(false)
  const [modalWA, setModalWA] = useState(false)
  const [modalMapa, setModalMapa] = useState(false)
  const [tab, setTab] = useState('escala')
  const [classesMapa, setClassesMapa] = useState(CLASSES)
  const [msgVersao, setMsgVersao] = useState(0)
  const [filtroWA_EB, setFiltroWA_EB] = useState('mes')
  const [diaSabWA, setDiaSabWA] = useState('')
  const [classeWA_EB, setClasseWA_EB] = useState('')
  const [modalConfEB, setModalConfEB] = useState(null) // {sabIdx, data}
  const [ocItensEB, setOcItensEB] = useState([])
  const [savingConfEB, setSavingConfEB] = useState(false)
  const [avisoSaidaEB, setAvisoSaidaEB] = useState(null)

  const hoje = new Date(); hoje.setHours(0,0,0,0)

  // Ocorrências/confirmação agora são POR CLASSE em cada sábado (funcao = nome da classe).
  // Uma linha "limpa" (sem nome/substituto/motivo) = confirmado OK; linha com nome = falta.
  const ocorrenciasEB = (sabIdx, classe) => (ocorrencias||[]).filter(o=>o.ano===ano&&o.mes===mes+1&&o.slot===String(sabIdx)&&o.tipo==='eb'&&o.funcao===classe)
  const statusConfEB = (sabIdx, classe) => {
    const rows = ocorrenciasEB(sabIdx, classe)
    if (!rows.length) return 'pendente'
    if (rows.some(r=>r.aula_dada===false)) return 'sem_aula'
    return rows.some(r=>r.nome_original||r.substituto||r.motivo) ? 'falta' : 'ok'
  }
  // A aula daquele sábado/classe foi marcada como NÃO dada? (então ela volta para a fila)
  const aulaNaoRealizada = (ano1, mes1, slotIdx, classe) =>
    (ocorrencias||[]).some(o=>o.ano===ano1&&o.mes===mes1&&String(o.slot)===String(slotIdx)&&o.tipo==='eb'&&o.funcao===classe&&o.aula_dada===false)

  const abrirConfEB = (sabIdx, data, classe) => {
    const s = esc[`${classe}-${sabIdx}`] || {}
    const rows = ocorrenciasEB(sabIdx, classe)
    // Monta os itens a partir de QUEM ESTAVA ESCALADO (vinculado — sem digitar nome)
    const base = []
    if (s.prof) base.push({ papel:'Professor', nome:s.prof })
    if (HAS_AUX.includes(classe) && s.aux) base.push({ papel:'Auxiliar', nome:s.aux })
    const itens = base.map(b => {
      const r = rows.find(x=>x.nome_original===b.nome)
      // Registro antigo (só tinha "faltou") entra como 'faltou'; sem registro = 'foi'.
      const situacao = r ? (r.situacao || 'faltou') : 'foi'
      return { ...b, situacao, substituto:r?.substituto||'', motivo:r?.motivo||'' }
    })
    setOcItensEB(itens)
    setModalConfEB({sabIdx, data, classe})
  }

  const salvarConfEB = async () => {
    const {sabIdx, classe} = modalConfEB
    setSavingConfEB(true)
    const existentes = ocorrenciasEB(sabIdx, classe)
    await Promise.all(existentes.map(o=>dbDelete('ocorrencias', o.id, null, { semAudit: !(o.nome_original||o.substituto||o.motivo) })))
    const problemas = ocItensEB.filter(it=>it.situacao!=='foi')
    const alguemDeu = ocItensEB.some(it=>it.situacao==='foi')
    const alguemSubstituiu = problemas.some(it=>it.substituto && String(it.substituto).trim())
    // A aula aconteceu se alguém deu (professor/auxiliar) ou se houve substituto.
    const aulaDada = ocItensEB.length ? (alguemDeu || alguemSubstituiu) : true
    let novos = []
    if (!problemas.length) {
      // Tudo certo: marcador "limpo" para a classe, aula dada
      const row = {ano,mes:mes+1,slot:String(sabIdx),tipo:'eb',funcao:classe,nome_original:null,substituto:null,motivo:null,situacao:null,aula_dada:true}
      const novo = await dbInsert('ocorrencias', row, null, { semAudit: true })
      novos.push(novo||{id:Date.now(),...row})
    } else {
      for (const it of problemas) {
        const row = {ano,mes:mes+1,slot:String(sabIdx),tipo:'eb',funcao:classe,nome_original:it.nome||null,substituto:it.substituto||null,motivo:it.motivo||null,situacao:it.situacao,aula_dada:aulaDada}
        const novo = await dbInsert('ocorrencias', row)
        novos.push(novo||{id:Date.now()+Math.random(),...row})
      }
    }
    const restantes = (ocorrencias||[]).filter(o=>!(o.ano===ano&&o.mes===mes+1&&o.slot===String(sabIdx)&&o.tipo==='eb'&&o.funcao===classe))
    dispatch({type:'SET',key:'ocorrencias',value:[...restantes,...novos]})
    setSavingConfEB(false); setModalConfEB(null)
    dispatch({type:'TOAST',value: aulaDada ? '✅ Confirmação registrada!' : '🚫 Não teve aula — a aula voltou para a fila.'})
  }

  const chM = (d) => { let m=mes+d,a=ano; if(m>11){m=0;a++} if(m<0){m=11;a--} setMes(m);setAno(a) }
  const ch = `eb-${ano}-${mes}`
  const esc = escalasEB[ch]||{}
  const { sabs } = getSabDom(mes, ano)

  // Only use members registered in the function - never fallback to all members
  const fnMbs = (nome) => {
    const f = (funcoes||[]).find(x=>x.nome===nome)
    return f && (f.membros||[]).length ? f.membros : []
  }

  const toggle = (cl) => setAbertas(a=>a.includes(cl)?a.filter(x=>x!==cl):[...a,cl])

  // ── Lições da Escola Bíblica ──
  const aulasDaTurma = (cl) => {
    const ids = (ebLicoes||[]).filter(l => !l.arquivada && (!l.classe || l.classe === cl)).map(l => l.id)
    return (ebAulas||[]).filter(a => ids.includes(a.licao_id) && !a.cafe)
      .sort((a,b) => (a.licao_id - b.licao_id) || ((a.ordem||0) - (b.ordem||0)))
  }
  const nomeLicao = (licaoId) => (ebLicoes||[]).find(l => l.id === licaoId)?.nome || ''
  const aulaPorId = (id) => (ebAulas||[]).find(a => String(a.id) === String(id))

  // Onde a aula já foi dada — evita repetir sem querer e responde 'que aula o fulano deu?'
  const ondeJaFoiDada = (aulaId, ignorar) => {
    const achados = []
    Object.entries(escalasEB||{}).forEach(([chave, slots]) => {
      const [, a, mi] = chave.split('-')
      Object.entries(slots||{}).forEach(([k, v]) => {
        if (String(v?.aula_id||'') !== String(aulaId)) return
        if (ignorar && chave === ch && k === ignorar) return
        const classe = k.slice(0, k.lastIndexOf('-'))
        const slotIdx = k.slice(k.lastIndexOf('-')+1)
        // Se aquele dia foi marcado como "não teve aula", a aula NÃO conta como dada:
        // volta a ficar disponível para o próximo sábado.
        if (aulaNaoRealizada(+a, +mi+1, slotIdx, classe)) return
        achados.push(`${classe} ${String(+mi+1).padStart(2,'0')}/${a}`)
      })
    })
    return achados
  }

  const setVal = (cl, idx, fn, val) => {
    const k = `${cl}-${idx}`
    const prev = (esc[k]||{})[fn]||''
    const novo = {...escalasEB, [ch]:{...esc,[k]:{...(esc[k]||{}),[fn]:val}}}
    dispatch({ type:'SET', key:'escalasEB', value:novo })
    // Trocou/removeu alguém já escalado: oferece avisar que ele saiu (pode já ter
    // recebido e-mail deste dia). Mesma proteção do culto.
    // SÓ para professor/auxiliar — nunca para a aula (aula_id é número, não pessoa:
    // tratá-lo como nome derrubava a tela ao trocar/limpar a aula).
    if ((fn === 'prof' || fn === 'aux') && prev && prev !== val && prev !== 'CAFÉ E CONEXÃO') {
      const d = sabs[idx]; const mb = (membros||[]).find(m=>m.nome===prev)
      if (d) setAvisoSaidaEB({ nome: prev, email: mb?.email||'', funcao: fn==='prof'?`Professor ${cl}`:`Auxiliar ${cl}`, data: d, rotuloDia:'Sáb' })
    }
  }

  const gerarAuto = () => {
    const seed = Math.floor(Math.random() * 9973)
    const novoSlots = {}
    classesPermitidas.forEach(cl => {
      const profs = fnMbs(`Professor EB — ${cl}`)
      const auxs = fnMbs(`Auxiliar EB — ${cl}`)
      if (!profs.length) return
      sabs.forEach((d,i) => {
        if (isCafeConexao(d)) {
          novoSlots[`${cl}-${i}`] = { prof: 'CAFÉ E CONEXÃO', aux: '' }
          return
        }
        const k = `${cl}-${i}`
        novoSlots[k] = { prof: profs[(seed+i)%profs.length] }
        if (HAS_AUX.includes(cl) && auxs.length) {
          const auxOpts = auxs.filter(a=>a!==novoSlots[k].prof)
          novoSlots[k].aux = auxOpts.length ? auxOpts[(seed+i)%auxOpts.length] : ''
        }
      })
    })
    // Preserva as turmas que o usuário não pode editar
    dispatch({ type:'SET', key:'escalasEB', value:{...escalasEB,[ch]:{...esc,...novoSlots}} })
    dispatch({ type:'TOAST', value:'✨ Escola Bíblica gerada!' })
  }

  const podeEditarTurma = (cl) => isAdmin(user) || !user?.ebTurmas?.length || user.ebTurmas.includes(cl)
  // Turmas que o usuário pode VER (e portanto enviar): admins e usuários sem
  // restrição veem todas; quem tem turmas específicas só vê as concedidas
  const classesPermitidas = (isAdmin(user) || !user?.ebTurmas?.length) ? CLASSES : CLASSES.filter(cl => user.ebTurmas.includes(cl))
  const mapaClasses = classesMapa.filter(c => classesPermitidas.includes(c))

  // Conflito: quem CONFIRMOU um sábado (via e-mail da EB) mas não está mais escalado
  // em NENHUMA classe daquele dia. Só conta quem é professor/auxiliar cadastrado,
  // para não confundir com quem confirmou o sábado por outra escala (culto/louvor).
  const registradosEB = (() => {
    const s = new Set()
    ;(funcoes||[]).forEach(f => { if (/^(Professor|Auxiliar) EB —/.test(f.nome||'')) (f.membros||[]).forEach(n=>s.add(n)) })
    return s
  })()
  const conflitosEB = (() => {
    const out = []
    sabs.forEach((d,i) => {
      if (isCafeConexao(d)) return
      const escalados = new Set()
      CLASSES.forEach(cl => { const s = esc[`${cl}-${i}`]||{}; if (s.prof) escalados.add(s.prof); if (s.aux) escalados.add(s.aux) })
      const dStr = d.toISOString().slice(0,10)
      ;(confirmacoes||[]).forEach(x => {
        if (x.status==='confirmado' && x.culto==='Sábado Manhã' && String(x.data).slice(0,10)===dStr && !escalados.has(x.membro_nome) && registradosEB.has(x.membro_nome))
          out.push({ id:x.id, data:d, nome:x.membro_nome })
      })
    })
    return out
  })()

  // Quadro "Aulas que não foram dadas" neste mês (a aula volta para a fila).
  const semAulaMes = (() => {
    const out = []
    const vistos = new Set()
    ;(ocorrencias||[]).forEach(o => {
      if (o.tipo!=='eb' || o.ano!==ano || o.mes!==mes+1 || o.aula_dada!==false) return
      const key = `${o.slot}-${o.funcao}`
      if (vistos.has(key)) return; vistos.add(key)
      const d = sabs[+o.slot]; if (!d) return
      const rows = (ocorrencias||[]).filter(x=>x.tipo==='eb'&&x.ano===ano&&x.mes===mes+1&&String(x.slot)===String(o.slot)&&x.funcao===o.funcao)
      const motivos = [...new Set(rows.map(r=>r.motivo).filter(Boolean))]
      const faltaram = rows.filter(r=>r.nome_original).map(r=>nomeDisp(r.nome_original, membros))
      const s = esc[`${o.funcao}-${o.slot}`]||{}
      const aula = aulaPorId(s.aula_id)
      out.push({ data:d, classe:o.funcao, motivos, faltaram, aula: aula ? `${nomeLicao(aula.licao_id)} · ${aula.titulo}` : null })
    })
    return out.sort((a,b)=>a.data-b.data)
  })()

  const salvar = async () => {
    setSaving(true)
    const rows = []
    Object.entries(esc).forEach(([k,s]) => {
      const parts = k.split('-')
      const idx = parts.pop()
      const classe = parts.join('-')
      if (!podeEditarTurma(classe)) return
      rows.push({ ano, mes:mes+1, classe, slot:idx, prof:s.prof||null, aux:s.aux||null, aula_id:s.aula_id||null })
    })
    await Promise.all(rows.map(r=>dbUpsert('escalas_eb',r,'ano,mes,classe,slot')))
    setSaving(false)
    dispatch({ type:'TOAST', value:'Escola Biblica salva!' })
  }

  const salvarCelula = async (cl, sabIdx) => {
    const s = esc[`${cl}-${sabIdx}`] || {}
    await dbUpsert('escalas_eb', { ano, mes:mes+1, classe:cl, slot:String(sabIdx), prof:s.prof||null, aux:s.aux||null, aula_id:s.aula_id||null }, 'ano,mes,classe,slot')
    dispatch({ type:'TOAST', value:'Dia salvo!' })
  }

  // Qual aula será dada — para o professor saber o tema no e-mail.
  const textoAulaEB = (aulaId) => {
    const a = aulaPorId(aulaId); if (!a) return ''
    const lic = nomeLicao(a.licao_id)
    const ref = a.referencia ? ` (${a.referencia})` : ''
    return ` | Aula: ${lic ? lic + ' · ' : ''}${a.titulo}${ref}`
  }

  // Iconezinhos ao lado do nome na grade: WhatsApp já com a escala + tema da aula,
  // e e-mail que ENVIA de verdade (pelo servidor), igual ao botão "Enviar Escala".
  const ContatoEB = ({ nome, papel, d, aulaId }) => {
    if (!nome || nome === 'CAFÉ E CONEXÃO') return null
    const mb = (membros || []).find(m => m.nome === nome)
    const tel = mb?.tel, email = mb?.email
    if (!tel && !email) return null
    const primeiro = String(nome).trim().split(' ')[0]
    const linha = `${papel} — ${fmtBR(d)}${textoAulaEB(aulaId)}`
    const stop = (e) => e.stopPropagation()
    const enviarEmail = async (e) => {
      stop(e)
      if (!email) { dispatch({ type: 'TOAST', value: '⚠ Sem e-mail cadastrado.' }); return }
      dispatch({ type: 'TOAST', value: '✉ Enviando...' })
      try {
        const r = await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ pessoas: [{ nome, email, linhas: [linha] }], tipo: 'eb', mes, ano, escopo: 'mes', usuario: user?.nome }) })
        const dd = await r.json(); window.dispatchEvent(new Event('email-enviado'))
        dispatch({ type: 'TOAST', value: dd.enviados ? '✅ E-mail enviado!' : '⚠ Falha ao enviar.' })
      } catch { dispatch({ type: 'TOAST', value: '⚠ Erro ao enviar.' }) }
    }
    const base = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, textDecoration: 'none', flexShrink: 0, cursor: 'pointer' }
    return (
      <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
        {tel && (
          <a href={waLink(tel, MSG_EB[0](primeiro, linha, 'dia'))} target="_blank" rel="noopener" title={`WhatsApp de ${primeiro}`} onClick={stop}
            style={{ ...base, background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.3)', color: 'var(--grn)' }}>
            <MessageCircle size={13} />
          </a>
        )}
        {email && (
          <button onClick={enviarEmail} title={`Enviar e-mail da escala para ${primeiro}`}
            style={{ ...base, background: 'var(--cdim)', border: '1px solid var(--cgl)', color: 'var(--cy)' }}>
            <Mail size={13} />
          </button>
        )}
      </span>
    )
  }
  // Build WA people list (professores e auxiliares escalados no mês)
  const getPessoasEscaladas = () => {
    const map = {}
    const add = (nome, papel, data, aulaId) => {
      if (!nome || nome === 'CAFÉ E CONEXÃO') return
      if (!map[nome]) map[nome] = { nome, tel:'', fns:[] }
      map[nome].fns.push(`${papel} — ${fmtBR(new Date(data+'T00:00:00'))}${textoAulaEB(aulaId)}`)
    }
    sabs.forEach((d,i) => {
      const dataStr = d.toISOString().slice(0,10)
      classesPermitidas.forEach(cl => {
        const s = esc[`${cl}-${i}`]||{}
        if (s.prof) add(s.prof, `Prof. ${cl}`, dataStr, s.aula_id)
        if (s.aux) add(s.aux, `Aux. ${cl}`, dataStr, s.aula_id)
      })
    })
    return Object.values(map).map(p=>{const mb=(membros||[]).find(m=>m.nome===p.nome);p.tel=mb?.tel||'';p.email=mb?.email||null;return p})
  }
  const todasPessoasEB = getPessoasEscaladas()
  const pessoasEBBase = filtroWA_EB === 'fds'
    ? (() => {
        const agora = new Date()
        // No próprio sábado, o "próximo FDS" é hoje (não o sábado seguinte)
        const diasAteSab = (6 - agora.getDay() + 7) % 7
        const proxSab = new Date(agora); proxSab.setDate(agora.getDate() + diasAteSab); proxSab.setHours(0,0,0,0)
        const dataBR = fmtBR(proxSab)
        const filtered = todasPessoasEB.filter(p=>p.fns.some(fn=>fn.includes(dataBR))).map(p=>({...p,fns:p.fns.filter(fn=>fn.includes(dataBR))}))
        return filtered.length ? filtered : todasPessoasEB.filter(()=>false)
      })()
    : filtroWA_EB === 'dia' && diaSabWA !== ''
      ? (() => { const d = sabs[parseInt(diaSabWA)]; return d ? todasPessoasEB.filter(p=>p.fns.some(fn=>fn.includes(fmtBR(d)))).map(p=>({...p,fns:p.fns.filter(fn=>fn.includes(fmtBR(d)))})) : todasPessoasEB })()
      : todasPessoasEB
  const pessoasEB = classeWA_EB
    ? pessoasEBBase.filter(p=>p.fns.some(fn=>fn.includes(classeWA_EB))).map(p=>({...p,fns:p.fns.filter(fn=>fn.includes(classeWA_EB))}))
    : pessoasEBBase
  const msgPreview = MSG_EB[msgVersao]
  const previewText = msgPreview('João', 'Sabado 06/06 — Prof. Crianças')

  return (
    <div>
      <Tabs tabs={[{id:'escala',label:'📅 Escala da EB'},{id:'licoes',label:'📖 Lições & Aulas'}]} active={tab} onChange={setTab} />

      {tab === 'licoes' && <LicoesEB classes={CLASSES} />}

      {tab === 'escala' && (<>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
        <MonthNav month={mes} year={ano} onPrev={()=>chM(-1)} onNext={()=>chM(1)} />
        <SeloEnvio tipo="eb" periodo={`${ano}-${mes + 1}`} />
        <BtnGroup>
          <Btn variant="outline" size="sm" onClick={gerarAuto}><Sparkles size={15}/> Gerar Auto</Btn>
          <Btn size="sm" onClick={salvar} disabled={saving}>{saving?'Salvando...':<><Save size={15}/> Salvar</>}</Btn>
          <Btn variant="outline" size="sm" onClick={()=>setModalMapa(true)}><Map size={15}/> Mapa Geral</Btn>
          <Btn variant="outline" size="sm" onClick={()=>window.print()}><FileDown size={15}/> PDF</Btn>
          {(isAdmin(user) || user?.perfil==='professor' || (user?.extraPages||[]).includes('escala-eb')) && <Btn variant="wa" size="sm" onClick={()=>setModalWA(true)}><Send size={15}/> Enviar Escala</Btn>}
        </BtnGroup>
      </div>
      <div style={{display:'flex',gap:14,flexWrap:'wrap',alignItems:'center',marginBottom:12,fontSize:11.5,color:'var(--g)'}}>
        <span style={{fontWeight:700,color:'var(--gl)'}}>Confirmação:</span>
        <span style={{display:'inline-flex',alignItems:'center',gap:5}}><span style={{width:9,height:9,borderRadius:99,background:'var(--grn)',border:'2px solid var(--grn)'}}/> confirmou</span>
        <span style={{display:'inline-flex',alignItems:'center',gap:5}}><span style={{width:9,height:9,borderRadius:99,background:'var(--red)',border:'2px solid var(--red)'}}/> não vai poder</span>
        <span style={{display:'inline-flex',alignItems:'center',gap:5}}><span style={{width:9,height:9,borderRadius:99,background:'var(--yel)',border:'2px solid var(--yel)'}}/> ainda não respondeu</span>
      </div>
      {conflitosEB.length>0 && (
        <div style={{background:'rgba(239,91,91,.12)',border:'1px solid var(--red)',borderRadius:8,padding:'9px 11px',marginBottom:12,fontSize:12,color:'var(--tx)'}}>
          <div style={{fontWeight:700,color:'var(--red)',marginBottom:3}}>⚠ Conflito de escala</div>
          {conflitosEB.map(c=><div key={c.id+String(c.nome)} style={{marginTop:2}}>
            <b>{nomeDisp(c.nome,membros)}</b> confirmou o sábado <b>{fmtBR(c.data)}</b> mas <b>não está escalado(a)</b> em nenhuma classe. Avise que a escala mudou.
          </div>)}
        </div>
      )}
      {semAulaMes.length>0 && (
        <div style={{background:'rgba(245,158,11,.08)',border:'1px solid var(--yel)',borderRadius:8,padding:'9px 11px',marginBottom:12,fontSize:12,color:'var(--tx)'}}>
          <div style={{fontWeight:700,color:'var(--yel)',marginBottom:4}}>🚫 Aulas que não foram dadas neste mês</div>
          {semAulaMes.map((x,i)=>(
            <div key={i} style={{marginTop:3,lineHeight:1.5}}>
              <b>{fmtBR(x.data)}</b> · <b>{x.classe}</b>
              {x.aula ? <> — {x.aula}</> : null}
              {x.motivos.length>0 && <span style={{color:'var(--g)'}}> · motivo: {x.motivos.join('; ')}</span>}
              {x.faltaram.length>0 && <span style={{color:'var(--g)'}}> · {x.faltaram.join(', ')}</span>}
              {x.classe!=='Nave' && <span style={{color:'var(--grn)'}}> · voltou para a fila</span>}
            </div>
          ))}
        </div>
      )}
      {classesPermitidas.map(cl => {
        const profs = fnMbs(`Professor EB — ${cl}`)
        const auxs = fnMbs(`Auxiliar EB — ${cl}`)
        const showAux = HAS_AUX.includes(cl)
        const open = abertas.includes(cl)
        const semProf = !profs.length
        const podeEditar = podeEditarTurma(cl)
        return (
          <div key={cl} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,overflow:'hidden',marginBottom:10,opacity:podeEditar?1:.7}}>
            <div onClick={()=>toggle(cl)} style={{background:'var(--s2)',padding:'9px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:13,fontWeight:700,letterSpacing:'-.01em',color:'var(--w)'}}>📖 Classe {cl}</span>
                {semProf
                  ? <span style={{background:'rgba(239,68,68,.1)',color:'var(--red)',fontSize:9,padding:'2px 7px',borderRadius:99,fontWeight:600}}>sem prof. cadastrado</span>
                  : <span style={{background:'rgba(34,197,94,.1)',color:'var(--grn)',fontSize:9,padding:'2px 7px',borderRadius:99,fontWeight:600}}>{profs.length} prof.</span>
                }
                {!podeEditar && <span style={{background:'rgba(100,100,100,.15)',color:'var(--g)',fontSize:9,padding:'2px 7px',borderRadius:99}}>somente leitura</span>}
              </div>
              <span style={{color:'var(--g)',fontSize:12}}>{open?'▲':'▼'}</span>
            </div>
            {open && (
              <div style={{padding:'9px 14px'}}>
                {semProf && <div style={{color:'var(--g)',fontSize:12,padding:'8px 0',fontStyle:'italic'}}>Cadastre professores no Registro de Funções para esta classe.</div>}
                {sabs.map((d,i) => {
                  const k = `${cl}-${i}`
                  const s = esc[k]||{}
                  const cafe = isCafeConexao(d)
                  const ccEB = !cafe && corConf(statusConf(confirmacoes, s.prof, d, {culto:'Sábado Manhã'}))
                  return (
                    <div key={i} style={{padding:'6px 8px',borderBottom:'1px solid var(--bd)',opacity:cafe?.5:1,background:ccEB?.bg||'',borderLeft:`3px solid ${ccEB?.bd||'transparent'}`,borderRadius:ccEB?6:0}}>
                     <div className="linha-campos" style={{display:'flex',alignItems:'center',gap:9}}>
                      <div style={{fontSize:9,color:cafe?'var(--yel)':'var(--g)',width:80,flexShrink:0}}>{fmtBR(d)}{cafe?' ☕':''}</div>
                      {cafe
                        ? <div style={{flex:1,fontSize:12,color:'var(--yel)'}}>☕ Café e Conexão — sem EB</div>
                        : <>
                          <select value={s.prof||''} onChange={e=>podeEditar&&setVal(cl,i,'prof',e.target.value)} disabled={!podeEditar} style={{flex:1,padding:'6px 8px',fontSize:11,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--w)',opacity:podeEditar?1:.6,cursor:podeEditar?'auto':'not-allowed'}}>
                            <option value="">— Professor —</option>
                            {profs.map(n=><option key={n} value={n}>{nomeDisp(n, membros)}</option>)}
                          </select>
                          <ConfDot nome={s.prof} data={d} culto="Sábado Manhã" />
                          <ContatoEB nome={s.prof} papel={`Prof. ${cl}`} d={d} aulaId={s.aula_id} />
                          {showAux && <select value={s.aux||''} onChange={e=>podeEditar&&setVal(cl,i,'aux',e.target.value)} disabled={!podeEditar} style={{flex:1,padding:'6px 8px',fontSize:11,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--w)',opacity:podeEditar?1:.6,cursor:podeEditar?'auto':'not-allowed'}}>
                            <option value="">— Auxiliar —</option>
                            {auxs.map(n=><option key={n} value={n}>{nomeDisp(n, membros)}</option>)}
                          </select>}
                          {showAux && <ConfDot nome={s.aux} data={d} culto="Sábado Manhã" />}
                          {showAux && <ContatoEB nome={s.aux} papel={`Aux. ${cl}`} d={d} aulaId={s.aula_id} />}
                          {podeEditar && <Btn variant="outline" size="xs" onClick={()=>salvarCelula(cl,i)}>Salvar</Btn>}
                          {podeEditar && d<hoje && (() => {
                            const st = statusConfEB(i, cl)
                            return <Btn size="xs" variant={st==='ok'?'green':(st==='falta'||st==='sem_aula')?'danger':'wa'} onClick={()=>abrirConfEB(i,d,cl)} title="Confirmar o que aconteceu neste dia">
                              {st==='ok'?<><Check size={13}/> Confirmado</>:st==='sem_aula'?'🚫 Sem aula':st==='falta'?'⚠ Falta':'📋 Confirmar'}
                            </Btn>
                          })()}
                        </>
                      }
                     </div>
                     {!cafe && (() => {
                       // Só mostra o que ainda está por vir: esconde aula já dada e aula cuja data já passou.
                       // Mantém sempre a que estiver escolhida nesta linha, pra não sumir da tela.
                       const opcoes = aulasDaTurma(cl).filter(a => {
                         if (String(a.id) === String(s.aula_id)) return true
                         if (ondeJaFoiDada(a.id).length) return false
                         if (a.data) { const da = new Date(a.data); da.setHours(0,0,0,0); if (da < hoje) return false }
                         return true
                       })
                       if (!opcoes.length) return null
                       const repetida = s.aula_id ? ondeJaFoiDada(s.aula_id, `${cl}-${i}`) : []
                       return (
                         <div style={{display:'flex',alignItems:'center',gap:7,marginTop:5,paddingLeft:89}}>
                           <BookOpen size={12} style={{color:'var(--g)',flexShrink:0}} />
                           <select value={s.aula_id||''} onChange={e=>podeEditar&&setVal(cl,i,'aula_id',e.target.value?Number(e.target.value):null)}
                             disabled={!podeEditar}
                             style={{flex:1,padding:'5px 8px',fontSize:10.5,background:'var(--bg)',border:'1px solid var(--bd)',borderRadius:5,color:s.aula_id?'var(--cy)':'var(--g)',opacity:podeEditar?1:.6,cursor:podeEditar?'auto':'not-allowed'}}>
                             <option value="">— que aula será dada? —</option>
                             {opcoes.map(a => {
                               const ja = ondeJaFoiDada(a.id, `${cl}-${i}`)
                               return <option key={a.id} value={a.id}>
                                 {nomeLicao(a.licao_id)} · {a.ordem}. {a.titulo}{a.referencia?` (${a.referencia})`:''}{ja.length?`  — já dada: ${ja.join(', ')}`:''}
                               </option>
                             })}
                           </select>
                           {repetida.length > 0 && <span title={'Já dada em: '+repetida.join(', ')} style={{fontSize:9.5,color:'var(--yel)',flexShrink:0}}>repetida</span>}
                         </div>
                       )
                     })()}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Mapa imprimível — oculto na tela, visível ao imprimir (usa classesMapa para filtrar) */}
      <div className="print-mapa">
        <h2>ESCOLA BÍBLICA — {MESES[mes].toUpperCase()} {ano}</h2>
        {mapaClasses.length < CLASSES.length && <p style={{fontSize:12,marginBottom:8}}>Turmas: {mapaClasses.join(', ')}</p>}
        <table>
          <thead>
            <tr>
              <th>Data</th>
              {mapaClasses.map(cl=><th key={cl}>{cl}</th>)}
            </tr>
          </thead>
          <tbody>
            {sabs.map((d,i)=>{
              const cafe=isCafeConexao(d)
              return(
                <tr key={i}>
                  <td><strong>{fmtBR(d)}</strong>{cafe?' ☕':''}</td>
                  {mapaClasses.map(cl=>{
                    const s=esc[`${cl}-${i}`]||{}
                    if(cafe) return <td key={cl} style={{color:'#888'}}>Café</td>
                    const prof=s.prof?nomeDisp(s.prof,membros):'—'
                    const aux=HAS_AUX.includes(cl)&&s.aux?` / ${nomeDisp(s.aux,membros)}`:''
                    return <td key={cl}>{prof}{aux}</td>
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      </>)}

      {/* Mapa Geral modal */}

      {modalMapa && (
        <Modal title={`Mapa Geral — ${MESES[mes]} ${ano}`} onClose={()=>setModalMapa(false)} wide
          footer={<><Btn variant="outline" size="sm" onClick={()=>window.print()} disabled={classesMapa.length===0}><Printer size={14}/> Imprimir selecionadas</Btn><Btn variant="outline" onClick={()=>setModalMapa(false)}>Fechar</Btn></>}>
          {/* Seleção de turmas */}
          <div style={{marginBottom:12,padding:'10px 12px',background:'var(--s2)',borderRadius:8,border:'1px solid var(--bd)'}}>
            <div style={{fontSize:11,color:'var(--g)',marginBottom:8,fontWeight:600,letterSpacing:1,textTransform:'uppercase'}}>Turmas a imprimir</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              <button onClick={()=>setClassesMapa(classesMapa.length===classesPermitidas.length?[]:classesPermitidas)} style={{padding:'4px 10px',borderRadius:6,border:'1px solid var(--bd)',background:'var(--s1)',color:'var(--g)',cursor:'pointer',fontSize:10,fontWeight:600}}>
                {classesMapa.length===classesPermitidas.length?'Desmarcar todas':'Marcar todas'}
              </button>
              {classesPermitidas.map(cl=>{
                const sel=classesMapa.includes(cl)
                return(
                  <button key={cl} onClick={()=>setClassesMapa(sel?classesMapa.filter(c=>c!==cl):[...classesMapa,cl])}
                    style={{padding:'4px 10px',borderRadius:6,border:`1px solid ${sel?'var(--cy)':'var(--bd)'}`,background:sel?'var(--cdim)':'var(--s1)',color:sel?'var(--cy)':'var(--g)',cursor:'pointer',fontSize:11,fontWeight:600}}>
                    {cl}
                  </button>
                )
              })}
            </div>
            {classesMapa.length===0&&<div style={{marginTop:6,fontSize:11,color:'var(--red)'}}>Selecione ao menos uma turma.</div>}
          </div>
          <div className="table-scroll">
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,minWidth:300}}>
              <thead>
                <tr style={{background:'var(--s2)'}}>
                  <th style={{padding:'7px 10px',textAlign:'left',color:'var(--cy)',fontFamily:'var(--font-display)',fontSize:10,letterSpacing:1,borderBottom:'2px solid var(--bd)',whiteSpace:'nowrap'}}>Data</th>
                  {classesMapa.map(cl=>(
                    <th key={cl} style={{padding:'7px 10px',textAlign:'left',color:'var(--cy)',fontFamily:'var(--font-display)',fontSize:10,letterSpacing:1,borderBottom:'2px solid var(--bd)',whiteSpace:'nowrap'}}>{cl}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sabs.map((d,i)=>{
                  const cafe=isCafeConexao(d)
                  return(
                    <tr key={i} style={{borderBottom:'1px solid var(--bd)',background:cafe?'rgba(245,158,11,.04)':''}}>
                      <td style={{padding:'7px 10px',whiteSpace:'nowrap'}}>
                        <span style={{fontWeight:600,color:'var(--w)'}}>{fmtBR(d)}</span>
                        {cafe&&<span style={{marginLeft:5,fontSize:10,color:'var(--yel)'}}>☕</span>}
                      </td>
                      {mapaClasses.map(cl=>{
                        const s=esc[`${cl}-${i}`]||{}
                        if(cafe) return <td key={cl} style={{padding:'7px 10px',color:'var(--yel)',fontSize:10}}>Café e Conexão</td>
                        const prof=s.prof?nomeDisp(s.prof,membros):null
                        const aux=HAS_AUX.includes(cl)&&s.aux?nomeDisp(s.aux,membros):null
                        return(
                          <td key={cl} style={{padding:'7px 10px',color:prof?'var(--tx)':'var(--g)',fontSize:10}}>
                            {prof||'—'}
                            {aux&&<div style={{fontSize:9,color:'var(--g)',marginTop:1}}>{aux}</div>}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* Modal confirmação EB — por classe, vinculado a quem estava escalado */}
      {modalConfEB && (() => {
        const { classe } = modalConfEB
        const opts = [...new Set([...fnMbs(`Professor EB — ${classe}`), ...fnMbs(`Auxiliar EB — ${classe}`)])]
        const setItem = (i, campo, val) => setOcItensEB(its=>its.map((o,idx)=>idx===i?{...o,[campo]:val}:o))
        const problemas = ocItensEB.filter(it=>it.situacao!=='foi')
        const alguemDeu = ocItensEB.some(it=>it.situacao==='foi')
        const alguemSubstituiu = problemas.some(it=>it.substituto && String(it.substituto).trim())
        const aulaDada = ocItensEB.length ? (alguemDeu || alguemSubstituiu) : true
        const sModal = esc[`${classe}-${modalConfEB.sabIdx}`] || {}
        const aulaModal = aulaPorId(sModal.aula_id)
        return (
        <Modal title={`Confirmar — ${classe} · ${fmtBR(modalConfEB.data)}`} onClose={()=>setModalConfEB(null)}
          footer={<><Btn variant="outline" onClick={()=>setModalConfEB(null)}>Cancelar</Btn><Btn onClick={salvarConfEB} disabled={savingConfEB}>{savingConfEB?'Salvando...':'Salvar'}</Btn></>}>
          {ocItensEB.length===0
            ? <div style={{fontSize:12,color:'var(--yel)',padding:'8px 0'}}>Ninguém estava escalado nesta classe neste dia.</div>
            : <div>
                <div style={{fontSize:12,color:'var(--g)',marginBottom:10}}>Como foi com cada um?</div>
                {ocItensEB.map((it,i)=>(
                  <div key={i} style={{background:'var(--s2)',border:`1px solid ${it.situacao==='foi'?'var(--bd)':'var(--rd)'}`,borderRadius:8,padding:'10px 12px',marginBottom:10}}>
                    <div style={{fontSize:12,color:'var(--w)',marginBottom:8}}><span style={{color:'var(--g)'}}>{it.papel}:</span> <strong>{nomeDisp(it.nome, membros)}</strong></div>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      {[['foi','✅ Deu a aula','green'],['nao_deu','⚠️ Foi, não deu','wa'],['faltou','❌ Faltou','danger']].map(([v,lbl,variant])=>(
                        <Btn key={v} size="xs" variant={it.situacao===v?variant:'outline'} onClick={()=>setItem(i,'situacao',v)}>{lbl}</Btn>
                      ))}
                    </div>
                    {it.situacao!=='foi' && (
                      <FormGrid>
                        <FG><label>Quem deu no lugar (se alguém deu)</label>
                          <SeletorPessoa value={it.substituto} onChange={v=>setItem(i,'substituto',v)}
                            membros={membros} grupo={opts} excluir={it.nome}
                            placeholder="— ninguém / não houve —" vazioLabel="— ninguém / não houve —" />
                        </FG>
                        <FG><label>Motivo (opcional)</label><input value={it.motivo} onChange={e=>setItem(i,'motivo',e.target.value)} placeholder="Ex: viagem, doença, não deu a aula..." /></FG>
                      </FormGrid>
                    )}
                  </div>
                ))}
                <div style={{marginTop:4,padding:'10px 12px',borderRadius:8,border:`1px solid ${aulaDada?'var(--grn)':'var(--red)'}`,background:aulaDada?'rgba(34,197,94,.08)':'rgba(239,91,91,.1)',fontSize:12.5,color:'var(--tx)',lineHeight:1.5}}>
                  {aulaDada
                    ? <>✅ <b>A aula foi dada.</b>{aulaModal?` (${aulaModal.titulo})`:''}</>
                    : <>🚫 <b>Não teve aula.</b> {aulaModal?<>A aula <b>"{aulaModal.titulo}"</b> </>:'A aula '}
                        {classe==='Nave' ? 'não foi dada (a Nave tem data fixa).' : <><b>volta para a fila</b> e aparece de novo pra ser dada no próximo sábado.</>}</>}
                </div>
              </div>}
        </Modal>
        )
      })()}

      <AvisoSaida aviso={avisoSaidaEB} membros={membros} mes={mes} ano={ano} usuario={user?.nome} dispatch={dispatch} onClose={()=>setAvisoSaidaEB(null)} />

      {modalWA && (
        <Modal title={`Enviar Escala EB — ${MESES[mes]} ${ano}`} onClose={()=>setModalWA(false)} wide
          footer={<Btn variant="outline" onClick={()=>setModalWA(false)}>Fechar</Btn>}>
          <div style={{display:'flex',gap:6,marginBottom:10}}>
            {[['mes','Todo o mes'],['fds','Proximo FDS'],['dia','Sabado especifico']].map(([v,l])=>(
              <button key={v} onClick={()=>setFiltroWA_EB(v)} style={{flex:1,padding:'7px',borderRadius:7,border:`2px solid ${filtroWA_EB===v?'var(--cy)':'var(--bd)'}`,background:filtroWA_EB===v?'var(--cdim)':'var(--s2)',color:filtroWA_EB===v?'var(--cy)':'var(--g)',cursor:'pointer',fontSize:11,fontWeight:600}}>{l}</button>
            ))}
          </div>
          {filtroWA_EB==='dia'&&(
            <select value={diaSabWA} onChange={e=>setDiaSabWA(e.target.value)} style={{width:'100%',marginBottom:10,padding:'7px 8px',fontSize:12}}>
              <option value="">— Selecionar sabado —</option>
              {sabs.map((d,i)=>!isCafeConexao(d)&&<option key={i} value={String(i)}>{fmtBR(d)}</option>)}
            </select>
          )}
          <select value={classeWA_EB} onChange={e=>setClasseWA_EB(e.target.value)} style={{width:'100%',marginBottom:10,padding:'7px 8px',fontSize:12}}>
            <option value="">📚 Todas as turmas</option>
            {classesPermitidas.map(cl=><option key={cl} value={cl}>📖 {cl}</option>)}
          </select>
          <div style={{marginBottom:12}}>
            <label>Selecionar Mensagem</label>
            <select value={msgVersao} onChange={e=>setMsgVersao(parseInt(e.target.value))} style={{marginTop:4}}>
              <option value={0}>Aviso 1 — "Passando pra avisar"</option>
              <option value={1}>Aviso 2 — "Segue sua participação"</option>
              <option value={2}>Aviso 3 — "É uma alegria contar com você"</option>
              <option value={3}>🔔 Lembrete — "Esse sábado é você!"</option>
            </select>
          </div>
          <div style={{background:'var(--s2)',borderRadius:8,padding:12,fontSize:12,lineHeight:1.8,color:'var(--tx)',whiteSpace:'pre-wrap',borderLeft:'3px solid var(--cy)',marginBottom:14,maxHeight:150,overflowY:'auto'}}>{previewText}</div>
          {pessoasEB.length===0
            ? <div style={{color:'var(--g)',fontSize:13,textAlign:'center',padding:20}}>{filtroWA_EB==='fds'?'Nenhum escalado para o próximo sábado.':'Ninguem escalado na Escola Biblica neste periodo ainda.'}</div>
            : <>
                {pessoasEB.some(p=>p.email) && (
                  <div style={{marginBottom:12,display:'flex',justifyContent:'flex-end'}}>
                    <button onClick={async()=>{
                      const comEmail=pessoasEB.filter(p=>p.email)
                      dispatch({type:'TOAST',value:`✉ Enviando para ${comEmail.length}...`})
                      try{const r=await fetch('/api/send-email',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${getToken()}`},body:JSON.stringify({pessoas:comEmail.map(p=>({nome:p.nome,email:p.email,linhas:p.fns})),tipo:'eb',mes,ano,escopo:filtroWA_EB,usuario:user?.nome})});const d=await r.json();window.dispatchEvent(new Event('email-enviado'));dispatch({type:'TOAST',value:`✅ ${d.enviados} e-mail(s)!`})}catch{dispatch({type:'TOAST',value:'⚠ Erro.'})}
                    }} style={{padding:'7px 14px',borderRadius:7,border:'1px solid var(--cgl)',background:'var(--cdim)',color:'var(--cy)',cursor:'pointer',fontSize:12,fontWeight:600,display:'inline-flex',alignItems:'center',gap:5}}>
                      <Mail size={14}/> Enviar todos por email ({pessoasEB.filter(p=>p.email).length})
                    </button>
                  </div>
                )}
                {pessoasEB.map(p=>(
              <div key={p.nome} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'9px 0',borderBottom:'1px solid var(--bd)'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--w)'}}>{p.nome}</div>
                  <div style={{fontSize:11,color:'var(--g)',marginTop:2}}>{p.fns.join(' · ')}</div>
                </div>
                <div style={{display:'flex',gap:5,flexShrink:0}}>
                  {p.tel ? <a href={waLink(p.tel, MSG_EB[msgVersao](p.nome.split(' ')[0], p.fns.join('\n'), filtroWA_EB))} target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',padding:'5px 10px',background:'rgba(34,197,94,.12)',border:'1px solid rgba(34,197,94,.3)',borderRadius:6,color:'var(--grn)',textDecoration:'none',fontSize:11,fontWeight:600}}><MessageCircle size={14}/></a> : <span style={{fontSize:10,color:'var(--g)'}}>sem tel</span>}
                  <button onClick={async()=>{if(!p.email){dispatch({type:'TOAST',value:'⚠ Sem e-mail cadastrado.'});return}dispatch({type:'TOAST',value:`✉ Enviando...`});try{const r=await fetch('/api/send-email',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${getToken()}`},body:JSON.stringify({pessoas:[{nome:p.nome,email:p.email,linhas:p.fns}],tipo:'eb',mes,ano,escopo:'mes',usuario:user?.nome})});const d=await r.json();window.dispatchEvent(new Event('email-enviado'));dispatch({type:'TOAST',value:d.enviados?`✅ E-mail enviado!`:'⚠ Falha.'})}catch{dispatch({type:'TOAST',value:'⚠ Erro.'})}}} style={{padding:'5px 10px',borderRadius:6,border:`1px solid ${p.email?'var(--cgl)':'var(--bd)'}`,background:p.email?'var(--cdim)':'transparent',color:p.email?'var(--cy)':'var(--g)',cursor:p.email?'pointer':'default',display:'inline-flex',alignItems:'center'}}><Mail size={14}/></button>
                </div>
              </div>
            ))}
              </>
          }
        </Modal>
      )}
    </div>
  )
}
