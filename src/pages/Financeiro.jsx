import { useStore } from '../lib/store.jsx'
import { Empty } from '../components/UI.jsx'

export default function Financeiro() {
  const { state } = useStore()
  return (
    <div>
      <Empty icon="🔧" text="Financeiro — em construção" />
    </div>
  )
}
