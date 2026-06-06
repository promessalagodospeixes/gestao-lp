import { useStore } from '../lib/store.jsx'
import { Empty } from '../components/UI.jsx'

export default function EscalaLouvor() {
  const { state } = useStore()
  return (
    <div>
      <Empty icon="🔧" text="EscalaLouvor — em construção" />
    </div>
  )
}
