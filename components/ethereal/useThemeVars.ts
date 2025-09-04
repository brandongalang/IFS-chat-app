export function readNumberVar(name: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}
