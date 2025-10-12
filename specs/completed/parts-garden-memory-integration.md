# Task: Parts Garden & Memory System Integration

## Problem Statement

The Parts Garden (Journey tab) and check-in features are disconnected from the markdown memory system. Users cannot create parts, and existing parts don't sync with their markdown profiles. This creates a fragmented experience where:

1. Check-ins show no parts because none exist in the database
2. The markdown memory system can track parts but they're invisible in the UI
3. Updates to parts don't propagate to memory profiles
4. The visual Parts Garden doesn't reflect memory state

## Success Criteria

- [ ] Users can create and manage parts through the UI
- [ ] Parts appear in check-ins for selection
- [ ] Database parts sync with markdown memory profiles
- [ ] Part updates trigger memory updates
- [ ] Visual indicators show memory sync status
- [ ] Evidence and insights from markdown display in part details

## Architecture Decision

**Hybrid Approach**: Database as primary for core data, markdown for extended memory

- Database stores: id, name, status, category, visualization, timestamps
- Markdown stores: role, evidence, insights, change history, relationships
- Bidirectional sync ensures consistency
- UI reads from both sources

## Implementation Phases

### Phase 1: Part Creation Infrastructure

**Goal**: Enable users to create parts

**Tasks**:

1. Add POST endpoint to `/api/parts/route.ts`
2. Create "Add Part" UI component with dialog
3. Add creation button to Parts Garden main view
4. Implement form validation for part creation
5. Auto-generate markdown profile on part creation

**Acceptance Criteria**:

- Users can create a part with name, emoji, and category
- Part appears immediately in garden view
- Markdown profile is created automatically
- Creation is logged in memory system

### Phase 2: Memory System Integration

**Goal**: Connect database parts with markdown profiles

**Tasks**:

1. Create `lib/memory/parts-sync.ts` for synchronization
2. Add `onPartCreated` hook to creation flow
3. Add `onPartUpdated` hook to update actions
4. Implement `checkPartProfileExists` utility
5. Create background sync job for existing parts

**Acceptance Criteria**:

- Every database part has a corresponding markdown profile
- Updates to parts trigger memory updates
- Sync status is trackable
- No data loss during sync

### Phase 3: Enhanced Part Details UI

**Goal**: Display markdown memory in part detail pages

**Tasks**:

1. Add tabs to part detail page (Overview, Memory, Evidence)
2. Create MemoryTab component to display markdown content
3. Create EvidenceTab for adding/viewing evidence
4. Add memory sync status indicator
5. Implement evidence collection form

**Acceptance Criteria**:

- Users can view markdown profile content
- Users can add evidence items (max 7)
- Change history is visible
- Sync status shows last update time

### Phase 4: Check-In Integration

**Goal**: Surface parts effectively in check-ins

**Tasks**:

1. Enhance `loadAvailableParts()` to include memory status
2. Add visual indicators for parts with rich profiles
3. Create "suggested parts" based on recent activity
4. Add quick part creation from check-in
5. Track part selection in memory

**Acceptance Criteria**:

- All user parts appear in check-in
- Parts with profiles show indicator
- Recently active parts appear first
- Part selection updates memory

### Phase 5: Garden Visualization Enhancement

**Goal**: Integrate memory data into visual garden

**Tasks**:

1. Connect charge/energy system to memory recency scores
2. Add memory status overlay to graph nodes
3. Display evidence count on part cards
4. Color-code based on profile completeness
5. Add filtering by memory status

**Acceptance Criteria**:

- Visual charge reflects memory recency
- Nodes show profile status
- Cards display evidence count
- Users can filter by profile completeness

## Technical Components

### New Files to Create

- `/app/api/parts/route.ts` (POST method)
- `/lib/memory/parts-sync.ts`
- `/components/parts/CreatePartDialog.tsx`
- `/components/parts/MemoryTab.tsx`
- `/components/parts/EvidenceCollector.tsx`
- `/lib/parts/creation.ts`

### Files to Modify

- `/app/(tabs)/garden/page.tsx` - Add creation button
- `/app/garden/[partId]/page.tsx` - Add memory tabs
- `/app/garden/actions.ts` - Add memory hooks
- `/lib/check-ins/server.ts` - Enhance part loading
- `/components/garden/PartCard.tsx` - Add sync indicators
- `/components/check-in/PartsPicker.tsx` - Show memory status

## Data Flow

```text
User Action → UI Component → Server Action → Database Update
                                                    ↓
                                            Memory Queue
                                                    ↓
                                            Markdown Update
                                                    ↓
                                            Revalidate Cache
                                                    ↓
                                            Update UI
```

## Memory Update Payloads

### Part Creation

```typescript
{
  kind: 'part_created',
  refId: partId,
  payload: {
    name: string,
    category: string,
    visualization: { emoji, color }
  }
}
```

### Part Update

```typescript
{
  kind: 'part_updated',
  refId: partId,
  payload: {
    changes: string[],
    values: Record<string, any>
  }
}
```

### Evidence Addition

```typescript
{
  kind: 'part_evidence',
  refId: partId,
  payload: {
    type: 'observation' | 'quote' | 'pattern',
    content: string,
    source: string
  }
}
```

## Migration Strategy

1. **Existing Users**: Run one-time sync to create markdown profiles for existing parts
2. **New Users**: Parts created with profiles from the start
3. **Rollback Plan**: Database remains source of truth, markdown can be regenerated

## Performance Considerations

- Markdown operations are async/queued
- Database remains primary for real-time operations
- Cache markdown content for 5 minutes
- Batch sync operations when possible
- Use optimistic UI updates

## Testing Requirements

1. Part creation flow end-to-end
2. Memory sync reliability
3. Check-in part loading performance
4. Evidence collection and display
5. Graph visualization with memory data
6. Error handling for sync failures

## Monitoring & Observability

- Track part creation success rate
- Monitor memory sync lag
- Alert on sync failures
- Dashboard for memory profile coverage
- User engagement with evidence feature

## Rollout Plan

1. **Week 1**: Part creation infrastructure (Phase 1)
2. **Week 2**: Memory system integration (Phase 2)
3. **Week 3**: Enhanced UI and check-in integration (Phases 3-4)
4. **Week 4**: Garden visualization and polish (Phase 5)

## Open Questions

1. Should we auto-create parts from chat conversations?
2. How many evidence items should we allow (currently 7)?
3. Should part deletion be soft or hard delete?
4. How to handle merge conflicts in markdown?
5. Should we version markdown profiles?

## Dependencies

- Markdown memory system must be stable
- Supabase storage adapter configured
- Memory queue processing running
- User authentication working

## Risk Mitigation

- **Risk**: Sync failures lose data
  - **Mitigation**: Queue retries, audit log, manual sync option

- **Risk**: Performance degradation
  - **Mitigation**: Async processing, caching, pagination

- **Risk**: User confusion with two data sources
  - **Mitigation**: Clear UI indicators, help text, unified view

## Definition of Done

- [ ] All phases implemented and tested
- [ ] Documentation updated
- [ ] Performance benchmarks met
- [ ] Error handling comprehensive
- [ ] Monitoring in place
- [ ] User feedback incorporated
- [ ] Code reviewed and approved
