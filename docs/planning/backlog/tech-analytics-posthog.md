# PostHog Analytics Integration

## Overview

Implement PostHog as a privacy-first analytics platform to replace our fragmented tracking approach with a comprehensive solution that provides user insights, session replay, and A/B testing capabilities.

## Current State

### What We Have

- **Console Analytics**: Simple `track()` function that only logs in development
- **Inbox Analytics**: `emitInboxEvent()` with Supabase persistence
- **Performance Telemetry**: `inbox_observation_telemetry` table for tool performance
- **Memory Observability**: Structured JSON logging for snapshot cache hits/misses
- **Session Tracking**: Supabase sessions table with conversation history

### Problems

- No unified event schema across systems
- No production analytics (main track() is dev-only)
- No visual dashboards (requires SQL queries)
- No user journey tracking or conversion funnels
- Fragmented implementation across components

## Why PostHog?

### PostHog vs Other Analytics Platforms

**PostHog is uniquely suited for our therapeutic context:**

- **Open source**: Can audit privacy implementation
- **Self-hostable**: Keep data in our infrastructure
- **HIPAA compliant**: Designed for healthcare contexts
- **Cookieless**: No consent banners needed
- **Generous free tier**: 1M events/month, 5K session recordings

**Comparison to alternatives:**

- **Mixpanel/Amplitude**: Expensive, less privacy-focused, complex for our needs
- **Plausible/Fathom**: Too basic, no product analytics features
- **Google Analytics**: Privacy concerns, overkill for our app

### PostHog Free Tier Includes

- 1 million events/month (~10,000 active users)
- 5,000 session recordings/month
- 1 million feature flag requests/month
- Unlimited team members
- 1-year data retention
- All core features (funnels, cohorts, A/B testing)

## Implementation Plan

### Phase 1: Setup & Privacy Wrapper (Week 1)

```typescript
// lib/analytics/posthog-wrapper.ts
class TherapyAnalytics {
  init(userId?: string) {
    posthog.init(KEY, {
      autocapture: false, // Manual control
      disable_cookie: true, // Privacy first
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '.therapeutic-content',
      },
    });
  }

  track(event: string, properties?: any) {
    const sanitized = this.sanitizeProperties(properties);
    posthog.capture(event, sanitized);
  }

  private sanitizeProperties(props: any) {
    // Remove sensitive fields
    delete props.content;
    delete props.description;
    delete props.notes;
    return props;
  }
}
```

### Phase 2: Core Event Tracking (Week 2)

**Safe Events to Track:**

```typescript
// User actions (no content)
'check_in_completed': { mood_score, parts_count, duration }
'part_created': { category, is_first }
'insight_viewed': { type, position }
'feature_discovered': { name, referrer }

// System events
'session_started': { source }
'onboarding_completed': { duration }
'error_occurred': { type, component }
```

**Never Track:**

- Session transcripts or content
- Part descriptions or names
- Personal check-in text
- Any therapeutic content

### Phase 3: Advanced Features (Week 3-4)

#### Session Replay (with consent)

```typescript
// Only for debugging, with explicit consent
if (user.hasConsentedToRecording) {
  posthog.startSessionRecording()
}

// Mask all therapeutic content
<div data-ph-capture-attribute-masked>
  {/* Sensitive content */}
</div>
```

#### A/B Testing

```typescript
// Test new features safely
const variant = posthog.getFeatureFlag('new_checkin_flow')
if (variant === 'enhanced') {
  return <EnhancedCheckIn />
}
return <StandardCheckIn />
```

#### Funnel Analysis

- Onboarding completion rates
- Feature adoption paths
- Check-in engagement patterns

## Privacy Considerations

### Data Minimization Principles

1. Track behaviors, not content
2. Use aggregate metrics where possible
3. Implement automatic data deletion
4. Respect user opt-out preferences

### Therapeutic Context Rules

```typescript
const THERAPEUTIC_PRIVACY = {
  // Safe to track
  ALLOWED: ['page_view', 'button_click', 'feature_used'],

  // Track with sanitization
  SANITIZE: ['check_in_mood', 'part_interaction'],

  // Never track
  FORBIDDEN: ['session_content', 'part_details', 'personal_notes'],
};
```

## Cost-Benefit Analysis

### PostHog Approach

- **Setup time**: ~20 hours
- **Monthly cost**: $0 (free tier covers our scale)
- **Features available**: Day 1
- **Maintenance**: Minimal (they handle updates)

### Custom Build Alternative

- **Setup time**: ~200 hours
- **Monthly cost**: $0 (but dev time opportunity cost)
- **Features available**: Week 8+ (still incomplete)
- **Maintenance**: 10-20 hours/month ongoing

### ROI Calculation

- 180 hours saved = 4.5 weeks of development time
- Can focus on therapeutic features instead
- Get enterprise features we couldn't build ourselves
- Professional debugging tools improve user experience

## Migration Strategy

### Hybrid Approach (Recommended)

1. Keep therapeutic data in Supabase (complete control)
2. Use PostHog for product analytics (page views, features)
3. Maintain clear boundaries between sensitive and product data

### Implementation Steps

1. Install PostHog SDK
2. Create privacy wrapper
3. Add tracking to non-sensitive actions
4. Set up dashboards
5. Enable session replay (with consent)
6. Implement first A/B test
7. Deprecate console logging

## Success Metrics

- Reduce time to identify user issues by 80%
- Increase feature adoption visibility
- Enable data-driven product decisions
- Maintain 100% privacy compliance
- Zero therapeutic content in analytics

## Decision Criteria

**Choose PostHog if:**

- We want analytics working immediately
- Privacy-first approach is mandatory
- We need professional debugging tools
- Team time is better spent on features

**Build custom if:**

- We have 200+ hours to spare
- We need exotic therapeutic-specific metrics
- We absolutely cannot use any external service

## Recommendation

**Implement PostHog with privacy wrapper** - gives us enterprise analytics while maintaining therapeutic privacy standards. The free tier covers our needs for the next 6-12 months minimum.

## Related Documents

- Current observability: `docs/current/operations/memory-observability.md`
- Grafana monitoring: `docs/planning/backlog/tech-grafana-observability.md` (different focus - see comparison below)

## PostHog vs Grafana Comparison

These tools serve completely different purposes:

### PostHog (User Analytics)

- **Focus**: Understanding user behavior and product usage
- **Data**: User events, clicks, page views, feature adoption
- **Questions answered**:
  - "How many users complete check-ins?"
  - "Where do users drop off in onboarding?"
  - "Which features are most used?"
- **Output**: Funnels, user paths, A/B test results

### Grafana (System Observability)

- **Focus**: Monitoring technical performance and system health
- **Data**: Server metrics, API latency, error rates, resource usage
- **Questions answered**:
  - "Why is the API slow?"
  - "How long do agent tools take to execute?"
  - "Are we hitting memory limits?"
- **Output**: Time-series graphs, alerts, performance dashboards

**In practice:**

- PostHog tells you "users are abandoning check-ins"
- Grafana tells you "the check-in API has 2s latency spikes"

Both are valuable but solve different problems. PostHog is for product decisions, Grafana is for operational health.
