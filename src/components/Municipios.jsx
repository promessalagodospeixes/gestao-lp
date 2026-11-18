import { useState, useEffect } from 'react'

// Lista de municípios do Brasil (IBGE), carregada uma vez e guardada em cache.
// Usada como sugestão (datalist) nos campos de Naturalidade — a pessoa digita e
// escolhe "Cidade - UF", padronizando o que antes era texto livre.
let CACHE = null
let CARREGANDO = null

function extrairUF(m) {
  return (
    m?.microrregiao?.mesorregiao?.UF?.sigla ||
    m?.['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla ||
    m?.UF?.sigla || ''
  )
}

export function carregarMunicipios() {
  if (CACHE) return Promise.resolve(CACHE)
  if (CARREGANDO) return CARREGANDO
  CARREGANDO = fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome')
    .then((r) => r.json())
    .then((arr) => {
      CACHE = (arr || []).map((m) => {
        const uf = extrairUF(m)
        return uf ? `${m.nome} - ${uf}` : m.nome
      })
      return CACHE
    })
    .catch(() => { CACHE = []; return CACHE })
  return CARREGANDO
}

// Renderize uma vez por formulário. Os inputs de cidade usam list="municipios-br".
export default function MunicipiosDatalist({ id = 'municipios-br' }) {
  const [lista, setLista] = useState(CACHE || [])
  useEffect(() => {
    let vivo = true
    if (!CACHE) carregarMunicipios().then((l) => { if (vivo) setLista(l) })
    return () => { vivo = false }
  }, [])
  return (
    <datalist id={id}>
      {lista.map((nome) => <option key={nome} value={nome} />)}
    </datalist>
  )
}
