import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbDelete } from '../lib/supabase.js'
import { MESES, isPastor } from '../lib/utils.js'
import { MonthNav, Btn, Modal, FormGrid, FG, Tag, Empty } from '../components/UI.jsx'

const CATS = ['Dízimo','Oferta Sábado','Oferta Domingo','Doação','Concessão','Energia Elétrica','Internet/Telefone','Transporte','Limpeza/Zeladoria','Material Expediente','Obra/Construção','Evento','Som/Música','Alimentação','Bens/Patrimônio','Outro']
const empty = { data:'', tipo:'entrada', descricao:'', categoria:'Dízimo', valor:'', obs:'' }

export default function Financeiro() {
  const { state, dispatch } = useStore()
  const { financeiro, user } = state
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth())
  const [ano, setAno] = useState(now.getFullYear())
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(false)

  const chM = (d) => { let m=mes+d,a=ano; if(m>11){m=0;a++} if(m<0){m=11;a--} setMes(m);setAno(a) }

  const lista = (financeiro||[]).filter(f=>{const d=new Date(f.data);return d.getMonth()===mes&&d.getFullYear()===ano}).sort((a,b)=>a.data.localeCompare(b.data))
  const ent = lista.filter(f=>f.tipo==='entrada').reduce((a,b)=>a+parseFloat(b.valor),0)
  const sai = lista.filter(f=>f.tipo==='saida').reduce((a,b)=>a+parseFloat(b.valor),0)
  const sal = ent - sai

  const fmt = v => 'R$ '+parseFloat(v||0).toFixed(2).replace('.',',')

  const salvar = async () => {
    if (!form.data||!form.descricao||!form.valor) { dispatch({ type:'TOAST', value:'⚠ Preencha todos os campos.' }); return }
    setLoading(true)
    const row = { data:form.data, tipo:form.tipo, descricao:form.descricao, categoria:form.categoria, valor:parseFloat(form.valor), obs:form.obs }
    const novo = await dbInsert('financeiro', row)
    dispatch({ type:'SET', key:'financeiro', value:[...(financeiro||[]), {...(novo||{id:Date.now()}),...row,desc:row.descricao,cat:row.categoria}] })
    setLoading(false); setModal(false); setForm(empty)
    dispatch({ type:'TOAST', value:'💰 Registrado!' })
  }

  const excluir = async (id) => {
    await dbDelete('financeiro', id)
    dispatch({ type:'SET', key:'financeiro', value:(financeiro||[]).filter(f=>f.id!==id) })
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
        <MonthNav month={mes} year={ano} onPrev={()=>chM(-1)} onNext={()=>chM(1)} />
        <Btn onClick={()=>{setForm({...empty,data:new Date().toISOString().slice(0,10)});setModal(true)}}>+ Lançamento</Btn>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:11,marginBottom:16}}>
        {[['Entradas',fmt(ent),'var(--grn)'],['Saídas',fmt(sai),'var(--red)'],['Saldo',fmt(sal),sal>=0?'var(--grn)':'var(--red)']].map(([l,v,c])=>(
          <div key={l} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,padding:14,textAlign:'center'}}>
            <div style={{fontSize:9,color:'var(--g)',letterSpacing:2,textTransform:'uppercase'}}>{l}</div>
            <div style={{fontFamily:'var(--font-display)',fontSize:20,color:c,marginTop:3}}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:10,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr>{['Data','Descrição','Cat.','Tipo','Valor',''].map(h=><th key={h} style={{background:'var(--s2)',padding:'8px 13px',textAlign:'left',fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:2,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
          <tbody>
            {lista.length===0 ? <tr><td colSpan="6" style={{textAlign:'center',color:'var(--g)',padding:24,fontSize:13}}>Sem lançamentos em {MESES[mes]}.</td></tr>
            : lista.map(f=>(
              <tr key={f.id} style={{borderTop:'1px solid var(--bd)'}}>
                <td style={{padding:'9px 13px',fontSize:12}}>{new Date(f.data+'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td style={{padding:'9px 13px',fontSize:12}}>{f.desc||f.descricao}</td>
                <td style={{padding:'9px 13px'}}><Tag color="gray">{f.cat||f.categoria}</Tag></td>
                <td style={{padding:'9px 13px'}}><Tag color={f.tipo==='entrada'?'green':'red'}>{f.tipo==='entrada'?'ENTRADA':'SAÍDA'}</Tag></td>
                <td style={{padding:'9px 13px',fontSize:12,fontWeight:600,color:f.tipo==='entrada'?'var(--grn)':'var(--red)'}}>{f.tipo==='entrada'?'+':'−'} {fmt(f.valor)}</td>
                <td style={{padding:'9px 13px'}}>{isPastor(user)&&<Btn variant="danger" size="xs" onClick={()=>excluir(f.id)}>🗑</Btn>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title="LANÇAMENTO" onClose={()=>setModal(false)}
          footer={<><Btn variant="outline" onClick={()=>setModal(false)}>Cancelar</Btn><Btn onClick={salvar} disabled={loading}>{loading?'Salvando...':'Salvar'}</Btn></>}>
          <FormGrid>
            <FG><label>Data</label><input type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})} /></FG>
            <FG><label>Tipo</label><select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}><option value="entrada">Entrada</option><option value="saida">Saída</option></select></FG>
            <FG full><label>Descrição</label><input value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})} /></FG>
            <FG><label>Categoria</label><select value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value})}>{CATS.map(c=><option key={c}>{c}</option>)}</select></FG>
            <FG><label>Valor (R$)</label><input type="number" step="0.01" value={form.valor} onChange={e=>setForm({...form,valor:e.target.value})} /></FG>
            <FG full><label>Observação</label><input value={form.obs} onChange={e=>setForm({...form,obs:e.target.value})} /></FG>
          </FormGrid>
        </Modal>
      )}
    </div>
  )
}
