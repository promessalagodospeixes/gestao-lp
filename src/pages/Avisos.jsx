import { useStore } from '../lib/store.jsx'
import { Empty } from '../components/UI.jsx'

export default function Avisos() {
  const { state } = useStore()
  return (
    <div>
      <Empty icon="🔧" text="Avisos — em construção" />
    </div>
  )
}
