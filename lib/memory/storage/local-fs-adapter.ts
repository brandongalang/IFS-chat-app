import fs from 'fs/promises'
import path from 'path'
import type { StorageAdapter } from './adapter'

// Local storage is deprecated - use SupabaseStorageAdapter instead
const MEMORY_LOCAL_ROOT = '.data/memory-snapshots'
let hasWarnedDeprecatedAdapter = false

function resolveSafe(userPath: string) {
  const rootAbs = path.resolve(process.cwd(), MEMORY_LOCAL_ROOT)
  const full = path.resolve(rootAbs, userPath.replace(/^\/+/, ''))
  if (!full.startsWith(rootAbs + path.sep) && full !== rootAbs) {
    throw new Error('Path traversal detected')
  }
  return { rootAbs, full }
}

export class LocalFsStorageAdapter implements StorageAdapter {
  constructor() {
    if (!hasWarnedDeprecatedAdapter) {
      hasWarnedDeprecatedAdapter = true
      console.warn('[LocalFsStorageAdapter] This adapter is deprecated. Please migrate to SupabaseStorageAdapter.')
    }
  }
  async putText(userPath: string, text: string): Promise<void> {
    const { full } = resolveSafe(userPath)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, text, 'utf8')
  }
  async getText(userPath: string): Promise<string | null> {
    const { full } = resolveSafe(userPath)
    try { return await fs.readFile(full, 'utf8') } catch { return null }
  }
  async exists(userPath: string): Promise<boolean> {
    const { full } = resolveSafe(userPath)
    try { await fs.access(full); return true } catch { return false }
  }
  async list(prefix: string): Promise<string[]> {
    const { rootAbs, full } = resolveSafe(prefix)
    const out: string[] = []
    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const e of entries) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) await walk(p)
        else out.push(path.relative(rootAbs, p))
      }
    }
    try { await walk(full) } catch {}
    return out
  }
  async delete(userPath: string): Promise<void> {
    const { full } = resolveSafe(userPath)
    try { await fs.unlink(full) } catch {}
  }
}

