// Autenticação do sistema: senha com hash e token de sessão assinado.
// Nada aqui vai para o navegador — só roda no servidor da Vercel.
import crypto from 'crypto'

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
export const SUPABASE_URL = 'https://mynektdohwpzfbmgfunp.supabase.co'

// Segredo para assinar o token. Usa o próprio segredo do servidor.
const SEGREDO = process.env.APP_JWT_SECRET || SERVICE_KEY.slice(-48)

export const temChave = () => !!SERVICE_KEY

// ── Acesso ao banco com a chave mestra (ignora RLS) ──
export async function banco(caminho, opcoes = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    ...opcoes,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(opcoes.headers || {}),
    },
  })
}

// ── Senha: hash com scrypt (nativo, sem biblioteca externa) ──
export function gerarHash(senha) {
  const sal = crypto.randomBytes(16).toString('hex')
  const dig = crypto.scryptSync(String(senha), sal, 32).toString('hex')
  return `scrypt$${sal}$${dig}`
}

export function conferirHash(senha, hash) {
  if (!hash || !hash.startsWith('scrypt$')) return false
  const [, sal, dig] = hash.split('$')
  const teste = crypto.scryptSync(String(senha), sal, 32).toString('hex')
  // comparação em tempo constante evita descobrir a senha por tentativa cronometrada
  const a = Buffer.from(teste, 'hex')
  const b = Buffer.from(dig, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// ── Token de sessão (JWT curtinho, assinado) ──
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')

export function criarToken(dados, horas = 12) {
  const corpo = { ...dados, exp: Math.floor(Date.now() / 1000) + horas * 3600 }
  const cabeca = b64({ alg: 'HS256', typ: 'JWT' })
  const carga = b64(corpo)
  const assinatura = crypto.createHmac('sha256', SEGREDO).update(`${cabeca}.${carga}`).digest('base64url')
  return `${cabeca}.${carga}.${assinatura}`
}

export function lerToken(token) {
  try {
    const [cabeca, carga, assinatura] = String(token || '').split('.')
    if (!cabeca || !carga || !assinatura) return null
    const esperada = crypto.createHmac('sha256', SEGREDO).update(`${cabeca}.${carga}`).digest('base64url')
    const a = Buffer.from(assinatura)
    const b = Buffer.from(esperada)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    const dados = JSON.parse(Buffer.from(carga, 'base64url').toString())
    if (!dados.exp || dados.exp < Math.floor(Date.now() / 1000)) return null
    return dados
  } catch (e) {
    return null
  }
}

// Pega a sessão do cabeçalho Authorization: Bearer <token>
export function sessaoDaRequisicao(req) {
  const cab = req.headers?.authorization || req.headers?.Authorization || ''
  return lerToken(cab.replace(/^Bearer\s+/i, ''))
}

// Só dígitos, para comparar telefone/CPF digitado de jeitos diferentes
export const soDigitos = (t) => String(t || '').replace(/\D/g, '')

// Confere os dois dígitos verificadores do CPF.
export const cpfValido = (v) => {
  const d = soDigitos(v)
  if (d.length !== 11) return false
  if (d.split('').every((c) => c === d[0])) return false
  for (const par of [[9, 10], [10, 11]]) {
    let soma = 0
    for (let i = 0; i < par[0]; i++) soma += Number(d[i]) * (par[1] - i)
    let resto = (soma * 10) % 11
    if (resto === 10) resto = 0
    if (resto !== Number(d[par[0]])) return false
  }
  return true
}
