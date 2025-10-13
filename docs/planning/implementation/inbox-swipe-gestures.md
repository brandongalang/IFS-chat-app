# Swipe Gestures for Web Inbox

## Technical Feasibility

Yes, swipe gestures work on web apps! Modern approaches:

### 1. Touch Events API (Native)

```typescript
let startX = 0;
let currentX = 0;

element.addEventListener('touchstart', (e) => {
  startX = e.touches[0].clientX;
});

element.addEventListener('touchmove', (e) => {
  currentX = e.touches[0].clientX;
  const diff = currentX - startX;

  // Visual feedback during swipe
  element.style.transform = `translateX(${diff}px)`;
});

element.addEventListener('touchend', (e) => {
  const diff = currentX - startX;

  if (Math.abs(diff) > 100) {
    // Threshold
    if (diff > 0) {
      handleAgree();
    } else {
      handleDisagree();
    }
  } else {
    // Snap back
    element.style.transform = 'translateX(0)';
  }
});
```

### 2. Framer Motion (Recommended)

```tsx
import { motion, useMotionValue, useTransform } from 'framer-motion';

function SwipeableCard({ onSwipeRight, onSwipeLeft }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      style={{ x, rotate, opacity }}
      onDragEnd={(e, { offset, velocity }) => {
        const swipe = Math.abs(offset.x) * velocity.x;

        if (swipe > 10000) {
          if (offset.x > 0) {
            onSwipeRight();
          } else {
            onSwipeLeft();
          }
        }
      }}
    >
      {/* Card content */}
    </motion.div>
  );
}
```

### 3. React-Swipeable (Library)

```tsx
import { useSwipeable } from 'react-swipeable';

function InboxCard() {
  const handlers = useSwipeable({
    onSwipedLeft: () => handleDisagree(),
    onSwipedRight: () => handleAgree(),
    trackMouse: true, // Also works with mouse drag on desktop
  });

  return <div {...handlers}>{/* Card content */}</div>;
}
```

## UX Considerations

### Visual Feedback During Swipe

- Card tilts/rotates slightly
- Background color shifts (green for agree, red for disagree)
- Icons appear on sides (✓ on right, ✗ on left)

### Desktop Fallback

- Mouse drag also works with trackMouse option
- Buttons remain visible for non-touch devices
- Keyboard shortcuts (arrow keys) as additional option

### Accessibility

- Always provide button alternatives
- Announce swipe actions to screen readers
- Ensure gesture is not the only way to interact

## Implementation Challenges

1. **Conflict with scroll**: Need to detect horizontal vs vertical intent
2. **Performance**: Use CSS transforms, not position changes
3. **Browser compatibility**: Touch events well supported, but test on iOS Safari
4. **Discoverability**: Users might not know they can swipe

## Hybrid Approach Recommendation

Combine swipe with visible UI:

- Cards are swipeable on touch devices
- Buttons visible but subtle (fade in on hover/tap)
- First-time hint animation showing swipe is possible
- Settings option to disable swipe if user prefers buttons
