import FloatingElement from '@/components/elements/FloatingElement'
import { Fish } from '@/components/elements/shapes'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-6">
      <FloatingElement bottom="12%" left="8%" animVariant="swim">
        <Fish />
      </FloatingElement>
      <div className="w-full max-w-md animate-fade-in">
        {children}
      </div>
    </div>
  )
}
