// Login do sistema. A senha nunca sai daqui e o banco não é mais tocado pelo navegador.
import { banco, temChave, gerarHash, conferirHash, criarToken, soDigitos } from './_auth.js'

const CARGO_PERFIL = {
  'Pastor': 'pastor',
  'Secretário': 'secretario', 'Secretária': 'secretario', 'Secretario': 'secretario',
  'Tesoureiro': 'tesoureiro', 'Tesoureira': 'tesoureiro',
  'Professor': 'professor', 'Professora': 'professor',
}

const cargosArray = (c) => {
  if (!c) return []
  if (Array.isArray(c)) return c
  try { const a = JSON.parse(c); return Array.isArray(a) ? a : [c] } catch { return [c] }
}

const lista = async (tabela, query = 'select=*') => {
  const r = await banco(`${tabela}?${query}`)
  return r.ok ? r.json() : []
}

// Descobre perfil, páginas extras e turmas de EB — mesmas regras de antes
async function montarPerfil(nome, perfilBase = 'membro') {
  let perfil = perfilBase
  let extraPages = []
  let ebTurmas = null

  const liderancaArr = await lista('lideranca')
  const lider = liderancaArr.find((l) => l.membro_nome === nome)
  if (perfil === 'membro' && lider) {
    for (const cargo of cargosArray(lider.cargo)) {
      if (CARGO_PERFIL[cargo]) { perfil = CARGO_PERFIL[cargo]; if (perfil === 'pastor') break }
    }
  }

  if (perfil !== 'pastor') {
    const g = (await lista('gestores'))[0]
    if (g?.secretario === nome) perfil = 'secretario'
    else if (g?.tesoureiro === nome) perfil = 'tesoureiro'
    else {
      try {
        const vArr = Array.isArray(g?.vocal) ? g.vocal : JSON.parse(g?.vocal || '[]')
        const iArr = Array.isArray(g?.instrumental) ? g.instrumental : JSON.parse(g?.instrumental || '[]')
        if (vArr.filter(Boolean).includes(nome)) perfil = 'gestor-vocal'
        else if (iArr.filter(Boolean).includes(nome)) perfil = 'gestor-instrumental'
      } catch (e) { /* mantém o perfil */ }
    }
    try {
      const perms = g?.permissoes ? (typeof g.permissoes === 'object' ? g.permissoes : JSON.parse(g.permissoes || '{}')) : {}
      extraPages = perms[nome] || []
      const ebList = Array.isArray(perms['~eb~']) ? perms['~eb~'] : []
      if (ebList.includes(nome) && !extraPages.includes('escala-eb')) extraPages = [...extraPages, 'escala-eb']
      ebTurmas = perms[`~eb~${nome}`] || null
    } catch (e) { extraPages = [] }
  }

  const useCustomNav = ['secretario', 'tesoureiro', 'gestor-vocal', 'gestor-instrumental'].includes(perfil)
  return { perfil, extraPages, useCustomNav, ministerioLider: lider?.ministerio || null, ebTurmas }
}

const registrar = (login, sucesso, ip) =>
  banco('login_tentativas', { method: 'POST', body: JSON.stringify({ login, sucesso, ip }) }).catch(() => {})

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'method' })
  if (!temChave()) return res.status(500).json({ erro: 'servidor sem SUPABASE_SERVICE_KEY' })

  const { login, senha } = req.body || {}
  if (!login || !senha) return res.status(400).json({ erro: 'Informe login e senha.' })

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || null
  const alvo = String(login).trim()
  const digitos = soDigitos(alvo)

  // Trava contra tentativa em massa: 8 erros do mesmo login em 15 min
  const desde = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const recentes = await lista('login_tentativas', `login=eq.${encodeURIComponent(alvo)}&sucesso=is.false&created_at=gte.${desde}&select=id`)
  if (recentes.length >= 8) {
    return res.status(429).json({ erro: 'Muitas tentativas. Aguarde 15 minutos e tente de novo.' })
  }

  const casa = (p) => (
    (digitos && soDigitos(p.tel) === digitos) ||
    (digitos && p.cpf && soDigitos(p.cpf) === digitos) ||
    (p.email && p.email.toLowerCase() === alvo.toLowerCase()) ||
    (p.login && p.login === alvo)
  )

  // 1) tabela usuarios  2) tabela membros
  const usuarios = await lista('usuarios')
  let pessoa = usuarios.find(casa)
  let tabela = 'usuarios'
  if (!pessoa) {
    const membros = await lista('membros')
    pessoa = membros.find(casa)
    tabela = 'membros'
  }
  if (!pessoa) {
    await registrar(alvo, false, ip)
    return res.status(401).json({ erro: 'Login ou senha inválidos.' })
  }

  // Confere a senha: hash novo, senha antiga em texto, ou a padrão 123456
  let ok = false
  let precisaTrocar = false
  if (pessoa.senha_hash) {
    ok = conferirHash(senha, pessoa.senha_hash)
  } else {
    const antiga = pessoa.senha || '123456'
    ok = String(senha) === String(antiga)
    precisaTrocar = true // ainda está com senha fraca/padrão
  }
  if (!ok) {
    await registrar(alvo, false, ip)
    return res.status(401).json({ erro: 'Login ou senha inválidos.' })
  }

  const perfilBase = tabela === 'usuarios' ? (pessoa.perfil || 'membro') : 'membro'
  const extra = await montarPerfil(pessoa.nome || '', perfilBase)
  await registrar(alvo, true, ip)

  const usuario = {
    id: pessoa.id,
    nome: pessoa.nome,
    nome_exibicao: pessoa.nome_exibicao || null,
    login: pessoa.tel || pessoa.login || alvo,
    membro_id: tabela === 'membros' ? pessoa.id : (pessoa.membro_id || null),
    lgpd_aceito: pessoa.lgpd_aceito || false,
    lgpd_aceito_em: pessoa.lgpd_aceito_em || null,
    trocar_senha: precisaTrocar || pessoa.trocar_senha === true,
    origem: tabela,
    ...extra,
  }

  const token = criarToken({ id: usuario.id, nome: usuario.nome, perfil: usuario.perfil, tabela, membro_id: usuario.membro_id })
  return res.status(200).json({ usuario, token })
}

// Troca de senha (a própria pessoa, já autenticada pelo login antigo)
export async function definirSenha(tabela, id, senhaNova) {
  const hash = gerarHash(senhaNova)
  await banco(`${tabela}?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ senha_hash: hash, trocar_senha: false, senha: null }),
  })
}
