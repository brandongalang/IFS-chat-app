'use server'

import {
  submitCheckIn,
  type CheckInSubmissionPayload,
  type SubmissionResult,
} from '@/lib/check-ins/server'

export interface CheckInActionResponse {
  ok: boolean
  conflict: boolean
  data: SubmissionResult['data']
  error: string | null
}

export async function submitCheckInAction(payload: CheckInSubmissionPayload): Promise<CheckInActionResponse> {
  try {
    const result = await submitCheckIn(payload)
    if (result.conflict) {
      return {
        ok: false,
        conflict: true,
        data: result.data,
        error: 'A check-in of this type already exists for this date.',
      }
    }
    return { ok: true, conflict: false, data: result.data, error: null }
  } catch (error) {
    if (error instanceof Error) {
      return { ok: false, conflict: false, data: [], error: error.message }
    }
    return { ok: false, conflict: false, data: [], error: 'Unknown error' }
  }
}
