import { sb } from './supabase'

/**
 * Quando um nome de membro é alterado, atualiza TODAS as referências
 * em todas as tabelas que guardam nomes como strings.
 * Retorna um objeto com os dados atualizados para o dispatch de estado.
 */
export async function cascadeRenomear(nomeAntigo, nomeNovo) {
  if (!nomeAntigo || !nomeNovo || nomeAntigo === nomeNovo) return {}

  // ── Tabelas simples (colunas de texto direto) ─────────────────────────────
  const simplesOps = []
  for (const col of ['dir','voc','mor','por','ord']) {
    simplesOps.push(sb.from('escalas').update({[col]: nomeNovo}).eq(col, nomeAntigo))
  }
  simplesOps.push(sb.from('escalas_eb').update({ prof: nomeNovo }).eq('prof', nomeAntigo))
  simplesOps.push(sb.from('escalas_eb').update({ aux:  nomeNovo }).eq('aux',  nomeAntigo))
  simplesOps.push(sb.from('escala_preg').update({ pregador: nomeNovo }).eq('pregador', nomeAntigo))
  simplesOps.push(sb.from('lideranca').update({ membro_nome: nomeNovo }).eq('membro_nome', nomeAntigo))
  simplesOps.push(sb.from('usuarios').update({ nome: nomeNovo }).eq('nome', nomeAntigo))
  await Promise.all(simplesOps)

  // ── funcoes (membros[] e disponibilidades{} são JSON) ─────────────────────
  const { data: funcoes } = await sb.from('funcoes').select('*')
  const funcoesAtualizadas = []
  const funcoesOps = (funcoes || []).map(f => {
    const mbs  = Array.isArray(f.membros) ? f.membros : JSON.parse(f.membros || '[]')
    const disp = typeof f.disponibilidades === 'object' && f.disponibilidades !== null
      ? f.disponibilidades : JSON.parse(f.disponibilidades || '{}')

    if (!mbs.includes(nomeAntigo)) {
      funcoesAtualizadas.push({ ...f, membros: mbs, disponibilidades: disp })
      return null
    }

    const newMbs  = mbs.map(m => m === nomeAntigo ? nomeNovo : m)
    const newDisp = Object.fromEntries(
      Object.entries(disp).map(([k, v]) => [k === nomeAntigo ? nomeNovo : k, v])
    )
    funcoesAtualizadas.push({ ...f, membros: newMbs, disponibilidades: newDisp })
    return sb.from('funcoes').update({
      membros: JSON.stringify(newMbs),
      disponibilidades: JSON.stringify(newDisp),
    }).eq('id', f.id)
  }).filter(Boolean)
  await Promise.all(funcoesOps)

  // ── gestores (vocal[] e instrumental[] são JSON) ──────────────────────────
  const { data: gestoresArr } = await sb.from('gestores').select('*')
  let gestoresAtualizado = null
  if (gestoresArr?.length) {
    const g = gestoresArr[0]
    const vocal = Array.isArray(g.vocal) ? g.vocal : JSON.parse(g.vocal || '[]')
    const inst  = Array.isArray(g.instrumental) ? g.instrumental : JSON.parse(g.instrumental || '[]')
    const newVocal = vocal.map(n => n === nomeAntigo ? nomeNovo : n)
    const newInst  = inst.map(n  => n === nomeAntigo ? nomeNovo : n)
    gestoresAtualizado = { ...g, vocal: newVocal, instrumental: newInst }
    if (JSON.stringify(newVocal) !== JSON.stringify(vocal) || JSON.stringify(newInst) !== JSON.stringify(inst)) {
      await sb.from('gestores').update({
        vocal: JSON.stringify(newVocal),
        instrumental: JSON.stringify(newInst),
      }).eq('id', g.id)
    }
  }

  // ── escalas_lv (vocal{} e instrumental{} são JSON) ────────────────────────
  const { data: lvArr } = await sb.from('escalas_lv').select('*')
  const lvOps = (lvArr || []).map(r => {
    const vocalRaw = typeof r.vocal === 'object' ? r.vocal : JSON.parse(r.vocal || '{}')
    const instRaw  = typeof r.instrumental === 'object' ? r.instrumental : JSON.parse(r.instrumental || '{}')
    const vocalStr = JSON.stringify(vocalRaw)
    const instStr  = JSON.stringify(instRaw)
    if (!vocalStr.includes(nomeAntigo) && !instStr.includes(nomeAntigo)) return null

    // vocal: { "1": "NOME", "2": "NOME2", ... }
    const newVocal = Object.fromEntries(
      Object.entries(vocalRaw).map(([k, v]) => [k, v === nomeAntigo ? nomeNovo : v])
    )
    // instrumental: { Teclado: [{nome, louvores}] | "NOME" | "" }
    const newInst = {}
    Object.entries(instRaw).forEach(([papel, val]) => {
      if (val === nomeAntigo) {
        newInst[papel] = nomeNovo
      } else if (Array.isArray(val)) {
        newInst[papel] = val.map(item =>
          typeof item === 'object' && item !== null
            ? { ...item, nome: item.nome === nomeAntigo ? nomeNovo : item.nome }
            : item
        )
      } else {
        newInst[papel] = val
      }
    })
    return sb.from('escalas_lv').update({
      vocal: JSON.stringify(newVocal),
      instrumental: JSON.stringify(newInst),
    }).eq('id', r.id)
  }).filter(Boolean)
  await Promise.all(lvOps)

  return { funcoesAtualizadas, gestoresAtualizado }
}
