# Chat UI Alignment Review

**Bead ID:** ifs-chat-app-22  
**Status:** In Progress  
**Created:** 2025-10-18  
**Related Docs:** `docs/current/features/chat.md`, `docs/planning/next/feat-inbox-to-chat-bridge.md`

---

## Context

The `/chat` experience still uses the legacy “Ethereal” presentation (full-bleed background image, glassmorphism, italic typography). Recent builds across Today, Inbox, and Garden now lean on the shared `PageContainer`, card surfaces, and muted foreground tones. The mismatch causes the chat surface to feel like a different product. This session audits the current chat layout and produces a concrete alignment plan.

## Todo

- [x] Inventory chat page structure, message list, and input bar styling.
- [x] Compare layout, typography, and chrome against `/today`, `/inbox`, `/garden`.
- [x] Document specific deltas (colors, spacing, component patterns, motion).
- [x] Propose stepwise plan to adopt shared design primitives and retire bespoke assets.

## Current Observations

- `app/chat/page.tsx` wraps `EtherealChat` with a full-height container bound to an Inter font variable not used elsewhere.
- `EtherealChat` layers `BackgroundImageLayer`, `GradientBackdrop`, and a vignette, creating a saturated teal/peach scene unlike the neutral `bg-background` surfaces on other tabs.
- Message bubbles (`EtherealMessageList`) rely on translucent whites (`bg-white/12`, `text-white/95`) and italic, large-body text; user messages force lowercase, diverging from standard typography.
- The input tray is a floating rounded pill with glassmorphism, uppercase button labels, and custom white-on-dark buttons instead of `Button` variants/semantic colors.
- Tool headers reuse `Tool` component but override base hues with white-on-glass tokens; session state chip uses bespoke styling.
- Global backdrop already draws a tinted gradient; the chat page duplicates similar visuals locally, compounding the effect.

## Preliminary Alignment Directions

- **Background & Layout:** Shift to `PageContainer`-driven layout with `bg-background` and `border-border/40` surfaces, relying on the global backdrop for subtle ambience instead of a dedicated background image per page.
- **Typography:** Restore default sentence casing and type scale (`text-base`, `leading-7`, weight utilities). Remove forced lowercase on user messages and italic assistant body copy; use existing text tokens from Inbox/Garden (`text-muted-foreground` etc.).
- **Message Surfaces:** Replace translucent bubbles with card-like containers (`bg-card/90`, `border-border/40`). Consider aligning assistant/user differentiation via accent border or background tint similar to Inbox cards.
- **Input Zone:** Anchor composer to the safe-area bottom but restyle using shared `Card`/`Button` patterns (`variant="secondary"` for end session, `variant="default"` for submit) and `Textarea` with `bg-background`, `border-input`.
- **Theming Hooks:** Evaluate whether `EtherealChat` should adopt shared theme vars (remove bespoke Inter font, rely on root typography). If gradients remain, expose them through `config/etherealTheme` so we can tune page-specific palette in one place.
- **Motion & Framing:** Reuse existing micro-interaction patterns (subtle hover/scale) while reducing large blur animations that differ from Today/Garden transitions.

## Open Questions

- Do we still need a dedicated ethereal background on `/chat`, or can the global backdrop adapt per route with softer tokens?
- Should assistant responses retain any unique styling (e.g., serif/italic) to signal “agent voice,” or do we move fully to system typography?
- Could shared components (e.g., `MessageList`, `Composer`) live under `components/chat/` with theme props so Inbox-to-chat bridge can reuse them?

## Implementation Notes (2025-10-18)

- Replaced the absolute-positioned glassmorphic shell with a `PageContainer`-driven layout that mirrors Today/Garden spacing, safe-area handling, and card surfaces.
- Restyled assistant/user bubbles to use shared card and accent tokens, removed forced lowercase/italic treatments, and aligned task overlays with `muted`/`border` palette values.
- Rebuilt the composer using standard `Button` and `Textarea` variants; end-session and send affordances now match the broader UI kit while preserving AI SDK streaming behaviour.
- Dropped the page-specific Inter font variable so chat inherits the global typography stack; visuals now rely on `defaultEtherealTheme` gradient controls rather than per-page background layers.
