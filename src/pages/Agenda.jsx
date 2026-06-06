import { useStore } from '../lib/store.jsx'
import { Empty } from '../components/UI.jsx'

export default function Agenda() {
  const { state } = useStore()
  return (
    <div>
      <Empty icon="🔧" text="Agenda — em construção" />
    </div>
  )
}
