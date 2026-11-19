import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { dbGet, dbInsert, dbUpdate, dbDelete, dbUpsert, dbCantinaNotaFoto } from '../lib/supabase.js'
import { MESES } from '../lib/utils.js'
import { fmt, refDoMes } from '../lib/tesouraria.js'
import { fotoParaDataURL } from '../lib/fotoSite.js'
import { MonthNav, Btn, Modal, FormGrid, FG, Tag, Empty, Tabs } from '../components/UI.jsx'
import { Plus, Trash2, Pencil, Paperclip } from 'lucide-react'

// Categorias prontas para escolher (a pessoa também pode digitar em "Outros").
const CATEGORIAS = {
  E: ['Vendas', 'Doação', 'Evento', 'Outros'],
  S: ['Mercadoria', 'Gás / Água', 'Descartáveis', 'Limpeza', 'Manutenção', 'Outros'],
}
const hojeISO = () => new Date().toLocaleDateString('sv')

// --- foto da nota (mesma ideia do oficial, versão enxuta) ---
function tipoRealFoto(foto) {
  const s = String(foto || ''); const corpo = s.slice(s.indexOf(',') + 1)
  if (corpo.startsWith('JVBER')) return 'application/pdf'
  if (corpo.startsWith('/9j/')) return 'image/jpeg'
  if (corpo.startsWith('iVBOR')) return 'image/png'
  if (corpo.startsWith('R0lGOD')) return 'image/gif'
  return null
}
function corrigeFoto(foto) {
  const real = tipoRealFoto(foto); if (!real || !foto) return foto
  const s = String(foto); const i = s.indexOf(','); if (i < 0) return foto
  return `data:${real};base64,` + s.slice(i + 1)
}
const ehPdfFoto = (foto) => { const r = tipoRealFoto(foto); return r ? r === 'application/pdf' : String(foto || '').startsWith('data:application/pdf') }

export default function Cantina() {
  const { state, dispatch } = useStore()
  const { user } = state
  const aviso = (t) => dispatch({ type: 'TOAST', value: t })
  const agora = new Date()

  const [mes, setMes] = useState(agora.getMonth())
  const [ano, setAno] = useState(agora.getFullYear())
  const [filtro, setFiltro] = useState('tudo')   // 'tudo' | 'E' | 'S'
  const [lancs, setLancs] = useState([])
  const [notas, setNotas] = useState([])          // {lancamento_id, tem_foto, chave}
  const [acumulado, setAcumulado] = useState(0)    // em caixa até o fim do mês
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(null)         // 'E' | 'S'
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [verFoto, setVerFoto] = useState(null)

  const ref = refDoMes(ano, mes)
  const notaDe = useMemo(() => new Map(notas.map(n => [n.lancamento_id, n])), [notas])
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const carregar = () => {
    setCarregando(true)
    Promise.all([
      dbGet('cantina_lancamentos', { mes_ref: ref }),
      dbGet('cantina_notas', { mes_ref: ref }),
      dbGet('cantina_lancamentos'),   // todos, para o acumulado em caixa
    ]).then(([l, nt, todos]) => {
      setLancs((l || []).sort((a, b) => String(a.data || '').localeCompare(String(b.data || ''))))
      setNotas(nt || [])
      // Em caixa = entradas menos saídas de todos os meses ATÉ o mês escolhido
      // (inclusive). mes_ref é sempre o dia 1º, então a comparação de texto basta.
      const acc = (todos || []).reduce((s, x) => {
        if (String(x.mes_ref) > ref) return s
        return s + (x.tipo === 'E' ? 1 : -1) * (Number(x.valor) || 0)
      }, 0)
      setAcumulado(acc)
      setCarregando(false)
    })
  }
  useEffect(carregar, [ref])

  const chM = (d) => { let m = mes + d, a = ano; if (m > 11) { m = 0; a++ } if (m < 0) { m = 11; a-- } setMes(m); setAno(a) }

  const totalE = useMemo(() => lancs.filter(l => l.tipo === 'E').reduce((s, l) => s + (Number(l.valor) || 0), 0), [lancs])
  const totalS = useMemo(() => lancs.filter(l => l.tipo === 'S').reduce((s, l) => s + (Number(l.valor) || 0), 0), [lancs])
  const saldoMes = totalE - totalS

  const lista = useMemo(() => filtro === 'tudo' ? lancs : lancs.filter(l => l.tipo === filtro), [lancs, filtro])

  const abrir = (tipo) => {
    setEditando(null)
    setForm({ data: hojeISO(), tipo, categoria: CATEGORIAS[tipo][0], catOutros: '', descricao: '', valor: '', forma: 'dinheiro', chave: '', foto: null, temFoto: false, fotoTocada: false })
    setModal(tipo)
  }
  const editar = (l) => {
    const nt = notaDe.get(l.id)
    const ehLista = CATEGORIAS[l.tipo].includes(l.categoria)
    setEditando(l.id)
    setForm({
      data: l.data || '', tipo: l.tipo,
      categoria: ehLista ? l.categoria : 'Outros', catOutros: ehLista ? '' : (l.categoria || ''),
      descricao: l.descricao || '', valor: l.valor ?? '', forma: l.forma || 'dinheiro',
      chave: nt?.chave || '', foto: null, temFoto: !!nt?.tem_foto, fotoTocada: false,
    })
    setModal(l.tipo)
  }

  const escolherFoto = async (file) => {
    if (!file) { set('foto', null); set('temFoto', false); set('fotoTocada', true); return }
    try { const dataUrl = await fotoParaDataURL(file); set('foto', dataUrl); set('temFoto', true); set('fotoTocada', true) }
    catch { aviso('⚠ Não consegui preparar a foto. Tente outra.') }
  }

  const salvar = async () => {
    const valor = parseFloat(String(form.valor).replace(',', '.'))
    if (!valor || valor <= 0) return aviso('⚠ Informe um valor.')
    if (!form.data) return aviso('⚠ Informe a data.')
    const categoria = form.categoria === 'Outros' ? (String(form.catOutros).trim() || 'Outros') : form.categoria
    setSalvando(true)
    try {
      const temComprovante = !!(String(form.chave || '').replace(/\D/g, '') || form.foto || form.temFoto)
      const row = {
        mes_ref: ref, data: form.data, tipo: form.tipo, categoria,
        descricao: String(form.descricao || '').trim(), valor, forma: form.forma,
        tem_nota: temComprovante, criado_por: user?.id || null,
      }
      let lancId = editando
      if (editando) {
        const r = await dbUpdate('cantina_lancamentos', editando, row, `Corrigiu ${form.tipo === 'E' ? 'entrada' : 'saída'} ${fmt(valor)}`)
        if (r?._err) { aviso('⚠ Não foi possível salvar.'); setSalvando(false); return }
        setLancs(l => l.map(x => x.id === editando ? { ...x, ...row, id: editando } : x))
      } else {
        const novo = await dbInsert('cantina_lancamentos', row, `${form.tipo === 'E' ? 'Entrada' : 'Saída'} ${fmt(valor)} — ${categoria}`)
        lancId = novo?.id || Date.now()
        setLancs(l => [...l, { ...row, id: lancId }])
      }
      // Nota (chave e/ou foto)
      const chave = String(form.chave || '').replace(/\D/g, '')
      if (chave || form.fotoTocada || notaDe.get(lancId)) {
        const nrow = { lancamento_id: lancId, mes_ref: ref, ano: Number(ano), chave: chave || null }
        if (form.fotoTocada) nrow.foto = form.foto || null
        await dbUpsert('cantina_notas', nrow, 'lancamento_id')
        const temFoto = form.fotoTocada ? !!form.foto : !!notaDe.get(lancId)?.tem_foto
        setNotas(l => [...l.filter(n => n.lancamento_id !== lancId), { lancamento_id: lancId, mes_ref: ref, ano: Number(ano), chave: chave || null, tem_foto: temFoto }])
      }
      setModal(null); setEditando(null); aviso(editando ? 'Corrigido.' : 'Lançado.')
    } finally { setSalvando(false) }
  }

  const excluir = async (l) => {
    if (!confirm(`Apagar ${l.tipo === 'E' ? 'entrada' : 'saída'} de ${fmt(l.valor)}?`)) return
    await dbDelete('cantina_lancamentos', l.id, `${l.tipo === 'E' ? 'Entrada' : 'Saída'} ${fmt(l.valor)}`)
    if (notaDe.get(l.id)) { await dbDelete('cantina_notas', notaDe.get(l.id).id || l.id).catch(() => {}) }
    setLancs(arr => arr.filter(x => x.id !== l.id))
    setNotas(arr => arr.filter(n => n.lancamento_id !== l.id))
  }

  const verNota = async (lancId) => {
    const foto = await dbCantinaNotaFoto(lancId)
    if (!foto) return aviso('⚠ Sem foto guardada.')
    const f = corrigeFoto(foto)
    if (ehPdfFoto(f)) {
      try {
        const bin = atob(String(f).split(',')[1]); const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
        const w = window.open(url, '_blank')
        if (!w) { aviso('Permita abrir uma aba nova para ver o PDF.'); setVerFoto(f) }
        setTimeout(() => URL.revokeObjectURL(url), 60000)
      } catch { setVerFoto(f) }
    } else setVerFoto(f)
  }

  const th = { background: 'var(--s2)', padding: '8px 12px', textAlign: 'left', fontSize: 9, fontWeight: 600, color: 'var(--g)', letterSpacing: 1.5, textTransform: 'uppercase' }
  const td = { padding: '9px 12px', fontSize: 12.5 }
  const inp = { background: 'var(--s2)', border: '1px solid var(--bd)', color: 'var(--w)', borderRadius: 9, padding: '9px 11px', fontSize: 13, fontFamily: 'inherit', width: '100%' }
  const lbl = { fontSize: 11, color: 'var(--g)', fontWeight: 600 }

  const catAtual = CATEGORIAS[form.tipo] || []

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <MonthNav month={mes} year={ano} onPrev={() => chM(-1)} onNext={() => chM(1)} onSetMonth={setMes} onSetYear={setAno} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant="green" onClick={() => abrir('E')}><Plus size={15} /> Entrada</Btn>
          <Btn variant="danger" onClick={() => abrir('S')}><Plus size={15} /> Saída</Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
        {[
          ['Entradas do mês', fmt(totalE), 'var(--grn)'],
          ['Saídas do mês', fmt(totalS), 'var(--red)'],
          ['Saldo do mês', fmt(saldoMes), saldoMes >= 0 ? 'var(--grn)' : 'var(--red)'],
          ['Em caixa (acumulado)', fmt(acumulado), 'var(--w)'],
        ].map(([l, v, c]) => (
          <div key={l} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 8.5, color: 'var(--g)', letterSpacing: 1.5, textTransform: 'uppercase' }}>{l}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: c, marginTop: 3 }}>{v}</div>
          </div>
        ))}
      </div>

      <Tabs active={filtro} onChange={setFiltro} tabs={[
        { id: 'tudo', label: `Tudo (${lancs.length})` },
        { id: 'E', label: '⬆ Entradas' },
        { id: 'S', label: '⬇ Saídas' },
      ]} />

      {carregando ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--g)', fontSize: 13 }}>Carregando…</div>
      ) : lista.length === 0 ? (
        <Empty icon="🍿" text="Nenhum lançamento neste mês. Toque em “Entrada” ou “Saída” para começar." />
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--bd)', borderRadius: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead><tr>
              <th style={th}>Data</th><th style={th}>Tipo</th><th style={th}>Categoria</th>
              <th style={th}>Descrição</th><th style={th}>Nota</th><th style={th}>Valor</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {lista.map(l => {
                const nt = notaDe.get(l.id)
                return (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--bd)' }}>
                    <td style={td}>{l.data ? new Date(l.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                    <td style={td}>{l.tipo === 'E' ? <Tag color="green">ENTRADA</Tag> : <Tag color="red">SAÍDA</Tag>}</td>
                    <td style={td}>{l.categoria || '—'}</td>
                    <td style={td}>{l.descricao || '—'}</td>
                    <td style={td}>
                      {nt?.tem_foto
                        ? <Btn variant="outline" size="xs" onClick={() => verNota(l.id)}><Paperclip size={12} /> ver</Btn>
                        : (nt?.chave ? <Tag color="gray">chave</Tag> : '—')}
                    </td>
                    <td style={{ ...td, fontWeight: 600, color: l.tipo === 'E' ? 'var(--grn)' : 'var(--red)' }}>{fmt(l.valor)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <Btn variant="outline" size="xs" onClick={() => editar(l)}><Pencil size={13} /></Btn>{' '}
                      <Btn variant="danger" size="xs" onClick={() => excluir(l)}><Trash2 size={13} /></Btn>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={`${editando ? 'Corrigir' : 'Nova'} ${modal === 'E' ? 'entrada' : 'saída'} — Cantina`} onClose={() => { setModal(null); setEditando(null) }}
          footer={<>
            <Btn variant="outline" onClick={() => { setModal(null); setEditando(null) }}>Cancelar</Btn>
            <Btn onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Btn>
          </>}>
          <FormGrid>
            <FG><label style={lbl}>Data</label>
              <input type="date" style={inp} value={form.data || ''} onChange={e => set('data', e.target.value)} /></FG>
            <FG><label style={lbl}>Valor (R$)</label>
              <input style={inp} inputMode="decimal" placeholder="0,00" value={form.valor} onChange={e => set('valor', e.target.value)} /></FG>
            <FG><label style={lbl}>Categoria</label>
              <select style={inp} value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                {catAtual.map(c => <option key={c} value={c}>{c}</option>)}
              </select></FG>
            {form.categoria === 'Outros' && (
              <FG><label style={lbl}>Qual?</label>
                <input style={inp} placeholder="Escreva a categoria" value={form.catOutros} onChange={e => set('catOutros', e.target.value)} /></FG>
            )}
            <FG full><label style={lbl}>Descrição (opcional)</label>
              <input style={inp} placeholder="Ex.: refrigerante, salgados, recarga de gás…" value={form.descricao} onChange={e => set('descricao', e.target.value)} /></FG>
            <FG><label style={lbl}>Forma</label>
              <select style={inp} value={form.forma} onChange={e => set('forma', e.target.value)}>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">Pix</option>
                <option value="cartao">Cartão</option>
              </select></FG>
            <FG><label style={lbl}>Chave da nota (opcional)</label>
              <input style={inp} inputMode="numeric" placeholder="44 dígitos" value={form.chave} onChange={e => set('chave', e.target.value)} /></FG>
            <FG full><label style={lbl}>Foto / PDF da nota (opcional)</label>
              <input type="file" accept="image/*,application/pdf" style={{ ...inp, padding: 7 }}
                onChange={e => escolherFoto(e.target.files?.[0] || null)} />
              {form.temFoto && <span style={{ fontSize: 11, color: 'var(--grn)', marginTop: 3 }}>✓ Nota anexada</span>}
            </FG>
          </FormGrid>
        </Modal>
      )}

      {verFoto && (
        <div onClick={() => setVerFoto(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <img src={verFoto} alt="Nota" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
        </div>
      )}
    </div>
  )
}
