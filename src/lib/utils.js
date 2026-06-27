export const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
export const MESES_A = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
export const DIAS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

export const PERFIL_LABEL = {
  pastor: 'Pastor',
  secretario: 'Secretário',
  tesoureiro: 'Tesoureiro',
  'gestor-vocal': 'Gestor Vocal',
  'gestor-instrumental': 'Gestor Instrumental',
  professor: 'Professor EB',
  aluno: 'Aluno EB',
  membro: 'Membro',
}

export const DISP_LABEL = {
  semanal: 'Semanal',
  'quinzenal-sab': 'Quinzenal Sáb',
  'quinzenal-dom': 'Quinzenal Dom',
  'quinzenal-alt': 'Quinzenal Alt',
  mensal: 'Mensal',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  livre: 'Livre',
}

export const DISP_OPTS = [
  ['semanal','Semanal'],
  ['quinzenal-sab','Quinzenal Sábados'],
  ['quinzenal-dom','Quinzenal Domingos'],
  ['quinzenal-alt','Quinzenal Alternado'],
  ['mensal','Mensal'],
  ['bimestral','Bimestral'],
  ['trimestral','Trimestral'],
  ['livre','Livre'],
]

export const fmtBR = (d) => {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d + 'T00:00:00') : d
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export const getSabDom = (month, year) => {
  const sabs = [], doms = []
  const days = new Date(year, month + 1, 0).getDate()
  for (let i = 1; i <= days; i++) {
    const d = new Date(year, month, i)
    if (d.getDay() === 6) sabs.push(d)
    if (d.getDay() === 0) doms.push(d)
  }
  return { sabs, doms }
}

// Saturdays and Sundays interleaved in chronological order, keeping each item's
// original index (sab-N / dom-N) so it still maps to the right escala slot
export const getCultosOrdenados = (month, year) => {
  const { sabs, doms } = getSabDom(month, year)
  const itens = [
    ...sabs.map((data, idx) => ({ data, tipo: 'sab', idx })),
    ...doms.map((data, idx) => ({ data, tipo: 'dom', idx })),
  ]
  itens.sort((a, b) => a.data - b.data)
  return itens
}

// Check if date is first Saturday of the month (Café e Conexão)
export const isCafeConexao = (date) => {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date
  if (d.getDay() !== 6) return false
  // First saturday = day <= 7
  return d.getDate() <= 7
}

export const nextWeekend = () => {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  let d = new Date(hoje)
  while (d.getDay() !== 6 && d.getDay() !== 0) d.setDate(d.getDate() + 1)
  const sab = d.getDay() === 6 ? d : new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)
  const dom = new Date(sab.getFullYear(), sab.getMonth(), sab.getDate() + 1)
  return { sab, dom }
}

export const isAdmin = (user) => ['pastor', 'secretario'].includes(user?.perfil)
export const isPastor = (user) => user?.perfil === 'pastor'
export const isGestorLouvor = (user) => ['pastor', 'secretario', 'gestor-vocal', 'gestor-instrumental'].includes(user?.perfil)

// Lista oficial de ministérios — compartilhada entre Agenda e Liderança
export const MINISTERIOS = [
  '','Igreja Geral','Ministério dos Homens','Ministério das Mulheres','Ministério Jovem',
  'Ministério das Crianças','Ministério de Louvor','Ministério de Intercessão',
  'Escola Bíblica','Convenção Regional','Outro',
]

// Detecta qual ministério o usuário lidera a partir dos cargos na Liderança (legado)
export const detectarMinisterio = (cargos) => {
  const t = (Array.isArray(cargos) ? cargos.join(' ') : cargos || '').toLowerCase()
  if (t.includes('mca') || t.includes('criança') || t.includes('infantil')) return 'Ministério das Crianças'
  if (t.includes('jovem') || t.includes('juventude') || t.includes(' mj')) return 'Ministério Jovem'
  if (t.includes('homem') || t.includes(' mh')) return 'Ministério dos Homens'
  if (t.includes('mulher') || t.includes('feminino') || t.includes(' mm')) return 'Ministério das Mulheres'
  if (t.includes('louvor') || t.includes('musical')) return 'Ministério de Louvor'
  if (t.includes('intercess') || t.includes('oração')) return 'Ministério de Intercessão'
  if (t.includes('escola') || t.includes('bíblica') || t.includes('biblica') || t.includes(' eb')) return 'Escola Bíblica'
  return null
}
// Pastor e Tesoureiro: acesso ao módulo Financeiro
export const isFinanceiro = (user) => ['pastor', 'tesoureiro'].includes(user?.perfil)

// Um líder pode acumular mais de um cargo. `cargo` é salvo como JSON (array)
// mas registros antigos guardam uma string única — aceita os dois formatos.
export const cargosArray = (cargo) => {
  if (Array.isArray(cargo)) return cargo
  if (!cargo) return []
  try {
    const parsed = JSON.parse(cargo)
    return Array.isArray(parsed) ? parsed : [cargo]
  } catch {
    return [cargo]
  }
}

export const waLink = (tel, msg) => {
  const num = (tel || '').replace(/\D/g, '')
  const formatted = num.length === 11 ? '55' + num : num.length === 10 ? '55' + num : num
  return `https://wa.me/${formatted}?text=${encodeURIComponent(msg)}`
}

// Normalize string for accent-insensitive search
// Retorna "Primeiro Último" com Title Case
export const primeiroUltimo = (nomeCompleto) => {
  const toTitle = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
  const parts = (nomeCompleto || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length <= 2) return parts.map(toTitle).join(' ')
  return `${toTitle(parts[0])} ${toTitle(parts[parts.length - 1])}`
}

// Retorna nome_exibicao do membro se definido, senão primeiroUltimo
// membros = array de membros do estado global
export const nomeDisp = (nomeCompleto, membros = []) => {
  if (!nomeCompleto) return ''
  const m = membros.find(x => x.nome === nomeCompleto)
  return m?.nome_exibicao || primeiroUltimo(nomeCompleto)
}

export const normalizar = (str) => {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// Always uppercase names
export const toUpperName = (str) => (str || '').toUpperCase()

// WhatsApp messages — escopo: 'mes' | 'fds' | 'dia'
export const MSG_ESCALA = [
  (nome, escala, escopo='mes') => {
    const intro = escopo==='dia' ? `Voce esta escalado(a) para o seguinte compromisso:`
      : escopo==='fds' ? `Segue sua escalacao para o proximo final de semana. Contamos com voce:`
      : `So passando pra te avisar que esse mes contamos com a sua participacao. Veja abaixo os dias em que voce esta escalado(a):`
    return `Paz, ${nome}!\n\n${intro}\n\n${escala}\n\nQualquer duvida ou necessidade de troca, fale com a gente. Que Deus abencoe seu servico!`
  },
  (nome, escala, escopo='mes') => {
    const intro = escopo==='dia' ? `Confirmando sua escalacao para este dia:`
      : escopo==='fds' ? `Que bom contar com voce neste final de semana! Segue sua escalacao:`
      : `Que bom contar com voce esse mes. Segue abaixo sua participacao na escala:`
    return `Ola, ${nome}!\n\n${intro}\n\n${escala}\n\nEstamos juntos! Qualquer coisa e so chamar.`
  },
  (nome, escala, escopo='mes') => {
    const intro = escopo==='dia' ? `Sua escalacao para este dia:`
      : escopo==='fds' ? `E uma alegria servir junto com voce neste final de semana:`
      : `Passando pra compartilhar sua escala desse mes. E uma alegria servir junto com voce:`
    return `Oi, ${nome}!\n\n${intro}\n\n${escala}\n\nConte com nossas oracoes. Deus abencoe seu servico!`
  },
]

// WhatsApp messages for Escola Bíblica schedule
export const MSG_EB = [
  (nome, escala, escopo='mes') => {
    const intro = escopo==='dia' ? `Voce esta escalado(a) na Escola Biblica para o seguinte sabado:` : `Passando pra avisar sobre sua escala na Escola Biblica esse mes:`
    return `Paz, ${nome}!\n\n${intro}\n\n${escala}\n\nQualquer duvida ou necessidade de troca, e so chamar. Que Deus abencoe seu servico!`
  },
  (nome, escala, escopo='mes') => {
    const intro = escopo==='dia' ? `Confirmando sua participacao na Escola Biblica:` : `Segue sua participacao na Escola Biblica esse mes:`
    return `Ola, ${nome}!\n\n${intro}\n\n${escala}\n\nContamos com voce! Qualquer coisa e so falar com a gente.`
  },
  (nome, escala, escopo='mes') => {
    const intro = escopo==='dia' ? `Sua escalacao na Escola Biblica:` : `E uma alegria contar com voce na Escola Biblica. Veja sua escala desse mes:`
    return `Oi, ${nome}!\n\n${intro}\n\n${escala}\n\nDeus abencoe! Conte com nossas oracoes.`
  },
]

export const MSG_LV = [
  (nome, escala, escopo='mes') => {
    const intro = escopo==='dia' ? `Seguem as informacoes para o seu servico no dia:` : escopo==='fds' ? `Segue sua escalacao de louvor para o proximo final de semana:` : `Passando pra compartilhar sua escala de louvor nesse mes. Contamos com voce:`
    return `Paz, ${nome}!\n\n${intro}\n\n${escala}\n\nQualquer duvida ou necessidade de troca, fale com a gente. Que Deus abencoe seu servico!`
  },
  (nome, escala, escopo='mes') => {
    const intro = escopo==='dia' ? `Voce esta escalado(a) para o dia de hoje na equipe de louvor:` : escopo==='fds' ? `Que alegria ter voce na equipe neste final de semana!` : `Que alegria ter voce na equipe de louvor! Segue sua participacao esse mes:`
    return `Ola, ${nome}!\n\n${intro}\n\n${escala}\n\nEstamos juntos! Qualquer coisa e so chamar.`
  },
  (nome, escala, escopo='mes') => {
    const intro = escopo==='dia' ? `Sua escalacao de louvor para hoje:` : escopo==='fds' ? `E uma honra servir ao Senhor com voce neste final de semana!` : `E uma honra servir ao Senhor com voce! Veja abaixo sua escala de louvor desse mes:`
    return `Oi, ${nome}!\n\n${intro}\n\n${escala}\n\nConte com nossas oracoes. Deus te abencoe!`
  },
]

export const MSG_PREG = (nome, data, tema, serie, linkYt, linkRec, obs) => {
  let msg = `Paz, ${nome}!\n\nVoce esta confirmado(a) para pregar no dia ${data}.\n`
  if (serie) msg += `\nSerie: ${serie}`
  if (tema) msg += `\nTema: ${tema}`
  if (linkYt) msg += `\nYouTube: ${linkYt}`
  if (linkRec) msg += `\nMaterial: ${linkRec}`
  if (obs) msg += `\n\n${obs}`
  msg += `\n\nQue Deus te use poderosamente!`
  return msg
}

// Mensagem completa para o grupo — suporta setlist, solos vocais e músicas por instrumentista
// slot.vocal = [{disp, solos: 'todos' | [1,2] | undefined}]
// slot.inst  = {papel: [{disp, louvores:[1,2]}]}
// slot.musicas = [{nome}] (em ordem)
export const MSG_GRUPO_LV = (slots) => {
  const linhas = []
  slots.forEach(s => {
    linhas.push(`=== ${s.label.toUpperCase()} — ${fmtBR(s.data)} ===`)

    if (s.vocal.length) {
      linhas.push('')
      linhas.push('VOCAL')
      s.vocal.forEach(v => {
        let linha = `  ${v.disp}`
        if (v.solos === 'todos') {
          linha += ' (solo em todos)'
        } else if (Array.isArray(v.solos) && v.solos.length) {
          const nms = v.solos.map(n => s.musicas?.[n-1]?.nome || `L${n}`).filter(Boolean)
          linha += nms.length ? ` (solo: ${nms.join(', ')})` : ` (solo: L${v.solos.join(', L')})`
        }
        linhas.push(linha)
      })
    }

    const instEntries = Object.entries(s.inst)
    if (instEntries.length) {
      linhas.push('')
      linhas.push('INSTRUMENTAL')
      instEntries.forEach(([papel, pessoas]) => {
        pessoas.forEach(p => {
          let linha = `  ${papel}: ${p.disp}`
          if (p.louvores?.length) {
            const nms = p.louvores.map(n => s.musicas?.[n-1]?.nome || `L${n}`).filter(Boolean)
            linha += nms.length ? ` — ${nms.join(', ')}` : ` — L${p.louvores.join(', L')}`
          }
          linhas.push(linha)
        })
      })
    }

    if (s.musicas?.length) {
      linhas.push('')
      linhas.push('MUSICAS DO DIA')
      s.musicas.forEach((m, i) => linhas.push(`  ${i+1}. ${m.nome}`))
    }

    linhas.push('')
  })
  return linhas.join('\n').trim()
}

export const MSG_GRUPO_CULTO = (slots) => {
  const linhas = []
  slots.forEach(s => {
    linhas.push(`--- ${s.label} (${fmtBR(s.data)}) ---`)
    if (s.pregador) linhas.push(`Pregador: ${s.pregador}`)
    if (s.dir) linhas.push(`Direcao: ${s.dir}`)
    if (s.voc) linhas.push(`Vocal Solo: ${s.voc}`)
    if (s.mor) linhas.push(`Mordomia: ${s.mor}`)
    if (s.por) linhas.push(`Portaria: ${s.por}`)
    if (s.ord) linhas.push(`Ordenado do Dia: ${s.ord}`)
    linhas.push('')
  })
  return linhas.join('\n').trim()
}
