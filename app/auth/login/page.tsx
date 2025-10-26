import { LoginForm } from '@/components/auth/login-form'

export default function Page() {
  return (
    <div
      className="flex min-h-svh w-full items-center justify-center px-4 py-10 text-foreground sm:px-6"
    >
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
