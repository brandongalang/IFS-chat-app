# Memory v2 — Markdown Tools (md.*)

This PR introduces minimal Markdown helpers used by the agent toolbelt:

- listSections(text): returns [{ anchor, heading, start, end }] using canonical H2 headings + hidden anchor markers.
- patchSectionByAnchor(text, anchor, { replace?, append? }): applies text changes and returns { text, beforeHash, afterHash }.
- lintMarkdown(text): basic checks (anchors under H2, soft caps like Evidence ~7 items).
- editMarkdownSection(path, anchor, change): adapter-based read/patch/write using StorageAdapter; returns lint + hashes.

Smoke test
```bash
# Local dev
MEMORY_STORAGE_ADAPTER=local IFS_DEFAULT_USER_ID=00000000-0000-0000-0000-000000000000 npm run smoke:md

# Supabase Storage
MEMORY_STORAGE_ADAPTER=supabase NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... IFS_DEFAULT_USER_ID=00000000-0000-0000-0000-000000000000 npm run smoke:md
```

Notes
- **Updated**: Markdown write operations now log via `lib/memory/markdown/logging.ts`, which computes SHA-256 hashes, infers entity context, and emits `profile_update` events. Logging is non-fatal (errors are swallowed) to ensure writes always succeed.
- Section targeting relies on canonical anchors (e.g., `<!-- @anchor: current_focus v1 -->`).
- `patchSectionByAnchor` returns `{ text, beforeHash, afterHash }` which are now used by the logging instrumentation to track integrity.

