import { useStore } from '../lib/store.jsx'
import { Empty } from '../components/UI.jsx'

export default function EscalaEB() {
  const { state } = useStore()
  return (
    <div>
      <Empty icon="🔧" text="EscalaEB — em construção" />
    </div>
  )
}
