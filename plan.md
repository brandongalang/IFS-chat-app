# IFS User Onboarding Implementation Plan

## ✅ COMPLETED (2 commits)

### Foundation & Database (Commit 1: `3cf277e`)
- ✅ Database schema with user_onboarding, onboarding_questions, and onboarding_responses tables
- ✅ RLS policies for secure data access  
- ✅ Comprehensive question bank with Stage 1 (5 behavioral probes), Stage 2 (12 contextual), and Stage 3 (4 somatic/belief)
- ✅ TypeScript types and Zod schemas for type safety
- ✅ Scoring engine that maps Stage 1 responses to theme weights
- ✅ Stage 2 selection algorithm with weighted scoring and diversity constraints

### API Layer (Commit 2: `9e03eaa`)
- ✅ POST /api/onboarding/progress: autosave with optimistic concurrency, stage 1 scoring, and stage 2 selection
- ✅ GET /api/onboarding/questions: personalized questions by stage with adaptive Stage 2 selection  
- ✅ POST /api/onboarding/complete: validates completion and redirects to /today
- ✅ GET /api/onboarding/state: lightweight endpoint for middleware and UI state checks

---

## 🚀 NEXT PHASES (Remaining Tasks)

### Phase 1: Feature Flags & Core Infrastructure
**Priority: HIGH** - Required to gate rollout and enable development

#### 1.1 Feature Flags System
- [ ] Add flags to existing feature flag system:
  - `onboarding_v1` (master flag)
  - `onboarding_redirect` (routes new users after OAuth)
  - `intervention_cards` (to gate new InterventionCard system)
- [ ] Default: off in production, on in staging; allow per-user overrides
- [ ] Add typed helpers: `lib/flags/index.ts: getFlag(name, userId?), getVariant(name, userId?)`
- [ ] Gate all onboarding routes, UI mounts, and middleware-based redirects behind flags

### Phase 2: Auth Integration & Routing
**Priority: HIGH** - Required for user flow

#### 2.1 Auth-aware Middleware
- [ ] Update middleware.ts with feature flag gating:
  - If `onboarding_redirect` is on, user is authenticated, and `user_onboarding.status != 'completed'`, redirect to `/onboarding`
- [ ] Use Supabase middleware client to read session and lightweight select of user_onboarding by user_id
- [ ] Ensure not to redirect asset/API routes; allow `/api/onboarding/*`, `/onboarding`, `/auth/*`
- [ ] On OAuth callback flow, set final redirect to `/onboarding` or `/today` based on completion

### Phase 3: Core UI Components
**Priority: HIGH** - The user-facing experience

#### 3.1 Onboarding Wizard Foundation
- [ ] Route: `app/onboarding/page.tsx`
- [ ] Components (shadcn/ui):
  - Card-based wizard: Card, Progress, Button, Separator, Badge, RadioGroup, Checkbox, Textarea, Skeleton
  - `OnboardingWizard` (client): orchestrates stages, renders QuestionCard(s), handles autosave
  - `QuestionCard`: renders per question type + helper text; accepts value and onChange
  - `WizardFooter`: Next/Back/Save & exit; shows autosave state; disable Next until required responses present
- [ ] Visual tone: soft copy, invitational language, brief helpers
- [ ] Keyboard and screen-reader friendly (labels, aria-describedby, focus management)

#### 3.2 Stage 1 UI (5 Fixed Probes)
- [ ] Fetch Stage 1 via GET /api/onboarding/questions?stage=1
- [ ] Render 5 single_choice questions with radio groups (updated from original likert5 design)
- [ ] On change:
  - Debounced (500ms) POST /api/onboarding/progress for each answer
  - Optimistic update to local state and progress indicator
- [ ] After all 5 are answered:
  - Request Stage 2 selection via GET /api/onboarding/questions?stage=2
  - Advance CTA: "Continue (4 quick context questions)"
- [ ] Analytics events: stage_viewed, question_answered, stage_completed

#### 3.3 Stage 2 UI (4 Adaptive Contextual Questions)
- [ ] Fetch selected 4 Stage 2 questions from server
- [ ] Lock the set in user_onboarding.stage2_selected_questions for consistency
- [ ] Render one question per card with Next/Back; allow skipping back to edit
- [ ] Autosave each response via /api/onboarding/progress
- [ ] Copy emphasizes curiosity and gentle noticing
- [ ] Brief explanations of why questions were selected (optional info tooltip)
- [ ] Analytics: stage_viewed, question_shown, question_answered, stage_completed

#### 3.4 Stage 3 UI (4 Fixed Somatic & Belief Mapping)
- [ ] Fetch or render fixed Stage 3 questions
- [ ] Use multi-select for body map and protection intents
- [ ] Free-text for beliefs and supportive message
- [ ] Autosave responses
- [ ] Completion button: "Finish and go to Today"
- [ ] Analytics: stage_viewed, question_answered, complete_clicked

#### 3.5 Autosave & Resumability
- [ ] Autosave every change with debouncing; show "Saved" state with last_saved_at time
- [ ] Persist in localStorage as fallback (keyed by userId + feature_version)
- [ ] Resume logic on page load: GET current user_onboarding, drive UI to saved stage and prefill answers

### Phase 4: Today Screen Integration
**Priority: MEDIUM** - Completes user journey

#### 4.1 Reusable InterventionCard Component
- [ ] `components/InterventionCard.tsx`:
  - Props: id, title, subtitle, icon?, tone, severity, priority, canSupersedeCheckins, actions, onDismiss, trackingId
  - Built from shadcn/ui Card primitives with slots for media and actions
  - Emits analytics: intervention_viewed, intervention_action_clicked, intervention_dismissed
  - Accessible: role="region", aria-labelledby

#### 4.2 Today Screen Integration
- [ ] Hook: `lib/today/useInterventions.ts` or server function `getTodayInterventions(userId)`
- [ ] If onboarding not completed and onboarding_v1 enabled, return InterventionCard model:
  - id: 'onboarding_prompt'
  - title: "Welcome—let's get to know your system"
  - subtitle: "A short, kind check-in to tailor your support"  
  - canSupersedeCheckins: true
  - actions: [{label:'Begin', href:'/onboarding'}]
  - priority: high
- [ ] `app/today/page.tsx`: if any card has canSupersedeCheckins = true, hide standard check-in container
- [ ] After completion: show reflective InterventionCard for 1–2 days with supportive message from S3_Q4

### Phase 5: User Memory & Analytics
**Priority: MEDIUM** - Enhances AI personalization

#### 5.1 User Memory Synthesis
- [ ] Server function `lib/memory/synthesizeOnboarding.ts`:
  - Inputs: userId; reads responses + derived stage1_scores
  - Deterministic synthesis into 3–5 concise memory entries:
    - onboarding:v1:themes — top 2–3 themes with normalized scores
    - onboarding:v1:somatic — selected body areas  
    - onboarding:v1:protections — selected "protecting from" intents
    - onboarding:v1:beliefs — brief free-text belief summary (S3_Q2)
    - onboarding:v1:self_compassion — their supportive message (S3_Q4)
  - Upsert into existing user memory system
  - Use tags for future retrieval: ['onboarding','ifs','v1']
  - Fire from POST /api/onboarding/complete and idempotently callable

#### 5.2 Analytics Implementation  
- [ ] Add `lib/analytics` with client and server wrappers
- [ ] Event catalog:
  - onboarding_started, onboarding_stage_viewed, onboarding_question_shown
  - onboarding_question_answered, onboarding_stage_completed, onboarding_progress_saved
  - onboarding_completed, intervention_viewed/action_clicked/dismissed
- [ ] Respect PII: avoid raw free-text in events; send lengths/hashes only for S3 free-text
- [ ] Add basic funnels and dashboards for completion rates and drop-off points

### Phase 6: Security & Performance
**Priority: MEDIUM** - Production readiness

#### 6.1 Security Hardening
- [ ] Input validation with zod on all API payloads (✅ already implemented)
- [ ] Rate limit progress endpoints (20 req/min/user) and size limit payloads
- [ ] Ensure RLS is enforced by using user session with Supabase server client (✅ implemented)
- [ ] Index checks: confirm query plans on onboarding_responses and onboarding_questions

### Phase 7: Testing & Quality
**Priority: MEDIUM** - Confidence and maintainability

#### 7.1 Unit Tests
- [ ] `scoring.test.ts`: theme mapping edge cases; normalization; tie-breaking
- [ ] `selector.test.ts`: diverse coverage of themes; deterministic selection with seed; constraints enforced  
- [ ] API route tests with supertest or Next test utils:
  - progress upsert, version conflict, completion validation

#### 7.2 E2E Tests
- [ ] Playwright scenarios:
  - New user → redirect to /onboarding → complete Stage 1 → dynamic Stage 2 → Stage 3 → complete → redirect to /today
  - Resume mid-way (reload) resumes correct stage and answers
  - Today screen shows InterventionCard superseding check-ins pre-completion
- [ ] Use playwright MCP to run and fix front-end issues

#### 7.3 Accessibility & Copy
- [ ] IFS-aligned copy pass:
  - Welcoming, curious, non-pathologizing; "parts" language gently introduced
  - Avoid jargon; short helper text with optional info popovers
- [ ] A11y audit:
  - Proper labels, aria attributes, focus ring and focus management per step
  - Sufficient color contrast; supports keyboard only
- [ ] Localization-ready text keys (even if only en now)

### Phase 8: Verification & Integration
**Priority: LOW** - Final validation

#### 8.1 Flow Verification
- [ ] Ensure Google OAuth callback leads to:
  - If onboarding_v1 + onboarding_redirect: /onboarding (if not completed)
  - Else: /today
- [ ] Integration test confirming no route loops and /chat is not used post-onboarding

#### 8.2 Today Feed Testing
- [ ] Unit test `getTodayInterventions` to confirm supersede behavior and priority sorting
- [ ] Analytics assertions that intervention_viewed fires on mount
- [ ] Ensure check-ins rendering is hidden only when canSupersedeCheckins=true and card is active

### Phase 9: Documentation & Rollout
**Priority: LOW** - Knowledge transfer and deployment

#### 9.1 Documentation
- [ ] `docs/onboarding.md`:
  - Architecture overview, flows, endpoints, scoring details, RLS policies, flags
  - Data dictionary: tables/columns, indexes, and retention
  - How to add questions guide
- [ ] ADR: decision on server-side selection vs DB function; rationale and tradeoffs
- [ ] Update CHANGELOG with features and flags

#### 9.2 Rollout Plan
- [ ] Stage rollout via flags:
  - 0% prod (internal QA in staging)
  - 5% prod → 25% → 100%, watching dashboards
- [ ] SLOs:
  - Progress save p95 < 200ms
  - Completion rate target: > 70%
- [ ] Alerts: anomaly on drop-off between Stage 1 and 2, API error rate >= 1%

#### 9.3 Production Deployment
- [ ] Deploy to staging; enable onboarding_v1 + onboarding_redirect + intervention_cards
- [ ] Manual QA with multiple accounts:
  - Redirect correctness, RLS access (no cross-user leakage)
  - Autosave/resume, Analytics events firing, Today screen supersede behavior
- [ ] Gradual prod rollout via flags; monitor dashboards; rollback by flipping flag if issues

---

## 📋 PR STRATEGY

### PR 1: Database Foundation (✅ Ready)
**Branch:** `feat/onboarding-schema`
**Files:** migrations, types, scoring, selector
**Description:** Complete database schema, RLS policies, question bank, and business logic

### PR 2: API Layer (✅ Ready) 
**Branch:** `feat/onboarding-api`
**Files:** 4 API routes with comprehensive error handling
**Description:** RESTful endpoints for progress, questions, completion, and state

### PR 3: Feature Flags & Infrastructure (🔄 Next)
**Branch:** `feat/onboarding-infrastructure`
**Files:** feature flags, middleware updates
**Description:** Controlled rollout infrastructure and auth integration

### PR 4: Core UI Components (🔄 Future)
**Branch:** `feat/onboarding-ui`  
**Files:** wizard components, stage UIs, autosave
**Description:** Complete user interface with card-based wizard

### PR 5: Today Integration (🔄 Future)
**Branch:** `feat/onboarding-today`
**Files:** InterventionCard, today hooks, middleware redirects
**Description:** Today screen integration and intervention system

### PR 6: Memory & Analytics (🔄 Future)
**Branch:** `feat/onboarding-insights`
**Files:** memory synthesis, analytics wiring
**Description:** User memory integration and analytics infrastructure

### PR 7: Testing & Quality (🔄 Future)
**Branch:** `feat/onboarding-testing`
**Files:** unit tests, e2e tests, a11y improvements
**Description:** Comprehensive testing and quality assurance

---

## 🎯 SUCCESS METRICS

### Development Metrics
- [ ] All migrations apply cleanly in staging/prod
- [ ] API endpoints return expected responses with proper error handling
- [ ] UI components render correctly across desktop/mobile
- [ ] E2E tests pass consistently
- [ ] Accessibility score > 95% on Lighthouse

### User Experience Metrics  
- [ ] Completion rate > 70% (target from requirements)
- [ ] Average completion time < 10 minutes
- [ ] < 5% drop-off between Stage 1 and Stage 2
- [ ] Stage 2 question diversity score > 0.8
- [ ] User satisfaction score > 4.0/5.0

### Technical Performance
- [ ] Progress save p95 < 200ms
- [ ] Questions endpoint p95 < 100ms
- [ ] Zero data leakage between users (RLS verification)
- [ ] Memory synthesis completes < 2s
- [ ] Analytics events fire reliably (>99% success rate)

---

## Ethereal UI rollout plan (new)

- PR A: feat(chat): add experimental ethereal UI at /chat/ethereal (this branch)
  - Status: In progress; background image, animated gradient, Inter 100 typography, streaming animations
  - Connect to Mastra chat agent via unified /api/chat (dev streams only when NEXT_PUBLIC_IFS_DEV_MODE=true)
- PR B: feat(theme): global ethereal backdrop and typography tokens
  - Add GlobalBackdrop (image + animated blobs + vignette) to app/layout.tsx
  - Persist background across the entire app; controlled by env flag NEXT_PUBLIC_IFS_ETHEREAL_THEME=true
  - Provide fallbacks when image not present
- PR C: feat(chat): consolidate standard chat to ethereal presentation
  - Replace components/chat/* stack with ethereal presentation components
  - Remove bubbles/avatars/timestamps; align assistant left, user right; maintain tasks UI off by default
- PR D: polish: pacing, accessibility, and performance
  - Reduced-motion handling toggle; tune easing and durations; optimize background image sizes

Tracking tasks
- [ ] Global theme flag and toggles
- [ ] Switch chat page (/chat) to new presentation after theme lands
- [ ] Playwright coverage for streaming animations (assert content grows and fades)
- [ ] Docs: usage and design tokens

*Last updated: 2025-09-04*
*Total estimated effort: ~40-50 hours across 7 PRs*
