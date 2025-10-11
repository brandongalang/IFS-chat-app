# Ethereal Theme

The ethereal visual style is controlled centrally via ThemeController and CSS variables.

## Development Override

Override theme settings without redeploying:

```js
// In browser console
localStorage.setItem('eth-theme', JSON.stringify({ enabled: 1 })) // or 0 to hide backdrop
// Change background image (must exist in /public)
localStorage.setItem('eth-theme', JSON.stringify({ imageUrl: '/ethereal-bg.jpg' }))
location.reload()
```

## Configuration

Central tokens live in `config/etherealTheme.ts`:
- Background image URL, vignette levels, blob colors/positions
- Text opacities and letter spacing (assistant/user)
- Animation timings (word/char fade, streaming cadence)

## Implementation Notes

- Components consume CSS variables; avoid hardcoding visuals in components
- See `docs/ops/warp-workflow.md` for rules and a PR checklist
