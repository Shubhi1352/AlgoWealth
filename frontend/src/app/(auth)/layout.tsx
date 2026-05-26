import FloatingElement from '@/components/elements/FloatingElement'
import { Fish } from '@/components/elements/shapes'
import styles from './auth.module.css'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={styles.shell}>
      <FloatingElement bottom="12%" left="8%" animVariant="swim">
        <Fish />
      </FloatingElement>
      <div className={styles.content}>
        {children}
      </div>
    </div>
  )
}