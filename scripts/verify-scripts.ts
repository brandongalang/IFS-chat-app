#!/usr/bin/env tsx
/*
  scripts/verify-scripts.ts
  Verifies that package.json scripts referencing files (e.g., "tsx scripts/xyz.ts") point to existing files.
  Exits non-zero if any missing files are found.
*/

import fs from 'fs'
import path from 'path'

function main() {
  const pkgPath = path.resolve(process.cwd(), 'package.json')
  const pkgRaw = fs.readFileSync(pkgPath, 'utf8')
  const pkg = JSON.parse(pkgRaw)

  const scripts: Record<string, string> = pkg.scripts || {}
  const missing: { name: string; file: string }[] = []

  const FILE_PATTERN = /(scripts\/[\w\-\/\.]+\.(ts|js))/

  for (const [name, cmd] of Object.entries(scripts)) {
    if (name === 'scripts:verify') continue
    const match = cmd.match(FILE_PATTERN)
    if (!match) continue
    const fileRel = match[1]
    const fileAbs = path.resolve(process.cwd(), fileRel)
    if (!fs.existsSync(fileAbs)) {
      missing.push({ name, file: fileRel })
    }
  }

  if (missing.length > 0) {
    console.error('\nMissing script files detected:')
    for (const m of missing) {
      console.error(`- ${m.name} → ${m.file}`)
    }
    console.error('\nFailing verification. Please fix or remove these scripts.')
    process.exit(1)
  }

  console.log('✅ All referenced script files exist.')
}

main()

