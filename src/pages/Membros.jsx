import { useStore } from '../lib/store.jsx'
import { Empty } from '../components/UI.jsx'

export default function Membros() {
  const { state } = useStore()
  return (
    <div>
      <Empty icon="🔧" text="Membros — em construção" />
    </div>
  )
}
