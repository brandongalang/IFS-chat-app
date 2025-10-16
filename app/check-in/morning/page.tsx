import { CheckInExperience } from '@/components/check-in/CheckInExperience'
import { loadAvailableParts, loadCheckInOverview } from '@/lib/check-ins/server'
import { toLocalDateIso } from '@/lib/check-ins/shared'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const targetDateIso = toLocalDateIso(new Date())
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
