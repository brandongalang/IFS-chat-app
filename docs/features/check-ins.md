---
title: Feature: Guided Check-ins
owner: @brandongalang
status: shipped
last_updated: 2025-10-11
feature_flag: null
code_paths:
  - app/check-in/morning/page.tsx
  - app/check-in/evening/page.tsx
  - app/api/check-ins/route.ts
  - components/check-in/CheckInExperience.tsx
  - components/check-in/CheckInWizard.tsx
  - components/check-in/EmojiScale.tsx
  - components/check-in/SliderScale.tsx
  - components/ui/slider.tsx
  - components/check-in/CheckInLayout.tsx
  - components/check-in/PartsPicker.tsx
  - components/home/CheckInSlots.tsx
  - app/_shared/hooks/useDailyCheckIns.ts
  - app/check-in/actions.ts
  - app/api/check-ins/overview/route.ts
  - lib/check-ins/server.ts
  - lib/check-ins/shared.ts
related_prs:
  - #36
  - #275
  - #267
  - #297
  - #298
  - #299
  - #300
  - #301
  - #303
---

## What
Structured morning and evening flows guiding users through self-reflection with quick mood/energy/intention scans, lightweight notes, and guidance to resume drafts.

## Why
Provides a gentle, repeatable practice to capture mood, intentions, and observations.

## How it works
- Next.js routes under /check-in/morning and /check-in/evening render a shared `CheckInExperience` single-page form; the interface varies by variant (morning includes mood/energy/intention focus; evening includes mood/energy plus gratitude and notes).

### Timezone semantics (PR #303)
- Server-authoritative timezone is read from `users.settings.timezone`; invalid values fallback to `America/New_York`.
- Client may send a `timezone` query param for testability, but the server prefers the profile value.
- “Today” is computed in the user’s timezone via `getTodayIsoInTimezone()`; pages use `resolveUserTodayIso()` so morning/evening flows operate on the correct local date.
- Availability windows are evaluated in the user’s timezone (DST-safe):
  - Morning becomes available at 04:00 local time; shows “upcoming” before, “closed” at/after 18:00.
  - Evening becomes available at 18:00 local time; locked before 18:00.
- Hour and date computations use `Intl.DateTimeFormat`-based helpers to avoid server-time drift and daylight-saving issues.
- The UI uses professional horizontal sliders (via `SliderScale` component) instead of emoji buttons, providing a 1-5 rating scale with visual endpoint labels and a subtle gradient to clarify scale direction.
- `EmojiScale` now acts as a thin wrapper around `SliderScale`, mapping slider values to emoji metadata and automatically passing the first and last option labels as left/right endpoints, while preserving the original component API for backward compatibility.
- The multi-step wizard interface has been replaced with a single-page form, removing the progress bar and review step for a more streamlined user experience.
- Check-in forms are composed from shared atoms (`SliderScale`, `EmojiScale`, `PartsPicker`, `MorningSummary`) and wrapped with `CheckInLayout` to provide streaks, inline error states, and a clean Save/Cancel footer.
- Local-date helpers keep drafts, submissions, and server streak calculations aligned with the user's timezone (no UTC drift) and broaden the overview lookback window for accurate streaks.
- Drafts auto-save to `localStorage` per date/variant so users can resume; dashboard tiles surface draft state via `components/home/CheckInSlots.tsx`.
- Server helpers in `lib/check-ins/server.ts` centralize Supabase reads/writes, including morning context hydration, prompt generation, and overview aggregation exposed at `/api/check-ins/overview`.
- Submissions post through `app/check-in/actions.ts` server actions, returning optimistic status/conflict flags for the form to handle toasts and redirects, while `/api/check-ins` normalizes payloads and returns precise 4xx errors (e.g., `Invalid check-in payload`) for schema violations.
- Evening flow replays morning context (intention, parts, generated prompt) and persists reflections with link backs to the morning entry via `parts_data`.
- The evening form consolidates "gratitude" and "more notes" into a single "Additional notes" textarea, which is internally split into the appropriate backend fields to maintain API compatibility.

## Data model
- `check_ins` table stores numeric mood/energy scores, textual reflection fields, and JSONB `parts_data.daily_responses` with emoji metadata, generated prompts, and selected part ids

## Configuration
- No special flags by default; uses standard auth/session settings

## Testing
- `npm run test:ui` exercises slot state wiring for the dashboard cards; CI type/lint coverage ensures wizard code stays aligned.

## Operational notes
- Consider rate limiting and UX for repeated submissions; overview endpoint currently scans a 10-day window for streak computation.

## UI/UX notes

### Slider-based Interface (PR #297)
- **Professional sliders**: Replaced emoji button groups with horizontal sliders for mood, energy, and intention ratings
- **Single-page form**: Consolidated multi-step wizard into one page, removing progress bars and review step
- **Simplified inputs**: Evening check-in consolidates "gratitude" and "more notes" into a single "Additional notes" field
- **Accessibility**: Sliders built on Radix UI primitives with full keyboard navigation, ARIA labels, and aria-valuetext for screen readers
- **Visual design**: Clean track and thumb with subtle focus states
- **Backward compatibility**: `EmojiScale` preserved as a wrapper around `SliderScale`, maintaining existing component contracts

### Endpoint Labels & Gradient (PR #301)
- **Endpoint labels**: Each slider now displays descriptive text labels at the left and right ends (e.g., "Running on empty" ← → "Glowing with joy") to clarify what each extreme of the scale represents
  - **Mobile (<768px)**: Shows abbreviated labels (first 1-2 words, max 14 chars) to prevent text overlap on small screens
  - **Desktop (≥768px)**: Shows full descriptive labels extracted from emoji option metadata
  - Labels positioned above the slider track with `text-muted-foreground/70` color for subtle visual hierarchy
  - **Accessibility**: Endpoint labels linked via `aria-describedby` to provide context to screen readers
- **Visual gradient**: Slider range now features a subtle left-to-right gradient from `hsl(var(--primary) / 0.3)` to `hsl(var(--primary) / 1))` to reinforce scale direction
  - Gradient applied only when `useGradient` prop is true (default in check-in flows)
  - Works automatically in both light and dark themes via CSS HSL variables
  - Base `Slider` component accepts optional `withGradient` prop (defaults to false for backward compatibility)
- **Implementation**: 
  - `SliderScale` accepts new optional props: `leftLabel`, `rightLabel`, `useGradient` (defaults to true)
  - `EmojiScale` automatically extracts endpoint labels from first and last `EmojiOption` in the options array
  - Internal `abbreviateLabel` helper derives mobile-friendly short versions without breaking existing APIs

## Mobile Responsiveness (PR #267, PR #298, PR #299, PR #300, PR #301)
- **Dashboard slots** (`CheckInSlots.tsx`): Buttons increased to 52px height with 18px font size and 16px icon size for comfortable thumb tapping on mobile devices
- **Slider scales** (`SliderScale.tsx`): Mobile-first responsive design:
  - **Endpoint labels**: Abbreviated on mobile (<768px) to 1-2 words; full descriptive text on desktop (≥768px)
  - **Label positioning**: Positioned 24px above slider track (`pt-6` on container) to prevent overlap with thumb at extremes
  - **Gradient**: Subtle visual reinforcement of scale direction via CSS gradient on slider range
  - **Accessibility**: Values and endpoints conveyed to screen readers via `aria-valuetext` and `aria-describedby`
- **Spacing and density** (`CheckInExperience.tsx`, `CheckInLayout.tsx`):
  - Scale containers use `gap-3 md:gap-5` for tighter vertical spacing on mobile
  - Card padding reduced to `p-4` on mobile, `md:p-6` on desktop
  - Outer container padding: `p-4 md:p-6 lg:p-10` for progressive density
- **Touch targets**: All interactive elements meet WCAG 2.5.5 AA minimum size guidelines (44×44px)
- **Visual hierarchy**: Cleaner mobile interface with endpoint labels and gradient providing clear context without clutter
