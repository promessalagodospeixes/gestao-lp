import { useStore } from '../lib/store.jsx'
import { Empty } from '../components/UI.jsx'

export default function Pregacao() {
  const { state } = useStore()
  return (
    <div>
      <Empty icon="🔧" text="Pregacao — em construção" />
    </div>
  )
}
