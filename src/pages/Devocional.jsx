import { useStore } from '../lib/store.jsx'
import { Empty } from '../components/UI.jsx'

export default function Devocional() {
  const { state } = useStore()
  return (
    <div>
      <Empty icon="🔧" text="Devocional — em construção" />
    </div>
  )
}
