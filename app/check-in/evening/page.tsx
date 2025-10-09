import { CheckInExperience } from '@/components/check-in/CheckInExperience'
import { loadAvailableParts, loadCheckInOverview, loadMorningContext } from '@/lib/check-ins/server'
import { toLocalDateIso } from '@/lib/check-ins/shared'

export default async function Page() {
  const targetDateIso = toLocalDateIso(new Date())
  const [parts, overview, morningContext] = await Promise.all([
    loadAvailableParts(),
    loadCheckInOverview(targetDateIso),
    loadMorningContext(targetDateIso),
  ])

  return (
    <CheckInExperience
      variant="evening"
      parts={parts}
      targetDateIso={targetDateIso}
      streakDays={overview.streak}
      morningContext={morningContext}
    />
  )
}
