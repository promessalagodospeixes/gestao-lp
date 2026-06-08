// Global state store using React Context
import { createContext, useContext, useReducer } from 'react'

const initialState = {
  user: null,
  membros: [],
  usuarios: [],
  funcoes: [],
  gestores: { vocal: ['', '', ''], instrumental: ['', '', ''] },
  lideranca: [],
  agenda: [],
  avisos: [],
  musicas: [],
  pregacoes: [],
  escalaPreg: [],
  financeiro: [],
  escalas: {},
  ocorrencias: [],
  escalasEB: {},
  escalasLv: {},
  setlists: [],
  devocionais: [],
  respostas: [],
  histMsgs: {},
  loading: false,
  toast: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET': return { ...state, [action.key]: action.value }
    case 'SET_USER': return { ...state, user: action.value }
    case 'SET_LOADING': return { ...state, loading: action.value }
    case 'TOAST': return { ...state, toast: action.value }
    case 'LOGOUT': return { ...initialState }
    case 'LOAD_ALL': return { ...state, ...action.data, loading: false }
    default: return state
  }
}

export const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  )
}

export const useStore = () => useContext(StoreContext)
