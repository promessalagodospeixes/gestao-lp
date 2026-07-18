import { useState, useMemo } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbUpsert, dbInsert, dbDelete } from '../lib/supabase.js'
import { podeExcluirOuSolicitar } from '../lib/solicitacoes.js'
import { getSabDom, getCultosOrdenados, fmtBR, isCafeConexao, normalizar, waLink, MSG_LV, MSG_GRUPO_LV, MESES, primeiroUltimo, nomeDisp, isAdmin } from '../lib/utils.js'
import { MonthNav, Btn, BtnGroup, Modal, FormGrid, FG, Tag } from '../components/UI.jsx'

const INSTS = ['Teclado','Bateria','Baixo','Guitarra','Violão','Som','Telão','Mídia']
const INSTS_UNICO = new Set(['Som','Telão','Mídia']) // só 1 pessoa por culto
// Emoji de cada função (não existe emoji de contrabaixo — cordas usam 🎸)
const INST_EMOJI = { Teclado:'🎹', Bateria:'🥁', Baixo:'🎸', Guitarra:'🎸', 'Violão':'🎸', Som:'🎚️', 'Telão':'🖥️', 'Mídia':'🎥' }

// Normaliza valor do instrumental para [{nome, louvores:[]}]
const normInst = (val) => {
  const mk = (v) => {
    if (!v) return {nome:'',louvores:[]}
    if (typeof v === 'string') return {nome:v, louvores:[]}
    return {nome:v?.nome||'', louvores:Array.isArray(v?.louvores)?v.louvores:[]}
  }
  if (!val || val === '') return [mk(null), mk(null)]
  if (typeof val === 'string') return [mk(val), mk(null)]
  if (Array.isArray(val)) {
    const arr = val.map(mk)
    while (arr.length < 2) arr.push(mk(null))
    return arr.slice(0,2)
  }
  return [mk(null), mk(null)]
}

function MsgGrupoModal({ esc, mes, ano, membros, musicas, setlists, copiado, setCopiado, onClose }) {
  const [escopo, setEscopo] = useState('fds')   // 'mes' | 'fds' | 'dia'
  const [diaSlot, setDiaSlot] = useState('')
  const [secao, setSecao] = useState('completo') // 'completo' | 'vocal' | 'instrumental'

  const hj = new Date(); hj.setHours(0,0,0,0)
  const cultos = getCultosOrdenados(mes, ano)
  const { sabs, doms } = getSabDom(mes, ano)

  // Determina quais cultos mostrar
  const cultosSelecionados = (() => {
    if (escopo === 'mes') return cultos
    if (escopo === 'dia' && diaSlot) return cultos.filter(c => `${c.tipo}-${c.idx}` === diaSlot)
    // fds: próximo FDS ou último se todos passados
    const futuros = cultos.filter(c => c.data >= hj)
    const base = futuros.length ? futuros[0] : cultos[cultos.length-1]
    return base ? cultos.filter(c => Math.abs(c.data - base.data) <= 2*24*3600*1000) : []
  })()

  // Monta slots ricos com vocal+solos, inst+louvores e setlist
  const msgSlots = cultosSelecionados.map(c => {
    const slot = `${c.tipo}-${c.idx}`
    const inst = esc[slot]?.inst || {}
    const vocalSolos = esc[slot]?.vocalSolos || {}
    const cultoNome = c.tipo === 'sab' ? 'Sábado Manhã' : 'Domingo Noite'
    const sl = (setlists||[]).find(s => s.data === c.data.toISOString().slice(0,10) && s.culto === cultoNome)
    const slMusicas = sl ? (sl.musicas||[]).map(id => (musicas||[]).find(m => m.id === id)).filter(Boolean) : []

    const vocal = [1,2,3,4,5,6].map(n => esc[`${slot}-v${n}`]).filter(Boolean).map(nome => ({
      disp: nomeDisp(nome, membros),
      solos: vocalSolos[nome],
    }))

    const instMap = {}
    INSTS.forEach(papel => {
      const arr = normInst(inst[papel])
      const pessoas = arr.filter(x => x.nome).map(x => ({
        disp: nomeDisp(x.nome, membros),
        louvores: x.louvores || [],
      }))
      if (pessoas.length) instMap[papel] = pessoas
    })

    return {
      tipo: c.tipo,
      data: c.data,
      label: c.tipo === 'sab' ? 'Sabado Manha' : 'Domingo Noite',
      vocal,
      inst: instMap,
      musicas: slMusicas,
    }
  })

  const texto = MSG_GRUPO_LV(msgSlots, secao)
  const copiar = () => navigator.clipboard.writeText(texto).then(() => setCopiado(true))

  const chipStyle = (active) => ({
    flex:1, padding:'7px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:600,
    border: `2px solid ${active?'var(--cy)':'var(--bd)'}`,
    background: active ? 'var(--cdim)' : 'var(--s2)',
    color: active ? 'var(--cy)' : 'var(--g)',
  })

  return (
    <Modal title="MENSAGEM PARA O GRUPO" onClose={onClose} wide
      footer={<><Btn onClick={copiar} variant={copiado?'green':'cyan'}>{copiado?'Copiado!':'Copiar texto'}</Btn><Btn variant="outline" onClick={onClose}>Fechar</Btn></>}>
      <div style={{display:'flex',gap:6,marginBottom:10}}>
        {[['fds','Proximo FDS'],['dia','Dia especifico'],['mes','Todo o mes']].map(([v,l])=>(
          <button key={v} onClick={()=>setEscopo(v)} style={chipStyle(escopo===v)}>{l}</button>
        ))}
      </div>
      <div style={{display:'flex',gap:6,marginBottom:10}}>
        {[['completo','Completo'],['vocal','🎤 Só Vocal'],['instrumental','🎸 Só Instrumental']].map(([v,l])=>(
          <button key={v} onClick={()=>setSecao(v)} style={chipStyle(secao===v)}>{l}</button>
        ))}
      </div>
      {escopo==='dia' && (
        <select value={diaSlot} onChange={e=>setDiaSlot(e.target.value)} style={{width:'100%',marginBottom:10,padding:'7px 8px',fontSize:12}}>
          <option value="">— Selecionar culto —</option>
          {cultos.map(c=>(
            <option key={`${c.tipo}-${c.idx}`} value={`${c.tipo}-${c.idx}`}>{c.tipo==='sab'?'Sab':'Dom'} {fmtBR(c.data)}</option>
          ))}
        </select>
      )}
      <div style={{fontSize:10,color:'var(--g)',marginBottom:8}}>
        Copie o texto e cole no grupo do WhatsApp. Solos vocais e musicas por instrumentista aparecem automaticamente quando configurados.
      </div>
      <textarea
        readOnly value={texto||'Nenhuma pessoa escalada para este periodo.'}
        style={{width:'100%',minHeight:260,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:8,padding:12,fontSize:11,color:'var(--tx)',lineHeight:1.7,resize:'vertical',fontFamily:'monospace',boxSizing:'border-box'}}
        onClick={e=>e.target.select()}
      />
    </Modal>
  )
}

export default function EscalaLouvor() {
  const { state, dispatch } = useStore()
  const { escalasLv, funcoes, membros, musicas, setlists, ocorrencias, user } = state
  const _extraPages = user?.extraPages || []
  const _isGestorLouvor = user?.perfil === 'gestor-vocal' || user?.perfil === 'gestor-instrumental'
  const _temPerms = _extraPages.length > 0
  // Gestores salvos antes dos flags louvor-vocal/louvor-instrumental (têm escala-louvor mas nenhum flag)
  // ganham acesso completo por retrocompatibilidade
  const _hasLouvorPage = _extraPages.includes('escala-louvor')
  const _hasVocalFlag = _extraPages.includes('louvor-vocal')
  const _hasInstFlag = _extraPages.includes('louvor-instrumental')
  const _legacyGestor = _hasLouvorPage && !_hasVocalFlag && !_hasInstFlag
  const podeVocal = isAdmin(user) || (_isGestorLouvor && (_temPerms ? (_legacyGestor || _hasVocalFlag) : user?.perfil === 'gestor-vocal'))
  const podeInstrumental = isAdmin(user) || (_isGestorLouvor && (_temPerms ? (_legacyGestor || _hasInstFlag) : user?.perfil === 'gestor-instrumental'))
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth())
  const [ano, setAno] = useState(now.getFullYear())
  const [saving, setSaving] = useState(false)
  const [modalSL, setModalSL] = useState(false)
  const [slForm, setSlForm] = useState({ id:null, data:'', culto:'Sábado Manhã', musicas:[], obs:'' })
  const [slBusca, setSlBusca] = useState('')
  const [modalWA, setModalWA] = useState(false)
  const [msgVersao, setMsgVersao] = useState(0)
  const [filtroWA, setFiltroWA] = useState('mes')
  const [filtroSecaoLv, setFiltroSecaoLv] = useState({ vocal: true, instrumental: true })
  const [cultosAbertos, setCultosAbertos] = useState({}) // cultos fechados por padrão
  const [modalMapa, setModalMapa] = useState(false)
  const [modalGrupo, setModalGrupo] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [diaSlotWA, setDiaSlotWA] = useState('')
  const [modalConfLv, setModalConfLv] = useState(null) // {slot, data, tipo}
  const [confRespLv, setConfRespLv] = useState('sim')
  const [ocItensLv, setOcItensLv] = useState([])
  const [savingConfLv, setSavingConfLv] = useState(false)

  const hoje2 = new Date(); hoje2.setHours(0,0,0,0)

  const ocorrenciasLvSlot = (slot) => (ocorrencias||[]).filter(o=>o.ano===ano&&o.mes===mes+1&&o.slot===slot&&o.tipo==='louvor')

  const abrirConfLv = (slot, data, tipo) => {
    const ex = ocorrenciasLvSlot(slot)
    const reais = ex.filter(o=>o.funcao!=='_confirmado')
    setConfRespLv(reais.length?'nao':'sim')
    setOcItensLv(reais.length ? reais.map(o=>({funcao:o.funcao||'',nome_original:o.nome_original||'',substituto:o.substituto||'',motivo:o.motivo||''})) : [])
    setModalConfLv({slot,data,tipo})
  }

  const salvarConfLv = async () => {
    const {slot} = modalConfLv
    setSavingConfLv(true)
    const existentes = ocorrenciasLvSlot(slot)
    await Promise.all(existentes.map(o=>dbDelete('ocorrencias',o.id)))
    let novos = []
    if (confRespLv==='sim') {
      const row = {ano,mes:mes+1,slot,tipo:'louvor',funcao:'_confirmado',nome_original:null,substituto:null,motivo:null}
      const novo = await dbInsert('ocorrencias',row)
      novos = [novo||{id:Date.now(),...row}]
    } else {
      for (const it of ocItensLv) {
        if (!it.funcao) continue
        const row = {ano,mes:mes+1,slot,tipo:'louvor',funcao:it.funcao,nome_original:it.nome_original||null,substituto:it.substituto||null,motivo:it.motivo||null}
        const novo = await dbInsert('ocorrencias',row)
        novos.push(novo||{id:Date.now()+Math.random(),...row})
      }
    }
    const restantes = (ocorrencias||[]).filter(o=>!(o.ano===ano&&o.mes===mes+1&&o.slot===slot&&o.tipo==='louvor'))
    dispatch({type:'SET',key:'ocorrencias',value:[...restantes,...novos]})
    setSavingConfLv(false); setModalConfLv(null)
    dispatch({type:'TOAST',value:'✅ Confirmação registrada!'})
  }

  const chM = (d) => { let m=mes+d,a=ano; if(m>11){m=0;a++} if(m<0){m=11;a--} setMes(m);setAno(a) }
  const ch = `lv-${ano}-${mes}`
  const esc = escalasLv[ch]||{}
  const { sabs, doms } = getSabDom(mes, ano)

  // Only use registered members - never fallback
  const fnMbs = (nome) => {
    const f = (funcoes||[]).find(x=>x.nome===nome)
    return f && (f.membros||[]).length ? f.membros : []
  }

  // Retorna disponibilidade de um membro numa função
  const getDisp = (nomeFuncao, nomeMembro) => {
    const f = (funcoes||[]).find(x=>x.nome===nomeFuncao)
    return (f?.disponibilidades||{})[nomeMembro] || 'semanal'
  }

  // Verifica se membro está disponível para um slot específico
  const isDisponivel = (disp, tipo, idx) => {
    switch(disp) {
      case 'semanal':       return true
      case 'quinzenal-sab': return tipo === 'sab' && idx % 2 === 0
      case 'quinzenal-dom': return tipo === 'dom' && idx % 2 === 0
      case 'quinzenal-alt': return idx % 2 === 0
      case 'mensal':        return idx === 0
      case 'bimestral':     return idx === 0  // só 1x no mês
      case 'trimestral':    return idx === 0
      case 'livre':         return false       // só manual
      default:              return true
    }
  }

  // Membros disponíveis para um papel em um slot específico
  const fnMbsDisp = (nomeFuncao, tipo, idx) => {
    const f = (funcoes||[]).find(x=>x.nome===nomeFuncao)
    if (!f || !f.membros?.length) return []
    return f.membros.filter(nome => isDisponivel(getDisp(nomeFuncao, nome), tipo, idx))
  }

  const vocais = fnMbs('Vocal Equipe')

  // Solo vocal: quais louvores cada vocal vai soar
  const getVocalSolos = (slot, nome) => (esc[slot]?.vocalSolos || {})[nome]
  const setVocalSolo = (slot, nome, n, checked) => {
    const cur = esc[slot] || {}
    const prev = cur.vocalSolos || {}
    const existing = Array.isArray(prev[nome]) ? prev[nome] : []
    const next = checked ? [...new Set([...existing, n])].sort((a,b)=>a-b) : existing.filter(x=>x!==n)
    dispatch({ type:'SET', key:'escalasLv', value:{...escalasLv,[ch]:{...esc,[slot]:{...cur,vocalSolos:{...prev,[nome]:next}}}} })
  }
  const setVocalTodos = (slot, nome) => {
    const cur = esc[slot] || {}
    const prev = cur.vocalSolos || {}
    const isTodos = prev[nome] === 'todos'
    dispatch({ type:'SET', key:'escalasLv', value:{...escalasLv,[ch]:{...esc,[slot]:{...cur,vocalSolos:{...prev,[nome]:isTodos?undefined:'todos'}}}} })
  }

  const setVoc = (slot, n, val) => {
    const key = `${slot}-v${n}`
    dispatch({ type:'SET', key:'escalasLv', value:{...escalasLv,[ch]:{...esc,[key]:val}} })
  }

  const setInst = (slot, papel, idx, nome) => {
    const cur = esc[slot]||{}
    const arr = normInst((cur.inst||{})[papel])
    arr[idx] = {...arr[idx], nome, louvores:[]}
    // Se mudar para 1 pessoa (limpa 2ª), reseta louvores da 1ª também
    if (idx === 1 && !nome) arr[0] = {...arr[0], louvores:[]}
    const instVal = arr.every(x=>!x.nome) ? '' : arr
    const inst = {...(cur.inst||{}), [papel]: instVal}
    dispatch({ type:'SET', key:'escalasLv', value:{...escalasLv,[ch]:{...esc,[slot]:{...cur,inst}}} })
  }

  const toggleLouvor = (slot, papel, idx, num) => {
    const cur = esc[slot]||{}
    const arr = normInst((cur.inst||{})[papel])
    const lvs = arr[idx].louvores
    arr[idx] = {...arr[idx], louvores: lvs.includes(num) ? lvs.filter(n=>n!==num) : [...lvs,num].sort((a,b)=>a-b)}
    const inst = {...(cur.inst||{}), [papel]: arr}
    dispatch({ type:'SET', key:'escalasLv', value:{...escalasLv,[ch]:{...esc,[slot]:{...cur,inst}}} })
  }

  const setNLouvores = (slot, tipo, n) => {
    const cur = esc[slot]||{}
    dispatch({ type:'SET', key:'escalasLv', value:{...escalasLv,[ch]:{...esc,[slot]:{...cur,nLouvores:n}}} })
  }

  const getNLouvores = (slot, tipo) => esc[slot]?.nLouvores || (tipo==='sab'?4:5)

  const gerarAuto = (modo = null) => {
    // modo: 'vocal' | 'instrumental' | null (usa perfil do usuário)
    const gerarVocal = modo === 'vocal' || (!modo && podeVocal)
    const gerarInstrumental = modo === 'instrumental' || (!modo && podeInstrumental)

    const seed = Math.floor(Math.random() * 9973)
    const smartPick = (lista, usadosVocal, usadosInst, lastUsed, off) => {
      if (!lista.length) return ''
      const pref = lista.filter(p => !usadosVocal.includes(p) && !usadosInst.includes(p) && !lastUsed.includes(p))
      const pool = pref.length ? pref : lista.filter(p => !usadosVocal.includes(p) && !usadosInst.includes(p))
      const final = pool.length ? pool : lista
      return final[(seed+off) % final.length] || ''
    }

    // Começa com cópia da escala atual: gerar só uma seção preserva a outra
    const novoEsc = {...esc}
    const lastVocUsed = []
    const lastInstUsed = {}

    const fillCulto = (slot, tipo, idx, nL) => {
      const slotAtual = esc[slot] || {}

      if (gerarVocal) {
        // Limpa vagas antigas de vocal antes de regenerar
        for(let n=1;n<=6;n++) delete novoEsc[`${slot}-v${n}`]
        const vocaisDisp = fnMbsDisp('Vocal Equipe', tipo, idx)
        const vU = []
        for(let n=1;n<=nL;n++){
          const p = smartPick(vocaisDisp, vU, [], lastVocUsed, idx*nL+n-1)
          novoEsc[`${slot}-v${n}`] = p
          if(p) vU.push(p)
        }
        lastVocUsed.length = 0
        lastVocUsed.push(...vU)
      }

      if (gerarInstrumental) {
        const instExistente = slotAtual.inst || {}
        if (!novoEsc[slot]) novoEsc[slot] = { inst: {...instExistente} }
        const iU = []
        const vUsados = Array.from({length:6},(_,n)=>novoEsc[`${slot}-v${n+1}`]).filter(Boolean)
        INSTS.forEach((papel,pi)=>{
          const ms = fnMbsDisp(papel, tipo, idx)
          if(!ms.length) return
          const last = lastInstUsed[papel] || []
          const p = smartPick(ms, vUsados, iU, last, idx+pi)
          if (p) {
            novoEsc[slot].inst[papel] = [{nome:p,obs:''},{nome:'',obs:''}]
            iU.push(p)
            lastInstUsed[papel] = [p]
          }
        })
      } else if (!novoEsc[slot]) {
        novoEsc[slot] = { inst: slotAtual.inst || {}, nLouvores: slotAtual.nLouvores, vocalSolos: slotAtual.vocalSolos }
      }
    }

    sabs.forEach((d,i) => fillCulto(`sab-${i}`, 'sab', i, 3))
    doms.forEach((_,i) => fillCulto(`dom-${i}`, 'dom', i, 3))

    dispatch({ type:'SET', key:'escalasLv', value:{...escalasLv,[ch]:novoEsc} })
    dispatch({ type:'TOAST', value:'✨ Louvor gerado!' })
  }


  const salvar = async () => {
    setSaving(true)
    const slots = {}
    Object.entries(esc).forEach(([k,v])=>{
      if(k.match(/-v\d+$/)){
        const slot=k.replace(/-v\d+$/,'')
        if(!slots[slot])slots[slot]={vocal:{}}
        slots[slot].vocal[k.match(/-v(\d+)$/)[1]]=v
      } else if(v&&typeof v==='object'&&(v.inst||v.nLouvores||v.vocalSolos)){
        if(!slots[k])slots[k]={vocal:{}}
        slots[k].inst=v.inst||{}
        if(v.nLouvores) slots[k].nLouvores=v.nLouvores
        if(v.vocalSolos) slots[k].vocalSolos=v.vocalSolos
      }
    })
    const rows = Object.entries(slots).map(([slot,s])=>{
      const instData = {...(s.inst||{})}
      if(s.nLouvores) instData._n = s.nLouvores
      if(s.vocalSolos && Object.keys(s.vocalSolos).length) instData._vs = s.vocalSolos
      return {ano,mes:mes+1,slot,vocal:JSON.stringify(s.vocal||{}),instrumental:JSON.stringify(instData)}
    })
    await Promise.all(rows.map(r=>dbUpsert('escalas_lv',r,'ano,mes,slot')))
    setSaving(false)
    dispatch({ type:'TOAST', value:'Louvor salvo!' })
  }

  const salvarSlot = async (slot) => {
    const vocal = {}
    for (let n=1; n<=9; n++) { const v = esc[`${slot}-v${n}`]; if(v) vocal[String(n)] = v }
    const cur = esc[slot] || {}
    const instData = {...(cur.inst||{})}
    if (cur.nLouvores) instData._n = cur.nLouvores
    if (cur.vocalSolos && Object.keys(cur.vocalSolos).length) instData._vs = cur.vocalSolos
    await dbUpsert('escalas_lv', { ano, mes:mes+1, slot, vocal:JSON.stringify(vocal), instrumental:JSON.stringify(instData) }, 'ano,mes,slot')
    dispatch({ type:'TOAST', value:'Dia salvo!' })
  }

  const abrirSetlist = (data, cultoNome) => {
    const dataStr = data.toISOString().slice(0,10)
    // Se já existe setlist para esse culto, abre para editar
    const existente = (setlists||[]).find(s=>s.data===dataStr&&s.culto===cultoNome)
    if (existente) {
      setSlForm({ id: existente.id, data: existente.data, culto: existente.culto, musicas: Array.isArray(existente.musicas)?existente.musicas:[], obs: existente.obs||'' })
    } else {
      setSlForm({ id: null, data: dataStr, culto: cultoNome, musicas: [], obs: '' })
    }
    setSlBusca(''); setModalSL(true)
  }

  const moveMusica = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= slForm.musicas.length) return
    const arr = [...slForm.musicas];[arr[i], arr[j]] = [arr[j], arr[i]]
    setSlForm(f => ({...f, musicas: arr}))
  }

  const salvarSL = async () => {
    if(!slForm.data||!slForm.musicas.length){dispatch({type:'TOAST',value:'⚠ Selecione data e músicas.'});return}
    const row={data:slForm.data,culto:slForm.culto,musicas:JSON.stringify(slForm.musicas),obs:slForm.obs}
    if (slForm.id) {
      // Editar existente
      await dbUpsert('setlists', {...row, id: slForm.id}, 'id')
      dispatch({type:'SET',key:'setlists',value:(setlists||[]).map(s=>s.id===slForm.id?{...s,...row,musicas:slForm.musicas}:s)})
      dispatch({type:'TOAST',value:'✅ Setlist atualizado!'})
    } else {
      const novo=await dbInsert('setlists',row)
      dispatch({type:'SET',key:'setlists',value:[...(setlists||[]),{...(novo||{id:Date.now()}),...row,musicas:slForm.musicas}]})
      dispatch({type:'TOAST',value:'🎵 Setlist salvo!'})
    }
    setModalSL(false);setSlForm({id:null,data:'',culto:'Sábado Manhã',musicas:[],obs:''});setSlBusca('')
  }

  const excluirSL = async (id) => {
    const sl = (setlists||[]).find(s=>s.id===id)
    const ok = await podeExcluirOuSolicitar(user, dispatch, { tabela:'setlists', registroId:id, descricao:`Excluir setlist de ${sl ? fmtBR(sl.data)+' - '+sl.culto : ''}` })
    if (!ok) return
    await dbDelete('setlists', id)
    dispatch({type:'SET',key:'setlists',value:(setlists||[]).filter(s=>s.id!==id)})
    dispatch({type:'TOAST',value:'🗑 Setlist removido.'})
  }

  const musicasFiltradas = slBusca
    ? (musicas||[]).filter(m=>normalizar(m.nome).includes(normalizar(slBusca))||normalizar(m.artista||'').includes(normalizar(slBusca)))
    : (musicas||[])

  const CultoCard = ({data,tipo,idx}) => {
    const slot=`${tipo}-${idx}`
    const cafe = tipo==='sab' && isCafeConexao(data)
    const nVocal=3
    const nLouvores = getNLouvores(slot, tipo)
    const slData=data.toISOString().slice(0,10)
    const cultoNome = tipo==='sab'?'Sábado Manhã':'Domingo Noite'
    const sl=(setlists||[]).find(s=>s.data===slData&&s.culto===cultoNome)
    const aberto = !!cultosAbertos[slot]
    // Resumo de quantas pessoas estão escaladas (mostrado quando fechado)
    const nVoc = [1,2,3,4,5,6].filter(n=>esc[`${slot}-v${n}`]).length
    const nInst = Object.values(esc[slot]?.inst||{}).reduce((a,v)=>a+normInst(v).filter(x=>x.nome).length,0)

    return(
      <div style={{background:'var(--s1)',border:`1px solid ${cafe?'rgba(245,158,11,.4)':'var(--bd)'}`,borderRadius:10,overflow:'hidden',marginBottom:12}}>
        <div onClick={()=>setCultosAbertos(p=>({...p,[slot]:!p[slot]}))} style={{background:cafe?'rgba(245,158,11,.08)':'var(--s2)',padding:'9px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap',cursor:'pointer'}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:12,letterSpacing:2,color:cafe?'var(--yel)':'var(--w)',flex:1,display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:11,color:'var(--cy)',display:'inline-block',transform:aberto?'rotate(90deg)':'none',transition:'transform .15s'}}>▶</span>
            <span>{tipo==='sab'?'☀ SÁBADO':'🌙 DOMINGO'} — {fmtBR(data)}{cafe?' — ☕ CAFÉ E CONEXÃO':''}</span>
            {!aberto && (nVoc+nInst>0) && <span style={{fontSize:9,color:'var(--g)',letterSpacing:0,fontFamily:'inherit'}}>🎤 {nVoc} · 🎸 {nInst}</span>}
          </div>
          {aberto && <span onClick={e=>e.stopPropagation()} style={{display:'contents'}}>
          <Btn variant="outline" size="xs" onClick={()=>salvarSlot(slot)}>Salvar dia</Btn>
          </span>}
          {/* Confirmação sempre visível, mesmo com o culto fechado */}
          {data < hoje2 && isAdmin(user) && (() => {
            const ocs = ocorrenciasLvSlot(slot)
            const confirmado = ocs.some(o=>o.funcao==='_confirmado')
            const temOc = ocs.some(o=>o.funcao!=='_confirmado')
            return <span onClick={e=>e.stopPropagation()} style={{display:'contents'}}>
              <Btn variant={confirmado?(temOc?'danger':'outline'):'wa'} size="xs" onClick={()=>abrirConfLv(slot,data,tipo)}>
                {confirmado?(temOc?'⚠ Ocorrência':'✅ Confirmado'):'📋 Confirmar'}
              </Btn>
            </span>
          })()}
          <div onClick={e=>e.stopPropagation()} style={{display:aberto?'flex':'none',alignItems:'center',gap:5,flexShrink:0}}>
            {/* Contador de louvores: − N lv + */}
            <div style={{display:'flex',alignItems:'center',background:'var(--s3)',border:'1px solid var(--bd)',borderRadius:6,overflow:'hidden'}}>
              <button onClick={()=>setNLouvores(slot,tipo,Math.max(1,nLouvores-1))}
                style={{width:22,height:26,border:'none',background:'transparent',color:'var(--g)',cursor:'pointer',fontSize:14,lineHeight:1,padding:0}}>−</button>
              <span style={{fontSize:11,fontWeight:700,color:'var(--cy)',minWidth:28,textAlign:'center',padding:'0 2px'}}>
                🎵 {nLouvores}
              </span>
              <button onClick={()=>setNLouvores(slot,tipo,Math.min(9,nLouvores+1))}
                style={{width:22,height:26,border:'none',background:'transparent',color:'var(--g)',cursor:'pointer',fontSize:14,lineHeight:1,padding:0}}>+</button>
            </div>
            <button onClick={()=>abrirSetlist(data, cultoNome)}
              title={sl && sl.musicas?.length ? sl.musicas.map((id,i)=>`${i+1}. ${(musicas||[]).find(m=>m.id===id)?.nome||'?'}`).join('\n') : undefined}
              style={{padding:'4px 10px',fontSize:11,background:sl?'rgba(16,185,129,.15)':'var(--s3)',border:`1px solid ${sl?'rgba(16,185,129,.5)':'var(--bd)'}`,borderRadius:6,color:sl?'var(--gr)':'var(--g)',cursor:'pointer',whiteSpace:'nowrap'}}>
              {sl?'🎵 Setlist':'+ Setlist'}
            </button>
          </div>
        </div>
        {aberto && <div style={{padding:'11px 14px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div>
              <div style={{fontSize:9,color:podeVocal?'var(--cy)':'var(--g)',letterSpacing:2,textTransform:'uppercase',marginBottom:5,fontWeight:600}}>🎤 VOCAL {!podeVocal&&<span style={{fontSize:8,color:'var(--g)'}}>(somente leitura)</span>}</div>
              {vocais.length===0 && <div style={{color:'var(--g)',fontSize:11,fontStyle:'italic'}}>Cadastre vocais no Registro de Funções</div>}
              {Array.from({length:nVocal},(_,i)=>{
                const nomeVoc = esc[`${slot}-v${i+1}`] || ''
                const solos = getVocalSolos(slot, nomeVoc)
                const isTodos = solos === 'todos'
                return (
                  <div key={i} style={{padding:'5px 0',borderBottom:'1px solid var(--bd)',opacity:podeVocal?1:.7}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{fontSize:9,color:'var(--g)',width:60,flexShrink:0}}>Vocal {i+1}</div>
                      {podeVocal
                        ? <select value={nomeVoc} onChange={e=>setVoc(slot,i+1,e.target.value)} style={{flex:1,padding:'5px 8px',fontSize:11,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--w)'}}><option value="">—</option>{vocais.map(n=><option key={n} value={n}>{nomeDisp(n, membros)}</option>)}</select>
                        : <div style={{flex:1,fontSize:11,color:nomeVoc?'var(--tx)':'var(--g)',padding:'5px 8px'}}>{nomeVoc?nomeDisp(nomeVoc,membros):'—'}</div>
                      }
                    </div>
                    {nomeVoc && podeVocal && (
                      <div style={{display:'flex',gap:3,marginTop:4,marginLeft:68,flexWrap:'wrap',alignItems:'center'}}>
                        <span style={{fontSize:8,color:'var(--g)',marginRight:2}}>Solo:</span>
                        <button onClick={()=>setVocalTodos(slot,nomeVoc)} style={{padding:'2px 7px',borderRadius:4,border:`1px solid ${isTodos?'var(--cy)':'var(--bd)'}`,background:isTodos?'var(--cdim)':'transparent',color:isTodos?'var(--cy)':'var(--g)',cursor:'pointer',fontSize:9,fontWeight:600}}>Todos</button>
                        {Array.from({length:nLouvores},(_,j)=>j+1).map(n=>{
                          const sel = Array.isArray(solos) && solos.includes(n)
                          const slMusNome = sl ? (musicas||[]).find(m=>m.id===(sl.musicas||[])[n-1])?.nome : null
                          return <button key={n} onClick={()=>setVocalSolo(slot,nomeVoc,n,!sel)} title={slMusNome ? `L${n}: ${slMusNome}` : `Louvor ${n}`} style={{width:20,height:20,borderRadius:3,border:`1px solid ${sel?'var(--cy)':'var(--bd)'}`,background:sel?'var(--cy)':'transparent',color:sel?'#000':'var(--g)',cursor:'pointer',fontSize:10,fontWeight:700,padding:0,lineHeight:1}}>{n}</button>
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div>
              <div style={{fontSize:9,color:podeInstrumental?'var(--cy)':'var(--g)',letterSpacing:2,textTransform:'uppercase',marginBottom:5,fontWeight:600}}>🎸 INSTRUMENTAL {!podeInstrumental&&<span style={{fontSize:8,color:'var(--g)'}}>(somente leitura)</span>}</div>
              {INSTS.map(papel=>{
                const ms=fnMbs(papel)
                if(!ms.length) return null
                const unico=INSTS_UNICO.has(papel)
                const arr=normInst((esc[slot]?.inst||{})[papel])
                const dois=!unico&&!!(arr[0].nome && arr[1].nome)
                const slots2=arr.slice(0,unico?1:2)
                return(
                  <div key={papel} style={{padding:'4px 0',borderBottom:'1px solid var(--bd)',opacity:podeInstrumental?1:.7}}>
                    <div style={{fontSize:9,color:'var(--g)',marginBottom:3,fontWeight:600}}>{papel}</div>
                    <div style={{display:'flex',gap:4}}>
                      {slots2.map((item,idx)=>(
                        <div key={idx} style={{flex:1,minWidth:0}}>
                          {podeInstrumental
                            ? <select value={item.nome} onChange={e=>setInst(slot,papel,idx,e.target.value)}
                                style={{width:'100%',padding:'4px 5px',fontSize:11,background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:5,color:'var(--w)'}}>
                                <option value="">—</option>
                                {ms.map(n=><option key={n} value={n}>{nomeDisp(n, membros)}</option>)}
                              </select>
                            : <div style={{padding:'4px 5px',fontSize:11,color:item.nome?'var(--tx)':'var(--g)'}}>{item.nome?nomeDisp(item.nome,membros):'—'}</div>
                          }
                          {dois && item.nome && podeInstrumental && (
                            <div style={{display:'flex',flexWrap:'wrap',gap:2,marginTop:3}}>
                              {Array.from({length:nLouvores},(_,i)=>i+1).map(n=>{
                                const sel=item.louvores.includes(n)
                                const slMusNome = sl ? (musicas||[]).find(m=>m.id===(sl.musicas||[])[n-1])?.nome : null
                                return(
                                  <button key={n} onClick={()=>toggleLouvor(slot,papel,idx,n)}
                                    title={slMusNome ? `L${n}: ${slMusNome}` : `Louvor ${n}`}
                                    style={{width:20,height:20,borderRadius:3,border:`1px solid ${sel?'var(--cy)':'var(--bd)'}`,
                                      background:sel?'var(--cy)':'var(--s3)',color:sel?'#000':'var(--g)',
                                      cursor:'pointer',fontSize:10,fontWeight:700,padding:0,lineHeight:1}}>
                                    {n}
                                  </button>
                                )
                              })}
                              {item.louvores.length===0&&<span style={{fontSize:8,color:'var(--g)',alignSelf:'center'}}>—</span>}
                            </div>
                          )}
                          {!dois && item.nome && idx===0 && (
                            <div style={{fontSize:8,color:'var(--g)',marginTop:2}}>todos os louvores</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>}
      </div>
    )
  }

  // Próximo FDS
  const proximoFDSSlots = useMemo(() => {
    const hj = new Date(); hj.setHours(0,0,0,0)
    const cultos = getCultosOrdenados(mes, ano).filter(c => c.data >= hj)
    if (!cultos.length) return []
    const first = cultos[0]
    const slots = [`${first.tipo}-${first.idx}`]
    const partner = cultos.find(c => c.tipo !== first.tipo && Math.abs(c.data - first.data) <= 2*24*3600*1000)
    if (partner) slots.push(`${partner.tipo}-${partner.idx}`)
    return slots
  }, [mes, ano])

  const tituloFDS = useMemo(() => {
    return proximoFDSSlots.map(sl => {
      const idx = parseInt(sl.split('-')[1])
      const d = sl.startsWith('sab') ? sabs[idx] : doms[idx]
      return d ? fmtBR(d) : ''
    }).filter(Boolean).join(' + ')
  }, [proximoFDSSlots, sabs, doms])

  // Compila escala por pessoa para o modal WhatsApp
  const todasPessoasLv = useMemo(() => { // eslint-disable-line
    const map = {}
    const addLine = (nome, linha) => {
      if (!nome) return
      if (!map[nome]) map[nome] = []
      map[nome].push(linha)
    }
    getCultosOrdenados(mes, ano).forEach(c => {
      const slot = `${c.tipo}-${c.idx}`
      const dataBR = fmtBR(c.data)
      const tipoNome = c.tipo === 'sab' ? 'Sábado' : 'Domingo'
      const linha = `📅 ${tipoNome} ${dataBR}`
      // Vocais
      for (let n = 1; n <= 3; n++) {
        const nome = esc[`${slot}-v${n}`]
        if (nome) addLine(nome, `${linha} — 🎤 Vocal`)
      }
      // Instrumentais
      const inst = esc[slot]?.inst || {}
      Object.entries(inst).forEach(([papel, val]) => {
        const arr = normInst(val)
        const dois = arr[0].nome && arr[1].nome
        arr.forEach(item => {
          if (item.nome) {
            const lvObs = dois && item.louvores.length ? ` (L${item.louvores.join(', L')})` : ''
            addLine(item.nome, `${linha} — ${INST_EMOJI[papel]||'🎸'} ${papel}${lvObs}`)
          }
        })
      })
    })
    // Busca telefone de cada pessoa
    return Object.entries(map).map(([nome, linhas]) => {
      const mb = (membros||[]).find(m => m.nome === nome)
      return { nome, tel: mb?.tel || null, email: mb?.email || null, linhas }
    }).sort((a,b) => a.nome.localeCompare(b.nome))
  }, [esc, mes, ano, membros])

  const pessoasLv = useMemo(() => {
    if (filtroWA === 'fds' && proximoFDSSlots.length) {
      return todasPessoasLv.filter(p =>
        p.linhas.some(linha => proximoFDSSlots.some(sl => {
          const idx = parseInt(sl.split('-')[1])
          const d = sl.startsWith('sab') ? sabs[idx] : doms[idx]
          return d && linha.includes(fmtBR(d))
        }))
      ).map(p => ({
        ...p,
        linhas: p.linhas.filter(linha => proximoFDSSlots.some(sl => {
          const idx = parseInt(sl.split('-')[1])
          const d = sl.startsWith('sab') ? sabs[idx] : doms[idx]
          return d && linha.includes(fmtBR(d))
        }))
      }))
    }
    if (filtroWA === 'dia' && diaSlotWA) {
      const idx = parseInt(diaSlotWA.split('-')[1])
      const d = diaSlotWA.startsWith('sab') ? sabs[idx] : doms[idx]
      if (!d) return todasPessoasLv
      const dataBR = fmtBR(d)
      return todasPessoasLv
        .filter(p => p.linhas.some(l => l.includes(dataBR)))
        .map(p => ({...p, linhas: p.linhas.filter(l => l.includes(dataBR))}))
    }
    return todasPessoasLv
  }, [todasPessoasLv, filtroWA, proximoFDSSlots, sabs, doms, diaSlotWA])

  // Filtro vocal/instrumental por seção
  const pessoasLvSecao = (() => {
    const { vocal, instrumental } = filtroSecaoLv
    if (vocal && instrumental) return pessoasLv
    return pessoasLv.map(p => ({
      ...p,
      // Linha de vocal tem 🎤; qualquer outra é de instrumental (cada instrumento tem seu emoji)
      linhas: p.linhas.filter(l => (vocal && l.includes('🎤')) || (instrumental && !l.includes('🎤')))
    })).filter(p => p.linhas.length > 0)
  })()

  const previewWA = MSG_LV[msgVersao]('Nome', 'Sabado 07/06 — Vocal\nDomingo 15/06 — Vocal', filtroWA)

  // Setlist do dia selecionado (para incluir na mensagem)
  const setlistDia = filtroWA === 'dia' && diaSlotWA ? (() => {
    const idx = parseInt(diaSlotWA.split('-')[1])
    const d = diaSlotWA.startsWith('sab') ? sabs[idx] : doms[idx]
    if (!d) return null
    const cultoNome = diaSlotWA.startsWith('sab') ? 'Sábado Manhã' : 'Domingo Noite'
    return (setlists||[]).find(s => s.data === d.toISOString().slice(0,10) && s.culto === cultoNome) || null
  })() : null

  const buildMsgLv = (p) => {
    let escala = p.linhas.join('\n')
    if (setlistDia && setlistDia.musicas?.length) {
      const nomes = setlistDia.musicas.map((id,i) => {
        const m = (musicas||[]).find(x=>x.id===id)
        return m ? `${i+1}. ${m.nome}` : null
      }).filter(Boolean)
      if (nomes.length) escala += `\n\nMusicas do dia:\n${nomes.join('\n')}`
    }
    return MSG_LV[msgVersao](p.nome.split(' ')[0], escala, filtroWA)
  }

  const mesSLs=(setlists||[]).filter(s=>{const d=new Date(s.data+'T00:00:00');return d.getMonth()===mes&&d.getFullYear()===ano})

  return(
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
        <MonthNav month={mes} year={ano} onPrev={()=>chM(-1)} onNext={()=>chM(1)} />
        <BtnGroup>
          {podeVocal && <Btn variant="outline" size="sm" onClick={()=>gerarAuto(isAdmin(user)?'vocal':null)}>✨ {isAdmin(user)?'Gerar Vocal':'Gerar Auto'}</Btn>}
          {isAdmin(user) && <Btn variant="outline" size="sm" onClick={()=>gerarAuto('instrumental')}>🎸 Gerar Instrumental</Btn>}
          <Btn size="sm" onClick={salvar} disabled={saving}>{saving?'Salvando...':'Salvar Mes'}</Btn>
          <Btn variant="outline" size="sm" onClick={()=>setModalMapa(true)}>🗺 Mapa Geral</Btn>
          <Btn variant="outline" size="sm" onClick={()=>window.print()}>📄 PDF</Btn>
          <Btn variant="outline" size="sm" onClick={()=>{setCopiado(false);setModalGrupo(true)}}>👥 Msg Grupo</Btn>
          <Btn variant="outline" size="sm" onClick={()=>setModalWA(true)}>💬 Enviar Escala</Btn>
        </BtnGroup>
      </div>
      {/* Chamado como função (não como <Componente/>) para o React não desmontar
          e remontar os cards a cada alteração — isso fazia a página pular pro topo */}
      {getCultosOrdenados(mes,ano).map(c=><div key={`${c.tipo}-${c.idx}`}>{CultoCard({data:c.data,tipo:c.tipo,idx:c.idx})}</div>)}

      {mesSLs.length>0&&<div style={{marginTop:16}}>
        <div style={{fontFamily:'var(--font-display)',fontSize:16,letterSpacing:2,color:'var(--w)',marginBottom:10}}>SETLISTS</div>
        {mesSLs.map(s=>{
          const ms=(s.musicas||[]).map(id=>{const m=(musicas||[]).find(x=>x.id===id);return m?m.nome:'?'})
          return<div key={s.id} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,padding:12,marginBottom:8}}>
            <div style={{display:'flex',gap:9,marginBottom:6,flexWrap:'wrap',alignItems:'center'}}>
              <strong style={{color:'var(--w)',flex:1}}>{s.culto}</strong>
              <span style={{color:'var(--cy)',fontSize:11}}>{new Date(s.data+'T00:00:00').toLocaleDateString('pt-BR')}</span>
              <button onClick={()=>excluirSL(s.id)} title="Excluir setlist" style={{background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:5,color:'var(--rd)',cursor:'pointer',fontSize:11,padding:'2px 8px'}}>🗑</button>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>{ms.map(m=><Tag key={m} color="cyan">🎵 {m}</Tag>)}</div>
            {s.obs&&<div style={{marginTop:4,fontSize:11,color:'var(--g)'}}>{s.obs}</div>}
          </div>
        })}
      </div>}

      {/* Mapa imprimível — oculto na tela, visível ao imprimir */}
      <div className="print-mapa">
        <h2>EQUIPE DE LOUVOR — {MESES[mes].toUpperCase()} {ano}</h2>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>V1</th><th>V2</th><th>V3</th>
              {INSTS.map(h=><th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {getCultosOrdenados(mes,ano).map(c=>{
              const slot=`${c.tipo}-${c.idx}`
              const inst=esc[slot]?.inst||{}
              return(
                <tr key={slot}>
                  <td><strong>{fmtBR(c.data)}</strong> {c.tipo==='sab'?'Sáb':'Dom'}</td>
                  {[1,2,3].map(n=><td key={n}>{esc[`${slot}-v${n}`]||'—'}</td>)}
                  {INSTS.map(p=>{
                    const arr=normInst(inst[p])
                    const nomes=arr.map(x=>x.nome?x.nome.split(' ')[0]:null).filter(Boolean)
                    return <td key={p}>{nomes.length?nomes.join(' / '):'—'}</td>
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mapa Geral */}
      {modalMapa&&(
        <Modal title={`MAPA GERAL — ${MESES[mes].toUpperCase()} ${ano}`} onClose={()=>setModalMapa(false)} wide
          footer={<><Btn variant="outline" size="sm" onClick={()=>window.print()}>🖨 Imprimir</Btn><Btn variant="outline" onClick={()=>setModalMapa(false)}>Fechar</Btn></>}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,minWidth:700}}>
              <thead>
                <tr style={{background:'var(--s2)'}}>
                  {['Data','V1','V2','V3',...INSTS].map(h=>(
                    <th key={h} style={{padding:'7px 8px',textAlign:'left',color:'var(--cy)',fontFamily:'var(--font-display)',fontSize:10,letterSpacing:1,borderBottom:'2px solid var(--bd)',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {getCultosOrdenados(mes,ano).map(c=>{
                  const slot=`${c.tipo}-${c.idx}`
                  const inst=esc[slot]?.inst||{}
                  return(
                    <tr key={slot} style={{borderBottom:'1px solid var(--bd)'}}>
                      <td style={{padding:'7px 8px',whiteSpace:'nowrap'}}>
                        <span style={{fontWeight:600,color:'var(--w)'}}>{fmtBR(c.data)}</span>
                        <span style={{marginLeft:5,fontSize:10,color:c.tipo==='sab'?'var(--yel)':'var(--cy)'}}>{c.tipo==='sab'?'☀':'🌙'}</span>
                      </td>
                      {[1,2,3].map(n=>(
                        <td key={n} style={{padding:'7px 8px',color:esc[`${slot}-v${n}`]?'var(--tx)':'var(--g)'}}>{esc[`${slot}-v${n}`]||'—'}</td>
                      ))}
                      {INSTS.map(p=>{
                        const arr=normInst(inst[p])
                        const nomes=arr.map(x=>x.nome?(x.obs?`${x.nome.split(' ')[0]} (${x.obs})`:x.nome.split(' ')[0]):null).filter(Boolean)
                        return <td key={p} style={{padding:'7px 8px',color:nomes.length?'var(--tx)':'var(--g)',fontSize:10}}>{nomes.length?nomes.join(' / '):'—'}</td>
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* Modal Mensagem para Grupo */}
      {modalGrupo&&<MsgGrupoModal esc={esc} mes={mes} ano={ano} membros={membros} musicas={musicas} setlists={setlists} copiado={copiado} setCopiado={setCopiado} onClose={()=>setModalGrupo(false)} />}

      {/* Modal confirmação Louvor */}
      {modalConfLv && (
        <Modal title={`CONFIRMAR LOUVOR — ${fmtBR(modalConfLv.data)}`} onClose={()=>setModalConfLv(null)}
          footer={<><Btn variant="outline" onClick={()=>setModalConfLv(null)}>Cancelar</Btn><Btn onClick={salvarConfLv} disabled={savingConfLv}>{savingConfLv?'Salvando...':'Salvar'}</Btn></>}>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:12,color:'var(--g)'}}>TUDO OCORREU COMO PLANEJADO?</label>
            <div style={{display:'flex',gap:8,marginTop:6}}>
              <Btn variant={confRespLv==='sim'?'green':'outline'} onClick={()=>setConfRespLv('sim')}>✅ Sim</Btn>
              <Btn variant={confRespLv==='nao'?'danger':'outline'} onClick={()=>setConfRespLv('nao')}>❌ Não</Btn>
            </div>
          </div>
          {confRespLv==='nao' && (
            <div>
              {ocItensLv.map((it,i)=>(
                <div key={i} style={{background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:8,padding:12,marginBottom:10}}>
                  <FormGrid>
                    <FG><label>Função</label><input value={it.funcao} onChange={e=>setOcItensLv(its=>its.map((o,idx)=>idx===i?{...o,funcao:e.target.value}:o))} placeholder="Ex: Vocal, Teclado..." /></FG>
                    <FG><label>Quem faltou</label><input value={it.nome_original} onChange={e=>setOcItensLv(its=>its.map((o,idx)=>idx===i?{...o,nome_original:e.target.value}:o))} /></FG>
                    <FG><label>Quem substituiu</label><input value={it.substituto} onChange={e=>setOcItensLv(its=>its.map((o,idx)=>idx===i?{...o,substituto:e.target.value}:o))} /></FG>
                    <FG><label>Motivo</label><input value={it.motivo} onChange={e=>setOcItensLv(its=>its.map((o,idx)=>idx===i?{...o,motivo:e.target.value}:o))} /></FG>
                  </FormGrid>
                  <div style={{textAlign:'right',marginTop:6}}><Btn variant="danger" size="xs" onClick={()=>setOcItensLv(its=>its.filter((_,idx)=>idx!==i))}>🗑 Remover</Btn></div>
                </div>
              ))}
              <Btn variant="outline" size="sm" onClick={()=>setOcItensLv(its=>[...its,{funcao:'',nome_original:'',substituto:'',motivo:''}])}>+ Adicionar ocorrência</Btn>
            </div>
          )}
        </Modal>
      )}

      {/* Modal WhatsApp — Enviar Escala */}
      {modalWA&&(
        <Modal title={`ENVIAR ESCALA DE LOUVOR — ${MESES[mes].toUpperCase()} ${ano}`} onClose={()=>setModalWA(false)} wide
          footer={<Btn variant="outline" onClick={()=>setModalWA(false)}>Fechar</Btn>}>
          {/* Filtro mês / FDS / Dia */}
          <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap'}}>
            {[['mes','Todo o mes'],['fds','Proximo FDS'],['dia','Dia especifico']].map(([v,l])=>(
              <button key={v} onClick={()=>setFiltroWA(v)} style={{flex:1,padding:'7px',borderRadius:7,border:`2px solid ${filtroWA===v?'var(--cy)':'var(--bd)'}`,background:filtroWA===v?'var(--cdim)':'var(--s2)',color:filtroWA===v?'var(--cy)':'var(--g)',cursor:'pointer',fontSize:11,fontWeight:600,minWidth:80}}>
                {l}{v==='fds'&&filtroWA==='fds'&&tituloFDS?` (${tituloFDS})`:''}
              </button>
            ))}
          </div>
          {filtroWA==='dia'&&(
            <select value={diaSlotWA} onChange={e=>setDiaSlotWA(e.target.value)} style={{width:'100%',marginBottom:10,padding:'7px 8px',fontSize:12}}>
              <option value="">— Selecionar culto —</option>
              {getCultosOrdenados(mes,ano).map(c=>(
                <option key={`${c.tipo}-${c.idx}`} value={`${c.tipo}-${c.idx}`}>{c.tipo==='sab'?'Sab':'Dom'} {fmtBR(c.data)}</option>
              ))}
            </select>
          )}
          {/* Filtro por seção */}
          <div style={{display:'flex',gap:10,marginBottom:12,padding:'8px 12px',background:'var(--s2)',borderRadius:8,border:'1px solid var(--bd)'}}>
            <span style={{fontSize:11,color:'var(--g)',alignSelf:'center',marginRight:4}}>Seção:</span>
            {[['vocal','🎤 Vocal'],['instrumental','🎸 Instrumental']].map(([k,l])=>(
              <label key={k} onClick={()=>setFiltroSecaoLv(f=>({...f,[k]:!f[k]}))} style={{display:'flex',alignItems:'center',gap:5,cursor:'pointer',fontSize:11,color:filtroSecaoLv[k]?'var(--cy)':'var(--g)',padding:'4px 8px',borderRadius:6,border:`1px solid ${filtroSecaoLv[k]?'var(--cy)':'var(--bd)'}`,background:filtroSecaoLv[k]?'rgba(0,188,212,.08)':'transparent'}}>
                <input type="checkbox" checked={filtroSecaoLv[k]} readOnly style={{accentColor:'var(--cy)',width:12,height:12}} />{l}
              </label>
            ))}
          </div>
          <div style={{marginBottom:12}}>
            <label>Selecionar Mensagem</label>
            <select value={msgVersao} onChange={e=>setMsgVersao(parseInt(e.target.value))} style={{marginTop:4}}>
              <option value={0}>Aviso 1 — "Contamos com você"</option>
              <option value={1}>Aviso 2 — "Que alegria ter você"</option>
              <option value={2}>Aviso 3 — "É uma honra servir"</option>
              <option value={3}>🔔 Lembrete — "Esse FDS é você!"</option>
            </select>
          </div>
          <div style={{background:'var(--s2)',borderRadius:8,padding:12,fontSize:12,lineHeight:1.8,color:'var(--tx)',whiteSpace:'pre-wrap',borderLeft:'3px solid var(--cy)',marginBottom:14,maxHeight:130,overflowY:'auto'}}>{previewWA}</div>
          {pessoasLvSecao.length===0
            ? <div style={{color:'var(--g)',fontSize:13,textAlign:'center',padding:20}}>{filtroWA==='fds'?'Nenhum escalado para o próximo FDS.':'Nenhuma pessoa escalada neste mês ainda.'}</div>
            : <>
              {pessoasLvSecao.some(p=>p.email) && (
                <div style={{marginBottom:12,display:'flex',justifyContent:'flex-end'}}>
                  <button onClick={async()=>{
                    const comEmail=pessoasLvSecao.filter(p=>p.email)
                    dispatch({type:'TOAST',value:`✉ Enviando para ${comEmail.length}...`})
                    try{const r=await fetch('/api/send-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pessoas:comEmail.map(p=>({nome:p.nome,email:p.email,linhas:p.linhas})),tipo:'louvor',mes,ano,escopo:filtroWA})});const d=await r.json();dispatch({type:'TOAST',value:`✅ ${d.enviados} e-mail(s)!${d.semEmail?` (${d.semEmail} sem e-mail)`:''}`})}catch{dispatch({type:'TOAST',value:'⚠ Erro.'})}
                  }} style={{padding:'7px 14px',borderRadius:7,border:'1px solid rgba(0,188,212,.4)',background:'rgba(0,188,212,.08)',color:'var(--cy)',cursor:'pointer',fontSize:12,fontWeight:600}}>
                    ✉ Enviar todos por email ({pessoasLvSecao.filter(p=>p.email).length})
                  </button>
                </div>
              )}
              {pessoasLvSecao.map(p=>(
              <div key={p.nome} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 0',borderBottom:'1px solid var(--bd)'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--w)'}}>{p.nome}</div>
                  <div style={{fontSize:11,color:'var(--g)',marginTop:3,lineHeight:1.7}}>{p.linhas.map((l,i)=><div key={i}>{l}</div>)}</div>
                </div>
                <div style={{display:'flex',gap:5,flexShrink:0,alignItems:'center'}}>
                  {p.tel ? <a href={waLink(p.tel, buildMsgLv(p))} target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',gap:4,padding:'5px 10px',background:'rgba(34,197,94,.12)',border:'1px solid rgba(34,197,94,.3)',borderRadius:6,color:'var(--grn)',textDecoration:'none',fontSize:11,fontWeight:600}}>💬</a> : <span style={{fontSize:10,color:'var(--g)'}}>sem tel</span>}
                  <button title={p.email?'Enviar email':'Sem e-mail cadastrado'} onClick={async()=>{
                    if(!p.email){dispatch({type:'TOAST',value:'⚠ Sem e-mail cadastrado.'});return}
                    dispatch({type:'TOAST',value:'✉ Enviando...'})
                    try{const r=await fetch('/api/send-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pessoas:[{nome:p.nome,email:p.email,linhas:p.linhas}],tipo:'louvor',mes,ano,escopo:filtroWA})});const d=await r.json();dispatch({type:'TOAST',value:d.enviados?'✅ E-mail enviado!':'⚠ Falha.'})}
                    catch{dispatch({type:'TOAST',value:'⚠ Erro.'})}
                  }} style={{padding:'5px 10px',borderRadius:6,border:`1px solid ${p.email?'rgba(0,188,212,.4)':'var(--bd)'}`,background:p.email?'rgba(0,188,212,.08)':'transparent',color:p.email?'var(--cy)':'var(--g)',cursor:p.email?'pointer':'default',fontSize:11}}>📧</button>
                </div>
              </div>
            ))}
            </>
          }
        </Modal>
      )}

      {modalSL&&<Modal title={slForm.id?"EDITAR SETLIST":"REGISTRAR SETLIST"} onClose={()=>setModalSL(false)} wide
        footer={<>
          {slForm.id && <Btn variant="danger" onClick={()=>{excluirSL(slForm.id);setModalSL(false)}}>🗑 Excluir</Btn>}
          <Btn variant="outline" onClick={()=>setModalSL(false)}>Cancelar</Btn>
          <Btn onClick={salvarSL}>Salvar</Btn>
        </>}>
        <FormGrid>
          <FG><label>Data</label><input type="date" value={slForm.data} onChange={e=>setSlForm({...slForm,data:e.target.value})}/></FG>
          <FG><label>Culto</label><select value={slForm.culto} onChange={e=>setSlForm({...slForm,culto:e.target.value})}><option>Sábado Manhã</option><option>Domingo Noite</option></select></FG>
          <FG full>
            <label>Músicas ({slForm.musicas.length} selecionadas)</label>
            {slForm.musicas.length > 0 && (
              <div style={{background:'var(--s2)',border:'1px solid var(--cy)',borderRadius:7,padding:'8px 10px',marginBottom:8}}>
                <div style={{fontSize:9,color:'var(--cy)',letterSpacing:1,textTransform:'uppercase',marginBottom:6,fontWeight:700}}>Ordem das músicas (arraste com ↑↓)</div>
                {slForm.musicas.map((id, i) => {
                  const m = (musicas||[]).find(x=>x.id===id)
                  return m ? (
                    <div key={id} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 0',borderBottom:'1px solid var(--bd)'}}>
                      <span style={{fontSize:12,fontWeight:700,color:'var(--cy)',width:22,flexShrink:0}}>{i+1}.</span>
                      <span style={{fontSize:12,flex:1,color:'var(--tx)'}}>{m.nome}{m.artista?` — ${m.artista}`:''}</span>
                      <button onClick={()=>moveMusica(i,-1)} disabled={i===0} style={{padding:'1px 6px',background:'transparent',border:'1px solid var(--bd)',borderRadius:4,color:'var(--g)',cursor:'pointer',fontSize:11,opacity:i===0?.3:1}}>↑</button>
                      <button onClick={()=>moveMusica(i,1)} disabled={i===slForm.musicas.length-1} style={{padding:'1px 6px',background:'transparent',border:'1px solid var(--bd)',borderRadius:4,color:'var(--g)',cursor:'pointer',fontSize:11,opacity:i===slForm.musicas.length-1?.3:1}}>↓</button>
                      <button onClick={()=>setSlForm(f=>({...f,musicas:f.musicas.filter((_,j)=>j!==i)}))} style={{padding:'1px 6px',background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:4,color:'var(--red)',cursor:'pointer',fontSize:10}}>✕</button>
                    </div>
                  ) : null
                })}
              </div>
            )}
            <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:6}}>
              <input placeholder="🔍 Buscar música..." value={slBusca} onChange={e=>setSlBusca(e.target.value)} style={{flex:1,marginBottom:0}}/>
              <span style={{fontSize:10,color:'var(--g)',whiteSpace:'nowrap'}}>{musicasFiltradas.length} música{musicasFiltradas.length!==1?'s':''}</span>
            </div>
            <div style={{maxHeight:340,overflowY:'auto',background:'var(--s2)',border:'1px solid var(--bd)',borderRadius:7}}>
              {musicasFiltradas.length===0
                ? <div style={{color:'var(--g)',fontSize:11,padding:10}}>Nenhuma música encontrada.</div>
                : musicasFiltradas.map(m=>(
                  <label key={m.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',cursor:'pointer',borderBottom:'1px solid var(--bd)',fontSize:12,color:slForm.musicas.includes(m.id)?'var(--cy)':'var(--tx)',background:slForm.musicas.includes(m.id)?'var(--cdim)':''}}>
                    <input type="checkbox" checked={slForm.musicas.includes(m.id)} onChange={()=>setSlForm(f=>({...f,musicas:f.musicas.includes(m.id)?f.musicas.filter(x=>x!==m.id):[...f.musicas,m.id]}))} style={{accentColor:'var(--cy)',flexShrink:0,width:15,height:15}}/>
                    <span style={{flex:1,minWidth:0,lineHeight:1.4,wordBreak:'break-word'}}>{m.nome}{m.artista?' — '+m.artista:''}</span>
                  </label>
                ))
              }
            </div>
          </FG>
          <FG full><label>Observações</label><input value={slForm.obs} onChange={e=>setSlForm({...slForm,obs:e.target.value})}/></FG>
        </FormGrid>
      </Modal>}
    </div>
  )
}
