import { useStore } from '../lib/store.jsx'
import { Empty } from '../components/UI.jsx'

export default function Usuarios() {
  const { state } = useStore()
  return (
    <div>
      <Empty icon="🔧" text="Usuarios — em construção" />
    </div>
  )
}
