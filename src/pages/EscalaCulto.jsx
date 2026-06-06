import { useStore } from '../lib/store.jsx'
import { Empty } from '../components/UI.jsx'

export default function EscalaCulto() {
  const { state } = useStore()
  return (
    <div>
      <Empty icon="🔧" text="EscalaCulto — em construção" />
    </div>
  )
}
