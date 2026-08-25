import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import FichaPublica from './pages/FichaPublica.jsx'
import { StoreProvider } from './lib/store.jsx'
import './index.css'

// /ficha é o link público da ficha de membro: abre sem login e fora do sistema.
const rota = window.location.pathname.replace(/\/+$/, '')
const ehFicha = rota === '/ficha'

ReactDOM.createRoot(document.getElementById('root')).render(
  ehFicha ? (
    <FichaPublica />
  ) : (
    <StoreProvider>
      <App />
    </StoreProvider>
  )
)
