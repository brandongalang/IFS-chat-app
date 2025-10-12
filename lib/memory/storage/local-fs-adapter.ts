import fs from 'fs/promises'
import path from 'path'
import type { StorageAdapter } from './adapter'
import { MEMORY_LOCAL_ROOT } from '../config'

function resolveSafe(userPath: string) {
  const rootAbs = path.resolve(process.cwd(), MEMORY_LOCAL_ROOT)
  const full = path.resolve(rootAbs, userPath.replace(/^\/+/, ''))
  if (!full.startsWith(rootAbs + path.sep) && full !== rootAbs) {
    throw new Error('Path traversal detected')
  }
  return { rootAbs, full }
}

export class LocalFsStorageAdapter implements StorageAdapter {
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
    try {
      await fs.mkdir(full, { recursive: true })
      await walk(full)
    } catch (e) {
      // Errors are swallowed here to prevent crashes if the directory is unreadable,
      // which is consistent with the original behavior of this function. The goal is
      // to return an empty list of parts rather than crashing the sync process.
    }
    return out
  }
  async delete(userPath: string): Promise<void> {
    const { full } = resolveSafe(userPath)
    try { await fs.unlink(full) } catch {}
  }
}

