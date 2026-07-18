import { useState, useEffect } from 'react'
import { sb } from '../lib/supabase.js'
import { SecHeader } from '../components/UI.jsx'

const fmtDT = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })
}

export default function Auditoria() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    sb.from('auditoria').select('*').order('created_at', { ascending: false }).limit(300)
      .then(({ data }) => { setLogs(data || []); setLoading(false) })
  }, [])

  const filtrados = busca
    ? logs.filter(l =>
        (l.usuario_nome||'').toLowerCase().includes(busca.toLowerCase()) ||
        (l.acao||'').toLowerCase().includes(busca.toLowerCase()) ||
        (l.detalhes||'').toLowerCase().includes(busca.toLowerCase())
      )
    : logs

  return (
    <div>
      <SecHeader title="Auditoria" />
      <input placeholder="🔍 Filtrar por usuário, ação ou detalhe..." value={busca} onChange={e=>setBusca(e.target.value)} style={{ marginBottom:14 }} />

      {loading
        ? <div style={{ color:'var(--g)', fontSize:13, textAlign:'center', padding:30 }}>Carregando registros...</div>
        : filtrados.length === 0
          ? <div style={{ color:'var(--g)', fontSize:13, textAlign:'center', padding:30 }}>Nenhum registro encontrado.</div>
          : (
            <div className="table-scroll" style={{ background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:10 }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'var(--s2)' }}>
                    {['Data/Hora','Usuário','Ação','Detalhes'].map(h => (
                      <th key={h} style={{ padding:'8px 13px', textAlign:'left', fontSize:9, fontWeight:600, color:'var(--g)', letterSpacing:2, textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(l => (
                    <tr key={l.id} style={{ borderTop:'1px solid var(--bd)' }}>
                      <td style={{ padding:'8px 13px', fontSize:11, color:'var(--g)', whiteSpace:'nowrap' }}>{fmtDT(l.created_at)}</td>
                      <td style={{ padding:'8px 13px', fontSize:12, fontWeight:600, color:'var(--w)', whiteSpace:'nowrap' }}>{l.usuario_nome}</td>
                      <td style={{ padding:'8px 13px' }}>
                        <span style={{ display:'inline-block', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99, letterSpacing:1,
                          background: l.acao==='LOGIN'?'rgba(16,185,129,.1)': (l.acao||'').includes('DELETE')||(l.acao||'').includes('EXCLU')?'rgba(239,68,68,.1)':'var(--cdim)',
                          color: l.acao==='LOGIN'?'var(--gr)': (l.acao||'').includes('DELETE')||(l.acao||'').includes('EXCLU')?'var(--red)':'var(--cy)',
                        }}>{l.acao||'—'}</span>
                      </td>
                      <td style={{ padding:'8px 13px', fontSize:11, color:'var(--tx)', maxWidth:300, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={l.detalhes||''}>{l.detalhes||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      }
    </div>
  )
}
