import { useEffect, useState } from 'react'
import { dataParaBR, dataMascara, dataParaISO } from '../lib/utils.js'

// Campo de data para quem tem dificuldade com o seletor do celular:
// a pessoa simplesmente digita os números e as barras aparecem sozinhas.
// Recebe e devolve no formato do banco (aaaa-mm-dd).
export default function CampoData({ valor, onChange, estilo, estiloErro, autoFocus, id }) {
  const [txt, setTxt] = useState(dataParaBR(valor))

  // Quando o valor chega de fora (ex.: cadastro carregado do servidor)
  useEffect(() => {
    const vindo = dataParaBR(valor)
    if (vindo && vindo !== txt) setTxt(vindo)
  }, [valor])

  const completo = txt.replace(/\D/g, '').length === 8
  const invalido = completo && !dataParaISO(txt)

  const digitar = (e) => {
    const novo = dataMascara(e.target.value)
    setTxt(novo)
    onChange(dataParaISO(novo)) // '' enquanto estiver incompleta ou impossível
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
