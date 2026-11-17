import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Search, X, Check } from 'lucide-react'
import { normalizar, nomeDisp } from '../lib/utils.js'

// Seletor de pessoa inteligente (substitui o <select> gigante com a igreja inteira).
// - Mostra PRIMEIRO quem é daquela função (grupo), que é quem normalmente substitui.
// - Botão "Outros da igreja" abre o resto.
// - Campo de busca que IGNORA ACENTO (digita "pamela" e acha "Pâmela").
//
// Props:
//   value        nome selecionado (string) | ''
//   onChange(nome)
//   membros      lista completa de membros [{id,nome,nome_exibicao}]
//   grupo        array de NOMES que são "desta função" (vêm primeiro)
//   excluir      nome a esconder da lista (ex: quem faltou)
//   placeholder  texto quando nada selecionado
//   vazioLabel   rótulo da opção "limpar" (ex: "— ninguém / ficou vago —"); se null, sem opção de limpar
export default function SeletorPessoa({ value, onChange, membros = [], grupo = [], excluir = '', placeholder = '— selecionar —', vazioLabel = '— ninguém —' }) {
  const [aberto, setAberto] = useState(false)
  const [q, setQ] = useState('')
  const [verTodos, setVerTodos] = useState(false)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!aberto) return
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setAberto(false) }
    document.addEventListener('mousedown', onDoc)
    setTimeout(() => inputRef.current?.focus(), 30)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [aberto])

  const todos = useMemo(() => [...(membros || [])].map(m => m.nome).sort((a, b) => a.localeCompare(b)), [membros])
  const grupoSet = useMemo(() => new Set(grupo), [grupo])
  const grupoNomes = useMemo(
    () => todos.filter(n => grupoSet.has(n) && n !== excluir),
    [todos, grupoSet, excluir]
  )
  const outrosNomes = useMemo(
    () => todos.filter(n => !grupoSet.has(n) && n !== excluir),
    [todos, grupoSet, excluir]
  )

  const qn = normalizar(q).trim()
  // Ao buscar, procura na igreja inteira (grupo primeiro). Sem busca, só o grupo (+ "Outros" sob demanda).
  const filtra = (arr) => qn ? arr.filter(n => normalizar(n).includes(qn)) : arr
  const listaGrupo = filtra(grupoNomes)
  const listaOutros = qn ? filtra(outrosNomes) : (verTodos ? outrosNomes : [])

  const escolher = (n) => { onChange(n); setAberto(false); setQ(''); setVerTodos(false) }

  const Item = ({ n }) => (
    <button type="button" onClick={() => escolher(n)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 10px', background: n === value ? 'var(--cdim)' : 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--w)', fontSize: 13 }}
      onMouseEnter={e => { if (n !== value) e.currentTarget.style.background = 'var(--s3)' }}
      onMouseLeave={e => { if (n !== value) e.currentTarget.style.background = 'transparent' }}>
      {n === value ? <Check size={14} style={{ color: 'var(--cy)', flexShrink: 0 }} /> : <span style={{ width: 14, flexShrink: 0 }} />}
      <span>{nomeDisp(n, membros)}</span>
    </button>
  )

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setAberto(a => !a)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%', boxSizing: 'border-box', padding: '9px 11px', background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 7, cursor: 'pointer', color: value ? 'var(--w)' : 'var(--g)', fontSize: 13, textAlign: 'left' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value ? nomeDisp(value, membros) : placeholder}</span>
        <ChevronDown size={15} style={{ color: 'var(--g)', flexShrink: 0 }} />
      </button>

      {aberto && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 9, boxShadow: '0 10px 30px rgba(0,0,0,.45)', padding: 8, maxHeight: 320, display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', marginBottom: 6 }}>
            <Search size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--g)' }} />
            <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar nome..."
              style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 30px', background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 6, color: 'var(--w)', fontSize: 13 }} />
            {q && <button type="button" onClick={() => setQ('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--g)', display: 'flex' }}><X size={14} /></button>}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {vazioLabel && !qn && (
              <button type="button" onClick={() => escolher('')}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--g)', fontSize: 12.5 }}>
                {vazioLabel}
              </button>
            )}

            {listaGrupo.length > 0 && (
              <>
                {!qn && grupoNomes.length > 0 && <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--cy)', padding: '6px 10px 3px' }}>Desta função</div>}
                {listaGrupo.map(n => <Item key={n} n={n} />)}
              </>
            )}

            {!qn && !verTodos && outrosNomes.length > 0 && (
              <button type="button" onClick={() => setVerTodos(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', padding: '9px 10px', marginTop: 4, background: 'var(--s1)', border: '1px dashed var(--bd)', borderRadius: 7, cursor: 'pointer', color: 'var(--tx)', fontSize: 12.5, fontWeight: 600 }}>
                <ChevronDown size={14} /> Outros da igreja ({outrosNomes.length})
              </button>
            )}

            {listaOutros.length > 0 && (
              <>
                {!qn && <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--g)', padding: '8px 10px 3px' }}>Outros</div>}
                {qn && listaGrupo.length > 0 && <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--g)', padding: '8px 10px 3px' }}>Outros</div>}
                {listaOutros.map(n => <Item key={n} n={n} />)}
              </>
            )}

            {qn && listaGrupo.length === 0 && listaOutros.length === 0 && (
              <div style={{ padding: '14px 10px', fontSize: 12.5, color: 'var(--g)', textAlign: 'center' }}>Ninguém encontrado para "{q}".</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
