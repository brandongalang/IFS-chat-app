import { CheckInExperience } from '@/components/check-in/CheckInExperience'
import { loadAvailableParts, loadCheckInOverview } from '@/lib/check-ins/server'

export default async function Page() {
  const targetDateIso = new Date().toISOString().slice(0, 10)
  const [parts, overview] = await Promise.all([
    loadAvailableParts(),
    loadCheckInOverview(targetDateIso),
  ])

  return (
    <CheckInExperience
      variant="morning"
      parts={parts}
      targetDateIso={targetDateIso}
      streakDays={overview.streak}
    />
  )
}
