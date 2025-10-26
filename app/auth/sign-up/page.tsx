import { SignUpForm } from '@/components/auth/sign-up-form'

export default function Page() {
  return (
    <div
      className="flex min-h-svh w-full items-center justify-center px-4 py-10 text-foreground sm:px-6"
    >
      <div className="w-full max-w-sm">
        <SignUpForm />
      </div>
    </div>
  )
}
