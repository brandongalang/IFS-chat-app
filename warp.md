# Project Rules: Development Workflow + UI Consistency

## Development Workflow (AI-Assisted)

### Auto-Development Rules (Always Active)
- **Auto-commits**: Every ~300 lines of code when tests pass
- **Commit messages**: Conventional commits with context (feat/fix/docs/chore)
- **File tracking**: Only commit changes in src/, app/, components/, lib/, config/
- **Branch detection**: When conversation indicates topic switch, suggest /fresh
- **Rich PR descriptions**: Auto-generate comprehensive context for PRs
- **Auto-documentation**: Update docs/ automatically when code changes (include in same commit/PR)

### Essential Commands (Warp Slash Commands)
- `/fresh [description]` - Start clean branch for new work
- `/sync` - Daily rebase current branch on main 
- `/cleanup` - Weekly merged branch deletion

### Commit & PR Format (Agent-Readable Context)

All commits and PR descriptions should have:
1. **Concise, human-readable description** (for reviewers and git log scanning)
2. **Detailed, agent-centric description** (for future AI context and decision history)

**Commit Message Format:**
```
feat(auth): add Google OAuth integration

Agent Context: Users requested social login to reduce friction. Chose Google over Facebook due to better enterprise support (78% of users have Google accounts vs 45% Facebook). Implementation uses OAuth 2.0 with PKCE for security. Stores tokens in httpOnly cookies, refresh handled automatically. Next: add Microsoft and Apple login options.
```

**PR Description Template:**
```markdown
## Summary
[Brief human-readable description for reviewers]

## Agent Context (Rich History)
### Why This Feature/Fix
[Business/user need that drove this work]

### Technical Decisions & Rationale  
[Why chose approach X over Y, with data/reasoning]

### Problems Encountered & Solutions
[Specific issues hit and how resolved]

### Code Architecture
[Key patterns, abstractions, integrations created]

### Future Considerations
[Known follow-ups, potential improvements, scaling concerns]

### Related Work
[Dependencies, related PRs, foundation for future features]
```

### Branch Management
- **Naming**: type/scope/short-desc (feat/auth/google-sso)
- **Scope**: Small, focused branches per feature
- **Lifetime**: Short-lived, merge quickly
- **Clean start**: Always branch from updated main

### Documentation (Auto-Maintained)
- **Auto-update**: docs/ updated automatically when related code changes
- **Include**: Documentation changes in same commit/PR as code changes
- **Context**: All reasoning captured in commit messages and PR descriptions
- **Scope**: Update API docs, README, component docs as code evolves

---

## Ethereal Theme and UI Consistency

These conventions ensure the ethereal visual style remains consistent and easy to tweak.

### 1) Use theme variables, not ad‑hoc values
- All background, vignette levels, colors/opacity, letter spacing, font weight/family, and animation timings must come from CSS variables set by the ThemeController (config/etherealTheme.ts).
- Do not hardcode hex colors, pixel values, or durations in components unless explicitly approved.

### 2) Tailwind + CSS variables
- When a Tailwind utility needs a variable, prefer dynamic utilities or style with var(--token).
  - Example: className="text-[color:var(--eth-text-color,theme(colors.white))]" or style={{ letterSpacing: 'var(--eth-letter-spacing-assistant)' }}
- If a Tailwind token is missing, extend Tailwind theme to reference CSS variables (not literals).

### 3) Background ownership
- The global background is owned by components/ethereal/GlobalBackdrop + ThemeController. Do not implement per-page backgrounds.
- Variants must be added as variables/toggles and consumed by GlobalBackdrop.

### 4) Typography
- Page fonts are provided via next/font and referenced by ThemeController's fontFamilyVar. Avoid per-component font-family overrides.
- If thinner weight is required, choose a family that supports wght 100 (e.g., Inter) and set via tokens rather than inline.

### 5) Motion and streaming
- Streaming text must read durations from --eth-word-duration and --eth-char-duration (via a hook or computed style).
- Background animation should respect prefers-reduced-motion by default. Temporary overrides must be dev-only and documented.

### 6) PR checklist for UI changes
- [ ] New/changed visuals read from theme variables (no ad-hoc literals).
- [ ] GlobalBackdrop remains the sole owner of page background.
- [ ] Streaming timing bound to CSS variables, not constants.
- [ ] Reduced-motion behavior verified; screenshots attached for mobile/desktop.
- [ ] Rich PR description includes UI reasoning and architecture decisions.

### 7) Organization
- Theme config: config/etherealTheme.ts
- Theme controller: components/ethereal/ThemeController.tsx
- All ethereal components: components/ethereal/*

### 8) Runtime overrides (dev only)
- Local testing can override tokens via localStorage (key: eth-theme). Do not commit overrides or bake them into components.

### 9) Route alignment
- Apply variables first when adjusting a route (Today, Chat, Onboarding). Avoid structural refactors in the same PR.

### 10) Accessibility
- Maintain contrast with variables (text opacity, vignette). Do not patch individual components unless necessary.
