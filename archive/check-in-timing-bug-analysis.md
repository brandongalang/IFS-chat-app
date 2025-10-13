# Check-In Timing Bug Analysis

**Date:** October 11, 2025, 4:15 PM EDT\
**Issue:** Evening check-in is available at 4:15 PM when it should be locked until 6:00 PM

## Root Cause

The bug is in `lib/check-ins/server.ts` lines 536-556 in the `loadCheckInOverview()` function:

```typescript
const now = new Date();
const hour = now.getHours(); // ← BUG: Uses server timezone, not user timezone
```

`const eveningStatus: CheckInOverviewSlot['status'] = (() => {`\
`if (hasEvening) return 'completed';`\
`if (!isViewingToday) return 'not_recorded';`\
`if (hour < EVENING_START_HOUR) return 'locked'; // Should be locked if hour < 18`\
`return 'available';`\
`})();`

### The Problem

1. **Server-side time check**: The code runs on the server (API route) and uses `new Date().getHours()`

2. **No timezone awareness**: This returns the hour in the **server's timezone**, not the user's timezone

3. **Wrong comparison**: If the server is in a different timezone (e.g., UTC), it might be 20:15 UTC when it's 16:15 EDT

4. **Result**: Evening check-in shows as "available" when it should be "locked"

### Constants

From `lib/check-ins/shared.ts`:

- `MORNING_START_HOUR = 4` (4:00 AM)
