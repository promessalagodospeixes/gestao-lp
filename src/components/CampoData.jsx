import { useEffect, useState } from 'react'

// Campo de data para quem tem dificuldade com o seletor do celular:
// a pessoa simplesmente digita os números e as barras aparecem sozinhas.
// Guarda e devolve no formato do banco (aaaa-mm-dd).

const paraBR = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

// Vai colocando a barra conforme digita: 1 → 12 → 12/0 → 12/07 → 12/07/2013
const mascara = (txt) => {
  const d = String(txt || '').replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

// Confere se a data existe de verdade (31/02 não passa)
export const paraISO = (txt) => {
  const d = String(txt || '').replace(/\D/g, '')
  if (d.length !== 8) return ''
  const dia = +d.slice(0, 2), mes = +d.slice(2, 4), ano = +d.slice(4)
  if (mes < 1 || mes > 12 || dia < 1 || ano < 1900 || ano > 2100) return ''
  const data = new Date(ano, mes - 1, dia)
  if (data.getDate() !== dia || data.getMonth() !== mes - 1 || data.getFullYear() !== ano) return ''
  return `${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}`
}

export default function CampoData({ valor, onChange, estilo, estiloErro, autoFocus, id }) {
  const [txt, setTxt] = useState(paraBR(valor))

  // Quando o valor chega de fora (ex.: cadastro carregado do servidor)
  useEffect(() => {
    const vindo = paraBR(valor)
    if (vindo && vindo !== txt) setTxt(vindo)
  }, [valor])

  const completo = txt.replace(/\D/g, '').length === 8
  const invalido = completo && !paraISO(txt)

  const digitar = (e) => {
    const novo = mascara(e.target.value)
    setTxt(novo)
    onChange(paraISO(novo)) // '' enquanto estiver incompleta ou impossível
  }

  return (
    <>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dia/mês/ano"
        value={txt}
        onChange={digitar}
        autoFocus={autoFocus}
        maxLength={10}
        style={{ ...estilo, ...(invalido ? estiloErro : null) }}
      />
      {invalido && (
        <span style={{ fontSize: 11.5, color: '#f85149', marginTop: 4, display: 'block' }}>
          Essa data não existe. Confira o dia e o mês.
        </span>
      )}
    </>
  )
}
