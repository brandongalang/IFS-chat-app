import { LoginForm } from '@/components/auth/login-form'
import { isNewUIEnabled } from '@/config/features'

export default function Page() {
  const newUI = isNewUIEnabled()

  if (newUI) {
    return (
      <div className="min-h-screen bg-[var(--hs-bg)] flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <LoginForm />
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex min-h-svh w-full items-center justify-center p-6 md:p-10"
      style={{
        letterSpacing: 'var(--eth-letter-spacing-user)',
        color: 'rgba(255,255,255,var(--eth-user-opacity))',
      }}
    >
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
