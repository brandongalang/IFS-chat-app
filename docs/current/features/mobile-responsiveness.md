# Mobile Responsiveness

## Overview

This document outlines the mobile responsiveness improvements made to the IFS Therapy Companion app. The primary goal was to ensure the app renders correctly on mobile devices (especially the Google Pixel 9 Pro, 412×915px viewport) with proper viewport settings, touch-friendly interactions, and safe-area support for notched devices.

## Problem Statement

The app was not mobile-friendly due to:
- Missing viewport meta tag causing mobile browsers to render at desktop width
- Touch targets smaller than the recommended 44×44px minimum
- Chat interface not optimized for mobile ergonomics
- No safe-area inset support for devices with notches/home indicators
- Fixed viewport heights not accounting for dynamic mobile browser UI

## Solution

### 1. Viewport Configuration (`app/layout.tsx`)

Added proper viewport configuration using Next.js 15's `Viewport` type:

```typescript
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}
```

**Impact**: Mobile browsers now render the app at the correct device width instead of scaling down a desktop view.

### 2. Safe-Area Utilities (`app/globals.css`)

Added CSS utilities to handle safe areas on devices with notches or home indicators:

```css
@supports (padding: env(safe-area-inset-bottom)) {
  .pb-safe {
    padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
  }
  .pt-safe {
    padding-top: max(0.5rem, env(safe-area-inset-top));
  }
}
```

**Impact**: Bottom navigation and input areas respect device safe zones, preventing overlap with device UI elements.

### 3. Chat Interface Improvements (`components/ethereal/EtherealChat.tsx`)

#### Enhanced Touch Targets
- **Send button**: Increased from `h-9` to `min-h-11 h-11 min-w-11` (44×44px minimum)
- **End session button**: Increased from `h-9` to `min-h-11 h-11` with `px-4` for comfortable tapping
- Added `active:scale-95 transition-transform` for tactile feedback

#### Mobile-Optimized Layout
- Chat page now locks its viewport height with a `useLockedViewportHeight` hook (`app/chat/page.tsx`), holding the layout to the largest measured `visualViewport.height` so the on-screen keyboard can overlap without forcing the conversation to jump upward.
- Fallbacks to `100vh` ensure older browsers without `VisualViewport` support keep working.
- Added `overscroll-contain` to prevent rubber-banding on iOS
- Increased bottom padding from `pb-[120px]` to `pb-[140px]` to accommodate larger touch targets

#### Typography
- Textarea maintains `text-[16px]` to prevent iOS auto-zoom on focus
- Button text increased from `text-[11px]` to `text-xs` for better readability

### 4. Bottom Navigation (`components/nav/BottomTabs.tsx`)

#### Touch Target Improvements
- Tab links increased from `min-h-[56px]` to `min-h-14` (56px)
- Icons increased from `w-5 h-5` to `w-6 h-6` for better visibility
- Labels explicitly set to `text-xs` for consistency

#### Safe-Area Support
- Navigation container now uses `pb-safe` class instead of `pb-2`
- Properly respects safe-area-inset-bottom on devices with home indicators

### 5. Check-In Buttons (`components/home/CheckInSlots.tsx`)

- Begin/Resume buttons increased to `min-h-12 py-3` (48px height)
- GuardedLink wrapper now `w-full` to ensure full-width tap target
- Maintains responsive grid layout (single column on mobile, 2 columns on md+)

### 6. Check-In Emoji Slider Scales (`components/check-in/SliderScale.tsx`)

#### Mobile-First Label Strategy
- **Problem**: Multi-word tick labels (e.g., "Running on empty", "Bright and open") created text overlap and visual clutter on mobile screens
- **Solution**: Progressive disclosure pattern
  - **Mobile (<768px)**: Hide all tick labels; display only the currently selected label below the slider
  - **Desktop (≥768px)**: Show selected label inline in header; display all tick labels below slider track

#### Implementation Details
- Selected label container:
  - Mobile: `mt-1 text-center text-base font-medium transition-opacity duration-200 md:hidden`
  - Uses `key={value}` to trigger React re-render on selection change, creating smooth fade effect
  - `role="status"` and `aria-live="polite"` for accessibility
- Tick labels: `hidden md:flex` to hide on mobile, show on desktop
- Slider padding adjusted: `pb-3 md:pb-6` to reduce mobile footprint

#### Benefits
- ✓ Eliminates text overlap on small screens
- ✓ Reduces visual noise—users focus on the slider itself
- ✓ Maintains full context on desktop where space allows
- ✓ Smooth transitions provide tactile feedback
- ✓ Screen readers announce selection changes on all devices

### 7. Locked Viewport Height (`app/chat/page.tsx`)

Replaced the prior `100dvh` approach with a runtime hook (`useLockedViewportHeight`) that records the largest visual viewport height and reapplies it while the keyboard is visible. Orientation changes reset the lock, while browsers without `VisualViewport` gracefully fall back to `100vh`. This keeps the chat page anchored when the composer receives focus on mobile.

### 8. Check-In Layout Density (`components/check-in/CheckInLayout.tsx`)

- Card padding: `p-4 md:p-6` (16px mobile, 24px desktop)
- Outer container: `p-4 md:p-6 lg:p-10` (16px → 24px → 40px)
- Progressive density allows more content width on mobile without feeling cramped

## Code Paths

The following files were modified:

- `app/layout.tsx` - Added viewport configuration
- `app/globals.css` - Added safe-area utility classes
- `app/chat/page.tsx` - Updated to use dynamic viewport height
- `components/ethereal/EtherealChat.tsx` - Improved mobile ergonomics and touch targets
- `components/nav/BottomTabs.tsx` - Enhanced navigation with proper safe-area support
- `components/home/CheckInSlots.tsx` - Increased button tap targets
- `components/check-in/SliderScale.tsx` - Mobile-first label display with progressive disclosure
- `components/check-in/CheckInExperience.tsx` - Responsive spacing between scales
- `components/check-in/CheckInLayout.tsx` - Progressive padding density

## Testing

### Pixel 9 Pro Emulation (Chrome DevTools)

Test the following in Chrome DevTools with device emulation (Pixel 9 Pro, 412×915px):

1. **Viewport Rendering**
   - ✓ Page renders at device width (no tiny desktop view)
   - ✓ No horizontal scrolling
   - ✓ Text is readable without zooming

2. **Touch Targets**
   - ✓ All buttons and links are ≥44×44px
   - ✓ Chat send/end buttons are easy to tap
   - ✓ Bottom navigation tabs are comfortably sized
   - ✓ Check-in action buttons have adequate tap areas

3. **Chat Interface**
   - ✓ Input area is accessible and not obscured by keyboard
   - ✓ Messages remain visible while typing; keyboard overlay no longer forces the conversation to jump upward
   - ✓ Scrolling is smooth with overscroll-contain
   - ✓ Textarea doesn't trigger iOS zoom (16px font-size)

4. **Safe Areas**
   - ✓ Bottom navigation respects safe-area-inset-bottom
   - ✓ Chat input respects safe-area-inset-bottom
   - ✓ No content clipped by device notch or home indicator

5. **Orientation**
   - ✓ Layout adapts correctly in portrait
   - ✓ Layout adapts correctly in landscape
   - ✓ Safe areas respected in both orientations

### Real Device Testing

For final validation, test on an actual Google Pixel 9 Pro:

1. Navigate to the home page and verify check-in buttons are easily tappable
2. Test chat interface:
   - Type messages and verify keyboard doesn't obscure input
   - Test send and end session buttons
   - Verify scrolling performance
3. Navigate using bottom tabs and confirm all tabs are responsive
4. Rotate device and verify layout adapts correctly

## Accessibility Considerations

- All interactive elements meet WCAG 2.1 Level AA minimum touch target size (44×44px)
- Focus states are properly styled for keyboard navigation
- ARIA labels are preserved on navigation items
- Color contrast ratios maintained for readability

## Performance Impact

- Minimal: Only CSS class changes and viewport meta additions
- No JavaScript performance impact
- Safe-area CSS uses feature detection with `@supports`

## Future Improvements

Potential enhancements for mobile experience:

1. Add gesture support for swipe navigation
2. Implement pull-to-refresh on content pages
3. Optimize font sizes and line-heights specifically for mobile
4. Add haptic feedback for button interactions (where supported)
5. Consider implementing a progressive web app (PWA) manifest

## Related Documents

- [Chat Feature](./chat.md)
- [Check-In Feature](./check-ins.md)
- [Navigation](./navigation.md)

## Last Updated

2025-01-11

## Related PRs

- #267 - Initial mobile responsiveness improvements
- #298 - Check-in slider scales mobile-first redesign
