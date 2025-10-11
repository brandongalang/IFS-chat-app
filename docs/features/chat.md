---
title: Feature: Chat
owner: @brandongalang
status: shipped
last_updated: 2025-10-11
feature_flag: null
code_paths:
  - app/chat/page.tsx
  - app/api/chat/route.ts
  - app/_shared/hooks/useChat.ts
  - components/ethereal/EtherealChat.tsx
  - components/ethereal/EtherealMessageList.tsx
  - components/ethereal/markdown/StreamingMarkdown.tsx
  - components/tasks/TaskList.tsx
  - components/ai-elements/tool.tsx
  - components/ai-elements/code-block.tsx
related_prs:
  - #34
  - #292
  - #293
  - #267
  - #302
---

## What
The conversational interface for interacting with the IFS companion.

## Why
Enables guided self-reflection, parts work, and agent-assisted workflows.

## How it works
- UI at app/chat/page.tsx with streaming responses
- `useChat` consumes AI SDK UI message parts (text/tool/data) and streams via `DefaultChatTransport`, yielding a single assistant response per turn while preserving token-by-token rendering; tool/dynamic parts now map into Task events keyed by tool call, with simplified status copy (`Looking through my notes…`, `Writing notes…`) and previews sourced from tool input/output.
- End-session requests now run through a lightweight state machine (`'idle'` → `'closing'` → `'cleanup'` → `'ended'` → `'idle'`) so the composer locks while the closing prompt streams, then automatically resets after 1.5s to allow starting a new session without page refresh, preventing stuck input when streaming completes or fails.
  - **Session restart fix (PR #292)**: Separated 'ended' → 'idle' transition into dedicated effect to prevent timer cancellation, ensuring composer reliably re-enables after cleanup
  - Session status message ("ending session…") includes `role="status"` and `aria-live="polite"` for screen reader accessibility
- **Tool display**: Active tools show friendly labels via `friendlyToolLabel` fallback when tool names aren't explicitly provided (e.g., "Searching notes…" instead of raw IDs)
- Client data access uses `@/lib/data/parts-lite` (browser-safe)
- Server routes/actions use `@/lib/data/parts-server` for writes, logging, and snapshots
- Agent actions are logged via lib/database/action-logger.ts (server-only); task updates arrive via `data-taskUpdate` parts and tool event streams.
- The active task overlay now anchors above the streaming assistant message, hiding raw tool cards when task metadata is present so Tasks become the primary representation.

## Data model
- sessions, messages, agent_actions tables

## Configuration
- Env vars for model/provider configuration (names only in code); see project env

## Testing
- Unit tests around parsing/format functions where present
- Add Playwright coverage for core chat flows (send message, receive response)

## Operational notes
- Ensure action logging remains enabled for auditability

## UI/UX notes
- Messages area top padding increased from 16px to 40px (2025-01-11) to prevent first message from being cut off at viewport edge
- Active task overlay position adjusted proportionally to align with new padding

## Markdown Rendering (2025-10-11)
- **Assistant messages** now render markdown using `streamdown` v1.4.0 (Vercel's streaming-optimized markdown renderer)
- **User messages** remain plain text with no markdown processing
- **Progressive streaming**: Markdown renders incrementally as content streams in from the AI
- **Supported markdown features**:
  - Headings (h1-h6) with stepped sizing and white text
  - Text formatting: **bold**, *italic*, inline `code`
  - Links with hover states and focus rings for accessibility
  - Ordered and unordered lists
  - Blockquotes with subtle background and left border
  - Tables with striped rows and bordered cells
  - Horizontal rules
  - Fenced code blocks with syntax highlighting via `CodeBlock` component
    - Supports multiple languages (TypeScript, JavaScript, Python, Bash, etc.)
    - Copy-to-clipboard button in white/translucent style
- **Ethereal theming**: All markdown elements styled with white/translucent colors to match the ethereal aesthetic
  - White text with varying opacity levels (90-100%)
  - Translucent backgrounds (white/5-10%)
  - Subtle borders (white/15-30%)
- **Performance**: Memoized component map prevents unnecessary re-renders during streaming
- **Accessibility**: Maintains `aria-live="polite"` for screen reader support

## Mobile Responsiveness (PR #267)
- **Chat page layout**: Uses dynamic viewport height (`dvh`) to accommodate mobile browser chrome (address bar, bottom nav)
- **Touch targets**: Send button (56×56px) and End Session button (48px height, full width) meet WCAG 2.5.5 AA guidelines (44×44px minimum)
- **Input ergonomics**: Textarea min-height 52px with 14px base font prevents zoom on iOS; rounded corners (12px) improve visual comfort
- **Session state**: Removed redundant `isClosing` checks from disabled conditions—`sessionClosed` already captures all non-idle states
- **Safe areas**: Chat interface respects device notches and home indicators via `safe-area-inset-*` padding (see `app/globals.css`)
