import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import FichaPublica from './pages/FichaPublica.jsx'
import AtualizarCadastro from './pages/AtualizarCadastro.jsx'
import { StoreProvider } from './lib/store.jsx'
import './index.css'

// Duas páginas abrem sem login, fora do sistema:
//   /ficha     — cadastro de quem ainda não é membro
//   /atualizar — link pessoal para o membro conferir os próprios dados
const rota = window.location.pathname.replace(/\/+$/, '')

const publica = rota === '/ficha' ? <FichaPublica />
  : rota === '/atualizar' ? <AtualizarCadastro />
    : null

ReactDOM.createRoot(document.getElementById('root')).render(
  publica || (
    <StoreProvider>
      <App />
    </StoreProvider>
  )
)
