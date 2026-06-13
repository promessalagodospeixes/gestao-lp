import { useEffect, useState } from 'react'
import { useStore } from './lib/store.jsx'
import { sb } from './lib/supabase.js'
import { loadAllData } from './lib/dataLoader.js'
import Login from './pages/Login.jsx'
import Layout from './components/Layout.jsx'

export default function App() {
  const { state, dispatch } = useStore()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Auto-login from session storage
    const savedUser = localStorage.getItem('gestao-lp-user')
    if (savedUser) {
      const user = JSON.parse(savedUser)
      dispatch({ type: 'SET_USER', value: user })
      loadAllData().then(data => {
        dispatch({ type: 'LOAD_ALL', data })
        setChecking(false)
      })
    } else {
      setChecking(false)
    }
  }, [])

  // Toast auto-dismiss
  useEffect(() => {
    if (state.toast) {
      const t = setTimeout(() => dispatch({ type: 'TOAST', value: null }), 3000)
      return () => clearTimeout(t)
    }
  }, [state.toast])

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, letterSpacing: 4, color: 'var(--cy)' }}>GESTÃO LP</div>
          <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 8, letterSpacing: 2 }}>CARREGANDO...</div>
        </div>
      </div>
    )
  }

  return (
    <>
      {state.loading && <div className="loading-bar" key={Date.now()} />}
      {state.toast && <div className="toast">{state.toast}</div>}
      {state.user ? <Layout /> : <Login />}
    </>
  )
}
