import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbInsert, dbUpdate, dbDelete } from '../lib/supabase.js'
import { Btn, FormGrid, FG, Empty } from './UI.jsx'
import { Plus, Trash2, Pencil, ChevronRight, BookOpen } from 'lucide-react'

// Lição = o assunto do período (ex.: "De cidade em cidade").
// Aula = cada encontro dentro dela (ex.: "Filipos", "Tessalônica").
// Mesma ideia da Série de Mensagens da pregação, só que por turma.

export default function LicoesEB({ classes }) {
  const { state, dispatch } = useStore()
  const { ebLicoes, ebAulas, escalasEB } = state

  const [editando, setEditando] = useState(null)   // lição sendo criada/editada
  const [abertas, setAbertas] = useState({})
  const [salvando, setSalvando] = useState(false)

  const licoes = (ebLicoes || []).filter(l => !l.arquivada)
  const aulasDa = (id) => (ebAulas || []).filter(a => a.licao_id === id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0))

  // Onde cada aula já foi dada — é isso que acaba com o "não sei qual aula o fulano deu"
  const usoDaAula = (aulaId) => {
    const achados = []
    Object.entries(escalasEB || {}).forEach(([ch, slots]) => {
      const [, ano, mesIdx] = ch.split('-')
      Object.entries(slots || {}).forEach(([k, s]) => {
        if (String(s?.aula_id || '') !== String(aulaId)) return
        const classe = k.slice(0, k.lastIndexOf('-'))
        achados.push({ ano: +ano, mes: +mesIdx + 1, classe, prof: s.prof || '' })
      })
    })
    return achados
  }

  const novo = () => setEditando({ nome: '', classe: classes[0] || '', descricao: '', aulas: [{ titulo: '', referencia: '' }] })

  const abrirEdicao = (l) => setEditando({
    id: l.id, nome: l.nome, classe: l.classe || '', descricao: l.descricao || '',
    aulas: aulasDa(l.id).map(a => ({ id: a.id, titulo: a.titulo, referencia: a.referencia || '' })),
  })

  const salvar = async () => {
    const e = editando
    if (!e.nome.trim()) { dispatch({ type: 'TOAST', value: '⚠ Dê um nome à lição.' }); return }
    const aulas = e.aulas.filter(a => a.titulo.trim())
    if (!aulas.length) { dispatch({ type: 'TOAST', value: '⚠ Cadastre pelo menos uma aula.' }); return }
    setSalvando(true)
    try {
      const dados = { nome: e.nome.trim(), classe: e.classe || null, descricao: e.descricao || null }
      let licaoId = e.id
      if (licaoId) {
        await dbUpdate('eb_licoes', licaoId, dados, `Lição EB: ${dados.nome}`)
      } else {
        const criada = await dbInsert('eb_licoes', dados, `Lição EB: ${dados.nome}`)
        licaoId = criada?.id
      }
      if (!licaoId) throw new Error('sem id')

      // aulas que sumiram da tela saem do banco
      const antigas = aulasDa(licaoId)
      const mantidas = new Set(aulas.filter(a => a.id).map(a => String(a.id)))
      for (const a of antigas) if (!mantidas.has(String(a.id))) await dbDelete('eb_aulas', a.id, a.titulo)

      const salvas = []
      for (let i = 0; i < aulas.length; i++) {
        const a = aulas[i]
        const linha = { licao_id: licaoId, ordem: i + 1, titulo: a.titulo.trim(), referencia: a.referencia || null }
        if (a.id) { await dbUpdate('eb_aulas', a.id, linha); salvas.push({ ...linha, id: a.id }) }
        else { const nova = await dbInsert('eb_aulas', linha); if (nova) salvas.push(nova) }
      }

      // atualiza a tela sem recarregar tudo
      const outrasAulas = (ebAulas || []).filter(a => a.licao_id !== licaoId)
      dispatch({ type: 'SET', key: 'ebAulas', value: [...outrasAulas, ...salvas] })
      const outrasLicoes = (ebLicoes || []).filter(l => l.id !== licaoId)
      dispatch({ type: 'SET', key: 'ebLicoes', value: [...outrasLicoes, { id: licaoId, ...dados, arquivada: false }] })

      dispatch({ type: 'TOAST', value: '✅ Lição salva!' })
      setEditando(null)
    } catch (err) {
      dispatch({ type: 'TOAST', value: '⚠ Não consegui salvar a lição.' })
    } finally { setSalvando(false) }
  }

  const excluir = async (l) => {
    const usadas = aulasDa(l.id).filter(a => usoDaAula(a.id).length)
    const aviso = usadas.length
      ? `\n\nAtenção: ${usadas.length} aula(s) desta lição já foram usadas em escalas. O registro do que foi dado se perde.`
      : ''
    if (!window.confirm(`Excluir a lição "${l.nome}" e todas as suas aulas?${aviso}`)) return
    await dbDelete('eb_licoes', l.id, l.nome)
    dispatch({ type: 'SET', key: 'ebLicoes', value: (ebLicoes || []).filter(x => x.id !== l.id) })
    dispatch({ type: 'SET', key: 'ebAulas', value: (ebAulas || []).filter(a => a.licao_id !== l.id) })
    dispatch({ type: 'TOAST', value: '🗑 Lição removida.' })
  }

  const setAula = (i, campo, v) => setEditando(e => ({
    ...e, aulas: e.aulas.map((a, idx) => idx === i ? { ...a, [campo]: v } : a),
  }))

  return (
    <div>

      {!editando && (
        <>
          <div style={{ fontSize: 11.5, color: 'var(--g)', lineHeight: 1.6, marginBottom: 12 }}>
            Cadastre o assunto do período e as aulas dentro dele — por exemplo, a lição
            <strong style={{ color: 'var(--w)' }}> De cidade em cidade</strong> com uma aula para cada cidade de Atos.
            Depois, na escala, você diz qual aula cada professor vai dar.
          </div>
          <Btn onClick={novo} style={{ marginBottom: 12 }}><Plus size={15} /> Nova lição</Btn>

          {licoes.length === 0
            ? <Empty icon="📖" text="Nenhuma lição cadastrada ainda." />
            : licoes.map(l => {
              const aulas = aulasDa(l.id)
              const aberta = !!abertas[l.id]
              const dadas = aulas.filter(a => usoDaAula(a.id).length).length
              return (
                <div key={l.id} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', cursor: 'pointer' }}
                    onClick={() => setAbertas(a => ({ ...a, [l.id]: !a[l.id] }))}>
                    <ChevronRight size={15} style={{ color: 'var(--g)', flexShrink: 0, transform: aberta ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--w)' }}>{l.nome}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--g)', marginTop: 2 }}>
                        {l.classe || 'todas as turmas'} · {aulas.length} {aulas.length === 1 ? 'aula' : 'aulas'}
                        {dadas > 0 && ` · ${dadas} já ${dadas === 1 ? 'dada' : 'dadas'}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
                      <Btn variant="outline" size="xs" onClick={() => abrirEdicao(l)}><Pencil size={13} /></Btn>
                      <Btn variant="danger" size="xs" onClick={() => excluir(l)}><Trash2 size={13} /></Btn>
                    </div>
                  </div>
                  {aberta && (
                    <div style={{ padding: '0 14px 12px' }}>
                      {aulas.map((a, i) => {
                        const usos = usoDaAula(a.id)
                        return (
                          <div key={a.id} style={{ fontSize: 12, borderTop: '1px solid var(--bd)', padding: '8px 0', display: 'flex', gap: 9 }}>
                            <span style={{ color: 'var(--g)', fontSize: 11, minWidth: 18 }}>{i + 1}.</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ color: 'var(--w)' }}>{a.titulo}</div>
                              {a.referencia && <div style={{ color: 'var(--g)', fontSize: 11 }}>{a.referencia}</div>}
                              {usos.length > 0 && (
                                <div style={{ color: 'var(--grn)', fontSize: 10.5, marginTop: 2 }}>
                                  já dada: {usos.map(u => `${u.classe} ${String(u.mes).padStart(2, '0')}/${u.ano}${u.prof ? ` — ${u.prof.split(' ')[0]}` : ''}`).join(' · ')}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
        </>
      )}

      {editando && (
        <>
          <FormGrid>
            <FG full><label>Nome da lição *</label>
              <input value={editando.nome} onChange={e => setEditando({ ...editando, nome: e.target.value })}
                placeholder="Ex.: De cidade em cidade" autoFocus /></FG>
            <FG><label>Turma</label>
              <select value={editando.classe} onChange={e => setEditando({ ...editando, classe: e.target.value })}>
                <option value="">Todas as turmas</option>
                {classes.map(c => <option key={c}>{c}</option>)}
              </select></FG>
            <FG><label>Descrição <span style={{ fontWeight: 400, color: 'var(--g)', fontSize: 10 }}>(opcional)</span></label>
              <input value={editando.descricao} onChange={e => setEditando({ ...editando, descricao: e.target.value })}
                placeholder="As cidades do livro de Atos" /></FG>
          </FormGrid>

          <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--cy)', textTransform: 'uppercase', letterSpacing: '.07em', margin: '18px 0 8px', paddingBottom: 5, borderBottom: '1px solid var(--bd)' }}>
            Aulas desta lição
          </div>
          {editando.aulas.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 7, alignItems: 'center' }}>
              <span style={{ color: 'var(--g)', fontSize: 11, minWidth: 16 }}>{i + 1}.</span>
              <input style={{ flex: 2 }} value={a.titulo} onChange={e => setAula(i, 'titulo', e.target.value)} placeholder="Título da aula (ex.: Filipos)" />
              <input style={{ flex: 1 }} value={a.referencia} onChange={e => setAula(i, 'referencia', e.target.value)} placeholder="Atos 16" />
              <Btn variant="danger" size="xs" onClick={() => setEditando(e => ({ ...e, aulas: e.aulas.filter((_, x) => x !== i) }))}><Trash2 size={13} /></Btn>
            </div>
          ))}
          <Btn variant="outline" size="sm" onClick={() => setEditando(e => ({ ...e, aulas: [...e.aulas, { titulo: '', referencia: '' }] }))}>
            <Plus size={14} /> Adicionar aula
          </Btn>

          <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
            <Btn variant="outline" onClick={() => setEditando(null)}>Cancelar</Btn>
            <Btn onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar lição'}</Btn>
          </div>
        </>
      )}
    </div>
  )
}


