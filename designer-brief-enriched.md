# IFS Chat App - Comprehensive UI/UX Designer Brief

## Executive Summary

The IFS (Internal Family Systems) Therapy Companion is a mobile-first web application designed to support therapeutic practices through daily check-ins, AI-guided conversations, and "parts" management (IFS concept). The app follows a calming, ethereal aesthetic with a teal-gray color palette and features a tab-based navigation system.

**Target Users**: Individuals engaged in IFS therapy or self-exploration, seeking daily emotional check-ins and AI-guided therapeutic conversations.

---

## 1. Visual Design System

### Color Palette

The app uses a sophisticated ethereal theme with teal-gray tones designed for calm, therapeutic interactions.

#### Light Mode

```css
--background: hsl(0 0% 100%) /* Pure white */ --foreground: hsl(240 10% 3.9%) /* Near black */
  --primary: hsl(240 5.9% 10%) /* Dark gray */ --muted: hsl(240 4.8% 95.9%) /* Light gray */
  --border: hsl(240 5.9% 90%) /* Subtle border */;
```

#### Dark Mode (Primary Theme)

```css
--background: hsl(240 10% 10%) /* Deep charcoal */ --foreground: hsl(0 0% 98%) /* Off-white */
  --primary: hsl(240 4.8% 20%) /* Muted dark */ --muted: hsl(240 3.7% 15.9%) /* Darker gray */
  --border: hsl(240 3.7% 15.9%) /* Subtle border */;
```

#### Ethereal Chat Theme (Unique to Chat Interface)

```css
/* Gradient background */
background: linear-gradient(180deg,
  rgba(4,13,16,1) 0%,
  rgba(14,26,30,1) 50%,
  rgba(10,20,22,1) 100%
);
```

`/* Animated gradient blobs /`\
`Blob 1: #1f3a3f (teal-dark) - position: -140px, -80px, size: 520px`\
`Blob 2: #2a4d52 (teal-mid) - position: 140px, 60px, size: 460px`\
`Blob 3: #d39a78 (peach accent) - position: 20px, 180px, size: 620px`

#### *Status Colors (Parts System)*

```
Emerging:     border-l-amber-400    / Yellow-orange - new discovery /
Acknowledged: border-l-blue-400     / Blue - recognized /
Active:       border-l-emerald-400  / Green - currently engaged /
Integrated:   border-l-purple-400   / Purple - fully integrated /
```

#### *Category Colors (IFS Parts)*

```
Manager:      Organized, protective parts
Firefighter:  Reactive, protective parts
Exile:        Wounded, vulnerable parts
Unknown:      Uncategorized parts
```

### *Typography*

***Font Family***\*: Inter (Google Fonts)\*

- *Weights: 100 (Thin), 300 (Light), 400 (Regular), 600 (Semibold)*

- *Letter spacing: Custom ethereal spacing (0 for most text)*

- *Text opacity:*

  - *Assistant messages: 85%*

  - *User messages: 80%*

***Hierarchy***\*:\*

- *H1: Large, bold headings for page titles*

- *Body: Regular weight for most content*

- *Labels: Semibold for form labels and emphasis*

- *Subtle text: Light weight with reduced opacity*

### *Spacing & Layout*

***Mobile-First Constraints***\*:\*

- ***Contrast Target***\*: All primary text/background combinations must meet WCAG 2.1 AA (4.5:1 ratio).\*

- *Maximum width:* `max-w-[52rem]` *(832px) for wider content*

- *Safe area padding:* `env(safe-area-inset-bottom)` *for iOS notches*

- *Touch targets: Minimum 44px for interactive elements*

***Grid System***\*:\*

- *Parts grid: 1 column mobile, 2 columns tablet, 3 columns desktop*

- *Card spacing: 4 units (1rem / 16px)*

- *Content padding: 5 units (1.25rem / 20px)*

### *Animation System*

***Text Streaming*** *(Chat Interface):*

- *Word duration: 150ms per word*

- *Character duration: 8 characters per tick*

- *Stream tick: 150ms intervals*

- *Effect: Word-by-word reveal with subtle fade-in*

***Soft Pulse*** *(Ambient animations):*

```
@keyframes softPulse {
0%, 100%: opacity: 1, transform: scale(1)
50%: opacity: 0.88, transform: scale(1.01)
}
animation: softPulse 3.2s ease-in-out infinite
```

***Transitions***\*:\*

- *Shadow transitions: 200ms duration*

- *Hover states: Subtle shadow changes*

- *Focus states: Soft glow instead of harsh rings*

### *Accessibility Features*

***Focus Styling*** *(Ethereal Approach):*

```
/ NO harsh focus rings - instead use subtle shadows */
.ethereal-focus {
focus: shadow: 0 0 0 1px rgba(255, 255, 255, 0.15)
hover: shadow: 0 0 0 1px rgba(255, 255, 255, 0.1)
}
```

**Other Accessibility**:

- ARIA labels throughout

- Reduced motion support (`prefers-reduced-motion`)

- Screen reader compatibility

- Keyboard navigation (Enter to send, Tab navigation)

- WCAG 2.1 Level AA compliance target

---

## 2. Data Models & User Content

### IFS "Parts" (Core Therapeutic Concept)

Parts are internal sub-personalities identified in IFS therapy. Each part has:

```typescript
Part {
id: UUID
name: string                    // e.g., "The Perfectionist", "Inner Critic"
category: 'manager' | 'firefighter' | 'exile' | 'unknown'
status: 'emerging' | 'acknowledged' | 'active' | 'integrated'
```

`// Visual representation`\
`visualization: {`\
`emoji: string // e.g., "🎭", "🛡️", "😔"`\
`color: string // Hex color`\
`energyLevel: number // 0.0 - 1.0`\
`}`

`// Therapeutic data`\
`role: string // e.g., "Protects me from criticism"`\
`triggers: string[] // e.g., ["public speaking", "deadlines"]`\
`emotions: string[] // e.g., ["anxiety", "fear"]`\
`beliefs: string[] // e.g., ["I must be perfect"]`\
`somatic_markers: string[] // e.g., ["tight chest", "clenched jaw"]`

`// Metadata`\
`evidence_count: number // How many times observed`\
`last_active: timestamp // Last time this part was active`\
`confidence: number // 0.0 - 1.0 (AI confidence)`\
`}`

**Example Parts Data**:

```json
[
{
"name": "The Perfectionist",
"category": "manager",
"status": "active",
"emoji": "🎯",
"role": "Ensures everything is done flawlessly to avoid criticism",
"triggers": ["work presentations", "social events"],
"emotions": ["anxiety", "pressure"],
"evidence_count": 23,
"last_active": "2025-11-08T14:30:00Z"
},
{
"name": "The Procrastinator",
"category": "firefighter",
"status": "acknowledged",
"emoji": "🛋️",
"role": "Protects from overwhelming tasks by avoiding them",
"triggers": ["large projects", "difficult conversations"],
"emotions": ["overwhelm", "avoidance"],
"evidence_count": 15,
"last_active": "2025-11-07T09:15:00Z"
},
{
"name": "Wounded Child",
"category": "exile",
"status": "emerging",
"emoji": "😔",
"role": "Carries feelings of not being good enough",
"triggers": ["rejection", "criticism"],
"emotions": ["sadness", "shame", "loneliness"],
"evidence_count": 8,
"last_active": "2025-11-06T20:45:00Z"
}
]
```

### Daily Check-Ins

**Onboarding Flow Improvement**: Reduce initial sign-up to 3 steps, deferring non-essential profile data to the first check-in to mitigate drop-off.

```typescript
CheckIn {
id: UUID
user_id: UUID
type: 'morning' | 'evening'
date: string                    // ISO date: "2025-11-08"
```

`// Emoji selections (1-5 scale)`\
`mood: string // ID: 'depleted' | 'soft' | 'steady' | 'bright' | 'glowing'`\
`energy: string // ID: 'drained' | 'low' | 'steady' | 'spark' | 'soaring'`\
`intention_focus: string // ID: 'scattered' | 'curious' | 'aimed' | 'committed' | 'grounded'`

`// Free text`\
`intention: string // Morning: "What's your intention for today?"`\
`reflection: string // Evening: "What stood out for you today?"`

`// Selected parts`\
`parts: string[] // Array of part names`\
`}`

**Emoji Scale Options**:

**Mood Scale** (How are you feeling?):

1. 😔 "Running on empty" (depleted)

2. 😕 "Tender but okay" (soft)

3. 🙂 "Steady and present" (steady)

4. 😄 "Bright and open" (bright)

5. 🤩 "Glowing with joy" (glowing)

**Energy Scale** (What's your energy like?):

1. 😴 "Running on fumes" (drained)

2. 😌 "Soft but tired" (low)

3. 🙂 "Steady and grounded" (steady)

4. ⚡️ "Spark of momentum" (spark)

5. 🚀 "Soaring with energy" (soaring)

**Intention Focus Scale** (How clear is your intention?):

1. 😵‍💫 "Still finding focus" (scattered)

2. 🤔 "Curious and exploring" (curious)

3. 🎯 "Clear on my aim" (aimed)

4. 💪 "Committed to follow-through" (committed)

5. 🧘 "Grounded and embodied" (grounded)

**Example Check-In Data**:

```json
{
"type": "morning",
"date": "2025-11-08",
"mood": "steady",
"energy": "spark",
"intention_focus": "aimed",
"intention": "Focus on completing the project proposal and take breaks when I notice The Perfectionist getting activated.",
"parts": ["The Perfectionist", "The Procrastinator"]
}
```

### Chat Messages

The chat interface uses a unique "bubble-less" ethereal design with streaming text.

```typescript
ChatMessage {
id: UUID
role: 'user' | 'assistant'
content: string
timestamp: string
```

`// Optional tool calls (AI functions)`\
`tool_calls?: {`\
`name: string // e.g., "update_part", "create_insight"`\
`arguments: object`\
`}[]`\
`}`

**Example Chat Conversation**:

```
User: "I'm feeling really anxious about my presentation tomorrow."
User: "I'm feeling really anxious about my presentation tomorrow."
```

UI Examples and Data Structures for Designer Brief

Key React Components with Actual Interfaces

- Check-In Interfaces

EmojiScale Component

File: components/check-in/EmojiScale.tsx

interface EmojiScaleProps {\
label: string;\
options: EmojiOption\[\];\
value: string;\
onChange: (value: string) =&gt; void;\
description?: string;\
}

interface EmojiOption {\
id: string;\
emoji: string;\
label: string;\
score: number;\
}

Example Mood Scale Options:

MOOD*OPTIONS: EmojiOption\[\] = \[ { id: 'depleted', emoji: '😔', label: 'Running on empty', score: 1 }, { id: 'soft', emoji: '😕', label: 'Tender but okay', score: 2 }, { id: 'steady', emoji: '🙂', label: 'Steady and present', score: 3 }, { id: 'bright', emoji: '😄', label: 'Bright and open', score: 4 }, { id: 'glowing', emoji: '🤩', label: 'Glowing with joy', score: 5 }, \]*

*Example Energy Scale Options:*

*ENERGY*OPTIONS: EmojiOption\[\] = \[ { id: 'drained', emoji: '😴', label: 'Running on fumes', score: 1 }, { id: 'low', emoji: '😌', label: 'Soft but tired', score: 2 }, { id: 'steady', emoji: '🙂', label: 'Steady and grounded', score: 3 }, { id: 'spark', emoji: '⚡️', label: 'Spark of momentum', score: 4 }, { id: 'soaring', emoji: '🚀', label: 'Soaring with energy', score: 5 }, \]

Example Intention Focus Options:

INTENTION*FOCUS*OPTIONS: EmojiOption\[\] = \[ { id: 'scattered', emoji: '😵‍💫', label: 'Still finding focus', score: 1 }, { id: 'curious', emoji: '🤔', label: 'Curious and exploring', score: 2 }, { id: 'aimed', emoji: '🎯', label: 'Clear on my aim', score: 3 }, { id: 'committed', emoji: '💪', label: 'Committed to follow-through', score: 4 }, { id: 'grounded', emoji: '🧘', label: 'Grounded and embodied', score: 5 }, \]

CheckInExperience Component

File: components/check-in/CheckInExperience.tsx

Morning Form Structure:

OPTIONS} value={state.mood} onChange={(value) =&gt; setState((prev) =&gt; ({ ...prev, mood: value }))} /&gt; OPTIONS} value={state.energy} onChange={(value) =&gt; setState((prev) =&gt; ({ ...prev, energy: value }))} /&gt; FOCUSOPTIONS} value={state.intentionFocus} onChange={(value) =&gt; setState((prev) =&gt; ({ ...prev, intentionFocus: value }))} /&gt;

setState((prev) =&gt; ({ ...prev, intention: event.target.value }))} rows={3} required /&gt; setState((prev) =&gt; ({ ...prev, mindForToday: event.target.value }))} rows={3} /&gt;

**Data Model for Check-In Entry**:

```typescript
// Morning Entry { type: 'morning', mood: 'steady', // matches MOODOPTIONS id energy: 'steady', // matches ENERGYOPTIONS id intentionFocus: 'committed', // matches INTENTIONFOCUSOPTIONS id mindForToday: 'Upcoming conversations, hopes, or worries', intention: 'Stay grounded and curious', parts: ['part-id-1', 'part-id-2'] // references to PartOption ids } 
```

`// Evening Entry`\
`{`\
`type: 'evening',`\
`mood: 'bright',`\
`energy: 'low',`\
`intentionFocus: 'grounded',`\
`reflection: 'What stood out for you today?',`\
`gratitude: 'Additional notes',`\
`moreNotes: 'More notes',`\
`parts: ['part-id-1', 'part-id-2']`\
`}`

### 2. Chat Interfaces

#### EtherealChat Component

**File**: `components/ethereal/EtherealChat.tsx`

**Interface Structure**:

```jsx
// Chat bubble styling
```

`18px50pxrgba(5,15,20,0.35)]" : "bg-white/8 border-white/12 text-white/85 shadow-[012px36pxrgba(5,5,10,0.25)]", isStreaming && isAssistant ? "border-white/35 shadow-[0042pxrgba(180,220,255,0.35)] animate-softPulse" : undefined )}`

`// Input styling`

#### EtherealMessageList Component

**File**: `components/ethereal/EtherealMessageList.tsx`

**Message Structure**:

```typescript
interface EtherealMessageListProps { 
```

`messages: Message[]`\
`uiMessages: UIMessage[]`\
`tasksByMessage: Record`\
`currentStreamingId?: string`\
`}`

`// Message bubble with tasks example`\
`{isAssistant && tasks?.length ? (`\
\
`) : null}`

### 3. Garden/Parts Management Interfaces

#### PartsList Component

**File**: `components/garden/PartsList.tsx`

**Part Card Structure**:

```jsx
href={/garden/${part.id}}
className={cn(
'group relative block rounded-lg border-l-4 transition-all duration-200 backdrop-blur',
'hover:shadow-lg hover:border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
'hover:scale-105 origin-top-left',
statusStyle.background,
statusStyle.border,
accentColor
)}
```

> 

`{/ Category Pill - Top Right /}`

`{part.category}`

`{/ Card Content /}`

`{/ Emoji with Evidence Badge /}`

`{emoji} {part.evidencecount > 0 && (`

`{part.evidencecount}`

`)}`

```
{/ Part Name /} 
```

### `{part.name}`

`{/ Role/Purpose if available /} {role && (`

`“ {role} ”`

`)} {/ Status Description /}`

`{statusStyle.description}`

`{/ Evidence + Freshness /}`

`Built from {part.evidencecount} observation{part.evidencecount === 1 ? '' : 's'}`

`{freshness.emoji} {freshness.label}`

#### *PartCard Component*

***File***\*:\* `components/garden/PartCard.tsx`

***Simple Part Card***\*:\*

```
INLINECODE0} className="group relative block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" aria-label={INLINECODE1} >   {emoji}  {part.name}  
```

***Part Data Structure***\*:\*

```
interface PartRow { id: string; name: string; category: 'manager' | 'firefighter' | 'exile' | 'unknown'; status: 'emerging' | 'acknowledged' | 'active' | 'integrated'; lastactive: string | null; evidencecount: number; data: { emoji?: string; role?: string } | null; } 
```

`interface PartOption {`\
`id: string;`\
`name: string;`\
`emoji: string | null;`\
`}`

### *4. Login/Signup and Onboarding Components*

#### *Login Form*

***File***\*:\* `components/auth/login-form.tsx`

***Ethereal Styling***\*:\*

```
```

`Login`

`Enter your email below to login to your account`

***Eth Text Style Configuration***\*:\*

```
const etherealTextStyle = {
letterSpacing: 'var(--eth-letter-spacing-user)',
color: 'rgba(255,255,255,var(--eth-user-opacity))',
};
```

#### *Onboarding Page*

***File***\*:\* `app/onboarding/page.tsx`

***Onboarding Interface***\*:\*

```
className="mx-auto max-w-2xl px-4 py-10"
style={{ letterSpacing: 'var(--eth-letter-spacing-user)' }}
```

> 

# `onboarding`

`let's get to know your system. this short, kind check-in helps tailor your support.`

### *5. Actual Sample Data Structures*

#### *Inbox Mock Data*

***File***\*:\* `lib/inbox/mockData.ts`

```
export const mockInboxEnvelopes: InboxEnvelope[] = [ { id: 'mock-insight-spotlight-1', sourceId: 'mock-insight-spotlight-1', type: 'insightspotlight', createdAt: new Date().toISOString(), updatedAt: null, readAt: null, expiresAt: null, source: 'fallback', priority: 10, tags: ['sample', 'dev'], actions: { kind: 'scale4', agreeStrongLabel: 'Agree a lot', agreeLabel: 'Agree a little', disagreeLabel: 'Disagree a little', disagreeStrongLabel: 'Disagree a lot', helperText: 'How true does this feel right now?', allowNotes: true, }, payload: { insightId: 'mock-insight-1', title: 'Your parts are most talkative after evening reflections', summary: 'In the past week you logged the most breakthroughs when reflecting between 8–9pm. Matching that rhythm could improve tomorrow's check-in.', readingTimeMinutes: 2, detail: { body: INLINECODE2, sources: [ { label: 'Reflection log • 7 entries', url: '/journal' }, { label: 'Insight archive', url: '/insights' }, ], }, cta: { label: 'Open insight', href: '/insights/mock-insight-1', intent: 'primary', }, }, }, ]
```

#### Onboarding Test Fixtures

**File**: `lib/dev/fixtures.ts`

**Sample Questions**:

```typescript
export const DEVSTAGE2QUESTIONBANK: OnboardingQuestion[] = [ { id: 'S2Q1', stage: 2, type: 'singlechoice', prompt: 'When facing a challenging task, I tend to:', helper: null, options: [ { value: 'procrastinate', label: 'Put it off until later' }, { value: 'divein', label: 'Jump right in immediately' }, { value: 'planextensively', label: 'Plan extensively before starting' }, { value: 'seekhelp', label: 'Ask others for guidance' }, ], active: true, locale: 'en', orderhint: 1, themeweights: { anxiety: 0.8, perfectionism: 0.6 }, }, { id: 'S2Q2', stage: 2, type: 'singlechoice', prompt: 'When I make a mistake, I usually:', helper: 'Think about your typical emotional response', options: [ { value: 'brushoff', label: 'Brush it off and move on' }, { value: 'learnfromit', label: 'Try to learn from it' }, { value: 'criticizeself', label: 'Criticize myself harshly' }, { value: 'blameothers', label: 'Look for external causes' }, ], active: true, locale: 'en', orderhint: 2, themeweights: { self_criticism: 0.9 }, }, ];
```

### 6. Theme Styling and CSS

#### Ethereal Theme Configuration

**File**: `config/etherealTheme.ts`

```typescript
export const defaultEtherealTheme: EtherealTheme = { enabled: true, imageUrl: '/ethereal-bg.jpg', vignette: { inner: 0.1, mid: 0.22, outer: 0.38 }, blobs: [ { x: -140, y: -80, size: 520, color: '#1f3a3f' }, { x: 140, y: 60, size: 460, color: '#2a4d52' }, { x: 20, y: 180, size: 620, color: '#d39a78' }, ], fontFamilyVar: '--font-ethereal', text: { assistantOpacity: 0.85, userOpacity: 0.8, letterSpacingAssistant: '0', letterSpacingUser: '0', }, animation: { wordDurationMs: 35, charDurationMs: 4, streamTickMs: 150, streamCharsPerTick: 8, }, variants: { chat: { gradient: 'linear-gradient(180deg, rgba(4,13,16,1) 0%, rgba(14,26,30,1) 50%, rgba(10,20,22,1) 100%)', }, }, };
```

#### Tailwind Configuration

**File**: `config/tailwind.config.js`

```javascript
module.exports = { theme: { extend: { keyframes: { softPulse: { '0%, 100%': { opacity: '1', transform: 'scale(1)' }, '50%': { opacity: '0.88', transform: 'scale(1.01)' }, }, }, animation: { softPulse: 'softPulse 3.2s ease-in-out infinite', }, }, }, };
```

#### Global CSS Focus Styles

**File**: `app/globals.css`

```css
@layer components { / Ethereal focus styles - override default harsh focus rings / .ethereal-focus { @apply focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:ring-0 focus:border-0; @apply focus:shadow-[var(--ethereal-focus-shadow)] hover:shadow-[var(--ethereal-hover-shadow)]; @apply transition-shadow duration-200; } 
```

`/ Apply ethereal focus to common form elements /`\
`input[type='text'],`\
`input[type='email'],`\
`input[type='password'],`\
`input[type='search'],`\
`input[type='url'],`\
`input[type='tel'],`\
`input[type='number'],`\
`textarea,`\
`select {`\
`@apply ethereal-focus;`\
`}`\
`}`

## Key UI Patterns for Designers

### 1. Ethereal Chat Interface

- **Glassmorphism**: `backdrop-blur-xl` with translucent backgrounds

- **Organic Shapes**: Rounded corners with `rounded-[28px]` instead of standard rounding

- **Ambient Animation**: Subtle pulsing effects with `animate-softPulse`

- **Gradient Overlays**: Multiple blurred blob elements in teal-gray color palette

- **Typography Contrast**: User text at 80% opacity, assistant at 85% opacity

### 2. Check-In Interfaces

- **Emoji Scales**: 5-point scales with custom emoji representations

- **Form Sections**: Clear separation with `Separator` components

- **Validation States**: Real-time validation with error messages

- **Draft Saving**: Auto-save functionality to localStorage

- **Time-based Availability**: Morning check-ins available 4AM-6PM, evening 6PM-4AM

### 3. Parts Management

- **Category System**: Four categories (manager, firefighter, exile, unknown)

- **Status System**: Four states (emerging, acknowledged, active, integrated)

- **Color Coding**: Each status has associated accent colors

- **Evidence Counting**: Badge system showing number of supporting observations

- **Freshness Indicators**: "Just now", "a few hours ago", "yesterday" etc.

### 4. Mobile Considerations

- **Safe Areas**: iOS notch and home indicator support

- **Touch Targets**: Minimum 48px height for interactive elements

- **Responsive Typography**: Dynamic text sizing based on screen size

- **Gesture Support**: Swipe-to-dismiss and pull-to-refresh patterns

### 5. Theme System

- **Custom Properties**: CSS variables for consistent theming

- **Ethereal Focus**: Soft, non-intrusive focus states

- **Vignetting**: Darkened edges to draw focus to center content

- **Animated Backgrounds**: Moving blurred shapes for ambient atmosphere

- **Text Spacing**: Custom letter-spacing for assistant vs user text

This comprehensive overview shows the actual UI patterns, data structures, and styling approaches used throughout the application. The ethereal theme emphasizes soft, translucent interfaces with ambient animations and organic shapes throughout the user experience.