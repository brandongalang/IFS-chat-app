# UI Examples and Data Structures for Designer Brief

## Key React Components with Actual Interfaces

### 1. Check-In Interfaces

#### EmojiScale Component

**File**: `components/check-in/EmojiScale.tsx`

```typescript
interface EmojiScaleProps {
  label: string;
  options: EmojiOption[];
  value: string;
  onChange: (value: string) => void;
  description?: string;
}
```

`interface EmojiOption {`\
`id: string;`\
`emoji: string;`\
`label: string;`\
`score: number;`\
`}`

**Example Mood Scale Options**:

```javascript
MOOD_OPTIONS: EmojiOption[] = [
{ id: 'depleted', emoji: '😔', label: 'Running on empty', score: 1 },
{ id: 'soft', emoji: '😕', label: 'Tender but okay', score: 2 },
{ id: 'steady', emoji: '🙂', label: 'Steady and present', score: 3 },
{ id: 'bright', emoji: '😄', label: 'Bright and open', score: 4 },
{ id: 'glowing', emoji: '🤩', label: 'Glowing with joy', score: 5 },
]
```

**Example Energy Scale Options**:

```javascript
ENERGY_OPTIONS: EmojiOption[] = [
{ id: 'drained', emoji: '😴', label: 'Running on fumes', score: 1 },
{ id: 'low', emoji: '😌', label: 'Soft but tired', score: 2 },
{ id: 'steady', emoji: '🙂', label: 'Steady and grounded', score: 3 },
{ id: 'spark', emoji: '⚡️', label: 'Spark of momentum', score: 4 },
{ id: 'soaring', emoji: '🚀', label: 'Soaring with energy', score: 5 },
]
```

**Example Intention Focus Options**:

```javascript
INTENTION_FOCUS_OPTIONS: EmojiOption[] = [
{ id: 'scattered', emoji: '😵‍💫', label: 'Still finding focus', score: 1 },
{ id: 'curious', emoji: '🤔', label: 'Curious and exploring', score: 2 },
{ id: 'aimed', emoji: '🎯', label: 'Clear on my aim', score: 3 },
{ id: 'committed', emoji: '💪', label: 'Committed to follow-through', score: 4 },
{ id: 'grounded', emoji: '🧘', label: 'Grounded and embodied', score: 5 },
]
```

#### CheckInExperience Component

**File**: `components/check-in/CheckInExperience.tsx`

**Morning Form Structure**:

```jsx
 setState((prev) => ({ ...prev, mood: value }))}
/>
 setState((prev) => ({ ...prev, energy: value }))}
/>
 setState((prev) => ({ ...prev, intentionFocus: value }))}
/>
```

`setState((prev) => ({ ...prev, intention: event.target.value }))} rows={3} required /> setState((prev) => ({ ...prev, mindForToday: event.target.value }))} rows={3} />`

**Data Model for Check-In Entry**:

```typescript
// Morning Entry { type: 'morning', mood: 'steady', // matches MOOD_OPTIONS id energy: 'steady', // matches ENERGY_OPTIONS id intentionFocus: 'committed', // matches INTENTION_FOCUS_OPTIONS id mindForToday: 'Upcoming conversations, hopes, or worries', intention: 'Stay grounded and curious', parts: ['part-id-1', 'part-id-2'] // references to PartOption ids } 
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

`// Input styling`

`` </code></pre><h4>EtherealMessageList Component</h4><p><strong>File</strong>: <code class="rounded-md bg-muted px-1.5 py-1 font-mono text-sm" spellcheck="false">components/ethereal/EtherealMessageList.tsx</code></p><p><strong>Message Structure</strong>:</p><pre class="rounded-md border bg-muted p-4 font-mono text-sm overflow-x-auto"><code class="language-typescript">interface EtherealMessageListProps { <p>messages: Message[]<br>uiMessages: UIMessage[]<br>tasksByMessage: Record<string, TaskEvent[]><br>currentStreamingId?: string<br>}</p><p>// Message bubble with tasks example<br>{isAssistant && tasks?.length ? (<br><TaskList tasks={tasks} className="mb-3 rounded-2xl border border-white/15 bg-white/6 p-3 text-white" itemClassName="border-white/20 bg-white/12" /><br>) : null}</code></pre><h3>3. Garden/Parts Management Interfaces</h3><h4>PartsList Component</h4><p><strong>File</strong>: <code class="rounded-md bg-muted px-1.5 py-1 font-mono text-sm" spellcheck="false">components/garden/PartsList.tsx</code></p><p><strong>Part Card Structure</strong>:</p><pre class="rounded-md border bg-muted p-4 font-mono text-sm overflow-x-auto"><code class="language-jsx"><Link<br>href={<code>/garden/${part.id}</code>}<br>className={cn(<br>'group relative block rounded-lg border-l-4 transition-all duration-200 backdrop-blur',<br>'hover:shadow-lg hover:border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',<br>'hover:scale-105 origin-top-left',<br>statusStyle.background,<br>statusStyle.border,<br>accentColor<br>)}</p><blockquote></blockquote><p>{/* Category Pill - Top Right */}</p> <div className={cn( 'absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold border capitalize shadow-sm', categoryColor )} > {part.category} </div> <p>{/* Card Content */}</p> <div className="p-5 space-y-3"> {/* Emoji with Evidence Badge */} <div className="relative inline-block"> <span className={cn( 'text-5xl transition-transform duration-200 group-hover:scale-110', statusStyle.emojiOpacity )} > {emoji} </span> {part.evidence_count > 0 && ( <div className="absolute -bottom-2 -right-2 bg-blue-500/90 rounded-full px-2.5 py-1 text-xs font-bold text-white shadow-md border border-blue-400/50"> {part.evidence_count} </div> )} </div> <pre><code>{/* Part Name */} <h3 className="text-lg font-semibold leading-tight text-foreground">{part.name}</h3> {/* Role/Purpose if available */} {role && ( <p className={cn('text-sm italic line-clamp-2 opacity-75', statusStyle.accentColor)}> <span aria-hidden="true" className="opacity-50"> “ </span> {role} <span aria-hidden="true" className="opacity-50"> ” </span> </p> )} {/* Status Description */} <p className={cn('text-xs font-medium uppercase tracking-wide', statusStyle.accentColor)}> {statusStyle.description} </p> {/* Evidence + Freshness */} <div className="text-xs text-muted-foreground space-y-1 pt-1"> <p className="text-foreground/60"> Built from {part.evidence_count} observation{part.evidence_count === 1 ? '' : 's'} </p> <div className="flex items-center gap-2"> <span aria-hidden="true">{freshness.emoji}</span> <span className={freshness.color}>{freshness.label}</span> </div> </div> </code></pre> </div> </Link></code></pre><h4>PartCard Component</h4><p><strong>File</strong>: <code class="rounded-md bg-muted px-1.5 py-1 font-mono text-sm" spellcheck="false">components/garden/PartCard.tsx</code></p><p><strong>Simple Part Card</strong>:</p><pre class="rounded-md border bg-muted p-4 font-mono text-sm overflow-x-auto"><code class="language-jsx"><Link href={`/garden/${part.id}`} className="group relative block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" aria-label={`View ${part.name}`} > <Card className="aspect-square flex flex-col items-center justify-center gap-4 p-6 text-center transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-lg group-focus-visible:-translate-y-1"> <span className="text-5xl md:text-6xl" aria-hidden="true"> {emoji} </span> <span className="text-lg font-semibold text-foreground line-clamp-2">{part.name}</span> </Card> </Link></code></pre><p><strong>Part Data Structure</strong>:</p><pre class="rounded-md border bg-muted p-4 font-mono text-sm overflow-x-auto"><code class="language-typescript">interface PartRow { id: string; name: string; category: 'manager' | 'firefighter' | 'exile' | 'unknown'; status: 'emerging' | 'acknowledged' | 'active' | 'integrated'; last_active: string | null; evidence_count: number; data: { emoji?: string; role?: string } | null; } <p>interface PartOption {<br>id: string;<br>name: string;<br>emoji: string | null;<br>}</code></pre><h3>4. Login/Signup and Onboarding Components</h3><h4>Login Form</h4><p><strong>File</strong>: <code class="rounded-md bg-muted px-1.5 py-1 font-mono text-sm" spellcheck="false">components/auth/login-form.tsx</code></p><p><strong>Ethereal Styling</strong>:</p><pre class="rounded-md border bg-muted p-4 font-mono text-sm overflow-x-auto"><code class="language-jsx"><Card variant="ethereal"><br><CardHeader><br><CardTitle className="text-2xl" style={etherealTextStyle}><br>Login<br></CardTitle><br><CardDescription style={etherealTextStyle}><br>Enter your email below to login to your account<br></CardDescription><br></CardHeader><br></Card></code></pre><p><strong>Eth Text Style Configuration</strong>:</p><pre class="rounded-md border bg-muted p-4 font-mono text-sm overflow-x-auto"><code class="language-typescript">const etherealTextStyle = {<br>letterSpacing: 'var(--eth-letter-spacing-user)',<br>color: 'rgba(255,255,255,var(--eth-user-opacity))',<br>};</code></pre><h4>Onboarding Page</h4><p><strong>File</strong>: <code class="rounded-md bg-muted px-1.5 py-1 font-mono text-sm" spellcheck="false">app/onboarding/page.tsx</code></p><p><strong>Onboarding Interface</strong>:</p><pre class="rounded-md border bg-muted p-4 font-mono text-sm overflow-x-auto"><code class="language-jsx"><main<br>className="mx-auto max-w-2xl px-4 py-10"<br>style={{ letterSpacing: 'var(--eth-letter-spacing-user)' }}</p><blockquote></blockquote> <div className="flex items-center justify-between gap-4"> <div> <h1 className="text-2xl font-thin" style={{ letterSpacing: 'var(--eth-letter-spacing-assistant)', color: 'rgba(255,255,255,var(--eth-assistant-opacity))', }} > onboarding </h1> <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,var(--eth-user-opacity))' }}> let's get to know your system. this short, kind check-in helps tailor your support. </p> </div> </div> <section className="mt-6"> <OnboardingWizard /> </section> </main></code></pre><h3>5. Actual Sample Data Structures</h3><h4>Inbox Mock Data</h4><p><strong>File</strong>: <code class="rounded-md bg-muted px-1.5 py-1 font-mono text-sm" spellcheck="false">lib/inbox/mockData.ts</code></p><pre class="rounded-md border bg-muted p-4 font-mono text-sm overflow-x-auto"><code class="language-typescript">export const mockInboxEnvelopes: InboxEnvelope[] = [ { id: 'mock-insight-spotlight-1', sourceId: 'mock-insight-spotlight-1', type: 'insight_spotlight', createdAt: new Date().toISOString(), updatedAt: null, readAt: null, expiresAt: null, source: 'fallback', priority: 10, tags: ['sample', 'dev'], actions: { kind: 'scale4', agreeStrongLabel: 'Agree a lot', agreeLabel: 'Agree a little', disagreeLabel: 'Disagree a little', disagreeStrongLabel: 'Disagree a lot', helperText: 'How true does this feel right now?', allowNotes: true, }, payload: { insightId: 'mock-insight-1', title: 'Your parts are most talkative after evening reflections', summary: 'In the past week you logged the most breakthroughs when reflecting between 8–9pm. Matching that rhythm could improve tomorrow's check-in.', readingTimeMinutes: 2, detail: { body: `Recent reflection logs show longer, calmer responses after sunset. Keeping a gentle ritual—like dimming lights or revisiting your planner—may help sustain that gain.`, sources: [ { label: 'Reflection log • 7 entries', url: '/journal' }, { label: 'Insight archive', url: '/insights' }, ], }, cta: { label: 'Open insight', href: '/insights/mock-insight-1', intent: 'primary', }, }, }, ]</code></pre><h4>Onboarding Test Fixtures</h4><p><strong>File</strong>: <code class="rounded-md bg-muted px-1.5 py-1 font-mono text-sm" spellcheck="false">lib/dev/fixtures.ts</code></p><p><strong>Sample Questions</strong>:</p><pre class="rounded-md border bg-muted p-4 font-mono text-sm overflow-x-auto"><code class="language-typescript">export const DEV_STAGE_2_QUESTION_BANK: OnboardingQuestion[] = [ { id: 'S2_Q1', stage: 2, type: 'single_choice', prompt: 'When facing a challenging task, I tend to:', helper: null, options: [ { value: 'procrastinate', label: 'Put it off until later' }, { value: 'dive_in', label: 'Jump right in immediately' }, { value: 'plan_extensively', label: 'Plan extensively before starting' }, { value: 'seek_help', label: 'Ask others for guidance' }, ], active: true, locale: 'en', order_hint: 1, theme_weights: { anxiety: 0.8, perfectionism: 0.6 }, }, { id: 'S2_Q2', stage: 2, type: 'single_choice', prompt: 'When I make a mistake, I usually:', helper: 'Think about your typical emotional response', options: [ { value: 'brush_off', label: 'Brush it off and move on' }, { value: 'learn_from_it', label: 'Try to learn from it' }, { value: 'criticize_self', label: 'Criticize myself harshly' }, { value: 'blame_others', label: 'Look for external causes' }, ], active: true, locale: 'en', order_hint: 2, theme_weights: { self_criticism: 0.9 }, }, ];</code></pre><h3>6. Theme Styling and CSS</h3><h4>Ethereal Theme Configuration</h4><p><strong>File</strong>: <code class="rounded-md bg-muted px-1.5 py-1 font-mono text-sm" spellcheck="false">config/etherealTheme.ts</code></p><pre class="rounded-md border bg-muted p-4 font-mono text-sm overflow-x-auto"><code class="language-typescript">export const defaultEtherealTheme: EtherealTheme = { enabled: true, imageUrl: '/ethereal-bg.jpg', vignette: { inner: 0.1, mid: 0.22, outer: 0.38 }, blobs: [ { x: -140, y: -80, size: 520, color: '#1f3a3f' }, { x: 140, y: 60, size: 460, color: '#2a4d52' }, { x: 20, y: 180, size: 620, color: '#d39a78' }, ], fontFamilyVar: '--font-ethereal', text: { assistantOpacity: 0.85, userOpacity: 0.8, letterSpacingAssistant: '0', letterSpacingUser: '0', }, animation: { wordDurationMs: 35, charDurationMs: 4, streamTickMs: 150, streamCharsPerTick: 8, }, variants: { chat: { gradient: 'linear-gradient(180deg, rgba(4,13,16,1) 0%, rgba(14,26,30,1) 50%, rgba(10,20,22,1) 100%)', }, }, };</code></pre><h4>Tailwind Configuration</h4><p><strong>File</strong>: <code class="rounded-md bg-muted px-1.5 py-1 font-mono text-sm" spellcheck="false">config/tailwind.config.js</code></p><pre class="rounded-md border bg-muted p-4 font-mono text-sm overflow-x-auto"><code class="language-javascript">module.exports = { theme: { extend: { keyframes: { softPulse: { '0%, 100%': { opacity: '1', transform: 'scale(1)' }, '50%': { opacity: '0.88', transform: 'scale(1.01)' }, }, }, animation: { softPulse: 'softPulse 3.2s ease-in-out infinite', }, }, }, };</code></pre><h4>Global CSS Focus Styles</h4><p><strong>File</strong>: <code class="rounded-md bg-muted px-1.5 py-1 font-mono text-sm" spellcheck="false">app/globals.css</code></p><pre class="rounded-md border bg-muted p-4 font-mono text-sm overflow-x-auto"><code class="language-css">@layer components { /* Ethereal focus styles - override default harsh focus rings */ .ethereal-focus { @apply focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:ring-0 focus:border-0; @apply focus:shadow-[var(--ethereal-focus-shadow)] hover:shadow-[var(--ethereal-hover-shadow)]; @apply transition-shadow duration-200; } <p>/* Apply ethereal focus to common form elements */<br>input[type='text'],<br>input[type='email'],<br>input[type='password'],<br>input[type='search'],<br>input[type='url'],<br>input[type='tel'],<br>input[type='number'],<br>textarea,<br>select {<br>@apply ethereal-focus;<br>}<br>}</code></pre><h2>Key UI Patterns for Designers</h2><h3>1. Ethereal Chat Interface</h3><ul class="list-outside list-disc pl-4"><li class="leading-normal"><p><strong>Glassmorphism</strong>: <code class="rounded-md bg-muted px-1.5 py-1 font-mono text-sm" spellcheck="false">backdrop-blur-xl</code> with translucent backgrounds</p></li><li class="leading-normal"><p><strong>Organic Shapes</strong>: Rounded corners with <code class="rounded-md bg-muted px-1.5 py-1 font-mono text-sm" spellcheck="false">rounded-[28px]</code> instead of standard rounding</p></li><li class="leading-normal"><p><strong>Ambient Animation</strong>: Subtle pulsing effects with <code class="rounded-md bg-muted px-1.5 py-1 font-mono text-sm" spellcheck="false">animate-softPulse</code></p></li><li class="leading-normal"><p><strong>Gradient Overlays</strong>: Multiple blurred blob elements in teal-gray color palette</p></li><li class="leading-normal"><p><strong>Typography Contrast</strong>: User text at 80% opacity, assistant at 85% opacity</p></li></ul><h3>2. Check-In Interfaces</h3><ul class="list-outside list-disc pl-4"><li class="leading-normal"><p><strong>Emoji Scales</strong>: 5-point scales with custom emoji representations</p></li><li class="leading-normal"><p><strong>Form Sections</strong>: Clear separation with <code class="rounded-md bg-muted px-1.5 py-1 font-mono text-sm" spellcheck="false">Separator</code> components</p></li><li class="leading-normal"><p><strong>Validation States</strong>: Real-time validation with error messages</p></li><li class="leading-normal"><p><strong>Draft Saving</strong>: Auto-save functionality to localStorage</p></li><li class="leading-normal"><p><strong>Time-based Availability</strong>: Morning check-ins available 4AM-6PM, evening 6PM-4AM</p></li></ul><h3>3. Parts Management</h3><ul class="list-outside list-disc pl-4"><li class="leading-normal"><p><strong>Category System</strong>: Four categories (manager, firefighter, exile, unknown)</p></li><li class="leading-normal"><p><strong>Status System</strong>: Four states (emerging, acknowledged, active, integrated)</p></li><li class="leading-normal"><p><strong>Color Coding</strong>: Each status has associated accent colors</p></li><li class="leading-normal"><p><strong>Evidence Counting</strong>: Badge system showing number of supporting observations</p></li><li class="leading-normal"><p><strong>Freshness Indicators</strong>: "Just now", "a few hours ago", "yesterday" etc.</p></li></ul><h3>4. Mobile Considerations</h3><ul class="list-outside list-disc pl-4"><li class="leading-normal"><p><strong>Safe Areas</strong>: iOS notch and home indicator support</p></li><li class="leading-normal"><p><strong>Touch Targets</strong>: Minimum 48px height for interactive elements</p></li><li class="leading-normal"><p><strong>Responsive Typography</strong>: Dynamic text sizing based on screen size</p></li><li class="leading-normal"><p><strong>Gesture Support</strong>: Swipe-to-dismiss and pull-to-refresh patterns</p></li></ul><h3>5. Theme System</h3><ul class="list-outside list-disc pl-4"><li class="leading-normal"><p><strong>Custom Properties</strong>: CSS variables for consistent theming</p></li><li class="leading-normal"><p><strong>Ethereal Focus</strong>: Soft, non-intrusive focus states</p></li><li class="leading-normal"><p><strong>Vignetting</strong>: Darkened edges to draw focus to center content</p></li><li class="leading-normal"><p><strong>Animated Backgrounds</strong>: Moving blurred shapes for ambient atmosphere</p></li><li class="leading-normal"><p><strong>Text Spacing</strong>: Custom letter-spacing for assistant vs user text</p></li></ul><p>This comprehensive overview shows the actual UI patterns, data structures, and styling approaches used throughout the application. The ethereal theme emphasizes soft, translucent interfaces with ambient animations and organic shapes throughout the user experience.</p></p></body></code></p></body></code></p></body> ``