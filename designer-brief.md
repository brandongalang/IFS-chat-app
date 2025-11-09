# IFS Chat App - UI/UX Designer Brief

## Executive Summary

The IFS (Internal Family Systems) Therapy Companion is a mobile-first web application designed to support therapeutic practices through daily check-ins, AI-guided conversations, and "parts" management (IFS concept). The app follows a calming, ethereal aesthetic with a teal-gray color palette and features a tab-based navigation system.

## Core Architecture & Technology Stack

- **Framework**: Next.js 14 with App Router

- **Styling**: Tailwind CSS with shadcn/ui component library

- **State Management**: Context-based (UserContext, chat state)

- **Authentication**: Supabase integration

- **Database**: PostgreSQL with Supabase

- **AI Integration**: Custom chat streaming with AI personas

- **Theme System**: Dual theme support (light/dark) with ethereal variations

## User Flows & Navigation

### Primary Navigation (Bottom Tabs)

1. **Today** (/) - Dashboard with morning/evening check-ins

2. **Chat** (/chat) - AI therapy companion with ethereal theme

3. **Garden** (/garden) - "Parts" management system

### Authentication Flow

- Sign-up → Onboarding questionnaire → Profile completion

- Demo mode available for development/testing

- Password recovery and account management

### Check-in Flow

Morning Check-in → Daily Intention → Parts Selection → Evening Reflection

- Emoji-based mood tracking (mood, energy, intention focus)

- Free-text intention setting and reflection

- Parts-based awareness (managers, firefighters, exiles)

- Auto-saves draft to localStorage

### Chat Flow

- Ethereal, "bubble-less" conversation design

- Real-time streaming responses

- Session management with explicit "end session" functionality

- Context transfer from inbox items

## Visual Design System

### Color Palette

**Primary**: Teal-gray ethereal theme

- Background: `hsl(240 10% 10%)` (dark), `hsl(0 0% 100%)` (light)

- Primary: `hsl(240 5.9% 10%)` (light), `hsl(240 4.8% 20%)` (dark)

- Teal accents: `#1f3a3f`, `#2a4d52`, `#d39a78` (peach accent)

### Typography

- Font: Inter with weight variants `[100, 300, 400, 600]`

- Letter spacing: Custom ethereal spacing with CSS variables

- Animated text reveal for AI responses

### Spacing & Layout

- Mobile-first responsive design

- Safe area support for iOS notches (`env(safe-area-inset-bottom)`)

- Maximum width constraints (`max-w-md`, `max-w-[52rem]`)

- Backdrop blur for glassmorphism effects

### Animation System

- Framer Motion integration

- Word-by-word text streaming (150ms per word, 8 chars per tick)

- Gradient blob animations with accessibility support

- Subtle hover states and transitions

## Component Library Overview

### Core UI Components (shadcn/ui)

- Button (6 variants: default, destructive, outline, secondary, ghost, link)

- Form system with react-hook-form integration

- Modal system (Dialog, Sheet, Drawer)

- Navigation (Tabs, Menubar, Breadcrumb)

- Data display (Card, Table, Chart)

- Input controls (Slider, Switch, Select, Checkbox, Radio)

- Layout (Skeleton, Progress, Separator, Badge, Avatar)

### Custom Components

**Navigation**

- BottomTabs: Fixed bottom navigation with active states

- PageContainer: Consistent content padding

- GuardedLink: Route protection wrapper

**Chat System**

- EtherealChat: Main chat interface with streaming

- EtherealMessageList: Message rendering

- StreamingText: Animated text display

- Tool components: AI function display

**Check-in System**

- CheckInExperience: Multi-step wizard

- EmojiScale: Mood/energy selection

- PartsPicker: Multiple selection component

- Slider-based rating scales

**Inbox System**

- InboxShelf: Notification feed

- Card-based notification system

- CTA and quick action handling

- Deep linking to chat context

**Garden System**

- PartsList: Filterable grid of "parts"

- Parts filtering by category

- Evidence counters and freshness indicators

- Status-based styling (emerging, acknowledged, active, integrated)

## Data Models

### Core Entities

```typescript
// User session and profiles
UserProfile: {
  (id, name, avatar_url, created_at, updated_at);
}
```

`// Daily check-ins`\
`CheckIn: {`\
`id, user_id, type ('morning' | 'evening'), date,`\
`mood, energy, intention_focus, intention, reflection`\
`}`

`// IFS "Parts" (therapeutic concept)`\
`Part: {`\
`id, name, category ('manager' | 'firefighter' | 'exile' | 'unknown'),`\
`status ('emerging' | 'acknowledged' | 'active' | 'integrated'),`\
`last_active, evidence_count, data: {emoji, role}`\
`}`

`// Chat messages and sessions`\
`ChatSession: { id, user_id, messages[], is_active }`

`// Inbox and notifications`\
`InboxEnvelope: {`\
`id, type ('insight_spotlight' | 'nudge' | 'notification' | 'cta'),`\
`payload, read_status, created_at`\
`}`

## Key UX Patterns

### Mobile-First Patterns

- Thumb-reachable bottom navigation

- Safe area padding for notches

- Touch-friendly interactive areas (min 44px)

- Contextual back navigation

### Accessibility Features

- ARIA labels and roles throughout

- Reduced motion support

- Focus-visible styling

- Screen reader support

- Keyboard navigation (Enter to send, etc.)

### Loading & Empty States

- Skeleton loaders during data fetching

- Empty state messages with friendly copy

- Retry mechanisms for failed requests

- Offline draft saving (localStorage)

### Error Handling

- Form validation with inline feedback

- Toast notifications for user feedback

- Graceful degradation for failed requests

- Debug information overlay (dev mode)

## Design Challenges & Opportunities

### Current Pain Points

1. **Information Density**: High cognitive load on Today page

2. **Ethereal Theme Legibility**: Low contrast ratios on some elements

3. **Long Wizard Flow**: Multi-step onboarding may cause drop-off

4. **Notification Overwhelm**: Inbox system could become cluttered. Define clear triage logic: Insights (high-priority), Nudges (medium), System Alerts (low).

### Potential Improvements

1. **Progressive Disclosure**: Break complex flows into digestible steps

2. **Personalized Theming**: User-selectable color schemes beyond light/dark

3. **Microinteractions**: More feedback on user actions

4. **Typography Scaling**: Better readability for accessibility

5. **Layout Adaptability**: Responsive changes beyond mobile-first

### Brand Opportunities

1. **Calming Aesthetic**: Ethereal gradients and soft animations

2. **Gamification**: Streak system integration

3. **Personalization**: Emoji-based part representations

4. **Contextual AI**: Smart suggestions based on patterns

## Technical Constraints

### Performance Requirements

- First load on mobile (&lt; 3G network)

- Smooth 60fps animations

- Efficient bundle splitting

- Progressive enhancement for old browsers

### Browser Support

- Modern Chrome, Safari, Firefox

- iOS Safari with safe area support

- Android Chrome with viewport handling

- Progressive Web App capabilities

### Accessibility Standards

- WCAG 2.1 Level AA compliance

- Screen reader compatibility

- Keyboard-only navigation

- High contrast mode support

## Deliverables Needed

### High-Fidelity Mockups

1. **Today Page Redesign**: Information hierarchy improvement

2. **Chat Interface**: Enhanced readability while maintaining ethereal theme

3. **Check-in Flows**: Streamlined multi-step experience

4. **Garden Grid**: Improved part browsing and discovery

5. **Inbox Management**: Better notification handling patterns

### Design System Extensions

1. **Color Palette**: Expand contrast-friendly colors

2. **Typography Scale**: Better size and weight relationships

3. **Spacing System**: Consistent spacing across components

4. **Animation Guidelines**: Microinteractions and transitions

### Prototype Requirements

1. **Interactive Flows**: Click-through prototypes for key journeys

2. **Responsive Designs**: Mobile, tablet, desktop breakpoints

3. **Theme Variations**: Light/dark/ethereal theme applications

4. **Accessibility Testing**: Color contrast and usability validation

## Success Metrics

### UX Metrics

- Task completion rates (onboarding, check-ins)

- Time-to-first-value for new users

- Session duration and frequency

- Error rates and user feedback quality

### Business Metrics

- User engagement and retention

- Daily active users

- Check-in completion rates

- Chat session engagement

### Technical Metrics

- Page load performance

- Animation frame rates

- Touch responsiveness

- Cross-browser compatibility

---

This brief provides a foundation for redesigning the IFS app's user experience while maintaining its core therapeutic value and technical architecture. The goal is to enhance usability, accessibility, and visual appeal while preserving the calming, supportive nature essential for a mental health application.
