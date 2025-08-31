#!/usr/bin/env tsx
/*
  scripts/verify-migrations.ts
  Verifies supabase/migrations filenames and flags duplicate numeric prefixes (e.g., two files starting with 007_...).
*/

import fs from 'fs'
import path from 'path'

function main() {
  const dir = path.resolve(process.cwd(), 'supabase', 'migrations')
  if (!fs.existsSync(dir)) {
    console.log('No supabase/migrations directory found. Nothing to verify.')
    return
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql'))
  const byPrefix = new Map<string, string[]>()

  for (const f of files) {
    const m = f.match(/^(\d{3,})_/)
    if (!m) continue
    const prefix = m[1]
    const list = byPrefix.get(prefix) || []
    list.push(f)
    byPrefix.set(prefix, list)
  }

  let duplicates = 0
  for (const [prefix, list] of byPrefix.entries()) {
    if (list.length > 1) {
      duplicates++
      console.warn(`Duplicate prefix ${prefix}:`)
      for (const f of list.sort()) console.warn(`  - ${f}`)
    }
  }

  if (duplicates > 0) {
    console.warn(`\nFound ${duplicates} duplicate prefix group(s). See supabase/MIGRATIONS.md for guidance.`)
  } else {
    console.log('✅ No duplicate migration prefixes found.')
  }
}

main()
