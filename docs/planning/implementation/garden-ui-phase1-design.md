# Garden UI Phase 1: Dashboard Redesign

**Bead ID:** ifs-chat-app-20  
**Status:** Planning  
**Created:** 2025-10-18  
**Blocked By:** ifs-chat-app-19 (Agent interaction patterns)  
**Related Docs:** `/docs/planning/implementation/agent-part-notes-interaction.md`

---

## Problem Statement

The `/garden` page is currently a simple list with minimal information hierarchy. Users can't quickly understand:
- Which parts are emerging vs. established (lifecycle stage)
- Which parts are currently active vs. dormant (freshness)
- How much evidence backs each part (credibility)
- What role each part plays (context)

The page feels disconnected from `/today`'s polished, information-rich design.

---

## Success Criteria

✅ Garden page has header with contextual stats  
✅ Parts displayed in responsive grid (1-3 columns)  
✅ Each card shows: status, role, evidence count, freshness, category  
✅ Status affects card opacity/visual hierarchy (emerging = muted, active = vivid)  
✅ Freshness shown with color-coded indicator (recently active vs. dormant)  
✅ Evidence count displayed as social proof  
✅ Card design mirrors `/today` page patterns (glassmorphism, badges, typography)  
✅ No dead data fields (charge, needs_attention removed from display)  
✅ Loading states match `/today` page skeleton pattern  

---

## Design: Component-by-Component

### 1. Header Section (New)

**Component:** `GardenHeader` (new)

**What it shows:**
```
┌──────────────────────────────────────────────────┐
│                                                  │
│  Your Inner Garden                              │  ← Title
│  {totalParts} parts discovered • {activeToday}  │  ← Subtitle
│  active today                                   │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │ Total Parts: 12                          │  │
│  │ Established: 8 (avg 71% identified)      │  │
│  │ Active Today: 4                          │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Stats to calculate:**
- `totalParts = parts.length`
- `establishedCount = parts.filter(p => p.status === 'acknowledged' || p.status === 'active' || p.status === 'integrated').length`
- `activeToday = parts.filter(p => isActiveSince(p.last_active, 24 * 60 * 60 * 1000)).length`
- `avgConfidence = (parts.reduce((sum, p) => sum + p.confidence, 0) / parts.length * 100).toFixed(0)`

**Implementation:**
- Reuse styling from StreakBanner component
- Use grid grid-cols-3 gap-4 for stat boxes
- Each stat: label (text-xs uppercase) + value (text-2xl font-bold)

---

### 2. Category Filters (Keep Existing)

**No changes** to existing filter buttons.

---

### 3. Parts Grid (Redesigned from List)

**Layout Change:**
```
Current:  space-y-3 (list)
Updated:  grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4
```

---

### 4. Individual Card Component

**Structure:**

```tsx
<Link href={`/garden/${part.id}`}>
  <div className="relative rounded-lg border transition-all duration-200 hover:shadow-md hover:border-border/60">
    
    {/* Top-Right: Category Pill */}
    <div className="absolute top-3 right-3 px-2 py-1 rounded-md text-xs font-semibold border">
      {category}
    </div>
    
    {/* Main Content */}
    <div className="p-5 space-y-3">
      
      {/* Emoji with Evidence Badge */}
      <div className="relative inline-block">
        <span className="text-5xl opacity-{statusOpacity}">
          {emoji}
        </span>
        {evidenceCount > 0 && (
          <div className="absolute -bottom-2 -right-2 bg-blue-500/80 rounded-full px-2 py-1 text-xs font-semibold">
            {evidenceCount}
          </div>
        )}
      </div>
      
      {/* Part Name */}
      <h3 className="text-lg font-semibold mt-3">
        {name}
      </h3>
      
      {/* Role/Purpose (if available) */}
      {role && (
        <p className="text-sm text-blue-300 italic">
          {role}
        </p>
      )}
      
      {/* Status Description */}
      <p className="text-sm text-blue-300 font-medium">
        {statusDescriptions[status]}
      </p>
      
      {/* Evidence + Freshness on one line */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>Built from {evidenceCount} {evidenceCount === 1 ? 'observation' : 'observations'}</p>
        <div className="flex items-center gap-2">
          <span className={freshnessIcon}>{freshnessEmoji}</span>
          <span>{freshnessLabel}</span>
        </div>
      </div>
      
    </div>
  </div>
</Link>
```

---

### 5. Card Styling: Status-Based Opacity

**Status colors affect entire card:**

```tsx
const statusStyles = {
  emerging: {
    background: 'bg-card/20',
    border: 'border-border/30',
    emoji_opacity: 'opacity-60',
    accent_color: 'text-amber-300'
  },
  acknowledged: {
    background: 'bg-card/35',
    border: 'border-border/40',
    emoji_opacity: 'opacity-75',
    accent_color: 'text-blue-300'
  },
  active: {
    background: 'bg-card/50',
    border: 'border-border/50',
    emoji_opacity: 'opacity-100',
    accent_color: 'text-emerald-300'
  },
  integrated: {
    background: 'bg-card/60',
    border: 'border-border/60',
    emoji_opacity: 'opacity-100',
    accent_color: 'text-purple-300'
  }
}
```

**Visual effect:** 
- Emerging parts "fade" into background (early stage, uncertain)
- Active parts "pop" (engaged, vivid)
- Integrated parts feel "settled" (calm, confident)

---

### 6. Freshness Indicator

**Calculation:**

```tsx
function getFreshness(lastActive: string | null) {
  if (!lastActive) return { label: 'Never active', emoji: '⚪', color: 'text-gray-400' }
  
  const hoursAgo = (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60)
  
  if (hoursAgo < 1) return { label: 'Active just now', emoji: '🔴', color: 'text-emerald-400' }
  if (hoursAgo < 24) return { label: `Active ${Math.floor(hoursAgo)}h ago`, emoji: '🟢', color: 'text-emerald-300' }
  if (hoursAgo < 168) return { label: `Active ${Math.floor(hoursAgo / 24)}d ago`, emoji: '🟡', color: 'text-amber-300' }
  return { label: `Last seen ${new Date(lastActive).toLocaleDateString()}`, emoji: '⚪', color: 'text-gray-400' }
}
```

**Color coding:**
- 🔴 Emerald (active right now)
- 🟢 Emerald (active this session)
- 🟡 Amber (dormant this week)
- ⚪ Gray (dormant longer)

---

### 7. Category Color Pills

**Top-right badges:**

```tsx
const categoryColors = {
  manager: 'bg-violet-900/40 text-violet-300 border-violet-700/40',
  firefighter: 'bg-red-900/40 text-red-300 border-red-700/40',
  exile: 'bg-blue-900/40 text-blue-300 border-blue-700/40',
  unknown: 'bg-gray-800/40 text-gray-400 border-gray-700/40'
}
```

---

### 8. Loading State (Skeleton)

**Match CheckInSlots pattern:**

```tsx
{isLoading && (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="rounded-lg border border-border/40 bg-card/20 p-5 space-y-3 animate-pulse">
        <Skeleton className="h-12 w-12 rounded" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    ))}
  </div>
)}
```

---

## File Changes

### New Files
- None (all changes in existing components)

### Modified Files

#### 1. `app/(tabs)/garden/page.tsx`
- Import new `GardenHeader` component
- Render header before PartsList
- Calculate stats (totalParts, establishedCount, activeToday, avgConfidence)
- Pass stats to header

#### 2. `components/garden/PartsList.tsx` (Major Refactor)
- Change layout: `space-y-3` → `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`
- Add `GardenHeader` component (or inline)
- Remove dead code paths (charge styling, needs_attention styling)
- Implement status-based opacity system
- Add freshness calculation and display
- Add role/purpose display (with fallback if empty)
- Add evidence count badge overlay on emoji
- Add category pill positioning
- Update loading skeleton to grid
- Update hover/focus states for grid context

#### 3. `lib/utils.ts` (if needed)
- Add `getFreshness()` utility function
- Add `getStatusStyles()` utility function
- (Consider extracting to separate utils file if large)

---

## Acceptance Criteria

### Visual
- [ ] Grid layout displays correctly on mobile (1 col), tablet (2 col), desktop (3 col)
- [ ] Status opacity gradation is visible (emerging clearly more muted than active)
- [ ] Freshness emoji + text displays clearly
- [ ] Category pill positioned in top-right without overlapping content
- [ ] Evidence badge positioned on emoji correctly
- [ ] Hover state shows shadow/border highlight
- [ ] Loading skeleton matches final card height

### Data
- [ ] Header stats calculate correctly (total, established, active, avg confidence)
- [ ] Role/purpose shows when available, empty when not
- [ ] Evidence count reflects `evidence_count` field from database
- [ ] Freshness accurately reflects time since `last_active`
- [ ] Status matches actual `part.status` value
- [ ] Category pill shows correct `part.category`
- [ ] Emoji shows correct `data.emoji`

### UX
- [ ] Cards are clickable links to detail page
- [ ] Filter buttons still work (only applies to new grid layout)
- [ ] Sorting by last_active still works
- [ ] No console errors
- [ ] Accessible (focus states, aria labels preserved)

---

## Implementation Steps

1. **Extract utilities**
   - Create `lib/garden/freshness.ts` with getFreshness()
   - Create `lib/garden/status-styles.ts` with getStatusStyles()

2. **Update PartsList.tsx**
   - Refactor layout to grid
   - Remove dead code (charge, needs_attention)
   - Implement status styling system
   - Add freshness indicators
   - Add role/purpose display
   - Add evidence badge to emoji
   - Add category pill

3. **Update garden/page.tsx**
   - Add header calculation logic
   - Render GardenHeader (or inline header if small)
   - Pass stats to header

4. **Update loading states**
   - Match skeleton to new card dimensions
   - Ensure 6 skeleton cards show (2-3 per row)

5. **Test**
   - [ ] Mobile, tablet, desktop responsive
   - [ ] All status variants visible
   - [ ] All category colors correct
   - [ ] Freshness calculation accurate
   - [ ] Hover/focus states work
   - [ ] Clicking cards navigates to detail page

---

## Code Patterns to Reuse

From `/today` page:

```tsx
// Glassmorphism
bg-card/20 backdrop-blur border border-border/40

// Badge styling
<Badge variant="secondary" className="text-xs capitalize">

// Loading skeleton
<Skeleton className="h-4 w-3/4" />

// Typography hierarchy
text-xs font-medium uppercase  (labels)
text-sm text-muted-foreground   (descriptions)
text-lg font-semibold           (headings)

// Hover effects
hover:border-border/80 hover:bg-card/30 hover:shadow-md transition-all duration-200

// Header structure
<h1 className="text-4xl font-bold tracking-tight">
<p className="text-muted-foreground mt-2">
```

---

## Not Included in Phase 1

- ❌ Charge-based styling (data doesn't exist)
- ❌ Needs_attention pulse animation (data doesn't exist)
- ❌ Relationship graph visualization (separate scope)
- ❌ Timeline view (separate scope)
- ❌ Advanced filtering/sorting beyond existing category filters

---

## Future Phases

### Phase 2: Relationship Visualization
- Show connected parts on cards
- Display relationship strength/type
- Link to part detail page with full graph

### Phase 3: Timeline & History
- Show when part emerged, transitioned through lifecycle
- Display recent observations feed
- Auto-generate timeline events

### Phase 4: Insights & Analytics
- Parts dashboard with growth metrics
- Suggest next parts to explore
- Show part co-occurrence patterns
