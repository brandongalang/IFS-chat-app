import { EveningCheckInForm } from '@/components/check-in/evening-form'

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <EveningCheckInForm />
      </div>
    </div>
  )
}
