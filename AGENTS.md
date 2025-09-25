# Agent Guidelines

- Prefer GitHub CLI (`gh`) for creating and updating pull requests from this repository.
- Document any deviations from standard workflows in this file so future agents stay aligned.
- 2025-09-25: Project-wide `npm run typecheck` still fails because of legacy UI issues. For Mastra-only edits, validate via a focused `tsc` run (temporarily extend `tsconfig.json` with `include: ["mastra/**/*.ts"]`) until the app-wide errors are resolved.
