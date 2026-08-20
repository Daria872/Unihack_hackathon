import IndustrialDashboard from '@/components/industrial-dashboard'
import { ProductChatbot } from '@/components/product-chatbot'
import { AuthGate } from '@/components/auth-gate'

export default function Page() {
  return <AuthGate><IndustrialDashboard /><ProductChatbot /></AuthGate>
}
