export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  
  const { q, musid, artid } = req.query
  
  try {
    let url
    if (musid && artid) {
      url = `https://api.vagalume.com.br/search.php?musid=${musid}&artid=${artid}&apikey=guest`
    } else if (q) {
      url = `https://api.vagalume.com.br/search.php?q=${encodeURIComponent(q)}&apikey=guest`
    } else {
      return res.status(400).json({ error: 'Missing query' })
    }
    
    const response = await fetch(url)
    const data = await response.json()
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Note: Run this SQL in Supabase if disponibilidades column doesn't exist:
// ALTER TABLE funcoes ADD COLUMN IF NOT EXISTS disponibilidades JSONB DEFAULT '{}';

// SQL para criar a tabela de ocorrências (rodar no SQL Editor do Supabase, se ainda não existir):
// CREATE TABLE IF NOT EXISTS ocorrencias (
//   id BIGSERIAL PRIMARY KEY,
//   ano INTEGER, mes INTEGER, slot TEXT,
//   funcao TEXT, nome_original TEXT, substituto TEXT, motivo TEXT,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
