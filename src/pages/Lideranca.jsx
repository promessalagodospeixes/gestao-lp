import { useStore } from '../lib/store.jsx'
import { Empty } from '../components/UI.jsx'

export default function Lideranca() {
  const { state } = useStore()
  return (
    <div>
      <Empty icon="🔧" text="Lideranca — em construção" />
    </div>
  )
}
