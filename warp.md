# Project rules: Ethereal theme and UI consistency

These conventions ensure the ethereal visual style remains consistent and easy to tweak.

1) Use theme variables, not ad‑hoc values
- All background, vignette levels, colors/opacity, letter spacing, font weight/family, and animation timings must come from CSS variables set by the ThemeController (config/etherealTheme.ts).
- Do not hardcode hex colors, pixel values, or durations in components unless explicitly approved.

2) Tailwind + CSS variables
- When a Tailwind utility needs a variable, prefer dynamic utilities or style with var(--token).
  - Example: className="text-[color:var(--eth-text-color,theme(colors.white))]" or style={{ letterSpacing: 'var(--eth-letter-spacing-assistant)' }}
- If a Tailwind token is missing, extend Tailwind theme to reference CSS variables (not literals).

3) Background ownership
- The global background is owned by components/ethereal/GlobalBackdrop + ThemeController. Do not implement per-page backgrounds.
- Variants must be added as variables/toggles and consumed by GlobalBackdrop.

4) Typography
- Page fonts are provided via next/font and referenced by ThemeController’s fontFamilyVar. Avoid per-component font-family overrides.
- If thinner weight is required, choose a family that supports wght 100 (e.g., Inter) and set via tokens rather than inline.

5) Motion and streaming
- Streaming text must read durations from --eth-word-duration and --eth-char-duration (via a hook or computed style).
- Background animation should respect prefers-reduced-motion by default. Temporary overrides must be dev-only and documented.

6) PR checklist for UI changes
- [ ] New/changed visuals read from theme variables (no ad-hoc literals).
- [ ] GlobalBackdrop remains the sole owner of page background.
- [ ] Streaming timing bound to CSS variables, not constants.
- [ ] Feature flags used when introducing global theme changes (NEXT_PUBLIC_IFS_ETHEREAL_THEME).
- [ ] Reduced-motion behavior verified; screenshots attached for mobile/desktop.

7) Organization
- Theme config: config/etherealTheme.ts
- Theme controller: components/ethereal/ThemeController.tsx
- All ethereal components: components/ethereal/*

8) Runtime overrides (dev only)
- Local testing can override tokens via localStorage (key: eth-theme). Do not commit overrides or bake them into components.

9) Route alignment
- Apply variables first when adjusting a route (Today, Chat, Onboarding). Avoid structural refactors in the same PR.

10) Accessibility
- Maintain contrast with variables (text opacity, vignette). Do not patch individual components unless necessary.
