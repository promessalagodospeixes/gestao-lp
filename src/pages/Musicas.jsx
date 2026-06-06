import { useStore } from '../lib/store.jsx'
import { Empty } from '../components/UI.jsx'

export default function Musicas() {
  const { state } = useStore()
  return (
    <div>
      <Empty icon="🔧" text="Musicas — em construção" />
    </div>
  )
}
