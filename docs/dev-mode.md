# Dev Mode and Feature Flags

This app uses a simple feature flag system to gate routes (e.g., Insights, Garden, Journey) while they’re being built. Dev mode makes local iteration easier by enabling non-production areas without flipping each flag.

## Feature gate behavior
- Central config: `config/features.ts` (use `isDevMode()` helper for checks)
- Status values: `enabled | coming_soon | disabled`
- In dev mode, any feature that is not `disabled` is treated as `enabled` on the client.

## How to enable dev mode
- Preferred: set an environment variable
  - `NEXT_PUBLIC_IFS_DEV_MODE=true` (works both client and server)
  - Or rely on `NODE_ENV=development`, which enables dev mode by default.

- Optional: UI toggle (client-side)
  - Controlled by `NEXT_PUBLIC_IFS_SHOW_DEV_TOGGLE`.
  - When shown, the home header displays an “Enable Dev Mode” control. Clicking it sets a local override and reloads the page.
  - The local override uses `localStorage.IFS_DEV_MODE`, which is respected by `statusForPath()` on the client.

## Environment variables
- `NEXT_PUBLIC_IFS_DEV_MODE` (boolean)
  - When `true`, dev mode is on everywhere (SSR + CSR).
  - Default: `false` unless `NODE_ENV === 'development'`.
- `NEXT_PUBLIC_IFS_SHOW_DEV_TOGGLE` (boolean)
  - Controls whether to show the in-app “Enable Dev Mode” button.
  - Default: shown in development, hidden in production.

### Migration note
- We removed the server-only `IFS_DEV_MODE`. Use `NEXT_PUBLIC_IFS_DEV_MODE` instead for consistency across client and server.

## Security and production guidance
- Do not enable dev mode in production unless you intend to grant access to gated areas.
- The UI toggle should remain hidden in production (default) to prevent accidental override via localStorage.
- Never commit real secrets. `.env.local` remains gitignored; use `.env.example` for documentation.

## Troubleshooting
- “Toggle does nothing”: ensure `NEXT_PUBLIC_IFS_SHOW_DEV_TOGGLE=true` and verify localStorage permission is available. In production, the toggle is usually hidden.
- “Feature still says Coming Soon”: verify the feature isn’t marked `disabled` in `config/features.ts` and that dev mode is actually enabled (via env or local override).
