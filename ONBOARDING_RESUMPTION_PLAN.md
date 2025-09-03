# IFS User Onboarding Implementation - Resumption Plan

## 📋 Current Status (Updated: 2025-09-03)

### ✅ **COMPLETED FOUNDATION (2 commits)**
- **Commit 1 (`3cf277e`)**: Database schema, RLS policies, question bank, TypeScript types, Zod schemas, scoring engine
- **Commit 2 (`9e03eaa`)**: Complete API layer with 4 endpoints (progress, questions, complete, state)

### 🎯 **RESUMPTION POINT - 18 Tasks Created**

The implementation has been organized into TaskMaster with dedicated "onboarding" tag containing 18 tasks across 9 phases:

## 🚀 **IMMEDIATE NEXT STEPS**

### **Ready to Start: Task #1 (HIGH Priority)**
**Feature Flag System Setup** - No dependencies, ready to begin immediately
- Add flags: `onboarding_v1`, `onboarding_redirect`, `intervention_cards`  
- Create typed helpers in `lib/flags/index.ts`
- Environment defaults: off in prod, on in staging
- Gate all onboarding routes and middleware

### **Critical Path (Tasks 1-7)**
The high-priority tasks form the critical user experience path:
1. ✅ Feature flags (Task #1) - **START HERE**
2. ✅ Auth middleware integration (Task #2) 
3. ✅ Onboarding wizard foundation (Task #3)
4. ✅ Stage 1 UI - 5 fixed probes (Task #4)
5. ✅ Stage 2 UI - 4 adaptive questions (Task #5) 
6. ✅ Stage 3 UI - somatic & belief mapping (Task #6)
7. ✅ Autosave & resumability (Task #7)

## 📊 **TASK ORGANIZATION**

### **Phase Breakdown**
- **Phase 1-2**: Infrastructure (Tasks 1-2) - 🔴 HIGH priority
- **Phase 3**: Core UI (Tasks 3-7) - 🔴 HIGH priority  
- **Phase 4**: Today Integration (Tasks 8-9) - 🟡 MEDIUM priority
- **Phase 5**: Memory & Analytics (Tasks 10-11) - 🟡 MEDIUM priority
- **Phase 6-9**: Security, Testing, Docs, Rollout (Tasks 12-18) - 🟢 LOW priority

### **Dependency Structure**
- Tasks 1-2: Sequential foundation
- Tasks 3-7: UI development chain (depends on 1-2)
- Tasks 8-11: Parallel integration work (depends on UI)
- Tasks 12-18: Quality, testing, deployment (depends on core features)

## 🛠 **USING TASKMASTER**

### **Switch to Onboarding Context**
```bash
# Switch to onboarding tag
tm use-tag onboarding

# View next available task
tm next

# View all onboarding tasks
tm get-tasks
```

### **Working on Tasks**
```bash
# Set task as in-progress
tm set-status 1 in-progress

# Update task with progress notes  
tm update-task 1 "Implemented feature flag infrastructure with typed helpers..."

# Mark complete when done
tm set-status 1 done
```

### **Task Dependencies**
- Each task clearly lists its dependencies
- TaskMaster will suggest the next available task based on completed dependencies
- No task can start until its dependencies are complete

## 📁 **PR STRATEGY (Updated)**

Based on the original plan, tasks will be grouped into these PRs:

### **PR 3: Feature Flags & Infrastructure** (Tasks 1-2)
- **Branch**: `feat/onboarding-infrastructure` 
- **Files**: feature flags, middleware updates
- **Ready**: When tasks 1-2 are complete

### **PR 4: Core UI Components** (Tasks 3-7)
- **Branch**: `feat/onboarding-ui`
- **Files**: wizard components, stage UIs, autosave
- **Ready**: When tasks 3-7 are complete

### **PR 5: Today Integration** (Tasks 8-9)
- **Branch**: `feat/onboarding-today`
- **Files**: InterventionCard, today hooks
- **Ready**: When tasks 8-9 are complete

### **PR 6: Memory & Analytics** (Tasks 10-11)
- **Branch**: `feat/onboarding-insights`
- **Files**: memory synthesis, analytics
- **Ready**: When tasks 10-11 are complete

### **PR 7: Testing & Quality** (Tasks 12-15)
- **Branch**: `feat/onboarding-testing`
- **Files**: unit tests, e2e tests, a11y
- **Ready**: When tasks 12-15 are complete

## 🎯 **SUCCESS METRICS**

### **Immediate Goals (Next 2 weeks)**
- [ ] Complete Tasks 1-7 (Critical Path)
- [ ] Functional onboarding flow end-to-end
- [ ] Feature flags working in staging
- [ ] Basic UI wizard with all 3 stages

### **Medium-term Goals (Following 2 weeks)**  
- [ ] Complete Tasks 8-11 (Integration)
- [ ] Today screen integration working
- [ ] Memory synthesis functional
- [ ] Analytics tracking implemented

### **Production Readiness (Final 2 weeks)**
- [ ] Complete Tasks 12-18 (Quality & Rollout)
- [ ] Full test coverage
- [ ] Security hardening
- [ ] Documentation complete
- [ ] Staged rollout plan ready

## 🔄 **RESUMPTION WORKFLOW**

1. **Immediate Action**: Start with Task #1 (Feature Flags)
2. **Follow TaskMaster**: Use `tm next` to get next available task
3. **Sequential Execution**: Complete high-priority tasks 1-7 first
4. **Parallel Development**: Tasks 8-11 can be done in parallel after core UI
5. **Quality Phase**: Tasks 12-18 for testing and production readiness

## 📝 **NOTES**

- Original plan.md remains as historical reference
- All task details expanded with comprehensive acceptance criteria
- Dependencies properly mapped to ensure logical development flow  
- Can switch back to main development with `tm use-tag master`
- Each completed task should be committed following the conventional commit format

---

**Total Effort Estimate**: ~40-50 hours across 7 PRs  
**Current Progress**: Foundation complete (2/7 PRs), 18 tasks queued for implementation  
**Next Action**: Execute `tm set-status 1 in-progress` and begin feature flag implementation
