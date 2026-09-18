// ============================================================
//  Backup completo do banco (todas as tabelas -> um JSON).
//
//  Roda sozinho todo dia (via tarefa agendada) ou na mão:
//     node scripts/backup-db.cjs
//
//  A chave do banco NÃO fica aqui: ela mora em backups/.db-url.txt
//  (essa pasta está no .gitignore, então nada sensível vai pro Git).
//
//  Guarda os últimos 30 backups diários e apaga os mais velhos,
//  para não encher o disco. Cada backup pesa ~1 MB.
// ============================================================
const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

const RAIZ = path.join(__dirname, '..')
const DIR = path.join(RAIZ, 'backups')
const MANTER = 30 // quantos backups diários guardar

function urlDoBanco() {
  const env = process.env.SUPABASE_DB_URL
  if (env) return env.trim()
  const arq = path.join(DIR, '.db-url.txt')
  if (fs.existsSync(arq)) return fs.readFileSync(arq, 'utf8').trim()
  throw new Error('Sem a chave do banco. Crie backups/.db-url.txt com a string de conexão, ou defina SUPABASE_DB_URL.')
}

;(async () => {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true })
  const c = new Client({ connectionString: urlDoBanco(), ssl: { rejectUnauthorized: false } })
  await c.connect()

  const tabelas = (await c.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(r => r.tablename)
  const dump = { _gerado_em: new Date().toISOString(), _tabelas: {} }
  let total = 0
  for (const t of tabelas) {
    try { const r = await c.query(`select * from "${t}"`); dump._tabelas[t] = r.rows; total += r.rows.length }
    catch (e) { dump._tabelas[t] = 'ERRO ' + e.message }
  }
  await c.end()

  const carimbo = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const alvo = path.join(DIR, `backup-COMPLETO-${carimbo}.json`)
  fs.writeFileSync(alvo, JSON.stringify(dump))
  console.log(`Backup ok: ${path.basename(alvo)} — ${tabelas.length} tabelas, ${total} linhas, ${(fs.statSync(alvo).size / 1024 / 1024).toFixed(2)} MB`)

  // Rotação: mantém os MANTER mais novos, apaga os diários mais velhos.
  const antigos = fs.readdirSync(DIR)
    .filter(f => f.startsWith('backup-COMPLETO-') && f.endsWith('.json'))
    .sort()
  const apagar = antigos.slice(0, Math.max(0, antigos.length - MANTER))
  for (const f of apagar) { fs.unlinkSync(path.join(DIR, f)); console.log('  removido antigo:', f) }
})().catch(e => { console.error('FALHOU:', e.message); process.exit(1) })
