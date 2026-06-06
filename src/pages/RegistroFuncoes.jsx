import { useStore } from '../lib/store.jsx'
import { Empty } from '../components/UI.jsx'

export default function RegistroFuncoes() {
  const { state } = useStore()
  return (
    <div>
      <Empty icon="🔧" text="RegistroFuncoes — em construção" />
    </div>
  )
}
